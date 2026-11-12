// Reading stages (AGENT_PLAN.md §7). Client-safe: no server imports.
import type { Stage } from "../contracts";

export interface StageDef {
  stage: Stage;
  label: string;
  minWords: number;
  maxWords: number;
  maxOffList: number | null;     // null = no word-list check (stages 0 and 4)
  /** Regex source for the stage's *target* pattern, for client-side highlighting. */
  targetPattern: string | null;
}

export const STAGES: Record<Stage, StageDef> = {
  0: { stage: 0, label: "Read together", minWords: 8, maxWords: 12, maxOffList: null, targetPattern: null },
  1: { stage: 1, label: "Short vowels (cat, sun)", minWords: 15, maxWords: 30, maxOffList: 1, targetPattern: "^[^aeiou]?[aeiou][^aeiou]s?$" },
  2: { stage: 2, label: "Digraphs and blends (ship, frog)", minWords: 15, maxWords: 30, maxOffList: 1, targetPattern: "(sh|ch|th|wh|ck|ng)|^(bl|cl|fl|gl|pl|sl|br|cr|dr|fr|gr|pr|tr|sc|sk|sm|sn|sp|st|sw|tw)|(nd|nt|mp|st|sk|ft|lt|ll|ss|ff)s?$" },
  3: { stage: 3, label: "Long vowels (cake, rain)", minWords: 30, maxWords: 45, maxOffList: 3, targetPattern: "(ai|ay|ee|ea|oa|ow|igh)|[aeiou][bcdfgklmnpstvz]e$" },
  4: { stage: 4, label: "Fluent (because, night)", minWords: 30, maxWords: 45, maxOffList: null, targetPattern: null },
};

export const SIGHT_WORDS = [
  "a", "the", "is", "to", "i", "he", "she", "we", "me", "be", "was", "said", "of", "you", "are", "they",
  "my", "do", "go", "no", "so", "here", "there", "what", "for", "have", "like", "look", "see", "come",
  "some", "one", "two", "all", "his", "her", "put", "push", "pull",
] as const;

// Small, deliberate extension of the plan's list. "and" and "into" appear on nearly every page and are
// taught as heart words alongside stage 1 in most phonics scopes; without them stage 1 regenerates constantly.
export const EXTRA_SIGHT_WORDS = ["and", "into"] as const;

/** Candidate theme vocabulary per interest chip. Only words NOT decodable at the stage become theme words. */
export const INTEREST_VOCAB: Record<string, { label: string; words: string[]; title: string }> = {
  dinosaurs: { label: "dinosaurs", words: ["dinosaur", "egg"], title: "{{hero}} and the Dinosaur" },
  trucks: { label: "trucks", words: ["truck", "digger"], title: "{{hero}} and the Big Truck" },
  space: { label: "space and rockets", words: ["rocket", "space"], title: "{{hero}} Blasts Off" },
  dogs: { label: "dogs", words: ["puppy", "dog"], title: "{{hero}} and the Pup" },
  sharks: { label: "sharks", words: ["shark", "ocean"], title: "{{hero}} and the Shark" },
  soccer: { label: "soccer", words: ["soccer", "ball"], title: "{{hero}} Kicks Off" },
  mermaids: { label: "mermaids", words: ["mermaid", "ocean"], title: "{{hero}} and the Mermaid" },
  robots: { label: "robots", words: ["robot", "beep"], title: "{{hero}} and the Robot" },
  bugs: { label: "bugs", words: ["bug", "beetle"], title: "{{hero}} and the Bug" },
  cooking: { label: "cooking", words: ["pizza", "cook"], title: "{{hero}} the Cook" },
  castles: { label: "castles", words: ["castle", "queen"], title: "{{hero}} and the Castle" },
  unicorns: { label: "unicorns", words: ["unicorn", "rainbow"], title: "{{hero}} and the Unicorn" },
};

/** Story title with the {{hero}} token (never the real name). */
export function titleFor(interest: string, custom: boolean): string {
  if (!custom && INTEREST_VOCAB[interest]) return INTEREST_VOCAB[interest].title;
  const t = interest.trim().replace(/\s+/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return `{{hero}} and the ${t}`;
}

export function interestLabel(interest: string, custom: boolean): string {
  return custom ? interest : INTEREST_VOCAB[interest]?.label ?? interest;
}

export function stageDef(s: Stage): StageDef {
  return STAGES[s];
}
