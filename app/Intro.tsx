"use client";

import { useEffect, useState } from "react";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";

const serif = Newsreader({ subsets: ["latin"], style: ["italic"], weight: ["400"] });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600"] });

const DIVE_KEY = "tvf-dive";

const CSS = `
.intro {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #050706;
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;
  animation: introOut 700ms cubic-bezier(0.7, 0, 0.3, 1) 2.5s forwards;
}
.introQuick {
  cursor: default;
  animation: introOut 750ms cubic-bezier(0.3, 0, 0.2, 1) 80ms forwards;
}
@keyframes introOut {
  to { opacity: 0; visibility: hidden; }
}
.arriveWarp {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 300vmax;
  height: 300vmax;
  background: repeating-conic-gradient(from 0deg, transparent 0deg 2deg, rgba(47, 214, 123, 0.55) 2deg 2.35deg, transparent 2.35deg 6deg);
  -webkit-mask-image: radial-gradient(circle, transparent 0 5%, black 25%, transparent 60%);
  mask-image: radial-gradient(circle, transparent 0 5%, black 25%, transparent 60%);
  transform: translate(-50%, -50%) scale(1.6);
  animation: warpCollapse 800ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
@keyframes warpCollapse {
  to { transform: translate(-50%, -50%) scale(0.2) rotate(8deg); opacity: 0; }
}
.introStage {
  position: relative;
  text-align: center;
  animation: zoomThrough 900ms cubic-bezier(0.7, 0, 0.9, 0.4) 2.3s forwards;
}
@keyframes zoomThrough {
  to { transform: scale(14); opacity: 0; filter: blur(6px); }
}
.introGlow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 900px;
  height: 900px;
  pointer-events: none;
  background: radial-gradient(circle, rgba(47, 214, 123, 0.35), transparent 60%);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.2);
  animation: glowBurst 1.4s ease-out 1.25s forwards;
}
@keyframes glowBurst {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
  30% { opacity: 1; }
  100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.2); }
}
.introBrand {
  position: relative;
  font-size: clamp(56px, 12vw, 140px);
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #e9eeeb;
  white-space: nowrap;
}
.introTalk {
  display: inline-block;
  color: #a7b0ab;
  font-weight: 400;
  opacity: 0;
  animation: talkReveal 900ms ease-out 200ms forwards;
}
@keyframes talkReveal {
  from { opacity: 0; filter: blur(14px); transform: translateX(-24px); }
  to { opacity: 1; filter: none; transform: none; }
}
.introVs {
  display: inline-block;
  font-size: 0.3em;
  font-weight: 400;
  color: #87918c;
  margin: 0 0.5em;
  vertical-align: middle;
  opacity: 0;
  animation: introFadeUp 500ms ease-out 800ms forwards;
}
.introFacts {
  display: inline-block;
  color: #2fd67b;
  opacity: 0;
  animation: slam 650ms cubic-bezier(0.2, 1.4, 0.4, 1) 1.15s forwards;
}
@keyframes slam {
  0% { opacity: 0; transform: scale(2.6); filter: blur(10px); }
  60% { opacity: 1; filter: none; text-shadow: 0 0 60px rgba(47, 214, 123, 0.9); }
  100% { opacity: 1; transform: scale(1); text-shadow: 0 0 30px rgba(47, 214, 123, 0.4); }
}
.introLine {
  height: 2px;
  width: min(560px, 70vw);
  margin: 30px auto 0;
  background: linear-gradient(90deg, transparent, #2fd67b, transparent);
  box-shadow: 0 0 16px rgba(47, 214, 123, 0.8);
  transform: scaleX(0);
  animation: lineSweep 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 1.5s forwards;
}
@keyframes lineSweep {
  to { transform: scaleX(1); }
}
.introTag {
  margin-top: 18px;
  color: #87918c;
  font-size: clamp(14px, 1.6vw, 18px);
  opacity: 0;
  animation: introFadeUp 600ms ease-out 1.7s forwards;
}
@keyframes introFadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
html.arrive .page > .inner {
  transform-origin: 50% 20vh;
  animation: arrive 1000ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes arrive {
  from { opacity: 0; transform: perspective(1200px) translateY(40px) rotateX(12deg) scale(0.72); filter: blur(14px); }
}
@media (prefers-reduced-motion: reduce) {
  .intro { display: none; }
  html.arrive .page > .inner { animation: none; }
}
`;

export default function Intro() {
  const [mode, setMode] = useState<"full" | "quick" | "done">("full");

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let viaDive = false;
    try {
      viaDive = sessionStorage.getItem(DIVE_KEY) === "1";
      sessionStorage.removeItem(DIVE_KEY);
    } catch {}

    if (reduce) {
      setMode("done");
      return;
    }

    const home = window.location.pathname === "/";

    if (viaDive || !home) {
      setMode("quick");
      root.classList.add("arrive");
      const t = setTimeout(() => setMode("done"), 900);
      return () => clearTimeout(t);
    }

    const a = setTimeout(() => root.classList.add("arrive"), 2350);
    const d = setTimeout(() => setMode("done"), 3300);
    return () => {
      clearTimeout(a);
      clearTimeout(d);
    };
  }, []);

  function skip() {
    if (mode !== "full") return;
    document.documentElement.classList.add("arrive");
    setMode("done");
  }

  if (mode === "done") return <style>{CSS}</style>;

  return (
    <>
      <style>{CSS}</style>
      <div className={`intro ${mode === "quick" ? "introQuick" : ""} ${sans.className}`} onClick={skip} aria-hidden="true">
        {mode === "quick" && <div className="arriveWarp" />}
        {mode === "full" && (
          <div className="introStage">
            <div className="introGlow" />
            <div className="introBrand">
              <span className={`introTalk ${serif.className}`}>Talk</span>
              <span className="introVs">vs</span>
              <span className="introFacts">Facts</span>
            </div>
            <div className="introLine" />
            <div className="introTag">Finance videos, checked against the data.</div>
          </div>
        )}
      </div>
    </>
  );
}