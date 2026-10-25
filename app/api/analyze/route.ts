type Prediction = {
  asset: string;
  symbol: string;
  direction: string;
  target_price: number | null;
  deadline: string | null;
  quote: string;
};

type Verdict = {
  index: number;
  verdict: string;
  reasoning: string;
};

export async function POST(req: Request) {
  const { url } = await req.json();

  const videoRes = await fetch(new URL("/api/transcript", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const video = await videoRes.json();
  if (!video.transcript) {
    return Response.json(video, { status: 500 });
  }
  const video_date = video.video_date;

  const extractRes = await fetch(new URL("/api/extract", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: `Video published on ${video_date}.\n\n${video.transcript}`,
    }),
  });
  const extracted = await extractRes.json();
  if (!extracted.predictions) {
    return Response.json(extracted, { status: 500 });
  }

  const checked = await Promise.all(
    extracted.predictions.map(async (p: Prediction) => {
      const checkRes = await fetch(new URL("/api/check", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: p.symbol,
          direction: p.direction,
          target_price: p.target_price,
          start_date: video_date,
          deadline: p.deadline,
        }),
      });
      const check = await checkRes.json();
      return { ...p, ...check };
    })
  );

  let trust_score = null;
  let summary = null;
  let results = checked.map((r) => ({ ...r, verdict: r.status, reasoning: null }));

  if (checked.length > 0) {
    const judgeRes = await fetch(new URL("/api/judge", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: video.title,
        channel: video.channel,
        video_date,
        results: checked,
      }),
    });
    const judged = await judgeRes.json();

    if (judged.verdicts) {
      trust_score = judged.trust_score;
      summary = judged.summary;
      results = checked.map((r, i) => {
        const v = judged.verdicts.find((x: Verdict) => x.index === i);
        return { ...r, verdict: v?.verdict ?? r.status, reasoning: v?.reasoning ?? null };
      });
    }
  }

  const finished = results.filter((r) => r.verdict === "correct" || r.verdict === "wrong");
  const correct = results.filter((r) => r.verdict === "correct").length;
  const hit_rate = finished.length > 0 ? Math.round((correct / finished.length) * 100) : null;

  return Response.json({
    title: video.title,
    channel: video.channel,
    video_date,
    hit_rate,
    trust_score,
    summary,
    total: results.length,
    correct,
    results,
  });
}