import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const SYSTEM_PROMPT = `You extract price predictions from finance video transcripts.
Find every clear prediction about a stock or crypto price.
Return ONLY JSON, no other text, in this format:
{"predictions":[{"asset":"Bitcoin","symbol":"BTC-USD","direction":"up","target_price":100000,"deadline":"2026-12-31","quote":"exact sentence from the transcript"}]}
Rules:
- symbol is the Yahoo Finance symbol. Crypto ends with -USD (BTC-USD, ETH-USD, SOL-USD). Stocks use the normal ticker (TSLA, NVDA, AAPL)
- direction is "up" or "down"
- target_price is a number or null
- deadline is YYYY-MM-DD or null
- If there are no predictions, return {"predictions":[]}`;

export async function POST(req: Request) {
  const { transcript } = await req.json();

  const response = await client.chat.completions.create({
    model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  let text = response.choices[0].message.content ?? "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  try {
    return Response.json(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return Response.json({ error: "Could not read AI answer", raw: text }, { status: 500 });
  }
}