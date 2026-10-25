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

type Video = { title: string; channel: string; video_date: string };

const STEPS = ["Getting the transcript", "Finding price predictions", "Checking real prices", "Judge is reviewing"];

const VERDICTS: Record<string, { label: string; tone: string }> = {
  correct: { label: "Came true", tone: "good" },
  wrong: { label: "Missed", tone: "bad" },
  already_true: { label: "Already true", tone: "warn" },
  pending: { label: "Still open", tone: "info" },
  no_deadline: { label: "No deadline", tone: "info" },
  not_a_prediction: { label: "Not a prediction", tone: "muted" },
};

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

function toneFor(score: number) {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const busy = step >= 0 && step < 4;

  const finished = (results ?? []).filter((r) => r.verdict === "correct" || r.verdict === "wrong");
  const correct = (results ?? []).filter((r) => r.verdict === "correct").length;
  const hitRate = finished.length > 0 ? Math.round((correct / finished.length) * 100) : null;

  const shownScore = useCountUp(score);
  const shownHit = useCountUp(hitRate);

  async function analyze() {
    if (!url.trim() || busy) return;
    setError(null);
    setVideo(null);
    setResults(null);
    setScore(null);
    setSummary(null);
    setStep(0);

    try {
      const v = await post("/api/transcript", { url });
      setVideo({ title: v.title, channel: v.channel, video_date: v.video_date });
      setStep(1);

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
          setScore(j.trust_score);
          setSummary(j.summary);
        } catch {
          setSummary("The judge could not finish, so these are the plain price checks.");
        }
      }

      setResults(final);
      setStep(4);
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
          Paste a finance video. We find every price call in it and check it against what the market really did.
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
                  <div className="statLabel">Hit rate on finished calls</div>
                </div>
                {score != null && (
                  <div className={toneFor(score)}>
                    <div className="statValue">{shownScore}</div>
                    <div className="bar">
                      <div className="barFill" style={{ width: `${score}%` }} />
                    </div>
                    <div className="statLabel">Trust score</div>
                  </div>
                )}
                <div>
                  <div className="statValue">{results.length}</div>
                  <div className="statLabel">Price calls found</div>
                </div>
              </div>

              {summary && <p className="judgeNote">{summary}</p>}
            </section>

            {results.length === 0 && (
              <p className="empty">No price predictions found in this video. Try one where the creator names a price target.</p>
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
          </>
        )}
      </div>
    </main>
  );
}