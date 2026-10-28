import OpenAI from "openai";

export const maxDuration = 300;

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const MAX_QUOTE_WORDS = 60;

type Prediction = {
  asset: string;
  symbol: string;
  direction: string;
  target_price: number | null;
  deadline: string | null;
  deadline_words: string | null;
  quote: string;
};

const SYSTEM_PROMPT = `/no_think
You extract price predictions from finance video transcripts.
A price prediction is when someone in the video says where the price of a specific stock, index, commodity or crypto will go in the future.
Targets can be said as numbers or words, like "250k", "a quarter million", "200 grand" or "six figures". Convert them to a plain number.
Predictions by guests or people being interviewed count too.
Return ONLY JSON, no other text, in this format:
{"predictions":[{"asset":"","symbol":"","direction":"","target_price":null,"deadline":null,"deadline_words":null,"quote":""}]}
Rules:
- asset: the name, as said in the video
- symbol: the Yahoo Finance symbol. Crypto is the coin ticker plus -USD. Stocks use the normal ticker. Indexes start with ^
- direction: "up" or "down"
- target_price: a number, or null if no price was said
- deadline: YYYY-MM-DD, ONLY if the speaker clearly says a time frame. Use the video publish date to turn words like "by the end of this year" or "next summer" into a date. If no time frame is said, use null. Never guess a deadline.
- deadline_words: the exact words from the transcript that state the time frame, like "by the end of 2022". Use null if deadline is null.
- quote: copy ONE short part of the transcript, word for word, between 8 and 40 words. It must contain the prediction itself, ideally the target price. Never copy long passages.
- Do not include statements about what already happened in the past.
- If there are no predictions, return {"predictions":[]}`;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9%£$€.' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string) {
  return normalize(text).split(" ").filter(Boolean).length;
}

function quoteIsReal(quote: string, transcript: string) {
  const q = normalize(quote).split(" ").filter(Boolean);
  if (q.length < 4) return false;
  const t = normalize(transcript);
  if (t.includes(q.join(" "))) return true;
  let total = 0;
  let found = 0;
  for (let i = 0; i + 4 <= q.length; i++) {
    total++;
    if (t.includes(q.slice(i, i + 4).join(" "))) found++;
  }
  return total > 0 && found / total >= 0.6;
}

function wordsAreReal(words: string | null, transcript: string) {
  if (!words) return false;
  const w = normalize(words);
  if (w.length < 3) return false;
  return normalize(transcript).includes(w);
}

function validDate(d: string | null) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return !isNaN(new Date(d).getTime());
}

async function askModel(transcript: string) {
  const response = await client.chat.completions.create({
    model: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    temperature: 0.1,
    max_tokens: 16000,
    ...({ chat_template_kwargs: { enable_thinking: false } } as object),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  let text = response.choices[0].message.content ?? "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```json|```/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    console.log("FAILED ATTEMPT, finish reason:", response.choices[0].finish_reason);
    return null;
  }
}

function clean(raw: Prediction[], transcript: string) {
  const seen = new Set<string>();
  const out: Prediction[] = [];

  for (const p of raw) {
    if (!p || !p.symbol || !p.quote) continue;
    if (p.direction !== "up" && p.direction !== "down") continue;
    if (wordCount(p.quote) > MAX_QUOTE_WORDS) continue;
    if (!quoteIsReal(p.quote, transcript)) continue;

    const target = typeof p.target_price === "number" && p.target_price > 0 ? p.target_price : null;
    const hasDeadline = validDate(p.deadline) && wordsAreReal(p.deadline_words, transcript);

    const key = `${p.symbol}|${target}|${hasDeadline ? p.deadline : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      asset: p.asset || p.symbol,
      symbol: p.symbol,
      direction: p.direction,
      target_price: target,
      deadline: hasDeadline ? p.deadline : null,
      deadline_words: hasDeadline ? p.deadline_words : null,
      quote: p.quote,
    });
  }

  return out.slice(0, 8);
}

export async function POST(req: Request) {
  const { transcript } = await req.json();
  const text = String(transcript ?? "");

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await askModel(text);
    if (result && Array.isArray(result.predictions)) {
      return Response.json({ predictions: clean(result.predictions, text) });
    }
  }

  return Response.json({ error: "Could not read AI answer after 3 tries" }, { status: 500 });
}