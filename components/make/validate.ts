// Client-side input guards (mirror of lib/safety/input.ts rules; server re-checks).
import { INTERESTS } from "@/lib/contracts";

export const FUN_NAMES = ["Captain Pickle", "Rocket Rex", "Pip", "Zip", "Bean", "Moss", "Tug", "Sunny", "Biscuit", "Nova"];

export function randomFunName(not?: string): string {
  const pool = FUN_NAMES.filter((n) => n !== not);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function cleanHero(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Returns an error message, or null when OK. */
export function heroError(raw: string): { reason: string; message: string } | null {
  const v = cleanHero(raw);
  if (!v) return { reason: "empty", message: "Add a name for the hero, or pick a fun one!" };
  if (v.length > 16) return { reason: "too_long", message: "Keep it to 16 letters or fewer." };
  if (!/^[\p{L}][\p{L} '\-]*$/u.test(v)) return { reason: "chars", message: "Letters only, please. Or pick a fun name!" };
  return null;
}

export function interestError(raw: string): { reason: string; message: string } | null {
  const v = raw.trim();
  if (v.length < 2) return { reason: "too_short", message: "Tell us a bit more, like “garbage trucks”." };
  if (v.length > 40) return { reason: "too_long", message: "Keep it short, 40 letters or fewer." };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ',.&!-]*$/u.test(v)) return { reason: "chars", message: "Letters and numbers only, please." };
  return null;
}

const NEAREST: [RegExp, string][] = [
  [/dino|rex|fossil/i, "dinosaurs"], [/truck|car|train|bus|digger|tractor|plane|vehicle/i, "trucks"],
  [/space|planet|star|moon|rocket|alien/i, "space"], [/dog|pup|cat|kitten|pet|animal|horse/i, "dogs"],
  [/shark|fish|ocean|sea|whale|octopus/i, "sharks"], [/ball|sport|football|basket|hockey|baseball/i, "soccer"],
  [/mermaid|fairy|princess|magic/i, "mermaids"], [/robot|machine|computer|lego/i, "robots"],
  [/bug|insect|spider|ant|bee|butterfl/i, "bugs"], [/cook|bake|food|cake|pizza/i, "cooking"],
  [/castle|knight|king|queen|dragon/i, "castles"], [/unicorn|rainbow|pony/i, "unicorns"],
];

/** Map a rejected custom interest to the closest chip id. */
export function closestChip(text: string, suggestion?: string): string {
  if (suggestion && INTERESTS.some((i) => i.id === suggestion)) return suggestion;
  for (const [re, id] of NEAREST) if (re.test(text)) return id;
  return "dogs";
}

export function readRef(): string | null {
  try {
    const r = new URLSearchParams(window.location.search).get("ref");
    return r && /^[A-Za-z0-9_-]{1,32}$/.test(r) ? r : null;
  } catch { return null; }
}
