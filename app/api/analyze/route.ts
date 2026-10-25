type Prediction = {
  asset: string;
  symbol: string;
  direction: string;
  target_price: number | null;
  deadline: string | null;
  quote: string;
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

  const results = await Promise.all(
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

  const finished = results.filter((r) => r.status === "correct" || r.status === "wrong");
  const correct = results.filter((r) => r.status === "correct").length;
  const hit_rate = finished.length > 0 ? Math.round((correct / finished.length) * 100) : null;

  return Response.json({
    title: video.title,
    channel: video.channel,
    video_date,
    hit_rate,
    total: results.length,
    correct,
    results,
  });
}