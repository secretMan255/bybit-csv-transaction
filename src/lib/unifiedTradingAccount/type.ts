export type CoinTradeSummary = {
  coin: string;
  quote: string;
  totalQty: number;
  totalQuoteAmount: number;
  avgPrice: number;
  trades: number;
};

export type CoinPosition = {
  coin: string;
  quote: string;
  buy: {
    qty: number;
    costQuote: number;
    avgPrice: number;
  };
  sell: {
    qty: number;
    proceedQuote: number;
    avgPrice: number;
  };
  netQty: number;
  status: "OPEN" | "CLOSED" | "PARTIAL";
};

export type TradeCoinsResult = {
  bought: CoinTradeSummary[];
  sold: CoinTradeSummary[];
  positions: CoinPosition[];
};

export type CoinKey = `${string}|${string}`;
