import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const SYSTEM_PROMPT = `/no_think
You extract price predictions from finance video transcripts.
Find every clear prediction about a stock or crypto price.
Return ONLY JSON, no other text, in this format:
{"predictions":[{"asset":"Bitcoin","symbol":"BTC-USD","direction":"up","target_price":100000,"deadline":"2026-12-31","quote":"exact sentence from the transcript"}]}
Rules:
- symbol is the Yahoo Finance symbol. Crypto ends with -USD (BTC-USD, ETH-USD, SOL-USD). Stocks use the normal ticker (TSLA, NVDA, AAPL)
- direction is "up" or "down"
- target_price is a number or null
- deadline is YYYY-MM-DD or null
- If there are no predictions, return {"predictions":[]}`;

async function askModel(transcript: string) {
  const response = await client.chat.completions.create({
    model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    temperature: 0.2,
    max_tokens: 16000,
    ...({ chat_template_kwargs: { enable_thinking: false } } as object),
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
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    console.log("FAILED ATTEMPT, finish reason:", response.choices[0].finish_reason);
    return null;
  }
}

export async function POST(req: Request) {
  const { transcript } = await req.json();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await askModel(transcript);
    if (result) return Response.json(result);
  }

  return Response.json({ error: "Could not read AI answer after 3 tries" }, { status: 500 });
}