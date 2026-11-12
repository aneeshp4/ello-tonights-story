"use client";
import { useSyncExternalStore } from "react";
import type { StoredStory } from "@/lib/contracts";
import { fillHero } from "./highlight";
import { type LiveStory, readCache, readHero, useLiveStory } from "./store";

const noop = () => () => {};
/** false during SSR/prerender and hydration, true after. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

function fromStored(s: StoredStory, hero: string): LiveStory {
  return {
    id: s.id, title: fillHero(s.title ?? "", hero), theme_words: s.theme_words ?? [], hero, fun_name: s.fun_name,
    age_band: null, stage: s.stage, interest: s.interest, ref: null, variant: null,
    pages: s.pages.map((p) => ({ ...p, text: fillHero(p.text, hero) })),
    status: s.status, live: false,
  };
}

/** Swap the real hero name for the fun name (share links never show the real name). */
function asFunName(s: LiveStory): LiveStory {
  if (!s.hero || s.hero === s.fun_name) return s;
  const re = new RegExp(`\\b${s.hero.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "giu");
  return {
    ...s, hero: s.fun_name, title: s.title.replace(re, s.fun_name),
    pages: s.pages.map((p) => ({ ...p, text: p.text.replace(re, s.fun_name) })),
  };
}

/**
 * Resolve a story for display. Order: live client store (stream in progress) →
 * server-loaded StoredStory (hero from sessionStorage, else fun_name) →
 * sessionStorage cache (covers mock mode / getStory stub returning null).
 * `mode: "fun"` forces the fun_name (share page).
 */
export function useResolvedStory(id: string, stored: StoredStory | null, mode: "own" | "fun" = "own"): {
  story: LiveStory | null;
  ready: boolean;
} {
  const mounted = useMounted();
  const live = useLiveStory(id);
  if (!mounted) {
    // Server / first paint: only the stored version with fun_name is safe to render.
    return { story: stored ? fromStored(stored, stored.fun_name) : null, ready: false };
  }
  let s: LiveStory | null = live ?? null;
  if (!s && stored) s = fromStored(stored, mode === "own" ? readHero(id) ?? stored.fun_name : stored.fun_name);
  if (!s) s = readCache(id);
  if (s && mode === "fun") s = asFunName(s);
  return { story: s, ready: true };
}
