import type { Stage } from "@/lib/contracts";
import { STAGE_TIP, pickSightWords, themeOnPage, tokenize } from "./highlight";

const MARK_CLASS = {
  target: "rounded-md bg-sun-lighter/70 px-0.5 underline decoration-sun-dark decoration-[3px] underline-offset-[6px]",
  theme: "rounded-md bg-grape-lighter/70 px-0.5",
  sight: "rounded-full px-1 outline-[3px] outline-cyan outline",
} as const;

export function StoryText({ text, stage, themeWords, hero, highlight = true, className = "" }: {
  text: string; stage: Stage; themeWords: string[]; hero: string; highlight?: boolean; className?: string;
}) {
  const tokens = tokenize(text, stage, highlight ? themeWords : [], [hero], stage === 0 ? pickSightWords(text) : undefined);
  return (
    <p className={`ello-story ${className}`}>
      {tokens.map((t, i) =>
        t.kind === "space" || !t.mark || !highlight
          ? <span key={i}>{t.text}</span>
          : <MarkedWord key={i} text={t.text} cls={MARK_CLASS[t.mark]} />,
      )}
    </p>
  );
}

export function ParentTip({ text, stage, themeWords, hero }: { text: string; stage: Stage; themeWords: string[]; hero: string }) {
  const help = themeOnPage(text, themeWords);
  return (
    <div className="rounded-ello bg-pastel-yellow px-4 py-3 text-body-s text-ink-dark">
      <p><span className="font-bold">For grown-ups: </span>{STAGE_TIP[stage].replaceAll("{hero}", hero)}</p>
      {help.length > 0 && (
        <p className="mt-1">
          <span className="font-bold">Help with: </span>
          {help.map((w) => <span key={w} className={`${MARK_CLASS.theme} mr-1`}>{w}</span>)}
          <span className="text-ink">(tricky word, just say it together)</span>
        </p>
      )}
    </div>
  );
}

/** Keep punctuation outside the highlight: `"truck."` -> mark(truck) + "." */
function MarkedWord({ text, cls }: { text: string; cls: string }) {
  const m = /^([^\p{L}']*)(.*?)([^\p{L}']*)$/u.exec(text);
  if (!m) return <span className={cls}>{text}</span>;
  return <span>{m[1]}<span className={cls}>{m[2]}</span>{m[3]}</span>;
}
