"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AskVariant, StoredStory } from "@/lib/contracts";
import { getSessionId, track } from "@/lib/track";
import { getVariant } from "@/lib/variant";
import { AskSheet } from "./AskSheet";
import { DonePanel } from "./DonePanel";
import { Scene, Yello } from "./Scene";
import { ParentTip, StoryText } from "./StoryText";
import { readUtm, submitLead } from "./store";
import { useResolvedStory } from "./useResolvedStory";

const PAGES = 5;
type Phase = "read" | "end" | "done";

export function Reader({ id, stored }: { id: string; stored: StoredStory | null }) {
  const router = useRouter();
  const { story, ready } = useResolvedStory(id, stored);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("read");
  const [sheet, setSheet] = useState<AskVariant | null>(null);
  const [askShown, setAskShown] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const waitStart = useRef<number | null>(null);
  const viewed = useRef(new Set<number>());
  const finished = useRef(false);

  const pages = story?.pages ?? [];
  const streaming = !!story && (story.live || story.status === "generating");
  const total = streaming ? PAGES : Math.max(pages.length, 1);
  const current = pages.find((p) => p.n === idx + 1);
  // Stream ended early (error / fewer pages): treat as the end.
  const effPhase: Phase = phase === "read" && !!story && !streaming && idx >= pages.length && pages.length > 0 ? "end" : phase;

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
      track("story_page_viewed", { page: currentN, story_id: id });
    }
  }, [currentN, id]);

  useEffect(() => {
    if (effPhase === "end" && !finished.current) {
      finished.current = true;
      track("story_finished", { story_id: id, pages: pages.length });
    }
  }, [effPhase, id, pages.length]);

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
  // Keep the arm the story was requested under (URL overrides don't survive router.replace).
  const variant = () => story!.variant ?? getVariant();

  function goTo(nextIdx: number) {
    if (!pages.some((p) => p.n === nextIdx + 1)) waitStart.current = performance.now();
    setIdx(nextIdx);
    window.scrollTo({ top: 0 });
  }

  function next() {
    if (idx + 1 >= total) { setPhase("end"); return; }
    if (idx === 1 && !askShown && variant().ask === "mid") {
      setAskShown(true);
      setSheet("mid");
      track("email_ask_viewed", { ask: "mid", story_id: id });
      return;
    }
    goTo(idx + 1);
  }

  function afterSheet(which: AskVariant) {
    setSheet(null);
    if (which === "mid") goTo(2);
    else setPhase("done");
  }

  function rate(score: number) {
    track("kid_reaction_rated", { score, story_id: id });
    if (variant().ask === "end" && !askShown && !leadDone) {
      setAskShown(true);
      setSheet("end");
      track("email_ask_viewed", { ask: "end", story_id: id });
    } else {
      setPhase("done");
    }
  }

  async function lead(email: string, website: string) {
    const ask = sheet ?? "end";
    const res = await submitLead({
      email, story_id: id, session_id: getSessionId(), variant: variant(), age_band: story!.age_band,
      stage: story!.stage, interest: story!.interest, consent: true, ref: story!.ref, utm: readUtm(), website,
    });
    if (res.ok) {
      track("lead_submitted", { ask, story_id: id });
      setLeadDone(true);
      afterSheet(ask);
    }
    return res;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-10 pt-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="m-0 truncate text-body font-bold text-ink-dark">{story.title}</h1>
        {effPhase === "read" && <span className="shrink-0 rounded-full bg-white px-3 py-1 text-body-s font-bold text-ink">{idx + 1} / {total}</span>}
      </header>

      {effPhase === "read" && (current ? (
        <>
          <Scene scene={current.scene} interest={story.interest} />
          <div className="ello-card">
            <StoryText text={current.text} stage={story.stage} themeWords={story.theme_words} hero={hero} />
          </div>
          <ParentTip text={current.text} stage={story.stage} themeWords={story.theme_words} hero={hero} />
          <Dots total={total} idx={idx} />
          <div className="flex gap-3">
            {idx > 0 && (
              <button type="button" className="ello-btn ello-btn--secondary w-auto! px-5" aria-label="Previous page" onClick={() => goTo(idx - 1)}>←</button>
            )}
            <button type="button" className="ello-btn" onClick={next}>{idx + 1 >= total ? "The End" : "Next page"}</button>
          </div>
        </>
      ) : (
        <Centered>
          <Yello />
          <p className="text-h3">turning the page…</p>
          <Dots total={total} idx={idx} />
        </Centered>
      ))}

      {effPhase === "end" && (
        <div className="ello-card flex flex-col items-center gap-4 py-10 text-center">
          <p className="font-story text-h1 text-ink-darker">The End</p>
          <h2 className="text-h3">How did {hero} do?</h2>
          <div className="flex gap-4">
            {[["😍", 3, "Loved it"], ["🙂", 2, "Okay"], ["😕", 1, "Too hard"]].map(([e, s, label]) => (
              <button key={s} type="button" aria-label={label as string} onClick={() => rate(s as number)}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink-lighter bg-white text-5xl shadow-card active:translate-y-0.5">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {effPhase === "done" && <DonePanel id={id} hero={hero} leadDone={leadDone} />}

      {sheet && (
        <AskSheet hero={hero} ask={sheet} onSubmit={lead}
          onDismiss={() => { track("email_ask_dismissed", { ask: sheet, story_id: id }); afterSheet(sheet); }} />
      )}
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
