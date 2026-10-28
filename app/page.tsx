"use client";

import { useEffect, useState } from "react";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
import "./talk.css";

const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500"] });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

type Result = {
  asset: string;
  symbol: string;
  direction: string;
  target_price: number | null;
  deadline: string | null;
  quote: string;
  status?: string;
  startPrice?: number;
  endPrice?: number;
  highest?: number;
  lowest?: number;
  verdict?: string;
  reasoning?: string | null;
};

type Point = { text: string; source: string };
type Source = { id: string; title: string; url: string };
type Claim = {
  claim: string;
  quote: string;
  period?: string;
  label: string;
  confidence: number;
  summary: string;
  supporting: Point[];
  risks: Point[];
  sources: Source[];
};

type Video = { title: string; channel: string; video_date: string };

const EXAMPLES = [
  { label: "Tom Nash, investing plan", url: "https://www.youtube.com/watch?v=lgT2G1jpt_w" },
  { label: "Mark Tilbury, investing for beginners", url: "https://www.youtube.com/watch?v=8Ij7A1VCB7I" },
];

const STEPS = [
  "Getting the transcript",
  "Finding price predictions",
  "Checking real prices",
  "Reviewing the price calls",
  "Checking claims with trusted sources",
];

const HOW = [
  { title: "Paste a link", body: "We read everything that is said in the video." },
  { title: "We find the claims", body: "Price predictions and statements about markets, returns and the economy." },
  {
    title: "We check them",
    body: "Against real price history and trusted sources like the Federal Reserve, IMF, Vanguard and Morningstar.",
  },
];

const VERDICTS: Record<string, { label: string; tone: string }> = {
  correct: { label: "Came true", tone: "good" },
  wrong: { label: "Missed", tone: "bad" },
  already_true: { label: "Already true", tone: "warn" },
  pending: { label: "Still open", tone: "info" },
  no_deadline: { label: "No deadline", tone: "info" },
  not_a_prediction: { label: "Not a prediction", tone: "muted" },
};

const CLAIM_LABELS: Record<string, { label: string; tone: string; group: string }> = {
  supported: { label: "Holds up", tone: "good", group: "holds" },
  historically_supported: { label: "True so far, not guaranteed", tone: "good", group: "holds" },
  missing_context: { label: "Needs context", tone: "warn", group: "context" },
  misleading: { label: "Overstated", tone: "bad", group: "overstated" },
  not_supported: { label: "Data disagrees", tone: "bad", group: "overstated" },
  unverifiable: { label: "Can't verify", tone: "muted", group: "unclear" },
  opinion: { label: "Opinion", tone: "muted", group: "unclear" },
};

const GROUPS = [
  { key: "holds", label: "Hold up", tone: "good" },
  { key: "context", label: "Need context", tone: "warn" },
  { key: "overstated", label: "Go further than the data", tone: "bad" },
  { key: "unclear", label: "Can't be checked", tone: "muted" },
];

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

function money(n?: number | null) {
  if (n == null) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

function niceDate(d?: string | null) {
  if (!d) return "unknown date";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function callText(r: Result) {
  const dir = r.direction === "up" ? "Up" : "Down";
  const target = r.target_price != null ? ` to ${money(r.target_price)}` : "";
  const by = r.deadline ? ` by ${niceDate(r.deadline)}` : ", no date given";
  return `${dir}${target}${by}`;
}

function countGroups(claims: Claim[]) {
  const g: Record<string, number> = { holds: 0, context: 0, overstated: 0, unclear: 0 };
  for (const c of claims) {
    const group = (CLAIM_LABELS[c.label] ?? CLAIM_LABELS.unverifiable).group;
    g[group] += 1;
  }
  return g;
}

function headline(g: Record<string, number>, total: number) {
  const checkable = total - g.unclear;
  if (total === 0 || checkable === 0) return "We couldn't find enough checkable claims in this video to judge it.";
  if (g.overstated === 0 && g.context === 0) return "The claims we could check hold up against the data.";
  if (g.overstated === 0) return "Mostly in line with the data, but some claims leave out important context.";
  if (g.overstated > g.holds + g.context) return "Several claims go further than the data supports.";
  return "A mix: some claims hold up, others go further than the data supports.";
}

function countLine(g: Record<string, number>, total: number) {
  const parts: string[] = [];
  if (g.holds) parts.push(`${g.holds} ${g.holds === 1 ? "holds" : "hold"} up`);
  if (g.context) parts.push(`${g.context} ${g.context === 1 ? "needs" : "need"} more context`);
  if (g.overstated) parts.push(`${g.overstated} ${g.overstated === 1 ? "goes" : "go"} further than the data`);
  if (g.unclear) parts.push(`${g.unclear} can't be checked`);
  if (parts.length === 0) return "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Of ${total} ${total === 1 ? "claim" : "claims"} we checked, ${list}.`;
}

function priceLine(results: Result[], correct: number, finished: number) {
  if (results.length === 0) return "No price predictions with a clear target were found.";
  if (finished > 0) return `Price calls: ${correct} of ${finished} finished ${finished === 1 ? "call" : "calls"} came true.`;
  return `${results.length} price ${results.length === 1 ? "call was" : "calls were"} found, but none can be scored yet.`;
}

function useCountUp(target: number | null) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 900, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function HeroChart() {
  const facts =
    "M20 210 L70 196 L115 204 L165 172 L215 184 L265 146 L310 162 L360 128 L410 170 L460 150 L515 158 L565 118 L615 134 L665 104 L715 120 L780 96";
  return (
    <svg viewBox="0 0 800 260" className="heroChart" role="img" aria-label="What was said versus what happened">
      <defs>
        <linearGradient id="factsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="reveal">
          <rect className="revealRect" x="0" y="0" width="800" height="260" />
        </clipPath>
      </defs>
      {[50, 100, 150, 200].map((y) => (
        <line key={y} x1="0" x2="800" y1={y} y2={y} className="gridLine" />
      ))}
      <g clipPath="url(#reveal)">
        <path d={`${facts} L780 260 L20 260 Z`} fill="url(#factsFill)" />
        <path d="M20 210 C 260 180, 520 90, 780 22" className="talkLine" />
        <path d={facts} className="factsLine" />
      </g>
      <circle cx="780" cy="22" r="5" className="talkDot" />
      <circle cx="780" cy="96" r="5" className="factsDot" />
      <text x="770" y="16" className="chartLabel talkLabel" textAnchor="end">
        What was said
      </text>
      <text x="770" y="88" className="chartLabel factsLabel" textAnchor="end">
        What really happened
      </text>
    </svg>
  );
}

function Donut({ groups, total }: { groups: Record<string, number>; total: number }) {
  const shown = useCountUp(total);
  const r = 54;
  const c = 2 * Math.PI * r;
  const parts = GROUPS.filter((g) => groups[g.key] > 0);
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={`${total} claims checked`}>
      <circle cx="70" cy="70" r={r} className="donutTrack" />
      <g transform="rotate(-90 70 70)">
        {total > 0 &&
          parts.map((p, i) => {
            const len = (groups[p.key] / total) * c;
            const seg = (
              <circle
                key={p.key}
                cx="70"
                cy="70"
                r={r}
                className={`donutSeg ${p.tone}`}
                strokeDasharray={`${Math.max(len - gap, 1)} ${c}`}
                strokeDashoffset={-offset}
                style={{ animationDelay: `${200 + i * 180}ms` }}
              />
            );
            offset += len;
            return seg;
          })}
      </g>
      <text x="70" y="72" className="donutNum">
        {shown}
      </text>
      <text x="70" y="92" className="donutCaption">
        {total === 1 ? "claim" : "claims"}
      </text>
    </svg>
  );
}

function SourceRef({ id, sources }: { id: string; sources: Source[] }) {
  const s = sources.find((x) => x.id === id);
  if (!s) return null;
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer" className="sourceRef">
      [{id}]
    </a>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const busy = step >= 0 && step < 5;

  const finished = (results ?? []).filter((r) => r.verdict === "correct" || r.verdict === "wrong");
  const correct = (results ?? []).filter((r) => r.verdict === "correct").length;
  const groups = countGroups(claims);

  async function analyze(target?: string) {
    const link = (target ?? url).trim();
    if (!link || busy) return;
    if (target) setUrl(target);
    setError(null);
    setVideo(null);
    setResults(null);
    setClaims([]);
    setSummary(null);
    setOpen(false);
    setStep(0);

    try {
      const v = await post("/api/transcript", { url: link });
      setVideo({ title: v.title, channel: v.channel, video_date: v.video_date });
      setStep(1);

      const claimsPromise: Promise<Claim[]> = post("/api/claims", {
        transcript: v.transcript,
        title: v.title,
        video_date: v.video_date,
      })
        .then((d) => (Array.isArray(d.claims) ? d.claims : []))
        .catch(() => []);

      const ex = await post("/api/extract", {
        transcript: `Video published on ${v.video_date}.\n\n${v.transcript}`,
      });
      setStep(2);

      const checked: Result[] = await Promise.all(
        ex.predictions.map(async (p: Result) => {
          try {
            const c = await post("/api/check", {
              symbol: p.symbol,
              direction: p.direction,
              target_price: p.target_price,
              start_date: v.video_date,
              deadline: p.deadline,
            });
            return { ...p, ...c };
          } catch {
            return { ...p, status: "no_data" };
          }
        })
      );

      let final: Result[] = checked.map((r) => ({ ...r, verdict: r.status, reasoning: null }));

      if (checked.length > 0) {
        setStep(3);
        try {
          const j = await post("/api/judge", {
            title: v.title,
            channel: v.channel,
            video_date: v.video_date,
            results: checked,
          });
          final = checked.map((r, i) => {
            const found = j.verdicts.find((x: { index: number }) => x.index === i);
            return { ...r, verdict: found?.verdict ?? r.status, reasoning: found?.reasoning ?? null };
          });
          setSummary(j.summary);
        } catch {
          setSummary("The review could not finish, so these are the plain price checks.");
        }
      }

      setStep(4);
      const checkedClaims = await claimsPromise;

      setResults(final);
      setClaims(checkedClaims);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep(-1);
    }
  }

  const showIntro = !results && !busy;
  const progress = busy ? ((step + 0.5) / STEPS.length) * 100 : 0;

  return (
    <main className={`page ${sans.className}`}>
      {busy && (
        <div className="progress" aria-hidden="true">
          <div className="progressFill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="inner">
        <h1 className="brand">
          <span className={`talk ${serif.className}`}>Talk</span>
          <span className="vs">vs</span>
          <span className="facts">Facts</span>
        </h1>
        <p className="lead">
          Paste a finance video. We check what was said against real market data and trusted sources.
        </p>

        <div className="form">
          <input
            className="input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            disabled={busy}
            aria-label="YouTube link"
          />
          <button className="button" onClick={() => analyze()} disabled={busy || !url.trim()}>
            {busy ? "Checking..." : "Check video"}
          </button>
        </div>

        <div className="examples">
          <span>Try an example:</span>
          {EXAMPLES.map((e) => (
            <button key={e.url} className="exampleBtn" onClick={() => analyze(e.url)} disabled={busy}>
              {e.label}
            </button>
          ))}
        </div>

        {busy && (
          <ol className="steps">
            {STEPS.map((label, i) => (
              <li key={label} className={`step ${i === step ? "stepActive" : ""} ${i < step ? "stepDone" : ""}`}>
                <span className="dot" />
                {label}
              </li>
            ))}
          </ol>
        )}

        {error && <div className="error">{error}</div>}

        {showIntro && (
          <section className="how">
            <div className="chartCard">
              <HeroChart />
            </div>
            <p className={`howText ${serif.className}`}>
              Most finance videos are not lies, and not proof either. They are claims. Some hold up, some leave out
              the risks, some go further than the data. We show you which is which, with sources.
            </p>
            <ol className="howSteps">
              {HOW.map((h, i) => (
                <li key={h.title} style={{ animationDelay: `${1200 + i * 120}ms` }}>
                  <div className="howNum">{i + 1}</div>
                  <div className="howTitle">{h.title}</div>
                  <p className="howBody">{h.body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {results && video && (
          <>
            <section className="overview">
              <div className="channel">
                {video.channel}, published {niceDate(video.video_date)}
              </div>
              <h2 className="title">{video.title}</h2>
            </section>

            <section className="summary" aria-labelledby="in-short">
              <h2 id="in-short" className="summaryLabel">
                In short
              </h2>
              <div className="summaryGrid">
                <Donut groups={groups} total={claims.length} />
                <div>
                  <p className={`headline ${serif.className}`}>{headline(groups, claims.length)}</p>
                  {claims.length > 0 && <p className="summaryText">{countLine(groups, claims.length)}</p>}
                  <p className="summaryMuted">{priceLine(results, correct, finished.length)}</p>
                </div>
              </div>

              {claims.length > 0 && (
                <ul className="legend">
                  {GROUPS.map((g) => (
                    <li key={g.key}>
                      <span className={`swatch ${g.tone}`} />
                      {g.label}
                      <span className="legendCount">{groups[g.key]}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="readNote">
                These are claims, not proof either way. “Holds up” means trusted data backs it. “Needs context” means
                the idea is fair, but risks or assumptions are left out. We rate the claims, not the person, and nothing
                here tells you what to buy or sell.
              </p>

              {(claims.length > 0 || results.length > 0) && (
                <button className="detailsBtn" onClick={() => setOpen(!open)} aria-expanded={open}>
                  {open ? "Hide the evidence" : "Show the evidence"}
                </button>
              )}
            </section>

            {open && (
              <div className="details">
                {claims.length > 0 && (
                  <>
                    <h3 className="sectionTitle">Claims</h3>
                    <p className="sectionNote">
                      Checked against trusted sources like the Federal Reserve, IMF, S&amp;P, Vanguard and Morningstar.
                    </p>
                  </>
                )}

                {claims.map((c, i) => {
                  const l = CLAIM_LABELS[c.label] ?? CLAIM_LABELS.unverifiable;
                  const showConfidence = l.group !== "unclear" && c.confidence > 0;
                  return (
                    <article key={`c${i}`} className="row" style={{ animationDelay: `${i * 90}ms` }}>
                      <div className="rowHead">
                        <div>
                          <div className="asset">{c.claim}</div>
                          <div className="call">
                            {c.period && c.period !== "long term" ? `About ${c.period}` : "Long term"}
                            {showConfidence ? `, confidence ${Math.round(c.confidence * 100)}%` : ""}
                          </div>
                        </div>
                        <span className={`stamp ${l.tone}`}>{l.label}</span>
                      </div>

                      <div className="split">
                        <div>
                          <div className="sideLabel">They said</div>
                          <blockquote className={`quote quoteSmall ${serif.className}`}>“{c.quote}”</blockquote>
                        </div>
                        <div>
                          {c.supporting.length > 0 && (
                            <>
                              <div className="sideLabel">What sources say</div>
                              <ul className="points">
                                {c.supporting.map((p, k) => (
                                  <li key={k}>
                                    {p.text}
                                    <SourceRef id={p.source} sources={c.sources} />
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                          {c.risks.length > 0 && (
                            <>
                              <div className="sideLabel">Risks to know</div>
                              <ul className="points">
                                {c.risks.map((p, k) => (
                                  <li key={k}>
                                    {p.text}
                                    <SourceRef id={p.source} sources={c.sources} />
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                          {c.supporting.length === 0 && c.risks.length === 0 && (
                            <div className="call">No trusted sources found for this claim.</div>
                          )}
                        </div>
                      </div>

                      {c.summary && <p className="reasoning">{c.summary}</p>}

                      {c.sources.length > 0 && (
                        <div className="sourceList">
                          {c.sources.map((s) => (
                            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.id}: {s.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}

                {results.length > 0 && (
                  <>
                    <h3 className="sectionTitle">Price calls</h3>
                    <p className="sectionNote">Checked against historical prices from Yahoo Finance.</p>
                    {summary && <p className="judgeNote">{summary}</p>}
                  </>
                )}

                {results.map((r, i) => {
                  const v = VERDICTS[r.verdict ?? ""] ?? { label: "No price data", tone: "muted" };
                  return (
                    <article key={i} className="row" style={{ animationDelay: `${(claims.length + i) * 90}ms` }}>
                      <div className="rowHead">
                        <div>
                          <div className="asset">{r.asset}</div>
                          <div className="call">{callText(r)}</div>
                        </div>
                        <span className={`stamp ${v.tone}`}>{v.label}</span>
                      </div>

                      <div className="split">
                        <div>
                          <div className="sideLabel">They said</div>
                          <blockquote className={`quote quoteSmall ${serif.className}`}>“{r.quote}”</blockquote>
                        </div>
                        <div>
                          <div className="sideLabel">What happened</div>
                          {r.startPrice != null ? (
                            <dl className="prices">
                              <dt>On video day</dt>
                              <dd>{money(r.startPrice)}</dd>
                              <dt>Highest after</dt>
                              <dd>{money(r.highest)}</dd>
                              <dt>Lowest after</dt>
                              <dd>{money(r.lowest)}</dd>
                              <dt>Last checked</dt>
                              <dd>{money(r.endPrice)}</dd>
                            </dl>
                          ) : (
                            <div className="call">No price data for {r.symbol}.</div>
                          )}
                        </div>
                      </div>

                      {r.reasoning && <p className="reasoning">{r.reasoning}</p>}
                    </article>
                  );
                })}
              </div>
            )}

            <p className="aiNote">
              AI-generated analysis using NVIDIA Nemotron via Nebius. It can contain errors and is not reviewed by a
              human. This is not financial advice and does not recommend buying or selling anything. Past performance
              does not guarantee future results.
            </p>
          </>
        )}

        <footer className="footer">
          <span>Talk vs Facts, a free hackathon project. Not financial advice.</span>
          <nav className="footerLinks" aria-label="Legal">
            <a href="/methodology">How we check</a>
            <a href="/disclaimer">Disclaimer</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}