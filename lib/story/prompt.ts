// Prompts for page-by-page generation (AGENT_PLAN.md §6a, §7).
import type { Stage } from "../contracts";
import { SCENES } from "../contracts";
import { EXTRA_SIGHT_WORDS, SIGHT_WORDS } from "./stages";

export const BEATS: Record<number, string> = {
  1: "Set-up: introduce the hero and the interest. Show where the hero is and what the hero loves.",
  2: "A small goal: the hero wants to do or find or make one thing.",
  3: "A gentle problem: something small goes wrong (it is stuck, too big, too far up, it rains). Nothing scary, sad or dangerous.",
  4: "Solved: the hero fixes it with help from a friend or a clever idea. Happy feeling.",
  5: "Cozy ending as the hero goes to bed, then ONE curious question for chapter 2 as the last sentence, about something fun the hero found (like: \"But what was in the box?\"). Cozy and curious, never spooky: no noises in the night, no strangers. Do not answer it.",
};

const sight = [...SIGHT_WORDS, ...EXTRA_SIGHT_WORDS].join(", ");

const STAGE_RULES: Record<Stage, string> = {
  0: `The child is a pre-reader; a grown-up reads this aloud and the child points at words.
- Very simple, warm, rhythmic sentences. 8 to 12 words in total on the page. Repetition is good.`,
  1: `The child can only read short-vowel words (stage 1, CVC).
- Every word must be EITHER a sight word: ${sight} (and these with -s: likes, looks, sees)
  OR a word of single letters with ONE short vowel, consonant-vowel-consonant. Pick from this word bank:
  cat dog pig hen fox bug pup cub bat yak kid mom dad sun mud bed rug mat hat cap box bus van jet cab map pan pot cup jug bag net pen pin log hut den pit web gem bun ham jam nut lid tub top fan kit rod
  sit run hop dig nap hug tug zip rub sip mix fix get got set let had has can did hid hit fit sat ran cut dug tap pat pet jog nod wag win
  big red hot wet fun sad tan ten six yes not but up on in it at us if an am him its
  Two such parts can join (sunset, picnic, rabbit, kitten). Add -s for plurals (cats, pups).
- FORBIDDEN: two consonants together (sh ch th ck ng st bl tr nd mp ll ss), silent e, two vowels together, r after a vowel, -ing, -ed, -y. No hyphens.
  These common words are NOT allowed: glad, good, this, that, with, then, fast, jump, stop, back, will, hill, ball, play, happy, very, little, down, out, now, how, day, time, nice, home, look at, sky, tree, car, star, egg.
  Instead of "glad" or "happy" write "Mo has fun" or "Mo is a fan". Instead of "then" just start a new sentence.
- 15 to 25 words on the page. Very short sentences (3 to 6 words).
Example page: "Mo has a big red van. Mo and Dad hop in. The van can zip up and up. Mo is a fan of the van!"`,
  2: `The child can read short-vowel words plus digraphs and blends (stage 2).
- Every word must be EITHER a sight word: ${sight} (and these with -s: likes, looks, sees)
  OR a short-vowel word (one vowel letter, short sound) that may use sh, ch, th, wh, ck, ng, nk, tch; blends at the start (bl cl fl gl pl sl br cr dr fr gr pr tr sk sm sn sp st sw str spl) or the end (nd nt mp st sk ft lt); doubled ll ss ff zz.
  Word bank: ship fish dish shop shell duck truck rock sock back stick chick chip lunch much rich bench thing king ring sing song long bring think pink sank bump jump lamp camp hand sand land pond nest best rest fast last lost dust frog flag clap grab swim spin spot stop step skip snap sled crab drum plum help belt gift soft fresh splash thick quick black glad will hill ball bell doll fluff kiss mess
  plus all short-vowel CVC words (cat, sun, big, hop, red...). Two closed parts can join (sunset, rocket, picnic). Add -s or -es for plurals and verbs (ships, fixes).
- FORBIDDEN: silent e, two vowels together (ee ea oo ai oa ou ow ay oy), r after a vowel (ar or er ir ur), -ed, -ing on verbs, -y endings. No hyphens.
  These common words are NOT allowed: good, out, down, now, how, day, time, home, safe, white, nice, joy, tree, see the sky, boat, rain, play, car, star, park, happy, water, little, very, night, room, bedroom.
- 15 to 28 words on the page. Short sentences (3 to 7 words).
Example page: "Mo has a red truck. The truck is big and fast. Mo can jump in and honk. Honk, honk! Mo and the truck zip up the hill."`,
  3: `The child can read stage 2 words plus long vowels (stage 3).
- Allowed: sight words (${sight}); short-vowel words with digraphs and blends; magic-e words (cake, bike, home, cute, made, smile); vowel teams ai, ay, ee, ea, oa, ow, igh (rain, play, tree, sea, boat, slow, night); endings -ed and -ing (jumped, playing).
- Avoid: oo (good, look is a sight word), ou (out), oi, oy, aw, ew (new), ue (blue), r after a vowel (ar, or, er, ir, ur), y as a vowel (happy, sky, by, fly), little, very.
- 30 to 42 words on the page. Short sentences.`,
  4: `The child reads fluently for their age.
- Open vocabulary, but short clear sentences a 7-8 year old can read. 30 to 42 words on the page.`,
};

export function systemPrompt(o: { stage: Stage; hero: string; interestLabel: string; themeWords: string[] }): string {
  const theme = o.themeWords.length
    ? `Theme words: ${o.themeWords.map((w) => `"${w}"`).join(", ")}. These are the ONLY words allowed outside the rules. Use each at most once per page.`
    : `There are no extra theme words: every word must follow the rules.`;
  return `You write one page at a time of a short 5-page bedtime story for a child aged 4-9 that the child reads by themselves.
The story is about ${o.interestLabel}. The hero, ${o.hero}, is a kid (not an animal, toy or machine).

STORY RULES
- Gentle, cozy, kind and a little funny. Never scary: no monsters, villains, danger, injuries, weapons, fire, getting lost alone, darkness as a threat, or meanness.
- Say "${o.hero}" every time instead of he, she, they, him, her, his. Write the name exactly as given.
- Plain words a child knows. No names other than ${o.hero}, Mom, Dad, and simple animal friends.
- Keep the same characters, things and setting as the story so far. Each page moves the story on.

READING RULES (most important: the child must be able to sound out every word)
${STAGE_RULES[o.stage]}
- ${theme}

OUTPUT: JSON {"text": the page text only, "scene": one of ${SCENES.join(", ")}} matching the page.`;
}

export function userPrompt(o: { n: number; prior: string[]; lastTry?: string; avoid?: string[]; tooLong?: boolean }): string {
  const sofar = o.prior.length ? o.prior.map((t, i) => `Page ${i + 1}: ${t}`).join("\n") : "(this is the first page)";
  let s = `Story so far:\n${sofar}\n\nWrite page ${o.n} of 5. Beat for this page: ${BEATS[o.n]}`;
  if (o.lastTry && (o.avoid?.length || o.tooLong)) {
    s += `\n\nYour last try was: "${o.lastTry}"`;
    if (o.avoid?.length) s += `\nThe child cannot read these words yet: ${o.avoid.join(", ")}. Rewrite the page, swapping them for simple allowed words (or cutting them).`;
    if (o.tooLong) s += `\nIt was too long. Use fewer words.`;
  }
  return s;
}

export const PAGE_SCHEMA = {
  name: "page",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["text", "scene"],
    properties: {
      text: { type: "string" },
      scene: { type: "string", enum: [...SCENES] },
    },
  },
};
