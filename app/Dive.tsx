"use client";

import { useEffect } from "react";

const DIVE_KEY = "tvf-dive";
const DURATION = 750;

const CSS = `
.diveWarp,
.diveCore,
.diveFade {
  position: fixed;
  pointer-events: none;
  opacity: 0;
}
.diveWarp {
  z-index: 91;
  left: var(--dx, 50vw);
  top: var(--dy, 50vh);
  width: 300vmax;
  height: 300vmax;
  background: repeating-conic-gradient(from 0deg, transparent 0deg 2deg, rgba(47, 214, 123, 0.6) 2deg 2.35deg, transparent 2.35deg 6deg);
  -webkit-mask-image: radial-gradient(circle, transparent 0 4%, black 22%, transparent 60%);
  mask-image: radial-gradient(circle, transparent 0 4%, black 22%, transparent 60%);
  transform: translate(-50%, -50%) scale(0.15);
}
.diveCore {
  z-index: 92;
  left: var(--dx, 50vw);
  top: var(--dy, 50vh);
  width: 40vmax;
  height: 40vmax;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(220, 255, 235, 0.9), rgba(47, 214, 123, 0.5) 25%, transparent 65%);
  transform: translate(-50%, -50%) scale(0);
}
.diveFade {
  z-index: 93;
  inset: 0;
  background: #050706;
}
html.diving .diveWarp {
  animation: warpOut ${DURATION}ms cubic-bezier(0.6, 0, 0.9, 0.5) forwards;
}
html.diving .diveCore {
  animation: coreOut ${DURATION}ms cubic-bezier(0.6, 0, 0.9, 0.5) forwards;
}
html.diving .diveFade {
  animation: fadeBlack ${DURATION}ms ease-in forwards;
}
@keyframes warpOut {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.15) rotate(0deg); }
  25% { opacity: 1; }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.8) rotate(-10deg); }
}
@keyframes coreOut {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
  40% { opacity: 0.9; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
}
@keyframes fadeBlack {
  0%, 55% { opacity: 0; }
  100% { opacity: 1; }
}
html.diving .page > .inner {
  transform-origin: var(--ox, 50%) var(--oy, 30vh);
  animation: diveInto ${DURATION}ms cubic-bezier(0.7, 0, 0.84, 0) forwards !important;
}
@keyframes diveInto {
  to { transform: scale(3.2); filter: blur(20px); opacity: 0; }
}
html.diving .page::before {
  animation: gridRush ${DURATION}ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
}
@keyframes gridRush {
  to { transform: scale(2.5); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .diveWarp, .diveCore, .diveFade { display: none; }
}
`;

export default function Dive() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function onClick(e: MouseEvent) {
      if (reduce || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement).closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/") || link.target === "_blank") return;
      if (href === window.location.pathname) return;
      e.preventDefault();

      root.style.setProperty("--dx", `${e.clientX}px`);
      root.style.setProperty("--dy", `${e.clientY}px`);

      const inner = document.querySelector(".page > .inner");
      if (inner) {
        const rect = inner.getBoundingClientRect();
        root.style.setProperty("--ox", `${e.clientX - rect.left}px`);
        root.style.setProperty("--oy", `${e.clientY - rect.top}px`);
      }

      try {
        sessionStorage.setItem(DIVE_KEY, "1");
      } catch {}

      root.classList.add("diving");
      setTimeout(() => {
        window.location.href = href;
      }, DURATION);
    }

    function onShow() {
      root.classList.remove("diving");
    }

    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="diveWarp" aria-hidden="true" />
      <div className="diveCore" aria-hidden="true" />
      <div className="diveFade" aria-hidden="true" />
    </>
  );
}