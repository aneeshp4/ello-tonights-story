import type { HeadlineVariant } from "@/lib/contracts";
import { Yello } from "@/components/brand/Yello";
import { LandingViewed, MakeStoryCta } from "./LandingClient";

// Screen 0 (AGENT_PLAN.md §5). Server component; the headline variant comes in as
// a prop (proxy.ts rewrites `/` → `/landing/{h}`), so the right copy is in the
// prerendered HTML with no flash.
export const HEADLINES: Record<HeadlineVariant, string> = {
  a: "A story your kid can read by themselves. About the thing they love.",
  b: "Turn their obsession into reading practice.",
};

const STEPS = [
  { emoji: "🚚", title: "Tell us what they love", body: "Trucks, sharks, unicorns, soccer… whatever they can't stop talking about." },
  { emoji: "🔤", title: "Tap a word they can read", body: "One tap tells us their level, so every word is one they can sound out." },
  { emoji: "🌙", title: "Read it tonight", body: "Five short pages, ready in seconds. Free, no signup." },
];

export function Landing({ h }: { h: HeadlineVariant }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-6">
      <LandingViewed h={h} />

      <p className="mb-6 flex items-center gap-2 text-body-s font-bold text-ink-dark">
        <Yello size="sm" />
        <span>
          Tonight&apos;s Story <span className="font-normal text-ink">by Ello</span>
        </span>
      </p>

      <h1 className="text-[2rem] leading-[1.2] text-ink-darker sm:text-h1" data-variant={h}>
        {HEADLINES[h]}
      </h1>
      <p className="mt-1 text-body text-ink-dark">
        Tell us what they&apos;re into and what they can read. We&apos;ll write tonight&apos;s story at
        exactly their level.
      </p>

      <ExampleStory />

      <div className="mt-6">
        <MakeStoryCta source="landing" />
        <p className="mt-3 text-center text-body-s text-ink">
          Free · about a minute · no account needed
        </p>
      </div>

      <section className="mt-10" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-h3 text-ink-darker">
          How it works
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-ello bg-white p-4 shadow-card">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pastel-yellow text-xl"
              >
                {s.emoji}
              </span>
              <div>
                <p className="font-bold text-ink-darker">
                  {i + 1}. {s.title}
                </p>
                <p className="text-body-s text-ink-dark">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 flex items-start gap-2 rounded-ello bg-pastel-teal p-4 text-body-s text-teal-darker">
        <span aria-hidden>🔒</span>
        <span>
          We never ask for your child&apos;s full name, photo or school. The name in the story stays on
          your device.
        </span>
      </p>

      <div className="mt-8">
        <MakeStoryCta source="landing_bottom" className="ello-btn ello-btn--secondary" />
      </div>

      <footer className="mt-10 flex items-center justify-center gap-2 text-center text-body-s text-ink">
        <Yello size="sm" />
        <span>From Ello, the AI reading teacher for ages 5–9</span>
      </footer>
    </main>
  );
}

function ExampleStory() {
  // Stage 2 (digraphs/blends) sample. Target-pattern words are highlighted the way
  // the reader does it.
  const hl = "rounded-md bg-sun-lighter/60 px-0.5";
  return (
    <figure className="mt-6 overflow-hidden rounded-ello-lg bg-white shadow-card">
      <div
        aria-hidden
        className="relative flex h-28 items-end justify-center bg-gradient-to-b from-sky-lighter to-pastel-cyan"
      >
        <span className="absolute left-6 top-4 text-3xl">☀️</span>
        <div className="h-8 w-full rounded-t-[50%] bg-teal-lighter" />
        <span className="absolute bottom-3 text-5xl">🚚</span>
      </div>
      <div className="p-5">
        <p className="ello-story !text-[1.375rem]">
          Mo has a big red <mark className={hl}>truck</mark>. Mo and the <mark className={hl}>truck</mark>{" "}
          zip up the <mark className={hl}>hill</mark>. <mark className={hl}>Honk</mark>!{" "}
          <mark className={hl}>Honk</mark>! At the top is a box. What is in
          it?
        </p>
        <figcaption className="mt-3 flex items-center justify-between text-body-s text-ink">
          <span>Example · for a 6-year-old who loves trucks</span>
          <span aria-label="Page 1 of 5" className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-teal" : "bg-ink-lighter"}`} />
            ))}
          </span>
        </figcaption>
      </div>
    </figure>
  );
}
