import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function POST(req: Request) {
  const { symbol, direction, target_price, start_date, deadline } = await req.json();

  const today = new Date();
  const deadlineDate = deadline ? new Date(deadline) : today;
  const endDate = deadlineDate < today ? deadlineDate : today;

  try {
    const result = await yahooFinance.chart(symbol, {
      period1: start_date,
      period2: endDate,
      interval: "1d",
    });

    const quotes = result.quotes.filter((q) => q.close != null);
    if (quotes.length === 0) {
      return Response.json({ error: "No price data found" }, { status: 404 });
    }

    const startPrice = quotes[0].close!;
    const endPrice = quotes[quotes.length - 1].close!;
    const highest = Math.max(...quotes.map((q) => q.high ?? q.close!));
    const lowest = Math.min(...quotes.map((q) => q.low ?? q.close!));

    let hit = false;
    if (target_price != null) {
      hit = direction === "up" ? highest >= target_price : lowest <= target_price;
    } else {
      hit = direction === "up" ? endPrice > startPrice : endPrice < startPrice;
    }

    let status = "wrong";
    if (hit) status = "correct";
    else if (deadlineDate > today) status = "pending";

    return Response.json({ symbol, status, startPrice, endPrice, highest, lowest, target_price });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}