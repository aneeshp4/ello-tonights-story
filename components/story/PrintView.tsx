"use client";
import Link from "next/link";
import type { StoredStory } from "@/lib/contracts";
import { track } from "@/lib/track";
import { interestEmoji, Yello } from "./Scene";
import { useResolvedStory } from "./useResolvedStory";

const SCENE_EMOJI: Record<string, string> = {
  "outdoors-day": "☀️🌳", "outdoors-night": "🌙⭐", bedroom: "🛏️🧸", kitchen: "🍳🥕", water: "🌊🐟", space: "🪐⭐",
  forest: "🌲🍄", city: "🏢🚦", farm: "🐄🌾", castle: "🏰🚩", "sports-field": "🥅⚽",
};

const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.4in; }
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .print-half { height: 4.9in; box-shadow: none !important; border: 2px dashed #c5cece !important; break-inside: avoid; page-break-inside: avoid; margin: 0 0 0.2in 0 !important; }
}`;

export function PrintView({ id, stored }: { id: string; stored: StoredStory | null }) {
  // The parent's own printout: real hero from this browser if we have it, else fun_name.
  const { story, ready } = useResolvedStory(id, stored);

  if (!story) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Yello bounce={!ready} />
        {ready && <><p className="text-h3">We couldn&apos;t find that story</p><Link href="/make" className="ello-btn">Make tonight&apos;s story</Link></>}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-col gap-3">
        <button type="button" className="ello-btn" onClick={() => { track("print_clicked", { from: "print_page", story_id: id }); window.print(); }}>
          🖨️ Print
        </button>
        <Link href={`/story/${id}`} className="text-center text-body font-semibold text-teal-dark underline">Back to the story</Link>
      </div>

      <section className="print-half ello-card flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-[5rem] leading-none">{interestEmoji(story.interest)}</p>
        <h1 className="font-story text-[2.5rem] leading-tight text-ink-darker">{story.title}</h1>
        <p className="text-body text-ink">Tonight&apos;s Story · from Ello</p>
      </section>

      {story.pages.map((p) => (
        <section key={p.n} className="print-half ello-card flex flex-col justify-between gap-4">
          <p className="text-center text-5xl">{SCENE_EMOJI[p.scene] ?? "⭐"} {interestEmoji(story.interest)}</p>
          <p className="font-story text-[2rem] leading-[1.7] text-gray-800">{p.text}</p>
          <p className="text-right text-body text-ink">{p.n}</p>
        </section>
      ))}

      <section className="print-half ello-card flex flex-col items-center justify-center gap-3 text-center">
        <p className="font-story text-[2.5rem] text-ink-darker">The End</p>
        <p className="text-body text-ink">I read this story by myself! ⭐</p>
        <p className="text-body-s text-ink">Name: ______________________</p>
      </section>
    </main>
  );
}
