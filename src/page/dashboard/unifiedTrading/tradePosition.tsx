import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TradeCoinsResult } from "@/lib/unifiedTradingAccount/type";

interface Props {
  tradeCoins: TradeCoinsResult | undefined;
}

export default function TradePosition({ tradeCoins }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="rounded-2xl max-h-[420px]">
        <CardHeader>
          <CardTitle>1) Bought coins</CardTitle>
          <CardDescription>TRADE + BUY (base coin)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto pr-7">
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
              No BUY trades found.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl max-h-[420px]">
        <CardHeader>
          <CardTitle>2) Sold coins</CardTitle>
          <CardDescription>TRADE + SELL (base coin)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto pr-7">
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

      <Card className="rounded-2xl max-h-[420px]">
        <CardHeader>
          <CardTitle>3) Positions</CardTitle>
          <CardDescription>
            BUY vs SELL → OPEN / CLOSED / PARTIAL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 overflow-y-auto pr-7">
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
                    {p.netQty.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    buy {p.buy.qty.toFixed(4)} / sell {p.sell.qty.toFixed(4)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No positions found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
