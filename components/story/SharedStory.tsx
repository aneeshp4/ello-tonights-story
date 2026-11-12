"use client";
import Link from "next/link";
import { useEffect } from "react";
import type { StoredStory } from "@/lib/contracts";
import { track } from "@/lib/track";
import { Scene, Yello } from "./Scene";
import { StoryText } from "./StoryText";
import { useResolvedStory } from "./useResolvedStory";

const landed = new Set<string>(); // once per story per page load (StrictMode runs effects twice in dev)

export function SharedStory({ id, stored }: { id: string; stored: StoredStory | null }) {
  const { story, ready } = useResolvedStory(id, stored, "fun");

  useEffect(() => {
    if (landed.has(id)) return;
    landed.add(id);
    const ref = new URLSearchParams(window.location.search).get("ref") ?? id;
    track("share_landing_viewed", { ref, story_id: id });
  }, [id]);

  const cta = (
    <Link href={`/make?ref=${encodeURIComponent(id)}`} className="ello-btn"
      onClick={() => track("cta_clicked", { from: "share", ref: id })}>
      Make one for your kid
    </Link>
  );

  if (!story) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <Yello bounce={!ready} />
        {ready && <h1 className="text-h3">This story has gone to bed</h1>}
        <p className="text-body text-ink">Make a free story about the thing your kid loves, at just their reading level.</p>
        {cta}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-12 pt-6">
      <header className="flex flex-col gap-2">
        <p className="text-body-s font-bold uppercase tracking-wide text-teal-dark">A Tonight&apos;s Story from Ello</p>
        <h1 className="text-h3 text-ink-dark">{story.title}</h1>
        <p className="text-body text-ink">A story a kid read tonight, made just for their reading level. Make one about the thing your kid loves.</p>
        {cta}
      </header>
      {story.pages.map((p) => (
        <article key={p.n} className="ello-card flex flex-col gap-4">
          <Scene scene={p.scene} interest={story.interest} size="sm" />
          <StoryText text={p.text} stage={story.stage} themeWords={story.theme_words} hero={story.hero} highlight={false} />
          <p className="text-right text-body-s text-ink">{p.n} / {story.pages.length}</p>
        </article>
      ))}
      <div className="ello-card flex flex-col items-center gap-3 text-center">
        <Yello size={64} bounce={false} />
        <h2 className="text-h3">Your kid&apos;s turn?</h2>
        <p className="text-body text-ink">Pick what they&apos;re into. In seconds they&apos;re reading a story with words they can sound out.</p>
        {cta}
      </div>
    </main>
  );
}
