"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A 3-page example book on the landing page. Stage 2 (digraphs/blends) text; target-pattern
// words are wrapped in *stars* and highlighted the way the reader does it.
// Swipe (CSS scroll-snap), tap the dots, use the arrows (sm+), or arrow keys on the focused book.
const PAGES = [
  {
    sky: "from-sky-lighter to-pastel-cyan", ground: "bg-teal-lighter", corner: "☀️", art: "🚚",
    text: "Mo has a big red *truck*. Mo and the *truck* zip up the *hill*. *Honk*! *Honk*! At the top is a box. What is in it?",
  },
  {
    sky: "from-sun-lighter to-pastel-yellow", ground: "bg-sun-light", corner: "📦", art: "🐶",
    text: "Mo *jumps* *from* the *truck* and *lifts* the lid. In the box is a *black* pup! The pup *licks* Mo.",
  },
  {
    sky: "from-ink-darker to-teal-darker", ground: "bg-teal-dark", corner: "🌙", art: "🚚",
    text: "Mo and the pup sit in the *truck*. *Honk*! *Honk*! They zip back to the *shop*. Mo has a *best* pal.",
  },
] as const;

const HL = "rounded-md bg-sun-lighter/70 px-0.5";

function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith("*") ? <mark key={i} className={HL}>{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function ExampleStory() {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  // Dots follow the scroll position (swipe, trackpad, arrows or keys all end up here).
  const sync = useCallback(() => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    setPage(Math.max(0, Math.min(PAGES.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => { el.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); };
  }, [sync]);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(PAGES.length - 1, i));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    setPage(n);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(page + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(page - 1); }
  }

  // Arrows show at sm+ (desktop); phones swipe or tap the dots. Disabled arrows keep their
  // space (opacity only) so the row never shifts.
  const arrow = "hidden h-8 w-8 items-center justify-center rounded-full border-2 border-ink-lighter bg-white font-bold text-ink-darker hover:border-teal disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-teal sm:flex";

  return (
    <figure className="mt-6 overflow-hidden rounded-ello-lg bg-white shadow-card" aria-roledescription="carousel" aria-label="Example story">
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="Example story pages. Use the left and right arrow keys to turn pages."
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-teal [&::-webkit-scrollbar]:hidden"
      >
        {PAGES.map((p, i) => (
          <div key={i} role="group" aria-roledescription="page" aria-label={`Page ${i + 1} of ${PAGES.length}`}
            className="w-full shrink-0 snap-start snap-always">
            <div aria-hidden className={`relative flex h-28 items-end justify-center bg-gradient-to-b ${p.sky}`}>
              <span className="absolute left-6 top-4 text-3xl">{p.corner}</span>
              <div className={`h-8 w-full rounded-t-[50%] ${p.ground}`} />
              <span className="absolute bottom-3 text-5xl">{p.art}</span>
            </div>
            <p className="ello-story px-5 pt-5 !text-[1.375rem]"><Marked text={p.text} /></p>
          </div>
        ))}
      </div>

      <figcaption className="flex items-center justify-between gap-3 px-5 pb-4 pt-3 text-body-s text-ink">
        <span>Example · age 6, loves trucks</span>
        <span className="flex shrink-0 items-center">
          <button type="button" aria-label="Previous page" className={`${arrow} mr-1`} disabled={page === 0} onClick={() => go(page - 1)}>←</button>
          {PAGES.map((_, i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={`Go to page ${i + 1}`} aria-current={i === page ? "true" : undefined}
              className="flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-teal">
              <span className={`block h-2 rounded-full transition-all ${i === page ? "w-4 bg-teal" : "w-2 bg-ink-lighter"}`} />
            </button>
          ))}
          <button type="button" aria-label="Next page" className={`${arrow} ml-1`} disabled={page === PAGES.length - 1} onClick={() => go(page + 1)}>→</button>
        </span>
      </figcaption>
    </figure>
  );
}
