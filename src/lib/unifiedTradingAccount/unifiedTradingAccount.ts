import type { FeesBreakdown, ParsedRow, ParseResult } from "@/page/dashboard";
import { toUpper } from "../utils";
import type {
  CoinKey,
  CoinPosition,
  CoinTradeSummary,
  TradeCoinsResult,
} from "./type";

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

  //   const rows: ParsedRow[] = dataRows
  //     .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
  //     .map((cols, i) => {
  //       const raw: Record<string, string> = {};
  //       headers.forEach((h, idx) => (raw[h] = cols[idx] ?? ""));

  //       const get = (idx: number | null) => (idx === null ? "" : cols[idx] ?? "");
  //       const qty = idxQty === null ? 0 : parseNumberMaybe(get(idxQty));
  //       const amount = idxAmount === null ? 0 : parseNumberMaybe(get(idxAmount));
  //       const type = get(idxCategory).toLowerCase();

  //       let revenue = 0,
  //         cost = 0,
  //         relieved = 0,
  //         unrelieved = 0;

  //       if (hasExplicitMetrics) {
  //         revenue = idxRevenue === null ? 0 : parseNumberMaybe(get(idxRevenue));
  //         cost = idxCost === null ? 0 : parseNumberMaybe(get(idxCost));
  //         relieved =
  //           idxRelieved === null ? 0 : parseNumberMaybe(get(idxRelieved));
  //         unrelieved =
  //           idxUnrelieved === null ? 0 : parseNumberMaybe(get(idxUnrelieved));
  //       } else if (idxAmount !== null && idxCategory !== null) {
  //         if (type.includes("deposit")) revenue = Math.abs(amount);
  //         else if (type.includes("withdraw")) cost = Math.abs(amount);
  //       } else if (idxQty !== null) {
  //         revenue = qty > 0 ? qty : 0;
  //         cost = qty < 0 ? Math.abs(qty) : 0;
  //       }

  //       return {
  //         __rowId: String(i + 1),
  //         raw,
  //         time: get(idxTime).trim() || undefined,
  //         symbol: get(idxSymbol).trim() || undefined,
  //         category: get(idxCategory).trim() || undefined,
  //         account: get(idxAccount).trim() || undefined,
  //         revenue,
  //         cost,
  //         relieved,
  //         unrelieved,
  //       };
  //     });

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
      tradingFeesUSDT += feePaidToUSDT(row);
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
 * Derive "bought coins", "sold coins", and "positions" from Bybit UTA
 * AssetChangeDetails CSV rows.
 *
 * IMPORTANT:
 * - Do NOT compute average price from "Change" bucket pairing. It is easy to mismatch
 *   base/quote legs (fees, adjustments, missing legs, etc.) and produce impossible prices.
 * - Use execution-like fields instead:
 *   - Base quantity: abs(Quantity) on the BASE coin row (Currency != USDT/USDC/USD)
 *   - Execution price: Filled Price
 *   - Quote amount: qty * price
 *
 * Output:
 * 1) bought: coins with TRADE + BUY
 * 2) sold:   coins with TRADE + SELL
 * 3) positions: merge buy & sell -> OPEN/CLOSED/PARTIAL
 */
export function getTradeCoinsFromUtaAssetChange(
  rows: ParsedRow[]
): TradeCoinsResult {
  const eps = 1e-12;
  const QUOTE_COINS = new Set(["USDT", "USDC", "USD"]);

  // --- Helpers -------------------------------------------------------------

  const safeUpper = (v: unknown) => toUpper(v ?? "");

  const getQuoteFromContract = (contract: string): string => {
    // Expand if you have more quote currencies
    if (contract.endsWith("USDC")) return "USDC";
    if (contract.endsWith("USDT")) return "USDT";
    if (contract.endsWith("USD")) return "USD";
    // Fallback
    return "USDT";
  };

  type Agg = {
    coin: string; // base coin
    quote: string;
    totalQty: number; // base quantity (abs)
    totalQuoteAmount: number; // quote amount (cost/proceed)
    trades: number; // number of contributing rows (approx)
  };

  const upsertAgg = (
    map: Map<string, Agg>,
    base: string,
    quote: string,
    qty: number,
    quoteAmt: number
  ) => {
    const key = `${base}|${quote}`;
    const prev = map.get(key);

    const totalQty = (prev?.totalQty ?? 0) + qty;
    const totalQuoteAmount = (prev?.totalQuoteAmount ?? 0) + quoteAmt;

    map.set(key, {
      coin: base,
      quote,
      totalQty,
      totalQuoteAmount,
      trades: (prev?.trades ?? 0) + 1,
    });
  };

  // --- A) Aggregate BUY/SELL using Filled Price * Quantity -----------------

  const buyAgg = new Map<string, Agg>();
  const sellAgg = new Map<string, Agg>();

  for (const row of rows) {
    // Only analyze TRADE rows
    const type = safeUpper(row.raw["Type"] ?? row.category ?? "");
    if (type !== "TRADE") continue;

    // BUY / SELL
    const direction = safeUpper(row.raw["Direction"] ?? row.raw["Side"] ?? "");
    if (direction !== "BUY" && direction !== "SELL") continue;

    const currency = safeUpper(row.raw["Currency"] ?? "");
    const contract = safeUpper(row.raw["Contract"] ?? row.raw["Symbol"] ?? "");
    if (!currency || !contract) continue;

    // Only take BASE coin rows; ignore quote coin rows to avoid double counting and noise
    if (QUOTE_COINS.has(currency)) continue;

    // Base quantity is Quantity (BUY often positive, SELL often negative) -> use abs
    const qty = Math.abs(parseNumberMaybe(String(row.raw["Quantity"] ?? "")));
    if (qty <= eps) continue;

    // Execution price
    const price = parseNumberMaybe(String(row.raw["Filled Price"] ?? ""));
    if (price <= eps) continue;

    // Quote currency inferred from contract suffix (BTCUSDT -> USDT)
    const quote = getQuoteFromContract(contract);

    // Quote amount: qty * execution price
    const quoteAmt = qty * price;

    if (direction === "BUY") upsertAgg(buyAgg, currency, quote, qty, quoteAmt);
    else upsertAgg(sellAgg, currency, quote, qty, quoteAmt);
  }

  // --- B) Convert to CoinTradeSummary arrays ------------------------------

  const bought: CoinTradeSummary[] = Array.from(buyAgg.values())
    .map((a) => ({
      coin: a.coin,
      quote: a.quote,
      totalQty: a.totalQty,
      totalQuoteAmount: a.totalQuoteAmount,
      avgPrice: a.totalQty > eps ? a.totalQuoteAmount / a.totalQty : 0,
      trades: a.trades,
    }))
    .sort((x, y) => x.coin.localeCompare(y.coin));

  const sold: CoinTradeSummary[] = Array.from(sellAgg.values())
    .map((a) => ({
      coin: a.coin,
      quote: a.quote,
      totalQty: a.totalQty,
      totalQuoteAmount: a.totalQuoteAmount,
      avgPrice: a.totalQty > eps ? a.totalQuoteAmount / a.totalQty : 0,
      trades: a.trades,
    }))
    .sort((x, y) => x.coin.localeCompare(y.coin));

  // --- C) Build positions (merge buy & sell) ------------------------------

  const buyMap = new Map<CoinKey, CoinTradeSummary>(
    bought.map((x) => [`${x.coin}|${x.quote}`, x])
  );
  const sellMap = new Map<CoinKey, CoinTradeSummary>(
    sold.map((x) => [`${x.coin}|${x.quote}`, x])
  );

  const allKeys = new Set<CoinKey>([...buyMap.keys(), ...sellMap.keys()]);
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

    // Status rules:
    // - CLOSED: netQty ~ 0
    // - PARTIAL: some sells but not fully closed
    // - OPEN: still holding > 0 net
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

  positions.sort((a, b) => a.coin.localeCompare(b.coin));

  return { bought, sold, positions };
}
