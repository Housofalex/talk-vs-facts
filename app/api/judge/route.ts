import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const SYSTEM_PROMPT = `You are a strict but fair judge that rates price predictions made by finance influencers.
You get the video info and a list of predictions. Each one has the exact quote and real price data checked by code: startPrice (price on the video date), highest, lowest, endPrice, and a code status.
For each prediction decide the final verdict:
- "correct": a real prediction that came true
- "wrong": a real prediction that failed by its deadline
- "pending": the deadline has not been reached yet
- "no_deadline": no clear time frame was said, so it cannot be called wrong
- "already_true": the price was already at the target when the video was published
- "not_a_prediction": a joke, a question, quoting someone else, or too vague
Check if a time frame is really in the quote. If not, use "no_deadline".
Trust the price numbers, they are real market data.
Write a short reasoning for each verdict (1 to 2 sentences, plain English, mention the real prices).
Then give the creator a trust_score from 0 to 100 based only on predictions with verdict "correct" or "wrong". If there are none, trust_score must be null. Also give a one sentence summary.
Return ONLY JSON in this format:
{"verdicts":[{"index":0,"verdict":"correct","reasoning":"..."}],"trust_score":50,"summary":"..."}`;

async function askJudge(input: string) {
  const response = await client.chat.completions.create({
    model: "nvidia/Nemotron-3-Ultra-550b-a55b",
    temperature: 0.2,
    max_tokens: 16000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input },
    ],
  });

  let text = response.choices[0].message.content ?? "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    console.log("JUDGE FAILED, finish reason:", response.choices[0].finish_reason);
    return null;
  }
}

export async function POST(req: Request) {
  const { title, channel, video_date, results } = await req.json();

  const input = JSON.stringify({
    video: { title, channel, published: video_date, today: new Date().toISOString().slice(0, 10) },
    predictions: results.map((r: Record<string, unknown>, index: number) => ({
      index,
      asset: r.asset,
      direction: r.direction,
      target_price: r.target_price,
      deadline_guess: r.deadline,
      quote: r.quote,
      code_status: r.status,
      startPrice: r.startPrice,
      highest: r.highest,
      lowest: r.lowest,
      endPrice: r.endPrice,
    })),
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await askJudge(input);
    if (result) return Response.json(result);
  }

  return Response.json({ error: "Judge could not answer" }, { status: 500 });
}