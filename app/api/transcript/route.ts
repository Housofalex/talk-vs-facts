const BASE = "https://api.supadata.ai/v1";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getVideoId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function toIsoDate(text: string | undefined | null) {
  if (!text) return null;
  const d = new Date(text);
  if (isNaN(d.getTime())) return null;
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

function cleanText(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

async function supadata(path: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-api-key": process.env.SUPADATA_API_KEY ?? "" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 429) {
      await wait(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok && res.status !== 202) {
      throw new Error(data?.message || data?.error || `Supadata error ${res.status}`);
    }
    return { status: res.status, data };
  }
  throw new Error("Supadata rate limit, try again in a minute");
}

function contentToText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => c?.text ?? "").join(" ");
  return "";
}

async function getTranscript(videoUrl: string) {
  const { status, data } = await supadata(
    `/transcript?url=${encodeURIComponent(videoUrl)}&text=true`
  );
  if (status !== 202 && !data.jobId) return contentToText(data.content);

  for (let i = 0; i < 30; i++) {
    await wait(2000);
    const job = await supadata(`/transcript/${data.jobId}`);
    if (job.data.status === "completed") return contentToText(job.data.content);
    if (job.data.status === "failed") throw new Error("Transcript job failed");
  }
  throw new Error("Transcript took too long");
}

export async function POST(req: Request) {
  const { url } = await req.json();
  const videoId = getVideoId(url);
  if (!videoId) {
    return Response.json({ error: "Invalid YouTube link" }, { status: 400 });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const rawTranscript = await getTranscript(videoUrl);
    await wait(1100);
    const meta = (await supadata(`/youtube/video?id=${videoId}`)).data;

    const transcript = cleanText(rawTranscript);
    if (!transcript) {
      return Response.json({ error: "No transcript found for this video" }, { status: 404 });
    }

    return Response.json({
      videoId,
      title: meta?.title ?? "",
      channel: meta?.channel?.name ?? meta?.channel ?? "",
      video_date: toIsoDate(meta?.uploadDate),
      transcript,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}