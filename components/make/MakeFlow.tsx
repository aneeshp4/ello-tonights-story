"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AGE_BANDS, AGE_DEFAULT_STAGE, INTERESTS, type AgeBand, type Stage, type StoryRequest } from "@/lib/contracts";
import { getSessionId, track } from "@/lib/track";
import { getVariant } from "@/lib/variant";
import { Yello } from "@/components/story/Scene";
import { readUtm, startStory } from "@/components/story/store";
import { cleanHero, closestChip, heroError, interestError, randomFunName, readRef, FUN_NAMES } from "./validate";

type Step = 1 | 2 | 3 | "loading" | "error";
type Choice = { stage: Stage; source: "card" | "not_reading" | "not_sure" };

const CARDS: { stage: Stage; words: string; hint: string }[] = [
  { stage: 1, words: "cat · sun", hint: "short vowels" },
  { stage: 2, words: "ship · frog", hint: "sh, ch, blends" },
  { stage: 3, words: "cake · rain", hint: "long vowels" },
  { stage: 4, words: "because · night", hint: "reading well" },
];

/**
 * Keyed on bfcacheId so a fresh push to /make (e.g. "Make another story") starts
 * over, while browser back/forward keeps the parent's answers (cacheComponents
 * preserves page state with <Activity>).
 */
export function MakePage() {
  const { bfcacheId } = useRouter();
  return <MakeFlow key={bfcacheId} />;
}

function MakeFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [hero, setHero] = useState("");
  const [heroIsFun, setHeroIsFun] = useState(false);
  const [age, setAge] = useState<AgeBand | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigated = useRef(false);
  const lastViewed = useRef<Step | null>(null);

  useEffect(() => {
    if (typeof step === "number" && lastViewed.current !== step) track("step_viewed", { step });
    lastViewed.current = step;
  }, [step]);

  const heroName = cleanHero(hero) || "your kid";
  const interestText = chip ? INTERESTS.find((i) => i.id === chip)!.label.toLowerCase() : custom.trim();

  function reject(field: "hero" | "interest", reason: string, server = false) {
    track("input_rejected", { field, reason, server });
  }

  function pickFun() {
    const name = randomFunName(hero);
    setHero(name); setHeroIsFun(true); setError(null);
    track("fun_name_used", { name });
  }

  function next1() {
    const e = heroError(hero);
    if (e) { setError(e.message); reject("hero", e.reason); return; }
    if (!age) { setError("How old is the reader?"); return; }
    setError(null); setNotice(null);
    track("step_completed", { step: 1, age_band: age, fun_name: heroIsFun });
    setStep(2);
  }

  function next2() {
    if (!chip) {
      const e = interestError(custom);
      if (e) { setError(custom.trim() ? e.message : "Pick one, or type what they love."); if (custom.trim()) reject("interest", e.reason); return; }
    }
    setError(null); setNotice(null);
    track("interest_selected", { interest: chip ?? custom.trim(), custom: !chip });
    track("step_completed", { step: 2, interest: chip ?? "custom", custom: !chip });
    setStep(3);
  }

  function write() {
    if (!choice || !age) return;
    track("reading_check_completed", { stage: choice.stage, source: choice.source });
    track("step_completed", { step: 3, stage: choice.stage });
    const variant = getVariant();
    const ref = readRef();
    readUtm(); // capture utm_* into the session for the lead later
    const req: StoryRequest = {
      hero: cleanHero(hero),
      fun_name: heroIsFun && FUN_NAMES.includes(cleanHero(hero)) ? cleanHero(hero) : randomFunName(),
      age_band: age,
      interest: chip ?? custom.trim(),
      interest_custom: !chip,
      stage: choice.stage,
      session_id: getSessionId(),
      variant,
      ref,
    };
    track("story_requested", { stage: req.stage, interest: req.interest, custom: req.interest_custom, age_band: age, ref });
    setStep("loading");
    const t0 = performance.now();
    navigated.current = false;
    void startStory(req, {
      onStory: () => {},
      onPage: (id, page) => {
        if (page.n !== 1 || navigated.current) return;
        navigated.current = true;
        track("page_ready", { page: 1, wait_ms: Math.round(performance.now() - t0), source: page.source, client: true, story_id: id });
        router.replace(`/story/${id}`);
      },
      onRejected: (field, suggestion) => {
        reject(field, "server", true);
        if (field === "hero") {
          const fun = randomFunName();
          setHero(fun); setHeroIsFun(true);
          setNotice(`Let's use a story name instead. How about ${fun}? You can pick another.`);
          setStep(1);
        } else {
          const id = closestChip(req.interest, suggestion);
          const label = INTERESTS.find((i) => i.id === id)!.label;
          setChip(id); setCustom("");
          setNotice(`We can't write about that one yet. How about ${label}?`);
          setStep(2);
        }
      },
      onError: (message) => {
        if (navigated.current) return; // the reader handles a stream that ends early
        track("story_failed", { reason: message, stage: req.stage });
        setError(message === "rate_limited" ? "That's a lot of stories! Try again in a little while." : "Oops, the story got stuck. Let's try again.");
        setStep("error");
      },
    });
  }

  const stepNum = typeof step === "number" ? step : 3;

  if (step === "loading") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
          <Yello size={110} />
          <p className="text-h3 text-ink-dark" aria-live="polite">
            Writing a {interestText} story with words {heroName} can sound out…
          </p>
          <div className="ello-card text-left">
            <p className="text-body"><span className="font-bold">Tip for tonight: </span>let {heroName} point to each word as they read. It helps keep their place.</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "error") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
          <Yello bounce={false} />
          <p className="text-h3">{error}</p>
          <button type="button" className="ello-btn" onClick={write}>Try again</button>
          <button type="button" className="ello-btn ello-btn--secondary" onClick={() => { setError(null); setStep(1); }}>Start over</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3">
        {stepNum > 1 ? (
          <button type="button" aria-label="Back" className="h-11 w-11 shrink-0 rounded-full bg-white text-xl text-ink-dark shadow-card"
            onClick={() => { setError(null); setNotice(null); setStep((stepNum - 1) as Step); }}>←</button>
        ) : (
          <Link href="/" aria-label="Home" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-card">←</Link>
        )}
        <div className="flex flex-1 gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={stepNum} aria-label={`Step ${stepNum} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-2.5 flex-1 rounded-full ${n <= stepNum ? "bg-teal" : "bg-ink-lighter"}`} />
          ))}
        </div>
      </div>

      {notice && <p className="rounded-ello bg-pastel-yellow px-4 py-3 text-body font-semibold text-ink-dark" role="status">{notice}</p>}

      {step === 1 && (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); next1(); }}>
          <h1 className="text-h1">Who&apos;s the hero?</h1>
          <div className="flex flex-col gap-2">
            <label htmlFor="hero" className="text-body font-bold">Story name</label>
            <input id="hero" className="ello-input" value={hero} maxLength={16} autoComplete="off" autoCapitalize="words"
              placeholder="Mo" aria-invalid={!!error} aria-describedby="hero-note"
              onChange={(e) => { setHero(e.target.value); setHeroIsFun(false); setError(null); }} />
            <button type="button" className="ello-chip self-start" onClick={pickFun}>🎲 Pick a fun name</button>
            <p id="hero-note" className="text-body-s text-ink">🔒 Only used inside the story. We don&apos;t save it.</p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-body font-bold">How old?</legend>
            <div className="grid grid-cols-4 gap-2">
              {AGE_BANDS.map((a) => (
                <button key={a} type="button" className="ello-chip min-h-12 px-2 text-center" aria-pressed={age === a}
                  onClick={() => { setAge(a); setError(null); }}>{a}</button>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-body font-semibold text-coral-dark" role="alert">{error}</p>}
          <button type="submit" className="ello-btn mt-2">Next</button>
        </form>
      )}

      {step === 2 && (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); next2(); }}>
          <h1 className="text-h3 sm:text-h1">What is {heroName} into right now?</h1>
          <div className="grid grid-cols-3 gap-2">
            {INTERESTS.map((i) => (
              <button key={i.id} type="button" aria-pressed={chip === i.id}
                className="ello-chip flex min-h-20 flex-col items-center justify-center gap-1 rounded-ello! px-1 text-body-s"
                onClick={() => { setChip(chip === i.id ? null : i.id); setCustom(""); setError(null); }}>
                <span className="text-3xl" aria-hidden>{i.emoji}</span>{i.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="custom" className="text-body font-bold">Or type it</label>
            <input id="custom" className="ello-input" value={custom} maxLength={40} autoComplete="off"
              placeholder="garbage trucks, Grandma's farm…"
              onChange={(e) => { setCustom(e.target.value); if (e.target.value) setChip(null); setError(null); }} />
          </div>
          {error && <p className="text-body font-semibold text-coral-dark" role="alert">{error}</p>}
          <button type="submit" className="ello-btn" disabled={!chip && !custom.trim()}>Next</button>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-h3 sm:text-h1">Which can {heroName} read on their own?</h1>
            <p className="text-body text-ink">Tap the hardest one.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CARDS.map((c) => {
              const on = choice?.source === "card" && choice.stage === c.stage;
              return (
                <button key={c.stage} type="button" aria-pressed={on}
                  className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-ello-lg border-2 bg-white p-3 shadow-card ${on ? "border-teal bg-pastel-teal" : "border-ink-lighter"}`}
                  onClick={() => setChoice({ stage: c.stage, source: "card" })}>
                  <span className="font-story text-[1.6rem] leading-tight text-ink-darker">{c.words}</span>
                  <span className="text-body-s text-ink">{c.hint}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" className="ello-chip flex-1" aria-pressed={choice?.source === "not_reading"}
              onClick={() => setChoice({ stage: 0, source: "not_reading" })}>Not reading yet</button>
            <button type="button" className="ello-chip flex-1" aria-pressed={choice?.source === "not_sure"}
              onClick={() => age && setChoice({ stage: AGE_DEFAULT_STAGE[age], source: "not_sure" })}>Not sure</button>
          </div>
          {choice?.source === "not_reading" && <p className="text-body-s text-ink">We&apos;ll make a read-together story and circle a few words for {heroName} to point at.</p>}
          <button type="button" className="ello-btn mt-2" disabled={!choice} onClick={write}>Write the story</button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-10 pt-5">{children}</main>;
}
