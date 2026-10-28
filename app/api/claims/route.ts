import OpenAI from "openai";

export const maxDuration = 300;

const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
});

const NANO = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
const ULTRA = "nvidia/Nemotron-3-Ultra-550b-a55b";

const TRUSTED = [
  "spglobal.com",
  "fred.stlouisfed.org",
  "investor.gov",
  "federalreserve.gov",
  "snb.ch",
  "finma.ch",
  "bis.org",
  "imf.org",
  "oecd.org",
  "ecb.europa.eu",
  "worldbank.org",
  "morningstar.com",
  "vanguard.com",
  "schwab.com",
  "fidelity.com",
  "blackrock.com",
  "am.jpmorgan.com",
  "mba.tuck.dartmouth.edu",
  "pages.stern.nyu.edu",
  "nber.org",
  "finra.org",
  "bls.gov",
];

const BLOCKED = [
  "reddit.com",
  "quora.com",
  "youtube.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "medium.com",
  "sec.gov",
];

const LABELS = [
  "supported",
  "historically_supported",
  "missing_context",
  "misleading",
  "not_supported",
  "unverifiable",
  "opinion",
];

const NEGATIVE = ["misleading", "not_supported"];
const MIN_NEGATIVE_CONFIDENCE = 0.6;

const ABSOLUTE_WORDS = [
  "impossible",
  "always",
  "never",
  "guarantee",
  "guaranteed",
  "like clockwork",
  "can't lose",
  "cannot lose",
  "can not lose",
  "won't lose",
  "risk free",
  "risk-free",
  "every single",
  "100%",
  "no way",
  "for sure",
  "definitely",
];

type Claim = { claim: string; quote: string; type?: string; period?: string; queries: string[] };
type Source = { id: string; title: string; url: string; content: string };
type Point = { text: string; source: string };

function parseJson(text: string) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json|```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9%£$€.' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function findAbsolute(text: string) {
  const lower = text.toLowerCase().replace(/’/g, "'");
  return ABSOLUTE_WORDS.find((w) => lower.includes(w)) ?? null;
}

async function ask(model: string, system: string, user: string, noThink: boolean) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const params = {
        model,
        max_tokens: 16000,
        temperature: 0.1,
        messages: [
          { role: "system", content: noThink ? `/no_think\n${system}` : system },
          { role: "user", content: user },
        ],
        ...(noThink ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      };
      const res = await client.chat.completions.create(
        params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );
      return parseJson(res.choices[0]?.message?.content ?? "");
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  throw new Error("Model failed");
}

async function tavily(query: string, depth: "basic" | "advanced", trustedOnly: boolean) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: depth,
        max_results: 4,
        ...(depth === "advanced" ? { chunks_per_source: 3 } : {}),
        ...(trustedOnly ? { include_domains: TRUSTED } : { exclude_domains: BLOCKED }),
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as { title: string; url: string; content: string }[];
  } catch {
    return [];
  }
}

async function gatherSources(claim: Claim) {
  const [main, risk] = await Promise.all([
    tavily(claim.queries[0] ?? claim.claim, "advanced", true),
    tavily(claim.queries[1] ?? `${claim.claim} risks`, "basic", true),
  ]);
  let found = [...main, ...risk];
  if (found.length < 2) {
    found = [...found, ...(await tavily(claim.queries[0] ?? claim.claim, "basic", false))];
  }

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const r of found) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    sources.push({
      id: `S${sources.length + 1}`,
      title: r.title ?? r.url,
      url: r.url,
      content: (r.content ?? "").slice(0, 1200),
    });
    if (sources.length >= 6) break;
  }
  return sources;
}

const EXTRACT_PROMPT = `You read transcripts of finance videos.
Find up to 7 of the most important CHECKABLE claims about markets, investing or the economy that the speaker ACTUALLY states as facts to the viewer in this transcript.
Only use claims that are really in the transcript. Never invent claims.
Kinds of claims to look for:
- statistics about long term returns or how often investors beat the market
- calculations, like how much monthly investing grows to over many years
- economic facts, like how much the economy grew or shrank in a given year
- general rules about investing that the speaker presents as facts
Skip completely:
- price predictions with a target or a date
- the speaker's own personal plans, wishes or choices ("I want", "I will", "my plan is", "I'm going to")
- personal stories or results of one specific person
- quotes attributed to famous people
- pure opinions, hype, jokes, motivation, ads
For each claim return:
- claim: one short sentence that says EXACTLY what the quote says. Stay as close to the speaker's own words as possible. Never soften or strengthen it. Never turn a personal plan into general advice. If the speaker said impossible, always, never, guaranteed, like clockwork or cannot lose, that word MUST appear in the claim. Do not add numbers the speaker did not say.
- period: the real years the claim is about. Turn words like "this year", "this time period" or "now" into actual years using the context of the transcript. If no time is mentioned, use "long term".
- quote: copy the exact words from the transcript, word for word, max 30 words. The quote alone must clearly contain the claim.
- type: one of statistic, calculation, economic_fact, general
- queries: exactly 2 web search queries that include the period, the first to find official data that checks the claim, the second to find risks or counter evidence
Return ONLY JSON: {"claims":[{"claim":"","period":"","quote":"","type":"","queries":["",""]}]}
If there are no checkable claims return {"claims":[]}.`;

const VERDICT_PROMPT = `You are a careful, fair financial fact checker. Be fair to the speaker: only call something misleading when the evidence clearly shows it.
STEP 1: Read the QUOTE on its own. Does the QUOTE clearly state the CLAIM as a fact to the viewer, with the same meaning and strength? Personal plans or wishes ("I want", "I will", "my plan") are NOT claims. If the claim is stronger, broader or different from the quote, the answer is false.
STEP 2: Only if STEP 1 is true, judge the claim using ONLY the numbered SOURCES given, plus your own arithmetic. Never invent sources, numbers or links.
Judge the claim exactly as worded in the QUOTE, including its strong words, and for the PERIOD given.
Labels:
- supported: sources directly confirm it, as worded
- historically_supported: about the future, but backed by long term historical records (not guaranteed)
- missing_context: roughly true, but leaves out important risks, assumptions, time frames or conditions, or rounds numbers a bit
- misleading: framed to give a clearly false impression (for example "guaranteed", "like clockwork", "impossible", "can't lose", cherry picked periods, unrealistic return assumptions far above long term averages)
- not_supported: a source DIRECTLY contradicts the claim about the SAME thing and the SAME period
- unverifiable: the sources do not directly address the claim or the period
- opinion: a value statement or personal belief that cannot be checked with data
Strict rules:
- Sources about a different year, period, market or type of investing than the claim do not count as evidence. If no source matches, use unverifiable.
- Small rounding or slight exaggeration of a number (for example saying "half" when the data says "nearly half" or 40%) is missing_context, not misleading.
- If the quote uses absolute words (always, never, impossible, guaranteed, like clockwork, cannot lose) and the sources show exceptions or big year to year swings, use missing_context or misleading, never supported.
- Only use not_supported when a source clearly contradicts the exact same measure and period.
- Ignore fund prospectuses, fund filings, single fund returns and unrelated indexes unless the claim is about them.
- For calculations (like compound growth of monthly investing), do the math yourself. State the yearly return the claim implies, and compare it to long term averages in the sources. Use missing_context if the assumed return is not stated, misleading if it is far above long term averages.
- Confidence must be below 0.6 when the sources are indirect.
- Judge the claim, never the speaker's character or intent.
- Add at least one risk or counterpoint if the sources contain one.
- Every point must cite a source id like "S1". Your own math can go in the summary without a source.
- Never give buy or sell advice.
Return ONLY JSON:
{"matches_quote":true,"label":"","confidence":0.0,"summary":"2 sentences max in plain English","supporting":[{"text":"","source":"S1"}],"risks":[{"text":"","source":"S2"}]}
If matches_quote is false, return {"matches_quote":false} and nothing else.`;

async function checkClaim(claim: Claim, videoDate: string) {
  const base = { claim: claim.claim, quote: claim.quote, period: claim.period ?? "long term" };
  try {
    const sources = await gatherSources(claim);
    if (sources.length === 0) {
      return {
        ...base,
        label: "unverifiable",
        confidence: 0,
        summary: "No trusted sources were found for this claim.",
        supporting: [],
        risks: [],
        sources: [],
      };
    }

    const evidence = sources
      .map((s) => `${s.id}: ${s.title}\n${s.url}\n${s.content}`)
      .join("\n\n");

    const v = await ask(
      ULTRA,
      VERDICT_PROMPT,
      `VIDEO PUBLISHED: ${videoDate}\nCLAIM: ${claim.claim}\nPERIOD: ${base.period}\nTYPE: ${claim.type ?? "general"}\nQUOTE: "${claim.quote}"\n\nSOURCES:\n${evidence}`,
      false
    );

    if (v.matches_quote === false) return null;

    const ids = new Set(sources.map((s) => s.id));
    const supporting = ((v.supporting ?? []) as Point[]).filter((p) => ids.has(p.source));
    const risks = ((v.risks ?? []) as Point[]).filter((p) => ids.has(p.source));
    const used = new Set([...supporting, ...risks].map((p) => p.source));
    const confidence = typeof v.confidence === "number" ? v.confidence : 0;

    let label = LABELS.includes(v.label) ? v.label : "unverifiable";
    let summary = v.summary ?? "";

    if (used.size === 0 && label !== "opinion") label = "unverifiable";

    if (NEGATIVE.includes(label) && confidence < MIN_NEGATIVE_CONFIDENCE) {
      label = "unverifiable";
      summary = `${summary} The evidence is not strong enough to call this claim wrong or misleading.`.trim();
    }

    const strong = findAbsolute(claim.quote);
    if (strong && (label === "supported" || label === "historically_supported")) {
      label = "missing_context";
      summary = `${summary} The data backs the general idea, but the word "${strong}" goes further than the evidence.`.trim();
    }

    return {
      ...base,
      label,
      confidence,
      summary,
      supporting,
      risks,
      sources: sources
        .filter((s) => used.has(s.id))
        .map((s) => ({ id: s.id, title: s.title, url: s.url })),
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function POST(req: Request) {
  const { transcript, title, video_date } = await req.json();
  if (!transcript) {
    return Response.json({ error: "Missing transcript" }, { status: 400 });
  }
  const text = String(transcript);
  const videoDate = video_date ?? "unknown";

  try {
    const extracted = await ask(
      NANO,
      EXTRACT_PROMPT,
      `Video title: ${title ?? ""}\nVideo published: ${videoDate}\n\nTranscript:\n${text.slice(0, 100000)}`,
      true
    );

    const seen = new Set<string>();
    const claims = ((extracted.claims ?? []) as Claim[])
      .filter((c) => c.claim && c.quote && quoteIsReal(c.quote, text))
      .filter((c) => {
        const key = normalize(c.quote).split(" ").slice(0, 8).join(" ");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);

    const checked = await Promise.all(claims.map((c) => checkClaim(c, videoDate)));
    const kept = checked.filter((c) => c !== null).slice(0, 5);
    return Response.json({ claims: kept });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}