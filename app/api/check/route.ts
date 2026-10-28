import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const ALIASES: Record<string, string> = {
  IXIC: "^IXIC",
  NASDAQ: "^IXIC",
  "NASDAQ COMPOSITE": "^IXIC",
  COMP: "^IXIC",
  NDX: "^NDX",
  "NASDAQ 100": "^NDX",
  "NASDAQ-100": "^NDX",
  SPX: "^GSPC",
  GSPC: "^GSPC",
  "S&P 500": "^GSPC",
  "S&P500": "^GSPC",
  SP500: "^GSPC",
  INX: "^GSPC",
  DJI: "^DJI",
  DJIA: "^DJI",
  DOW: "^DJI",
  "DOW JONES": "^DJI",
  RUT: "^RUT",
  "RUSSELL 2000": "^RUT",
  VIX: "^VIX",
  DAX: "^GDAXI",
  SMI: "^SSMI",
  FTSE: "^FTSE",
  NIKKEI: "^N225",
  GOLD: "GC=F",
  XAU: "GC=F",
  XAUUSD: "GC=F",
  SILVER: "SI=F",
  XAG: "SI=F",
  OIL: "CL=F",
  WTI: "CL=F",
  BRENT: "BZ=F",
  BITCOIN: "BTC-USD",
  ETHEREUM: "ETH-USD",
};

const CRYPTO = [
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "AVAX", "LINK", "LTC", "BNB", "MATIC", "SHIB",
  "TRX", "TON", "PEPE", "SUI", "APT", "ARB", "OP", "NEAR", "ATOM", "XLM", "HBAR", "UNI", "AAVE",
];

function candidates(raw: string) {
  const s = String(raw ?? "").trim().toUpperCase().replace(/^\$/, "");
  const list: string[] = [];
  const add = (x: string) => {
    if (x && !list.includes(x)) list.push(x);
  };

  if (ALIASES[s]) add(ALIASES[s]);
  const bare = s.replace(/-USD$|USDT$|USD$/, "");
  if (CRYPTO.includes(bare)) add(`${bare}-USD`);
  add(s);
  if (!s.startsWith("^") && !s.includes("-") && !s.includes("=")) {
    add(`^${s}`);
    add(`${s}-USD`);
  }
  return list;
}

async function fetchQuotes(symbol: string, start: string, end: Date) {
  const result = await yahooFinance.chart(symbol, {
    period1: start,
    period2: end,
    interval: "1d",
  });
  return result.quotes.filter((q) => q.close != null);
}

export async function POST(req: Request) {
  const { symbol, direction, target_price, start_date, deadline } = await req.json();

  const today = new Date();
  const deadlineDate = deadline ? new Date(deadline) : today;
  const endDate = deadlineDate < today ? deadlineDate : today;

  let used = "";
  let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];

  for (const s of candidates(symbol)) {
    try {
      const q = await fetchQuotes(s, start_date, endDate);
      if (q.length > 0) {
        used = s;
        quotes = q;
        break;
      }
    } catch {}
  }

  if (quotes.length === 0) {
    return Response.json({ error: "No price data found" }, { status: 404 });
  }

  const startPrice = quotes[0].close!;
  const endPrice = quotes[quotes.length - 1].close!;
  const highest = Math.max(...quotes.map((q) => q.high ?? q.close!));
  const lowest = Math.min(...quotes.map((q) => q.low ?? q.close!));

  let hit = false;
  let alreadyTrue = false;
  if (target_price != null) {
    hit = direction === "up" ? highest >= target_price : lowest <= target_price;
    alreadyTrue = direction === "up" ? startPrice >= target_price : startPrice <= target_price;
  } else {
    hit = direction === "up" ? endPrice > startPrice : endPrice < startPrice;
  }

  let status = "wrong";
  if (alreadyTrue) status = "already_true";
  else if (hit) status = "correct";
  else if (!deadline) status = "no_deadline";
  else if (deadlineDate > today) status = "pending";

  return Response.json({ symbol: used, status, startPrice, endPrice, highest, lowest, target_price });
}