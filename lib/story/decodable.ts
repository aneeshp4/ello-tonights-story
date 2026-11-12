// Decodable-text checker (AGENT_PLAN.md §7). Client-safe, pure.
//
// A word passes if it is a sight word, a theme word (or its plural), part of the hero name / {{hero}}
// token, or matches the stage's grapheme grammar. The grammar is syllable based:
//   stage 1: closed syllables of single consonants + short vowel (cat, sun, sunset), plural -s
//   stage 2: + digraphs (sh ch th wh ck ng nk tch), initial/final blends, -ll -ss -ff -zz, -es
//   stage 3: + magic-e (cake), vowel teams (ai ay ee ea oa ow igh), open syllables (robot), -ed -ing -er
// Syllables after the first must start with a consonant, which stops vowel pairs that are not taught
// yet (out, boat at stage 2) from sneaking through as two syllables.
import type { Stage } from "../contracts";
import { EXTRA_SIGHT_WORDS, INTEREST_VOCAB, SIGHT_WORDS, STAGES } from "./stages";

const V = "[aeiou]";
const ON1 = "(?:qu|[bcdfghjklmnprstvwyz])";
const CO1 = "[bdfgklmnpstxz]";
const ON2 = "(?:spl|spr|str|scr|shr|thr|squ|sh|ch|th|wh|bl|cl|fl|gl|pl|sl|br|cr|dr|fr|gr|pr|tr|sc|sk|sm|sn|sp|st|sw|tw|qu|[bcdfghjklmnprstvwyz])";
const CO2 = "(?:tch|nch|sh|ch|th|ck|ng|nk|ll|ss|ff|zz|gg|dd|nd|nt|mp|st|sk|sp|ft|lt|lk|lp|lf|lm|pt|xt|ct|[bdfgklmnpstxz])";
const VT = "(?:igh|ai|ay|ee|ea|oa|ow)";

function grammar(stage: 1 | 2 | 3): RegExp {
  if (stage === 1) {
    const closed = `${V}${CO1}`;
    return new RegExp(`^${ON1}?${closed}(?:${ON1}${closed})?s?$`);
  }
  if (stage === 2) {
    const closed = `${V}${CO2}`;
    return new RegExp(`^${ON2}?${closed}(?:${ON2}${closed})?(?:s|es)?$`);
  }
  const body = `(?:${V}${CO2}|${VT}${CO2}?|${V})`;      // closed | vowel team | open
  const magic = `${V}[bcdfgklmnpstvz]e`;
  const first = `${ON2}?(?:${magic}|${body})`;
  const next = `${ON2}(?:${magic}|${body})`;
  return new RegExp(`^${first}(?:${next}){0,2}(?:s|es|ed|ing|er|d)?$`);
}

const GRAMMARS = { 1: grammar(1), 2: grammar(2), 3: grammar(3) } as const;
const SIGHT = new Set<string>([...SIGHT_WORDS, ...EXTRA_SIGHT_WORDS]);

export function tokenize(text: string): string[] {
  return text
    .replace(/\{\{hero\}\}/gi, "herotoken")
    .replace(/[‘’]/g, "'")
    .split(/[\s\-—–/]+/)
    .map((w) => w.toLowerCase().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "").replace(/'s$/, ""))
    .filter((w) => w.length > 0);
}

/** True if a single (lowercased) word is decodable at this stage by grammar alone (no sight/theme words). */
export function isPhonicsDecodable(word: string, stage: Stage): boolean {
  if (stage === 0 || stage === 4) return true;
  const g = GRAMMARS[stage];
  if (!g.test(word)) return false;
  // -ed / -ing endings are stage 3. Catch inflections that parse as extra closed syllables at stages 1-2
  // (jum-ped, jum-ping) while keeping real words like red, sled, king, thing.
  if (stage < 3) {
    const m = word.match(/^(.+?)(?:ed|ing)$/);
    if (m && (GRAMMARS[2].test(m[1]) || GRAMMARS[2].test(m[1] + "e"))) return false;
  }
  return true;
}

export interface DecodableResult {
  ok: boolean;
  words: number;
  offList: string[];
  tooLong: boolean;
  tooShort: boolean;
}

export function checkDecodable(text: string, stage: Stage, opts: { hero?: string; themeWords?: string[] } = {}): DecodableResult {
  const def = STAGES[stage];
  const tokens = tokenize(text);
  const heroParts = new Set(tokenize(opts.hero ?? "").concat("herotoken"));
  const theme = new Set<string>();
  for (const t of opts.themeWords ?? []) for (const w of tokenize(t)) { theme.add(w); theme.add(w + "s"); theme.add(w + "es"); }

  const offList: string[] = [];
  if (def.maxOffList !== null) {
    for (const w of tokens) {
      if (/^\d+$/.test(w) || heroParts.has(w) || SIGHT.has(w) || theme.has(w)) continue;
      if (/s$/.test(w) && (SIGHT.has(w.slice(0, -1)) || SIGHT.has(w.replace(/es$/, "")))) continue; // likes, looks, sees, pushes
      if (isPhonicsDecodable(w, stage)) continue;
      offList.push(w);
    }
  }
  const tooLong = tokens.length > def.maxWords;
  // Short pages are fine for kids; only reject pages that are clearly truncated.
  const tooShort = tokens.length < Math.ceil(def.minWords / 2);
  const ok = !tooLong && !tooShort && (def.maxOffList === null || offList.length <= def.maxOffList);
  return { ok, words: tokens.length, offList, tooLong, tooShort };
}

/** Up to 2 interest words a kid at this stage can't decode, shown to parents as "Help with: …". */
export function themeWordsFor(interest: string, stage: Stage, custom: boolean): string[] {
  if (stage === 0 || stage === 4) return [];
  const candidates = custom
    ? tokenize(interest).filter((w) => w.length >= 3 && /^\p{L}+$/u.test(w) && !SIGHT.has(w) && !STOP.has(w))
        .map((w) => (w.endsWith("s") && w.length > 4 ? w.slice(0, -1) : w))
    : INTEREST_VOCAB[interest]?.words ?? [];
  const out: string[] = [];
  for (const w of candidates) {
    if (out.length >= 2) break;
    if (!SIGHT.has(w) && !isPhonicsDecodable(w, stage) && !out.includes(w)) out.push(w);
  }
  return out;
}

const STOP = new Set(["and", "the", "with", "for", "big", "little", "very", "about", "that", "this", "from"]);
