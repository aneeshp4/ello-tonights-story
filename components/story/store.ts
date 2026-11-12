"use client";
// Client-side live story store.
//
// Why a module-level store: the NDJSON stream is started on /make and must keep
// flowing after router.replace('/story/{id}'). Client-side navigation keeps the
// same JS runtime, so a module singleton survives it regardless of whether the
// /make page is unmounted or hidden by <Activity> (cacheComponents). Components
// subscribe via useSyncExternalStore. A full reload loses it; then the reader
// falls back to getStory() (server) and finally to the sessionStorage cache.
import { useSyncExternalStore } from "react";
import type { AgeBand, LeadRequest, LeadResponse, Stage, StoryPage, StoryRequest, StreamMsg, Variant } from "@/lib/contracts";
import { MOCK_ENABLED, mockLead, mockStoryStream } from "@/lib/mocks/story-stream";

export interface LiveStory {
  id: string;
  title: string;
  theme_words: string[];
  hero: string;
  fun_name: string;
  age_band: AgeBand | null;
  stage: Stage;
  interest: string;
  ref: string | null;
  variant: Variant | null; // the variant the story was made under (null when loaded from DB)
  pages: StoryPage[];
  status: "generating" | "complete" | "fallback" | "failed";
  live: boolean; // true while the stream is still open
}

const stories = new Map<string, LiveStory>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getLive(id: string): LiveStory | undefined {
  return stories.get(id);
}

export function useLiveStory(id: string): LiveStory | undefined {
  return useSyncExternalStore(subscribe, () => stories.get(id), () => undefined);
}

function put(s: LiveStory) {
  stories.set(s.id, s);
  saveCache(s);
  emit();
}

// ---- sessionStorage (hero name for reloads; stories are saved with {{hero}}) --
export const heroKey = (id: string) => `ello_hero_${id}`;
const cacheKey = (id: string) => `ello_story_${id}`;

export function readHero(id: string): string | null {
  try { return sessionStorage.getItem(heroKey(id)); } catch { return null; }
}
function saveCache(s: LiveStory) {
  try {
    sessionStorage.setItem(heroKey(s.id), s.hero);
    sessionStorage.setItem(cacheKey(s.id), JSON.stringify({ ...s, live: false }));
  } catch { /* storage unavailable */ }
}
export function readCache(id: string): LiveStory | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(id));
    return raw ? (JSON.parse(raw) as LiveStory) : null;
  } catch { return null; }
}

// ---- stream ------------------------------------------------------------------
export interface StartHandlers {
  onStory: (id: string) => void;
  onPage: (id: string, page: StoryPage, msSinceStart: number) => void;
  onRejected: (field: "hero" | "interest", suggestion?: string) => void;
  onError: (message: string) => void;
}

async function openStream(req: StoryRequest): Promise<ReadableStream<Uint8Array>> {
  if (MOCK_ENABLED) return mockStoryStream(req);
  const res = await fetch("/api/story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (res.status === 404) return mockStoryStream(req); // route not merged yet
  if (res.status === 429) throw new Error("rate_limited");
  if (!res.ok || !res.body) throw new Error(`http_${res.status}`);
  return res.body;
}

export async function startStory(req: StoryRequest, h: StartHandlers): Promise<void> {
  const t0 = performance.now();
  let id: string | null = null;
  const finish = (status: LiveStory["status"]) => {
    const cur = id ? stories.get(id) : undefined;
    if (cur) put({ ...cur, status, live: false });
  };
  try {
    const body = await openStream(req);
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      if (done) buf += "\n"; // flush a final line without a trailing newline
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: StreamMsg;
        try { msg = JSON.parse(line) as StreamMsg; } catch { continue; }
        switch (msg.type) {
          case "story":
            id = msg.id;
            put({
              id: msg.id, title: msg.title, theme_words: msg.theme_words ?? [], hero: req.hero, fun_name: req.fun_name,
              age_band: req.age_band, stage: req.stage, interest: req.interest, ref: req.ref ?? null, variant: req.variant,
              pages: [], status: "generating", live: true,
            });
            h.onStory(msg.id);
            break;
          case "page": {
            const cur = id ? stories.get(id) : undefined;
            if (!cur) break;
            const { type: _t, ...page } = msg; void _t;
            const pages = [...cur.pages.filter((p) => p.n !== page.n), page].sort((a, b) => a.n - b.n);
            put({ ...cur, pages });
            h.onPage(cur.id, page, Math.round(performance.now() - t0));
            break;
          }
          case "done":
            finish(msg.status);
            break;
          case "rejected":
            h.onRejected(msg.field, msg.suggestion);
            return;
          case "error":
            finish("failed");
            h.onError(msg.message);
            return;
        }
      }
      if (done) break;
    }
    const cur = id ? stories.get(id) : undefined;
    if (cur?.live) finish(cur.pages.length ? "fallback" : "failed");
    if (!id) h.onError("empty_stream");
  } catch (e) {
    finish("failed");
    h.onError(e instanceof Error ? e.message : "network");
  }
}

// ---- lead ----------------------------------------------------------------------
export async function submitLead(req: LeadRequest): Promise<LeadResponse> {
  if (MOCK_ENABLED) return mockLead(req);
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.status === 404) return mockLead(req); // route not merged yet
    const json = (await res.json().catch(() => null)) as LeadResponse | null;
    if (json) return json;
    return { ok: false, error: res.status === 429 ? "rate_limited" : "server" };
  } catch {
    return { ok: false, error: "server" };
  }
}

/** utm_* from the current URL, merged with any captured earlier this session. */
export function readUtm(): Record<string, string> {
  let out: Record<string, string> = {};
  try {
    out = JSON.parse(sessionStorage.getItem("ello_utm") ?? "{}") as Record<string, string>;
    new URLSearchParams(window.location.search).forEach((v, k) => {
      if (k.startsWith("utm_")) out[k] = v.slice(0, 100);
    });
    sessionStorage.setItem("ello_utm", JSON.stringify(out));
  } catch { /* ignore */ }
  return out;
}
