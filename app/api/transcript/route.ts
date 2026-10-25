import { Innertube } from "youtubei.js";
import { fetchTranscript } from "youtube-transcript-plus";

function getVideoId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function toIsoDate(text: string) {
  const match = text.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  if (!match) return null;
  const d = new Date(match[0]);
  if (isNaN(d.getTime())) return null;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
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

export async function POST(req: Request) {
  const { url } = await req.json();
  const videoId = getVideoId(url);
  if (!videoId) {
    return Response.json({ error: "Invalid YouTube link" }, { status: 400 });
  }

  try {
    const segments = await fetchTranscript(videoId);
    const transcript = cleanText(segments.map((s) => s.text).join(" "));

    const yt = await Innertube.create({ lang: "en", location: "US" });
    const info = await yt.getInfo(videoId);
    const published = info.primary_info?.published?.toString() ?? "";

    return Response.json({
      videoId,
      title: info.basic_info.title,
      channel: info.basic_info.author,
      video_date: toIsoDate(published),
      transcript,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}