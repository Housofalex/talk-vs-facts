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
  label: string;
  confidence: number;
  summary: string;
  supporting: Point[];
  risks: Point[];
  sources: Source[];
};

type Video = { title: string; channel: string; video_date: string };

const STEPS = [
  "Getting the transcript",
  "Finding price predictions",
  "Checking real prices",
  "Judge is reviewing",
  "Checking claims with trusted sources",
];

const VERDICTS: Record<string, { label: string; tone: string }> = {
  correct: { label: "Came true", tone: "good" },
  wrong: { label: "Missed", tone: "bad" },
  already_true: { label: "Already true", tone: "warn" },
  pending: { label: "Still open", tone: "info" },
  no_deadline: { label: "No deadline", tone: "info" },
  not_a_prediction: { label: "Not a prediction", tone: "muted" },
};

const CLAIM_LABELS: Record<string, { label: string; tone: string }> = {
  supported: { label: "Supported", tone: "good" },
  historically_supported: { label: "True so far, not guaranteed", tone: "info" },
  missing_context: { label: "Missing context", tone: "warn" },
  misleading: { label: "Misleading", tone: "bad" },
  not_supported: { label: "Not supported", tone: "bad" },
  unverifiable: { label: "Can't verify", tone: "muted" },
  opinion: { label: "Opinion", tone: "muted" },
};

const sectionTitle = { fontSize: 22, fontWeight: 600, margin: "56px 0 4px" };
const sectionNote = { opacity: 0.6, margin: "0 0 8px" };
const pointList = { margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.55 };
const sourceLink = { color: "inherit", opacity: 0.7, textDecoration: "underline", fontSize: 13 };

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

function SourceRef({ id, sources }: { id: string; sources: Source[] }) {
  const s = sources.find((x) => x.id === id);
  if (!s) return null;
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer" style={sourceLink}>
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

  const busy = step >= 0 && step < 5;

  const finished = (results ?? []).filter((r) => r.verdict === "correct" || r.verdict === "wrong");
  const correct = (results ?? []).filter((r) => r.verdict === "correct").length;
  const hitRate = finished.length > 0 ? Math.round((correct / finished.length) * 100) : null;

  const shownHit = useCountUp(hitRate);

  async function analyze() {
    if (!url.trim() || busy) return;
    setError(null);
    setVideo(null);
    setResults(null);
    setClaims([]);
    setSummary(null);
    setStep(0);

    try {
      const v = await post("/api/transcript", { url });
      setVideo({ title: v.title, channel: v.channel, video_date: v.video_date });
      setStep(1);

      const claimsPromise: Promise<Claim[]> = post("/api/claims", {
        transcript: v.transcript,
        title: v.title,
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
          setSummary("The judge could not finish, so these are the plain price checks.");
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

  return (
    <main className={`page ${sans.className}`}>
      <div className="inner">
        <h1 className="brand">
          <span className={`talk ${serif.className}`}>Talk</span>
          <span className="vs">vs</span>
          <span>Facts</span>
        </h1>
        <p className="lead">
          Paste a finance video. We find the price calls and claims in it and check them against real market data and
          trusted sources.
        </p>

        <div className="form">
          <input
            className="input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            disabled={busy}
          />
          <button className="button" onClick={analyze} disabled={busy || !url.trim()}>
            {busy ? "Checking..." : "Check video"}
          </button>
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

        {results && video && (
          <>
            <section className="overview">
              <div className="channel">
                {video.channel}, published {niceDate(video.video_date)}
              </div>
              <h2 className="title">{video.title}</h2>

              <div className="stats">
                <div>
                  <div className="statValue">{hitRate != null ? `${shownHit}%` : "n/a"}</div>
                  <div className="statLabel">
                    {hitRate != null
                      ? `Hit rate, ${correct} of ${finished.length} finished calls`
                      : "Hit rate, no finished calls yet"}
                  </div>
                </div>
                <div>
                  <div className="statValue">{results.length}</div>
                  <div className="statLabel">Price calls found</div>
                </div>
                <div>
                  <div className="statValue">{claims.length}</div>
                  <div className="statLabel">Claims checked</div>
                </div>
              </div>

              {summary && <p className="judgeNote">{summary}</p>}
            </section>

            {results.length === 0 && claims.length === 0 && (
              <p className="empty">
                No price calls or checkable claims found in this video. Try one where the creator names a price target
                or makes claims about markets.
              </p>
            )}

            {results.length > 0 && (
              <>
                <h3 style={sectionTitle}>Price calls</h3>
                <p style={sectionNote}>Checked against historical prices from Yahoo Finance.</p>
              </>
            )}

            {results.map((r, i) => {
              const v = VERDICTS[r.verdict ?? ""] ?? { label: "No price data", tone: "muted" };
              return (
                <article key={i} className="row" style={{ animationDelay: `${200 + i * 100}ms` }}>
                  <div className="rowHead">
                    <div>
                      <div className="asset">{r.asset}</div>
                      <div className="call">{callText(r)}</div>
                    </div>
                    <span className={`stamp ${v.tone}`} style={{ animationDelay: `${500 + i * 100}ms` }}>
                      {v.label}
                    </span>
                  </div>

                  <div className="split">
                    <div>
                      <div className="sideLabel">They said</div>
                      <blockquote className={`quote ${serif.className}`}>“{r.quote}”</blockquote>
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

            {claims.length > 0 && (
              <>
                <h3 style={sectionTitle}>Claims</h3>
                <p style={sectionNote}>
                  Checked against trusted sources like the SEC, Federal Reserve, S&amp;P and central banks. We rate the
                  claim, not the person.
                </p>
              </>
            )}

            {claims.map((c, i) => {
              const l = CLAIM_LABELS[c.label] ?? CLAIM_LABELS.unverifiable;
              const delay = 200 + (results.length + i) * 100;
              return (
                <article key={`c${i}`} className="row" style={{ animationDelay: `${delay}ms` }}>
                  <div className="rowHead">
                    <div>
                      <div className="asset">{c.claim}</div>
                      {c.confidence > 0 && (
                        <div className="call">Confidence {Math.round(c.confidence * 100)}%</div>
                      )}
                    </div>
                    <span className={`stamp ${l.tone}`} style={{ animationDelay: `${delay + 300}ms` }}>
                      {l.label}
                    </span>
                  </div>

                  <div className="split">
                    <div>
                      <div className="sideLabel">They said</div>
                      <blockquote className={`quote ${serif.className}`}>“{c.quote}”</blockquote>
                    </div>
                    <div>
                      {c.supporting.length > 0 && (
                        <>
                          <div className="sideLabel">What sources say</div>
                          <ul style={pointList}>
                            {c.supporting.map((p, k) => (
                              <li key={k}>
                                {p.text} <SourceRef id={p.source} sources={c.sources} />
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {c.risks.length > 0 && (
                        <>
                          <div className="sideLabel">Risks to know</div>
                          <ul style={pointList}>
                            {c.risks.map((p, k) => (
                              <li key={k}>
                                {p.text} <SourceRef id={p.source} sources={c.sources} />
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                      {c.sources.map((s) => (
                        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" style={sourceLink}>
                          {s.id}: {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}

            <p className="call" style={{ marginTop: 48, opacity: 0.6, fontSize: 13, lineHeight: 1.6 }}>
              AI-generated analysis using NVIDIA Nemotron via Nebius. It can contain errors and is not reviewed by a
              human. This is not financial advice and does not recommend buying or selling anything. Past performance
              does not guarantee future results.
            </p>
          </>
        )}
      </div>
    </main>
  );
}