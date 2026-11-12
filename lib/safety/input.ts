// Input guards (AGENT_PLAN.md §8). Client-safe and pure: the frontend runs the same checks.
// The server-side Jev topic check for custom interests lives in guardStoryRequest() in ./request.ts.
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { AGE_BANDS, INTERESTS } from "../contracts";

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export function hasProfanity(s: string): boolean {
  return matcher.hasMatch(s);
}

// Plan says 12, but the fun-name list includes "Captain Pickle" (14), so allow 16.
export const HERO_MAX = 16;
export const INTEREST_MAX = 40;
const HERO_RE = /^[\p{L}][\p{L} '\-]*$/u;

export type GuardResult = { ok: true; value: string } | { ok: false; reason: string; suggestion?: string };

export function checkHero(raw: unknown): GuardResult {
  if (typeof raw !== "string") return { ok: false, reason: "missing" };
  const v = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (v.length < 1 || v.length > HERO_MAX) return { ok: false, reason: "length" };
  if (!HERO_RE.test(v)) return { ok: false, reason: "chars" };
  if (hasProfanity(v)) return { ok: false, reason: "profanity" };
  return { ok: true, value: v };
}

// Whole-word topic blocklist: weapons, gore, horror, adult, drugs, brand names.
const BLOCK: Record<string, string[]> = {
  weapons: ["gun", "guns", "rifle", "pistol", "knife", "knives", "bomb", "bombs", "grenade", "weapon", "weapons", "sniper", "shooting", "shooter", "ammo", "war", "army tanks"],
  gore: ["blood", "bloody", "gore", "gory", "kill", "killing", "murder", "dead", "death", "die", "dying", "corpse", "zombie", "zombies", "skeleton army"],
  horror: ["horror", "creepy", "nightmare", "nightmares", "demon", "demons", "devil", "slasher", "haunted", "possessed", "chucky", "freddy", "pennywise", "huggy wuggy", "skibidi", "five nights"],
  adult: ["sex", "sexy", "porn", "nude", "naked", "boobs", "kissing", "dating", "girlfriend", "boyfriend", "strip"],
  drugs: ["drug", "drugs", "weed", "cocaine", "beer", "wine", "vodka", "alcohol", "drunk", "cigarette", "cigarettes", "vape", "vaping", "smoking", "pills"],
  brands: ["minecraft", "fortnite", "roblox", "pokemon", "pokémon", "pikachu", "disney", "frozen", "elsa", "spiderman", "spider-man", "marvel", "barbie", "paw patrol", "bluey", "peppa", "lego", "mario", "sonic", "batman", "superman", "star wars", "harry potter", "nintendo", "hot wheels", "transformers", "cocomelon", "moana", "pixar", "minions", "avengers", "hulk"],
};
const BLOCK_RE = new RegExp(`(?:^|[^\\p{L}])(?:${Object.values(BLOCK).flat().join("|")})(?=$|[^\\p{L}])`, "iu");

// Closest chip for rejected or free-text interests.
const SYNONYMS: Record<string, string[]> = {
  trucks: ["truck", "car", "cars", "train", "trains", "bus", "tractor", "digger", "excavator", "vehicle", "fire truck", "hot wheels", "transformers", "monster truck"],
  dinosaurs: ["dino", "dinosaur", "t-rex", "trex", "rex", "dragon", "dragons", "jurassic"],
  space: ["rocket", "planet", "planets", "moon", "star", "stars", "astronaut", "alien", "aliens", "star wars"],
  dogs: ["dog", "puppy", "puppies", "pet", "pets", "cat", "cats", "kitten", "animals", "bluey", "paw patrol"],
  sharks: ["shark", "ocean", "fish", "whale", "whales", "sea", "dolphin", "octopus"],
  soccer: ["football", "sports", "ball", "basketball", "baseball", "hockey"],
  mermaids: ["mermaid", "fairy", "fairies", "princess", "moana", "frozen", "elsa", "ariel"],
  robots: ["robot", "minecraft", "roblox", "fortnite", "video games", "games", "computer", "lego", "machines"],
  bugs: ["bug", "insect", "insects", "butterfly", "spider", "ants", "bees", "worms", "pokemon", "pikachu"],
  cooking: ["food", "baking", "cake", "pizza", "cookies", "kitchen"],
  castles: ["castle", "knight", "knights", "king", "queen", "prince", "superheroes", "superhero", "batman", "spiderman", "marvel", "avengers"],
  unicorns: ["unicorn", "pony", "ponies", "horse", "horses", "rainbow", "magic", "barbie"],
};

export function closestChip(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const c of INTERESTS) if (t.includes(c.id) || t.includes(c.id.replace(/s$/, ""))) return c.id;
  for (const [chip, words] of Object.entries(SYNONYMS)) {
    if (words.some((w) => new RegExp(`(?:^|[^\\p{L}])${w}(?=$|[^\\p{L}])`, "iu").test(t))) return chip;
  }
  return undefined;
}

/** Interest: chip ids pass as-is; custom text must pass length, profanity and blocklist (Jev runs server-side). */
export function checkInterest(raw: unknown, custom: boolean): GuardResult {
  if (typeof raw !== "string") return { ok: false, reason: "missing" };
  const v = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!custom) {
    return INTERESTS.some((c) => c.id === v) ? { ok: true, value: v } : { ok: false, reason: "unknown_chip" };
  }
  if (v.length < 2 || v.length > INTEREST_MAX) return { ok: false, reason: "length", suggestion: closestChip(v) };
  if (!/^[\p{L}\d][\p{L}\d '\-,&!.]*$/u.test(v)) return { ok: false, reason: "chars", suggestion: closestChip(v) };
  if (hasProfanity(v)) return { ok: false, reason: "profanity" };
  if (BLOCK_RE.test(v)) return { ok: false, reason: "blocklist", suggestion: closestChip(v) };
  return { ok: true, value: v };
}

export function checkAgeBand(raw: unknown): boolean {
  return typeof raw === "string" && (AGE_BANDS as readonly string[]).includes(raw);
}

/** Email: trim, lowercase, <=254 chars, simple RFC-ish shape. Returns the normalized email or null. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length > 254) return null;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/.test(v) ? v : null;
}
