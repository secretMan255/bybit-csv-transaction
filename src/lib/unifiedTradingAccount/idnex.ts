// src/lib/unifiedTradingAccount/unifiedTradingAccount.ts

import type { FeesBreakdown, ParsedRow, ParseResult } from "@/page/dashboard";
import { toUpper } from "../utils";
import type { CoinPosition, CoinTradeSummary, TradeCoinsResult } from "./type";

export function isBybitAssetChangeDetailsUtaCsv(file: File) {
  const name = file.name.trim();
  return /^Bybit_AssetChangeDetails_uta_/i.test(name) && /\.csv$/i.test(name);
}

function normalizeText(input: string) {
  let text = input ?? "";
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseCsvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  return rows;
}

function cleanHeader(h: string) {
  return (h ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKey(h: string) {
  return cleanHeader(h)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseNumberMaybe(v: string): number {
  const s = (v ?? "").trim();
  if (!s) return 0;

  const isParenNeg = /^\(.*\)$/.test(s);
  const core = isParenNeg ? s.slice(1, -1) : s;

  const cleaned = core.replace(/[, ]/g, "").replace(/[^\d.+-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+") return 0;

  const n = Number(cleaned);
  if (Number.isNaN(n)) return 0;
  return isParenNeg ? -n : n;
}

function pickColumnIndex(
  headers: string[],
  candidates: string[]
): number | null {
  const normHeaders = headers.map(normalizeKey);
  for (const cand of candidates) {
    const idx = normHeaders.indexOf(cand);
    if (idx >= 0) return idx;
  }
  return null;
}

function findHeaderRowIndex(matrix: string[][]): number {
  const maxScan = Math.min(matrix.length, 30);

  for (let i = 0; i < maxScan; i++) {
    const keys = matrix[i].map(cleanHeader).map(normalizeKey);

    const score = [
      keys.includes("uid") || keys.includes("userid"),
      keys.some((k) => k.includes("date")),
      keys.includes("coin") ||
        keys.includes("asset") ||
        keys.includes("currency"),
      keys.includes("qty") ||
        keys.includes("amount") ||
        keys.includes("quantity"),
    ].filter(Boolean).length;

    if (score >= 3) return i;
  }

  return 0;
}

const CANDIDATES = {
  time: ["dateandtimeutc", "datetimeutc", "datetime", "date", "time"],
  symbol: ["asset", "coin", "currency", "symbol"],
  category: ["type", "category", "side"],
  account: ["account", "accounttype", "wallet", "chain", "status"],
  qty: ["qty", "quantity"],
  amount: ["amount", "qty", "quantity"],
  revenue: ["revenue", "income", "pnl", "realizedpnl", "realizedpl", "profit"],
  cost: ["cost", "fee", "fees", "commission", "tradingfee"],
  relieved: ["relieved", "released", "settled", "realized"],
  unrelieved: [
    "unrelieved",
    "unreleased",
    "unsettled",
    "unrealized",
    "unrealizedpnl",
    "unrealizedpl",
  ],
};

export function parseCsv(input: string): ParseResult {
  const warnings: string[] = [];
  const matrix = parseCsvToMatrix(normalizeText(input));

  if (matrix.length === 0) {
    return { headers: [], rows: [], warnings: ["CSV appears empty."] };
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  if (headerRowIndex > 0) {
    warnings.push(`Skipped ${headerRowIndex} metadata row(s) before header.`);
  }

  const headers = matrix[headerRowIndex].map(cleanHeader);
  const dataRows = matrix.slice(headerRowIndex + 1);

  const idxTime = pickColumnIndex(headers, CANDIDATES.time);
  const idxSymbol = pickColumnIndex(headers, CANDIDATES.symbol);
  const idxCategory = pickColumnIndex(headers, CANDIDATES.category);
  const idxAccount = pickColumnIndex(headers, CANDIDATES.account);
  const idxQty = pickColumnIndex(headers, CANDIDATES.qty);
  const idxAmount = pickColumnIndex(headers, CANDIDATES.amount);
  const idxRevenue = pickColumnIndex(headers, CANDIDATES.revenue);
  const idxCost = pickColumnIndex(headers, CANDIDATES.cost);
  const idxRelieved = pickColumnIndex(headers, CANDIDATES.relieved);
  const idxUnrelieved = pickColumnIndex(headers, CANDIDATES.unrelieved);

  const hasExplicitMetrics =
    idxRevenue !== null ||
    idxCost !== null ||
    idxRelieved !== null ||
    idxUnrelieved !== null;

  if (!hasExplicitMetrics && idxAmount !== null && idxCategory !== null) {
    warnings.push(
      "Detected Withdraw/Deposit History. Using Type+Amount: revenue=Deposit, cost=Withdraw."
    );
  } else if (!hasExplicitMetrics && idxQty !== null) {
    warnings.push(
      "Detected Asset Change Details. Using QTY sign: revenue=positive, cost=negative."
    );
  }

  // 你目前 Dashboard 只用 raw + category，所以我保持与你一致
  const rows: ParsedRow[] = dataRows
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((cols, i) => {
      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => (raw[h] = cols[idx] ?? ""));
      const get = (idx: number | null) => (idx === null ? "" : cols[idx] ?? "");

      return {
        __rowId: String(i + 1),
        category: get(idxCategory).trim() || undefined,
        raw,
      };
    });

  return { headers, rows, warnings };
}

export function getLastWalletBalance(rows: ParsedRow[]) {
  const first = rows.find((row) => {
    const value = row.raw["Wallet Balance"];
    return value != null && String(value).trim() !== "";
  });

  if (!first) return 0;
  return parseNumberMaybe(String(first.raw["Wallet Balance"] ?? ""));
}

export function feePaidToUSDT(row: ParsedRow): number {
  const feeNative = parseNumberMaybe(String(row.raw["Fee Paid"] ?? ""));
  if (!feeNative) return 0;

  const currency = toUpper(row.raw["Currency"] ?? "");
  const contract = toUpper(row.raw["Contract"] ?? "");
  const filledPrice = parseNumberMaybe(String(row.raw["Filled Price"] ?? ""));

  if (currency === "USDT") return feeNative;

  if (contract.endsWith("USDT") && filledPrice) {
    const base = contract.slice(0, -4);
    if (base === currency) return feeNative * filledPrice;
  }

  return 0;
}

export function feesPaid(rows: ParsedRow[]): FeesBreakdown {
  let tradingFeesUSDT = 0;
  let fundingPaidUSDT = 0;
  let fundingReceivedUSDT = 0;
  let feeRefundUSDT = 0;

  for (const row of rows) {
    const type = toUpper(row.raw["Type"] ?? row.category ?? "");

    // A) Trading fee
    if (type === "TRADE") {
      tradingFeesUSDT += feePaidToUSDT(row); // 保留原符号（通常为负）
    }

    // B) Funding: SETTLEMENT
    if (type === "SETTLEMENT") {
      const funding = parseNumberMaybe(String(row.raw["Funding"] ?? ""));
      if (funding < 0) fundingPaidUSDT += funding;
      else if (funding > 0) fundingReceivedUSDT += funding;
    }

    // C) Fee refund: FEE_REFUND
    if (type === "FEE_REFUND") {
      const refund = parseNumberMaybe(String(row.raw["Change"] ?? ""));
      feeRefundUSDT += refund;
    }
  }

  // signed net
  const netFeesUSDT = tradingFeesUSDT + fundingPaidUSDT + feeRefundUSDT;

  // display cost
  const tradingCostUSDT = Math.max(0, -tradingFeesUSDT);
  const fundingCostUSDT = Math.max(0, -fundingPaidUSDT);
  const netCostUSDT = Math.max(
    0,
    tradingCostUSDT + fundingCostUSDT - feeRefundUSDT
  );

  return {
    tradingFeesUSDT,
    fundingPaidUSDT,
    fundingReceivedUSDT,
    feeRefundUSDT,
    netFeesUSDT,
    tradingCostUSDT,
    fundingCostUSDT,
    netCostUSDT,
  };
}

/**
 * 1) bought:  买过的 coin（TRADE + BUY + base coin + change>0）
 * 2) sold:    卖过的 coin（TRADE + SELL + base coin + change<0）
 * 3) positions: 合并买/卖后的持仓分类（OPEN/CLOSED/PARTIAL）
 *
 * 说明：
 * - UTA AssetChangeDetails 一笔 trade 通常会拆为两条腿：
 *   - quote(USDT/USDC) 变化
 *   - base(如 ADA) 变化
 * - 我们用 contract+direction 作为 bucket，把两条腿聚合起来计算均价。
 */
export function getTradedCoinsFromUtaAssetChange(
  rows: ParsedRow[]
): TradeCoinsResult {
  const QUOTE_COINS = new Set(["USDT", "USDC", "USD"]);
  const eps = 1e-12;

  type Bucket = {
    contract: string;
    direction: "BUY" | "SELL";
    baseCoin?: string; // e.g. ADA
    quoteCoin: string; // e.g. USDT
    baseQtyAbs: number; // abs(base change)
    quoteAmtAbs: number; // abs(quote change)
  };

  const bucketMap = new Map<string, Bucket>();

  const ensureBucket = (contract: string, direction: "BUY" | "SELL") => {
    const key = `${contract}|${direction}`;
    const exist = bucketMap.get(key);
    if (exist) return exist;

    const b: Bucket = {
      contract,
      direction,
      quoteCoin: "USDT",
      baseQtyAbs: 0,
      quoteAmtAbs: 0,
    };
    bucketMap.set(key, b);
    return b;
  };

  for (const row of rows) {
    const type = toUpper(row.raw["Type"] ?? row.category ?? "");
    if (type !== "TRADE") continue;

    const direction = toUpper(row.raw["Direction"] ?? row.raw["Side"] ?? "");
    if (direction !== "BUY" && direction !== "SELL") continue;

    const currency = toUpper(row.raw["Currency"] ?? "");
    const contract = toUpper(row.raw["Contract"] ?? row.raw["Symbol"] ?? "");
    if (!currency || !contract) continue;

    const change = parseNumberMaybe(String(row.raw["Change"] ?? ""));
    if (Math.abs(change) <= eps) continue;

    const b = ensureBucket(contract, direction);

    // quote leg
    if (QUOTE_COINS.has(currency)) {
      b.quoteCoin = currency || b.quoteCoin;
      b.quoteAmtAbs += Math.abs(change);
      continue;
    }

    // base leg
    b.baseCoin = currency;
    b.baseQtyAbs += Math.abs(change);
  }

  const buyMap = new Map<string, CoinTradeSummary>();
  const sellMap = new Map<string, CoinTradeSummary>();

  const upsert = (
    map: Map<string, CoinTradeSummary>,
    base: string,
    quote: string,
    qty: number,
    quoteAmt: number
  ) => {
    const key = `${base}|${quote}`;
    const prev = map.get(key);
    const totalQty = (prev?.totalQty ?? 0) + qty;
    const totalQuoteAmount = (prev?.totalQuoteAmount ?? 0) + quoteAmt;
    const avgPrice = totalQty > eps ? totalQuoteAmount / totalQty : 0;

    map.set(key, {
      coin: base,
      quote,
      totalQty,
      totalQuoteAmount,
      avgPrice,
      trades: (prev?.trades ?? 0) + 1,
    });
  };

  for (const b of bucketMap.values()) {
    if (!b.baseCoin) continue;
    if (b.baseQtyAbs <= eps) continue;

    if (b.direction === "BUY")
      upsert(buyMap, b.baseCoin, b.quoteCoin, b.baseQtyAbs, b.quoteAmtAbs);
    else upsert(sellMap, b.baseCoin, b.quoteCoin, b.baseQtyAbs, b.quoteAmtAbs);
  }

  const bought = Array.from(buyMap.values()).sort((a, c) =>
    a.coin.localeCompare(c.coin)
  );
  const sold = Array.from(sellMap.values()).sort((a, c) =>
    a.coin.localeCompare(c.coin)
  );

  // positions
  const allKeys = new Set<string>([...buyMap.keys(), ...sellMap.keys()]);
  const positions: CoinPosition[] = [];

  for (const key of allKeys) {
    const buy = buyMap.get(key);
    const sell = sellMap.get(key);

    const coin = buy?.coin ?? sell?.coin ?? "";
    const quote = buy?.quote ?? sell?.quote ?? "USDT";

    const buyQty = buy?.totalQty ?? 0;
    const buyCost = buy?.totalQuoteAmount ?? 0;
    const buyAvg = buyQty > eps ? buyCost / buyQty : 0;

    const sellQty = sell?.totalQty ?? 0;
    const sellProceed = sell?.totalQuoteAmount ?? 0;
    const sellAvg = sellQty > eps ? sellProceed / sellQty : 0;

    const netQty = buyQty - sellQty;

    let status: CoinPosition["status"] = "OPEN";
    if (Math.abs(netQty) <= eps) status = "CLOSED";
    else if (sellQty > eps && sellQty < buyQty - eps) status = "PARTIAL";

    positions.push({
      coin,
      quote,
      buy: { qty: buyQty, costQuote: buyCost, avgPrice: buyAvg },
      sell: { qty: sellQty, proceedQuote: sellProceed, avgPrice: sellAvg },
      netQty,
      status,
    });
  }

  positions.sort((a, c) => a.coin.localeCompare(c.coin));

  return { bought, sold, positions };
}
