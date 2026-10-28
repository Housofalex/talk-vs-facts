import { notFound } from "next/navigation";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import "../talk.css";

const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500"] });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EMAIL = "talkvsfacts.team@gmail.com";
const UPDATED = "October 28, 2026";

type LabelRow = { label: string; tone: string; text: string };
type Section = { heading: string; text?: string[]; list?: string[]; labels?: LabelRow[] };
type Doc = { title: string; tab: string; summary: string[]; sections: Section[] };

const ORDER = ["methodology", "disclaimer", "privacy", "terms", "contact"];

const PAGES: Record<string, Doc> = {
  methodology: {
    title: "How we check",
    tab: "How we check",
    summary: [
      "We check price predictions against real price history, and claims against trusted sources.",
      "Every quote is verified against the real transcript, and every source link is one we actually found.",
      "We rate claims, never people, and we do not store or rank results.",
    ],
    sections: [
      {
        heading: "Getting the transcript",
        text: [
          "When you paste a YouTube link, we get the video's transcript, title, channel and publish date through Supadata, a third party service.",
        ],
        list: ["We only analyze videos that a visitor asks for.", "We do not crawl or collect YouTube content on our own."],
      },
      {
        heading: "Price calls",
        list: [
          "NVIDIA Nemotron Nano finds price predictions, like a target price for a stock or coin by a certain date.",
          "We compare each prediction with Yahoo Finance prices from the publish date until the deadline.",
          "NVIDIA Nemotron Ultra reviews each result, for example to catch statements that are not real predictions.",
          "The hit rate only counts finished calls, and always shows how many calls it is based on.",
        ],
      },
      {
        heading: "Claims",
        list: [
          "The AI picks up to 5 checkable claims about markets, investing or the economy. Personal plans, stories and opinions are skipped.",
          "Every quote is checked against the real transcript in code. Quotes that are not in the video are removed.",
          "Claims that do not match what the quote really says are removed.",
          "We search with Tavily, limited to trusted sources such as the Federal Reserve, IMF, World Bank, S&P Dow Jones Indices, Vanguard, Fidelity, Schwab, Morningstar, FINRA and university research.",
          "NVIDIA Nemotron Ultra judges each claim using only those sources. Citations to sources we did not actually find are removed in code.",
        ],
      },
      {
        heading: "What the labels mean",
        labels: [
          { label: "Holds up", tone: "good", text: "Trusted sources confirm the claim as it was said." },
          {
            label: "True so far, not guaranteed",
            tone: "good",
            text: "About the future, but backed by long term historical data.",
          },
          {
            label: "Needs context",
            tone: "warn",
            text: "The idea is fair, but it leaves out risks, assumptions or time frames, or rounds a number.",
          },
          { label: "Overstated", tone: "bad", text: "The claim gives a clearly stronger impression than the data supports." },
          {
            label: "Data disagrees",
            tone: "bad",
            text: "A trusted source directly contradicts the claim for the same measure and period.",
          },
          { label: "Can't verify", tone: "muted", text: "The sources we found do not clearly answer the claim." },
          { label: "Opinion", tone: "muted", text: "A personal belief that cannot be checked with data." },
        ],
      },
      {
        heading: "Fairness rules",
        list: [
          "We rate claims, never people. No rankings or lists of creators.",
          "Results are not stored. They only exist when someone checks a video.",
          "Overstated or Data disagrees needs at least 60% confidence. Otherwise the claim is marked Can't verify.",
          "Absolute words like always, never, impossible, guaranteed or like clockwork can't get Holds up when the data shows exceptions.",
          "The summary at the top is built from the counts by code, not written by the AI, so it can't exaggerate.",
        ],
      },
      {
        heading: "Limits",
        list: [
          "AI can make mistakes.",
          "Transcripts can contain errors.",
          "Sources can be incomplete or outdated.",
          "Checking the same video twice can give slightly different results.",
          "Always open the sources and judge for yourself.",
        ],
      },
      {
        heading: "Corrections",
        text: [
          "If you think a result about your own video is wrong, see the Contact page. If we made a mistake, we fix the method.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    tab: "Disclaimer",
    summary: [
      "Nothing on this site is financial advice.",
      "Results are made by AI and can be wrong.",
      "A label on a claim says nothing about the person who made it.",
    ],
    sections: [
      {
        heading: "Not financial advice",
        list: [
          "Talk vs Facts is a free, non-commercial educational tool.",
          "Nothing here is a personal recommendation, an offer, or a request to buy or sell any financial instrument.",
          "Nothing here takes into account your personal financial situation, goals or risk tolerance.",
          "Investing involves risk, including the loss of your money. Past returns do not guarantee future returns.",
          "Data may be delayed, incomplete or wrong.",
          "We are not registered as a financial service provider or investment adviser in any country. Talk to a licensed professional before making investment decisions.",
        ],
      },
      {
        heading: "AI-generated content",
        text: [
          "All analyses are generated by AI models (NVIDIA Nemotron via Nebius) and are not reviewed by a human before they are shown. They can contain errors. Always check the linked sources yourself.",
        ],
      },
      {
        heading: "About creators",
        text: [
          "Results describe specific statements in specific videos, not the people who made them. A label says nothing about a creator's honesty, intent or overall quality.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    tab: "Privacy",
    summary: [
      "No accounts, no tracking cookies, no analytics and no ads.",
      "We do not store the analyses you create.",
      "Our service providers never receive your IP address or personal data.",
    ],
    sections: [
      {
        heading: "Who is responsible",
        text: [`Alexander Rohrbach, Kanton Solothurn, Switzerland. Contact: ${EMAIL}`],
      },
      {
        heading: "What we process",
        list: [
          "Technical request data (IP address, browser type, time and requested page), processed by our hosting provider Vercel Inc. (USA) to deliver the site and keep it secure.",
          "The YouTube link you paste into the site.",
          "Publicly available information from the video you check, such as the channel name, title and quotes.",
        ],
      },
      {
        heading: "What we do not do",
        list: [
          "No user accounts.",
          "No tracking or advertising cookies.",
          "No analytics tools and no ads.",
          "No storage of your analyses.",
        ],
      },
      {
        heading: "Service providers",
        list: [
          "Supadata (Germany): transcripts and video information.",
          "Nebius (data centers in the EU and USA): AI models (NVIDIA Nemotron).",
          "Tavily (USA): web search for sources.",
          "Yahoo Finance: historical price data.",
        ],
        text: [
          "We only send these providers the video link, transcript text, claims and ticker symbols. Never your IP address or other information about you.",
        ],
      },
      {
        heading: "Transfers abroad",
        text: [
          "Some providers are located in the USA. Vercel is certified under the Swiss-U.S. and EU-U.S. Data Privacy Framework. For other providers, transfers rely on their standard contractual safeguards.",
        ],
      },
      {
        heading: "Legal basis",
        text: [
          "Under the Swiss Federal Act on Data Protection (FADP) and, where it applies, the EU GDPR, we rely on our legitimate interest in running a secure website and publishing fact-based analysis of public statements (GDPR Art. 6(1)(f)).",
        ],
      },
      {
        heading: "How long we keep data",
        list: ["Server logs: according to Vercel's standard retention.", "Analyses: not stored."],
      },
      {
        heading: "Your rights",
        list: [
          "Ask for access to, correction of or deletion of your data.",
          "Object to the processing of your data.",
          "Complain to the Swiss Federal Data Protection and Information Commissioner (FDPIC) or your local EU data protection authority.",
        ],
        text: [`For privacy requests, email ${EMAIL} with "Privacy request" in the subject.`],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    tab: "Terms",
    summary: [
      "Free to use, provided as it is.",
      "Results can be wrong and are not advice.",
      "Swiss law applies.",
    ],
    sections: [
      {
        heading: "The service",
        text: [
          "Talk vs Facts is a free educational tool, provided as it is, without any promise that it is accurate, complete or always available.",
        ],
      },
      {
        heading: "No advice",
        text: ["Nothing on this site is financial, investment, tax or legal advice. See the Disclaimer page."],
      },
      {
        heading: "AI output",
        text: ["Results are generated by AI and can be wrong. Always check the linked sources."],
      },
      {
        heading: "Fair use",
        list: [
          "No automated mass requests.",
          "No attempts to break, overload or misuse the service.",
          "No use for anything unlawful.",
        ],
      },
      {
        heading: "Third party content",
        text: [
          "Videos, transcripts and sources belong to their owners. We show short quotes only to explain and support a result, always with a link to the original.",
        ],
      },
      {
        heading: "Liability",
        text: [
          "To the extent permitted by law, we exclude liability for any loss or damage from using or relying on the service or its results, including investment losses. Liability for intent or gross negligence is not affected.",
        ],
      },
      {
        heading: "Changes",
        text: ["We may update these terms. The date at the bottom shows the latest version."],
      },
      {
        heading: "Law",
        text: [
          "These terms are governed by Swiss law. The place of jurisdiction is Solothurn, Switzerland, subject to mandatory consumer protection rules.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    tab: "Contact",
    summary: [
      "This email is only for corrections, privacy requests and legal matters.",
      "We do not answer investment questions or requests to check videos.",
      "We reply to valid requests within 7 days.",
    ],
    sections: [
      {
        heading: "Who runs this site",
        text: [
          "Talk vs Facts is a free, non-commercial project built for the Nebius x NVIDIA Global AI Hackathon 2026, run by Alexander Rohrbach, Kanton Solothurn, Switzerland. No advertising, no paid services, no affiliate links.",
          `Email: ${EMAIL}`,
        ],
      },
      {
        heading: "Use this email for",
        list: [
          "Corrections: you are the creator of a video and think a result is wrong.",
          "Privacy requests: access, correction or deletion of your data.",
          "Legal matters concerning this website.",
        ],
      },
      {
        heading: "We don't answer",
        list: [
          "Investment questions or requests for financial advice.",
          "Requests to check a video for you. Use the tool on the homepage.",
          "General feedback, support or promotion requests.",
        ],
      },
      {
        heading: "Please include",
        list: [
          "The YouTube link of the video.",
          "The exact claim or result you mean.",
          "Why you think it is wrong, ideally with a source.",
          "For creators: proof that you own the channel, for example an email from your channel's official address.",
        ],
        text: ["Requests without this information may not get a reply."],
      },
    ],
  },
};

const box = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: "20px 24px",
  margin: "28px 0 8px",
};

const tabs = { display: "flex", flexWrap: "wrap" as const, gap: 8, margin: "40px 0 0" };

const tab = {
  border: "1px solid var(--line)",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 14,
  textDecoration: "none",
  color: "var(--muted)",
};

const tabActive = { ...tab, color: "var(--text)", borderColor: "var(--talk)" };

const list = { margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.6, maxWidth: "68ch" };

const labelRow = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 220px) 1fr",
  gap: 16,
  alignItems: "start",
  padding: "12px 0",
  borderBottom: "1px solid var(--line)",
};

export function generateStaticParams() {
  return ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = PAGES[slug];
  return { title: doc ? `${doc.title} | Talk vs Facts` : "Talk vs Facts" };
}

function withEmail(text: string) {
  const parts = text.split(EMAIL);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        <a href={`mailto:${EMAIL}`} style={{ color: "var(--info)" }}>
          {EMAIL}
        </a>
      )}
    </span>
  ));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = PAGES[slug];
  if (!doc) notFound();

  return (
    <main className={`page ${sans.className}`}>
      <div className="inner">
        <a href="/" className="brand" style={{ fontSize: 32, textDecoration: "none", color: "inherit" }}>
          <span className={`talk ${serif.className}`}>Talk</span>
          <span className="vs">vs</span>
          <span>Facts</span>
        </a>

        <nav style={tabs} aria-label="Legal pages">
          {ORDER.map((key) => (
            <a
              key={key}
              href={`/${key}`}
              style={key === slug ? tabActive : tab}
              aria-current={key === slug ? "page" : undefined}
            >
              {PAGES[key].tab}
            </a>
          ))}
        </nav>

        <h1 style={{ fontSize: 40, fontWeight: 600, margin: "40px 0 4px", letterSpacing: "-0.01em" }}>{doc.title}</h1>
        <div className="call">Last updated: {UPDATED}</div>

        <div style={box}>
          <div className="summaryLabel" style={{ marginBottom: 10 }}>
            In short
          </div>
          <ul style={{ ...list, margin: 0 }}>
            {doc.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        {doc.sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="sectionTitle">
              <span style={{ color: "var(--talk)", marginRight: 10 }}>{i + 1}.</span>
              {s.heading}
            </h2>

            {s.text?.map((t, k) => (
              <p key={k} className="judgeNote">
                {withEmail(t)}
              </p>
            ))}

            {s.list && (
              <ul style={list}>
                {s.list.map((item, k) => (
                  <li key={k}>{withEmail(item)}</li>
                ))}
              </ul>
            )}

            {s.labels && (
              <div style={{ marginTop: 12 }}>
                {s.labels.map((l) => (
                  <div key={l.label} style={labelRow}>
                    <span className={`stamp ${l.tone}`} style={{ justifySelf: "start" }}>
                      {l.label}
                    </span>
                    <span style={{ lineHeight: 1.55, paddingTop: 4 }}>{l.text}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <p className="aiNote">This page is not legal advice.</p>

        <footer className="footer">
          <a href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>
            Back to Talk vs Facts
          </a>
          <nav className="footerLinks" aria-label="Legal">
            {ORDER.map((key) => (
              <a key={key} href={`/${key}`}>
                {PAGES[key].tab}
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </main>
  );
}