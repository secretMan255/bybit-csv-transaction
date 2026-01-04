import type { FeesBreakdown, ParsedRow, ParseResult } from "@/page/dashboard";
import { toUpper } from "./utils";

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
