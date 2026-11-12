// Client-side word highlighting for the reader (AGENT_PLAN §5, §7).
import type { Stage } from "@/lib/contracts";

export const SIGHT_WORDS = new Set(
  "a the is to i he she we me be was said of you are they my do go no so here there what for have like look see come some one two all his her put push pull"
    .split(" "),
);

const C = "bcdfghjklmnpqrstvwxyz";
const CVC = new RegExp(`^[${C}][aeiou][${C}]s?$`);
const DIGRAPH = /(sh|ch|th|wh|ck|ng)/;
const INITIAL_BLEND = /^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sc|sk|sl|sm|sn|sp|st|sw|tr|tw|spl|spr|str|scr)[aeiou]/;
const FINAL_BLEND = /[aeiou](st|sk|sp|nd|nt|nk|mp|ft|lt|ld|lp|lk|ct|pt|xt)s?$/;
const MAGIC_E = /[aeiou][^aeiou\s]e[sd]?$/;
const VOWEL_TEAM = /(ai|ay|ee|ea|oa|ow|igh)/;

export function isTarget(word: string, stage: Stage): boolean {
  const w = word.toLowerCase();
  if (SIGHT_WORDS.has(w) || w === "and" || w.length < 2) return false;
  switch (stage) {
    case 1: return CVC.test(w);
    case 2: return DIGRAPH.test(w) || INITIAL_BLEND.test(w) || FINAL_BLEND.test(w);
    case 3: return MAGIC_E.test(w) || VOWEL_TEAM.test(w);
    default: return false;
  }
}

export const STAGE_TIP: Record<Stage, string> = {
  0: "Read it together. Let {hero} point to the circled words, they show up a lot in books.",
  1: "The highlighted words are short-vowel words like cat and sun. Let {hero} sound each one out.",
  2: "The highlighted words have sh, ch, th, ck or a blend like fr- or -st. Let {hero} sound those out.",
  3: "The highlighted words have a magic e (cake) or a vowel team (rain, see). Let {hero} try them first.",
  4: "{hero} is reading well! Ask what they think happens next.",
};

export type Token =
  | { kind: "space"; text: string }
  | { kind: "word"; text: string; mark: "target" | "theme" | "sight" | null };

/**
 * Split page text into tokens and mark words.
 * `themeWords` are non-decodable interest words ("Help with: dinosaur").
 * `heroNames` are never highlighted.
 */
export function tokenize(text: string, stage: Stage, themeWords: string[], heroNames: string[], sightBudget?: Set<string>): Token[] {
  const theme = themeWords.map((t) => t.toLowerCase());
  const heroes = new Set(heroNames.flatMap((h) => h.toLowerCase().split(/\s+/)));
  const out: Token[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { out.push({ kind: "space", text: part }); continue; }
    const core = part.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, "").toLowerCase().replace(/'s$/, "");
    let mark: "target" | "theme" | "sight" | null = null;
    if (core && !heroes.has(core)) {
      if (theme.some((t) => core === t || core === t + "s" || core === t + "es")) mark = "theme";
      else if (stage === 0 && sightBudget?.has(core)) mark = "sight";
      else if (isTarget(core, stage)) mark = "target";
    }
    out.push({ kind: "word", text: part, mark });
  }
  return out;
}

/** Stage 0: pick up to 3 distinct sight words from the page for the kid to point at. */
export function pickSightWords(text: string): Set<string> {
  const picked = new Set<string>();
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^\p{L}']/gu, "");
    if (SIGHT_WORDS.has(w) && w !== "a" && w !== "i") picked.add(w);
    if (picked.size >= 3) break;
  }
  return picked;
}

/** Theme words that actually appear on this page. */
export function themeOnPage(text: string, themeWords: string[]): string[] {
  const t = text.toLowerCase();
  return themeWords.filter((w) => new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));
}

export const fillHero = (text: string, hero: string) => text.split("{{hero}}").join(hero);
