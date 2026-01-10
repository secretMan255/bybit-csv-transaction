import MetricCard from "@/components/metricCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  feesPaid,
  getLastWalletBalance,
  isBybitAssetChangeDetailsUtaCsv,
  parseCsv,
  getTradeCoinsFromUtaAssetChange,
} from "@/lib/unifiedTradingAccount/unifiedTradingAccount";
import type { TradeCoinsResult } from "@/lib/unifiedTradingAccount/type";
import { convertFees, moneyFormatAmount } from "@/lib/utils";
import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

export type ParsedRow = {
  __rowId: string;
  raw: Record<string, string>;
  time?: string;
  symbol?: string;
  category?: string;
  account?: string;
  revenue?: number;
  cost?: number;
  relieved?: number;
  unrelieved?: number;
};

export type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
  warnings: string[];
};

export type FeesBreakdown = {
  tradingFeesUSDT: number; // usually negative
  fundingPaidUSDT: number; // negative only
  fundingReceivedUSDT: number; // positive only (revenue)
  feeRefundUSDT: number; // positive (rebate)
  netFeesUSDT: number; // signed: trading + fundingPaid + refund

  tradingCostUSDT: number; // positive
  fundingCostUSDT: number; // positive
  netCostUSDT: number; // positive
};

export default function Dashboard() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  function onPickFile() {
    fileRef.current?.click();
  }

  const [rows, setRows] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const [revenue, setRevenue] = useState<string>("0.00");
  const [fees, setFees] = useState<FeesBreakdown>();
  const [net, setNet] = useState<string>("0.00");
  const [walletBalance, setWalletBalance] = useState<string>("0.00");

  const [tradeCoins, setTradeCoins] = useState<TradeCoinsResult>();

  function resetAll(opts?: { keepFileName?: boolean; warnings?: string[] }) {
    setFileName("");
    setRows(0);
    setHeaders([]);
    setParsedRows([]);
    setRevenue("0.00");
    setNet("0.00");
    setWalletBalance("0.00");
    setFees(undefined);
    setWarnings(opts?.warnings ?? []);
    setTradeCoins(undefined);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!isBybitAssetChangeDetailsUtaCsv(file)) {
      resetAll({
        keepFileName: true,
        warnings: [
          "Invalid CSV format.",
          "Please upload Bybit export: AssetChangeDetails (UTA) CSV.",
        ],
      });

      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const result = parseCsv(text);

      const lastBalance = getLastWalletBalance(result.rows);
      const fees = feesPaid(result.rows);

      const tradeCoins = getTradeCoinsFromUtaAssetChange(result.rows);
      // console.log("tradeCoins: ", tradeCoins);
      setTradeCoins(tradeCoins);
      setFees(fees);
      setRows(result.rows.length);
      setParsedRows(result.rows);
      setWarnings(result.warnings);
      setWalletBalance(moneyFormatAmount(lastBalance));
      setHeaders(result.headers);

      // console.log("file name: ", file.name);
      // console.log("result: ", result);
    } catch (err: any) {
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto px-4">
        <p className="text-4xl font-bold mb-3">
          Unified Trading Account Static
        </p>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Import file</CardTitle>
            <CardDescription className="min-w-0 space-y-1 text-sm leading-relaxed">
              <span className="block text-muted-foreground">
                Upload a UTA (Unified Trading Account) CSV export from Bybit.
              </span>

              <span className="block text-muted-foreground">Example:</span>

              <code
                className="block rounded-md bg-muted px-2 py-1 text-xs leading-snug text-foreground
                   overflow-hidden break-all"
              >
                Bybit_AssetChangeDetails_uta_123456789_20250101_20251231_0.csv
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              className="hidden"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={onFileChange}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
                <Button
                  className="rounded-2xl w-full sm:w-auto"
                  onClick={onPickFile}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Choose CSV
                </Button>

                <div className="min-w-0 w-full sm:flex-1">
                  {fileName ? (
                    <div className="min-w-0 w-full sm:flex-1">
                      <Badge
                        variant="secondary"
                        className="rounded-xl w-full min-w-0"
                      >
                        <code
                          className="block w-full min-w-0 rounded-md bg-muted px-2 py-1 text-xs leading-snug
                 whitespace-normal break-all"
                        >
                          {fileName}
                        </code>
                      </Badge>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-xl w-full sm:w-auto"
                    >
                      No file selected
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-sm text-muted-foreground shrink-0">
                Rows:{" "}
                <span className="font-medium text-muted-foreground">
                  {rows}
                </span>
              </div>
            </div>

            {warnings.length > 0 && (
              <Alert>
                <AlertTitle>Parsing notes</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-5">
                    {warnings.slice(0, 6).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="h-6" />

        <div className="grid gap-4 md:grid-col-1 lg:grid-cols-3">
          {/* <MetricCard
            title="Revenue"
            value={`${revenue} USD`}
            subtitle="Sum (filtered)"
          />
          <MetricCard
            title="Net"
            value={`${net} USD`}
            subtitle="Revenue - Cost"
          /> */}
          <MetricCard
            title="Last Balance"
            value={`${walletBalance} USD`}
            subtitle="Wallet Last Balance"
          />
        </div>

        <div className="h-4" />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Net Fees"
            value={`${convertFees(fees?.netCostUSDT)} USD`}
            subtitle="Trading cost + Funding paid − Fee refunds"
          />
          <MetricCard
            title="Trading Fees"
            value={`${convertFees(fees?.tradingCostUSDT)} USD`}
            subtitle="Fees paid on trades"
          />
          <MetricCard
            title="Funding Paid"
            value={`${convertFees(fees?.fundingCostUSDT)} USD`}
            subtitle="Funding fees paid"
          />
          <MetricCard
            title="Fee Refund"
            value={`${convertFees(fees?.feeRefundUSDT)} USD`}
            subtitle="Fee rebates / refunds"
          />
          <MetricCard
            title="Funding Received"
            value={`${convertFees(fees?.fundingReceivedUSDT)} USD`}
            subtitle="Funding fees received"
          />
        </div>

        <div className="h-6" />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>1) Bought coins</CardTitle>
              <CardDescription>TRADE + BUY (base coin)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tradeCoins?.bought?.length ? (
                tradeCoins.bought.map((x) => (
                  <div
                    key={`${x.coin}-${x.quote}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className="rounded-xl" variant="secondary">
                        {x.coin}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        /{x.quote}
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {x.totalQty
                          .toFixed(8)
                          .replace(/0+$/, "")
                          .replace(/\.$/, "")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        avg {x.avgPrice.toFixed(6)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No BUY trades found.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>2) Sold coins</CardTitle>
              <CardDescription>TRADE + SELL (base coin)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tradeCoins?.sold?.length ? (
                tradeCoins.sold.map((x) => (
                  <div
                    key={`${x.coin}-${x.quote}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className="rounded-xl" variant="secondary">
                        {x.coin}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        / {x.quote}
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {x.totalQty
                          .toFixed(8)
                          .replace(/0+$/, "")
                          .replace(/\.$/, "")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        avg {x.avgPrice.toFixed(6)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No SELL trades found.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>3) Positions</CardTitle>
              <CardDescription>
                BUY vs SELL → OPEN / CLOSED / PARTIAL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tradeCoins?.positions?.length ? (
                tradeCoins.positions.map((p) => (
                  <div
                    key={`${p.coin}-${p.quote}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className="rounded-xl" variant="outline">
                        {p.coin}
                      </Badge>
                      <Badge className="rounded-xl" variant="secondary">
                        {p.status}
                      </Badge>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        net{" "}
                        {p.netQty
                          .toFixed(8)
                          .replace(/0+$/, "")
                          .replace(/\.$/, "")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        buy {p.buy.qty.toFixed(4)} / sell{" "}
                        {p.sell.qty.toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No positions found.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
