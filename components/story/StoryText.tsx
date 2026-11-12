"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Stage } from "@/lib/contracts";
import { pickSightWords, tokenize } from "./highlight";

const MARK_CLASS = {
  target: "rounded-md bg-sun-lighter/70 px-0.5 underline decoration-sun-dark decoration-[3px] underline-offset-[6px]",
  theme: "rounded-md bg-grape-lighter/70 px-0.5",
  sight: "rounded-full px-1 outline-[3px] outline-cyan outline",
} as const;

const THEME_HINT = "Tricky word: say it together";

export function StoryText({ text, stage, themeWords, hero, highlight = true, className = "" }: {
  text: string; stage: Stage; themeWords: string[]; hero: string; highlight?: boolean; className?: string;
}) {
  const tokens = tokenize(text, stage, highlight ? themeWords : [], [hero], stage === 0 ? pickSightWords(text) : undefined);
  return (
    <p className={`ello-story ${className}`}>
      {tokens.map((t, i) =>
        t.kind === "space" || !t.mark || !highlight
          ? <span key={i}>{t.text}</span>
          : <MarkedWord key={i} text={t.text} mark={t.mark} />,
      )}
    </p>
  );
}

/** Keep punctuation outside the highlight: `"truck."` -> mark(truck) + "." */
function MarkedWord({ text, mark }: { text: string; mark: keyof typeof MARK_CLASS }) {
  const m = /^([^\p{L}']*)(.*?)([^\p{L}']*)$/u.exec(text);
  const [pre, word, post] = m ? [m[1], m[2], m[3]] : ["", text, ""];
  const inner = mark === "theme"
    ? <ThemeWord word={word} />
    : <span className={MARK_CLASS[mark]}>{word}</span>;
  return <span>{pre}{inner}{post}</span>;
}

/**
 * Theme words (e.g. "dinosaur") are above the kid's phonics level. Tapping one shows a
 * tiny hint for the grown-up. The hint floats (portal + fixed position), so it takes no
 * layout space; it closes on the next tap anywhere, on scroll, or after a few seconds.
 */
function ThemeWord({ word }: { word: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const t = setTimeout(close, 3500);
    // Deferred so the tap that opened it doesn't close it.
    const raf = requestAnimationFrame(() => {
      window.addEventListener("pointerdown", close, { once: true });
    });
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  function toggle() {
    if (pos) { setPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 48;
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
  }

  return (
    <>
      <button ref={ref} type="button" onClick={toggle} aria-expanded={!!pos}
        aria-label={`${word} (${THEME_HINT.toLowerCase()})`}
        className={`${MARK_CLASS.theme} m-0 inline cursor-help border-0 p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit`}>
        {word}
      </button>
      {pos && createPortal(
        <span role="status"
          className="pointer-events-none fixed z-50 rounded-full bg-ink-darker px-3 py-1 font-sans text-body-s font-bold whitespace-nowrap text-white shadow-card"
          style={{ left: Math.min(Math.max(pos.x, 110), window.innerWidth - 110), top: pos.y, transform: `translate(-50%, ${pos.below ? "0" : "-100%"})` }}>
          {THEME_HINT}
        </span>,
        document.body,
      )}
    </>
  );
}
