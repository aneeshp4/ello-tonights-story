"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StoredStory } from "@/lib/contracts";
import { getSessionId, track } from "@/lib/track";
import { getVariant } from "@/lib/variant";
import { AskSheet } from "./AskSheet";
import { DonePanel } from "./DonePanel";
import { Scene, Yello } from "./Scene";
import { StoryText } from "./StoryText";
import { readProgress, readUtm, saveProgress, submitLead, takeTtfp } from "./store";
import { useResolvedStory } from "./useResolvedStory";
import { useSwipe } from "./useSwipe";

const PAGES = 5;
type Phase = "read" | "done";
type Placement = "sheet" | "done_inline";

// Story font auto-fit (px). Line height stays 1.6.
const FONT_MIN = 22;
const FONT_MAX = 40;
const FONT_MAX_LATE = 32; // stages 3-4: longer pages, smaller cap

// Layout: the reader is a fixed full-height column: header, page (scene + text box), controls.
// The page area takes the leftover height; the scene gets a share of it and the text box the rest.
// Story text auto-fits the box (largest font that fits, centered), so pages never look empty;
// a long page at the minimum size scrolls inside the box with a "more" cue. The controls row
// has a fixed height, so it never moves between pages. Pages turn with the buttons, a horizontal
// swipe (useSwipe) or the arrow keys. The rating + "The End" live in the controls area of the
// last page; the email ask opens over the last page after the rating (or "Skip").
//
// Progress (page, phase, rating, which one-time events fired) is saved per story in
// sessionStorage, so a reload in the same tab resumes where the parent was.
export function Reader({ id, stored }: { id: string; stored: StoredStory | null }) {
  const router = useRouter();
  const { story, ready } = useResolvedStory(id, stored);
  // Progress saved earlier in this tab (reload). Read once on the client; on the server
  // (and in a fresh tab) it's null and the reader starts at page 1. Rendering is gated on
  // `ready` (false until mounted), so restored state can't cause a hydration mismatch.
  const [saved] = useState(() => (typeof window === "undefined" ? null : readProgress(id)));
  const [idx, setIdx] = useState(saved?.idx ?? 0);
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "read");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askShown, setAskShown] = useState(saved?.askShown ?? false);
  const [inlineAskShown, setInlineAskShown] = useState(saved?.inlineAskShown ?? false);
  const [rated, setRated] = useState<number | null>(saved?.rated ?? null);
  const [leadDone, setLeadDone] = useState(saved?.leadDone ?? false);
  const waitStart = useRef<number | null>(null);
  const viewed = useRef(new Set<number>(saved?.seen ?? []));
  const finished = useRef(saved?.finished ?? false);
  const textBox = useRef<HTMLDivElement>(null);
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false); // text box has unseen text below

  const pages = story?.pages ?? [];
  const streaming = !!story && (story.live || story.status === "generating");
  const total = streaming ? PAGES : Math.max(pages.length, 1);
  const current = pages.find((p) => p.n === idx + 1);
  const isLast = !!current && idx === total - 1 && (!streaming || pages.length >= PAGES);
  // Same rule as the buttons: "Next" works once this page is showing (if the next one hasn't
  // streamed in yet, the reader shows "turning the page…"). A swipe only turns to a page that's
  // already here, so the finger never lands on an empty page.
  const canNext = !!current && !isLast;
  const nextLoaded = pages.some((p) => p.n === idx + 2);
  const canPrev = idx > 0;
  const reading = ready && !!story && phase === "read" && !sheetOpen;

  // story_page_viewed + next_page_waited (fires when the awaited page arrives)
  const currentN = phase === "read" ? current?.n : undefined;
  useEffect(() => {
    if (!currentN) return;
    if (waitStart.current != null) {
      track("next_page_waited", { page: currentN, wait_ms: Math.round(performance.now() - waitStart.current), story_id: id });
      waitStart.current = null;
    }
    if (!viewed.current.has(currentN)) {
      viewed.current.add(currentN);
      // ttfp_ms: request -> page 1 as the user saw it (only for a story streamed in this tab, reported once).
      const ttfp_ms = currentN === 1 ? takeTtfp(id) : undefined;
      track("story_page_viewed", { page: currentN, story_id: id, ...(ttfp_ms != null ? { ttfp_ms } : {}) });
    }
  }, [currentN, id]);

  // Fit the story text to its box before paint: the largest font in [min, max] that fits
  // (binary search), else the minimum and the box scrolls. Re-fits when the box resizes.
  const stage = story?.stage ?? 0;
  const fit = useCallback(() => {
    const box = textBox.current;
    const p = box?.querySelector<HTMLElement>(".ello-story");
    if (!box || !p) return;
    const fits = (px: number) => { p.style.fontSize = `${px}px`; return box.scrollHeight <= box.clientHeight + 1; };
    p.style.lineHeight = "1.6";
    let lo = FONT_MIN, hi = stage >= 3 ? FONT_MAX_LATE : FONT_MAX;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) lo = mid; else hi = mid - 1;
    }
    fits(lo);
  }, [stage]);
  const checkMore = useCallback(() => {
    const el = textBox.current;
    setMore(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  }, []);
  // Each page starts at the top of the text box, fitted; show a "more" cue if it still overflows.
  const currentText = current?.text;
  useLayoutEffect(() => {
    const el = textBox.current;
    if (!el) return;
    el.scrollTop = 0;
    fit();
    checkMore();
    let w = el.clientWidth, h = el.clientHeight;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w || el.clientHeight !== h) { w = el.clientWidth; h = el.clientHeight; fit(); }
      checkMore();
    });
    ro.observe(el);
    // The story webfont may swap in after the first fit.
    let live = true;
    document.fonts?.ready.then(() => { if (live) { fit(); checkMore(); } }).catch(() => {});
    return () => { live = false; ro.disconnect(); };
  }, [idx, currentText, phase, ready, fit, checkMore]);

  // Reaching the last page = finished the story.
  useEffect(() => {
    if (isLast && !finished.current) {
      finished.current = true;
      track("story_finished", { story_id: id, pages: pages.length });
    }
  }, [isLast, id, pages.length]);

  // Persist progress for reloads. Runs after the tracking effects above, so `seen` and
  // `finished` include anything they just fired. Never includes the hero name.
  useEffect(() => {
    saveProgress(id, { idx, phase, rated, askShown, inlineAskShown, leadDone, seen: [...viewed.current], finished: finished.current });
  }, [id, idx, phase, rated, askShown, inlineAskShown, leadDone, currentN, isLast]);

  // Reloaded while the server was still generating: poll the server component.
  const needPoll = !!story && !story.live && story.status === "generating" && !!stored;
  useEffect(() => {
    if (!needPoll) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [needPoll, router]);

  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; });
  const goTo = useCallback((nextIdx: number) => {
    if (!pagesRef.current.some((p) => p.n === nextIdx + 1)) waitStart.current = performance.now();
    setIdx(nextIdx);
  }, []);
  const next = useCallback(() => { if (canNext) goTo(idx + 1); }, [canNext, goTo, idx]);
  const prev = useCallback(() => { if (canPrev) goTo(idx - 1); }, [canPrev, goTo, idx]);

  // Swipe: not on the done panel or under the ask sheet.
  useSwipe(pageEl, { enabled: reading, canNext: canNext && nextLoaded, canPrev, onNext: next, onPrev: prev });

  // Arrow keys turn pages (same rules as the buttons).
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading, next, prev]);

  // Chrome's horizontal overscroll = history back/forward; turn it off while the reader is up
  // so a page swipe can't trigger it. (iOS edge back-swipe can't be disabled; it starts at the
  // very edge, outside the page area's padding.)
  useEffect(() => {
    if (phase !== "read") return;
    const html = document.documentElement;
    const prevVal = html.style.overscrollBehaviorX;
    html.style.overscrollBehaviorX = "none";
    return () => { html.style.overscrollBehaviorX = prevVal; };
  }, [phase]);

  const inlineFired = useRef(saved?.inlineAskShown ?? false); // ref: guards double effects too
  const onInlineShown = useCallback(() => {
    if (inlineFired.current) return;
    inlineFired.current = true;
    setInlineAskShown(true);
    track("email_ask_viewed", { ask: "end", placement: "done_inline", story_id: id });
  }, [id]);

  if (!ready) return <Centered><Yello /><p className="text-h3">Opening the story…</p></Centered>;
  if (!story) {
    return (
      <Centered>
        <Yello bounce={false} />
        <h1 className="text-h3">We couldn&apos;t find that story</h1>
        <Link href="/make" className="ello-btn">Make tonight&apos;s story</Link>
      </Centered>
    );
  }

  const hero = story.hero;
  const variant = () => story!.variant ?? getVariant();

  function openAsk() {
    setSheetOpen(true);
    if (!askShown) {
      setAskShown(true);
      track("email_ask_viewed", { ask: "end", placement: "sheet", story_id: id });
    }
  }

  function rate(score: number | null) {
    if (score != null) track("kid_reaction_rated", { score, story_id: id });
    setRated(score ?? 0);
    if (leadDone) setPhase("done");
    else openAsk();
  }

  function closeAsk(submitted: boolean) {
    if (!submitted) track("email_ask_dismissed", { ask: "end", story_id: id });
    setSheetOpen(false);
    setPhase("done");
    window.scrollTo({ top: 0 });
  }

  async function lead(email: string, website: string, placement: Placement) {
    const res = await submitLead({
      email, story_id: id, session_id: getSessionId(), variant: variant(), age_band: story!.age_band,
      stage: story!.stage, interest: story!.interest, consent: true, hero, ref: story!.ref, utm: readUtm(), website,
    });
    if (res.ok) {
      track("lead_submitted", { ask: "end", placement, story_id: id });
      setLeadDone(true);
      if (placement === "sheet") closeAsk(true);
    }
    return res;
  }

  if (phase === "done") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-10 pt-5">
        <h1 className="m-0 truncate text-body font-bold text-ink-dark">{story.title}</h1>
        <DonePanel id={id} hero={hero} leadDone={leadDone}
          onLead={(email, website) => lead(email, website, "done_inline")} onInlineShown={onInlineShown} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="m-0 truncate text-body font-bold text-ink-dark">{story.title}</h1>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-body-s font-bold text-ink" data-testid="page-indicator">{idx + 1} / {total}</span>
      </header>

      {/* Page: scene + text. Swipeable horizontally; pan-y keeps vertical scrolling native. */}
      <div ref={setPageEl} className="flex min-h-0 flex-1 touch-pan-y flex-col gap-3 select-none" data-testid="page">
        <div className="min-h-24 max-h-72 shrink-0 basis-[34%]">
          <Scene scene={current?.scene ?? "outdoors-day"} interest={story.interest} size="fill" />
        </div>

        {/* Text box: fills the remaining space; text auto-fits, long pages scroll inside it. */}
        <div className="relative flex min-h-0 flex-[1_1_0] flex-col">
          <div ref={textBox} onScroll={checkMore} tabIndex={more ? 0 : -1} aria-label="Story text"
            className="ello-card flex min-h-0 flex-1 touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4! py-4!">
            {current ? (
              <div className="my-auto w-full">
                <StoryText key={current.n} text={current.text} stage={story.stage} themeWords={story.theme_words} hero={hero}
                  className="text-center tracking-normal!" />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <Yello size={56} />
                <p className="text-body font-bold text-ink">turning the page…</p>
              </div>
            )}
          </div>
          {more && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center rounded-b-ello-lg bg-gradient-to-t from-white via-white/90 to-transparent pb-1.5">
              <span className="rounded-full bg-pastel-teal px-3 py-0.5 text-body-s font-bold text-teal-darker">more ↓</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls: same height on every page. On the last page they become "The End" + rating. */}
      <div className="flex h-[7.5rem] shrink-0 flex-col justify-end gap-3" data-testid="controls">
        {isLast ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="m-0 text-body font-bold text-ink-dark">
              <span className="font-story text-h3 text-ink-darker">The End.</span> How did {hero} do?
            </p>
            <div className="flex items-center gap-3">
              {[["😍", 3, "Loved it"], ["🙂", 2, "Okay"], ["😕", 1, "Too hard"]].map(([e, s, label]) => (
                <button key={s} type="button" aria-label={label as string} onClick={() => rate(s as number)}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white text-3xl shadow-card active:translate-y-0.5 ${rated === s ? "border-teal" : "border-ink-lighter"}`}>
                  {e}
                </button>
              ))}
              <button type="button" className="px-2 text-body-s font-semibold text-ink underline underline-offset-4" onClick={() => rate(null)}>Skip</button>
            </div>
            <p className="m-0 text-body-s text-ink">📬 Chapter 2 comes out tomorrow at 7pm</p>
          </div>
        ) : (
          <>
            <Dots total={total} idx={idx} />
            {/* Page 1 has no back button, so Next spans the row. */}
            <div className="flex gap-3">
              {idx > 0 && (
                <button type="button" className="ello-btn ello-btn--secondary w-auto! px-5" aria-label="Previous page" onClick={prev}>←</button>
              )}
              <button type="button" className="ello-btn" disabled={!current} onClick={next}>Next page</button>
            </div>
          </>
        )}
      </div>

      {sheetOpen && <AskSheet hero={hero} onSubmit={(email, website) => lead(email, website, "sheet")} onDismiss={() => closeAsk(false)} />}
    </main>
  );
}

function Dots({ total, idx }: { total: number; idx: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2.5 rounded-full transition-all ${i === idx ? "w-6 bg-teal" : i < idx ? "w-2.5 bg-teal-lighter" : "w-2.5 bg-ink-lighter"}`} />
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">{children}</div>;
}
