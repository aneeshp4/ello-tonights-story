"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredStory } from "@/lib/contracts";
import { getSessionId, track } from "@/lib/track";
import { getVariant } from "@/lib/variant";
import { AskSheet } from "./AskSheet";
import { DonePanel } from "./DonePanel";
import { Scene, Yello } from "./Scene";
import { ParentTip, StoryText } from "./StoryText";
import { readUtm, submitLead, takeTtfp } from "./store";
import { useResolvedStory } from "./useResolvedStory";

const PAGES = 5;
type Phase = "read" | "done";

// Layout: the reader is a fixed full-height column (header, scene, text box, tip box, controls).
// The text box flexes to fill the leftover space and scrolls internally if a page is long, so the
// controls row never moves between pages. The rating + "The End" live in the controls area of the
// last page; the email ask opens over the last page after the rating (or "Skip").
export function Reader({ id, stored }: { id: string; stored: StoredStory | null }) {
  const router = useRouter();
  const { story, ready } = useResolvedStory(id, stored);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("read");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askShown, setAskShown] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const [leadDone, setLeadDone] = useState(false);
  const waitStart = useRef<number | null>(null);
  const viewed = useRef(new Set<number>());
  const finished = useRef(false);
  const textBox = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false); // text box has unseen text below

  const pages = story?.pages ?? [];
  const streaming = !!story && (story.live || story.status === "generating");
  const total = streaming ? PAGES : Math.max(pages.length, 1);
  const current = pages.find((p) => p.n === idx + 1);
  const isLast = !!current && idx === total - 1 && (!streaming || pages.length >= PAGES);

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

  // Each page starts at the top of the text box; show a "more" cue when a long page overflows.
  const currentText = current?.text;
  const checkMore = useCallback(() => {
    const el = textBox.current;
    setMore(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  }, []);
  useEffect(() => {
    const el = textBox.current;
    if (!el) return;
    el.scrollTop = 0;
    checkMore();
    const ro = new ResizeObserver(checkMore);
    ro.observe(el);
    return () => ro.disconnect();
  }, [idx, currentText, phase, checkMore]);

  // Reaching the last page = finished the story.
  useEffect(() => {
    if (isLast && !finished.current) {
      finished.current = true;
      track("story_finished", { story_id: id, pages: pages.length });
    }
  }, [isLast, id, pages.length]);

  // Reloaded while the server was still generating: poll the server component.
  const needPoll = !!story && !story.live && story.status === "generating" && !!stored;
  useEffect(() => {
    if (!needPoll) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [needPoll, router]);

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

  function goTo(nextIdx: number) {
    if (!pages.some((p) => p.n === nextIdx + 1)) waitStart.current = performance.now();
    setIdx(nextIdx);
  }

  function openAsk() {
    setSheetOpen(true);
    if (!askShown) {
      setAskShown(true);
      track("email_ask_viewed", { ask: "end", story_id: id });
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

  async function lead(email: string, website: string) {
    const res = await submitLead({
      email, story_id: id, session_id: getSessionId(), variant: variant(), age_band: story!.age_band,
      stage: story!.stage, interest: story!.interest, consent: true, hero, ref: story!.ref, utm: readUtm(), website,
    });
    if (res.ok) {
      track("lead_submitted", { ask: "end", story_id: id });
      setLeadDone(true);
      closeAsk(true);
    }
    return res;
  }

  if (phase === "done") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-10 pt-5">
        <h1 className="m-0 truncate text-body font-bold text-ink-dark">{story.title}</h1>
        <DonePanel id={id} hero={hero} leadDone={leadDone} onAsk={openAsk} />
        {sheetOpen && <AskSheet hero={hero} onSubmit={lead} onDismiss={() => { setSheetOpen(false); track("email_ask_dismissed", { ask: "end", story_id: id }); }} />}
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="m-0 truncate text-body font-bold text-ink-dark">{story.title}</h1>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-body-s font-bold text-ink">{idx + 1} / {total}</span>
      </header>

      <div className="shrink-0">
        <Scene scene={current?.scene ?? "outdoors-day"} interest={story.interest} size="reader" />
      </div>

      {/* Text box: fills the remaining space; long pages scroll inside it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={textBox} onScroll={checkMore} tabIndex={more ? 0 : -1} aria-label="Story text"
        className="ello-card flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {current ? (
          <StoryText text={current.text} stage={story.stage} themeWords={story.theme_words} hero={hero}
            className={story.stage >= 3 ? "text-[1.375rem]! leading-[1.7]!" : "[@media(max-height:720px)]:text-[1.5rem]! [@media(max-height:720px)]:leading-[1.65]!"} />
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

      {/* Tip box: fixed height so it never pushes the controls around. */}
      <div className="h-[5.25rem] shrink-0 overflow-y-auto">
        {current && <ParentTip text={current.text} stage={story.stage} themeWords={story.theme_words} hero={hero} />}
      </div>

      {/* Controls: same height on every page. On the last page they become "The End" + rating. */}
      <div className="flex h-[7.5rem] shrink-0 flex-col justify-end gap-3">
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
            <div className="flex gap-3">
              <button type="button" className="ello-btn ello-btn--secondary w-auto! px-5" aria-label="Previous page"
                disabled={idx === 0} style={{ visibility: idx === 0 ? "hidden" : "visible" }} onClick={() => goTo(idx - 1)}>←</button>
              <button type="button" className="ello-btn" disabled={!current} onClick={() => goTo(idx + 1)}>Next page</button>
            </div>
          </>
        )}
      </div>

      {sheetOpen && <AskSheet hero={hero} onSubmit={lead} onDismiss={() => closeAsk(false)} />}
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
