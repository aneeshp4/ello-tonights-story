// Story persistence. Supabase-backed (public.stories); server-only.
// Signatures are stable: the story engine and pages code against them.
//
// Resilience: every write also goes to a small in-memory cache, and DB errors
// are logged rather than thrown, so a Supabase blip never breaks a story that
// is mid-stream. If SUPABASE_* env vars are missing, it runs memory-only
// (local dev without a DB) and logs a warning once.
import { supabaseConfigured, sbInsert, sbSelect, sbUpdate, eq, variantText } from "../supabase";
import type { StoredStory, StoryPage, Stage, AgeBand, Variant } from "../contracts";

export interface NewStory {
  id: string;
  session_id: string;
  variant: Variant;
  age_band: AgeBand;
  stage: Stage;
  interest: string;
  interest_custom: boolean;
  fun_name: string;
  title: string;
  theme_words: string[];
  ref?: string | null;
}
export interface StoryPatch {
  pages?: StoryPage[];       // text must use the {{hero}} token, never the real name
  status?: StoredStory["status"];
  model?: string;
  safety?: unknown[];
}

const MEM_MAX = 500;
const mem = new Map<string, StoredStory>();
function memSet(s: StoredStory) {
  mem.delete(s.id);
  mem.set(s.id, s);
  if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value as string);
}

let warned = false;
function dbEnabled(): boolean {
  if (supabaseConfigured()) return true;
  if (!warned) {
    warned = true;
    console.warn("[stories] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing: using in-memory store (not persisted)");
  }
  return false;
}

interface StoryRow {
  id: string;
  title: string | null;
  fun_name: string;
  stage: number;
  interest: string;
  theme_words: string[] | null;
  pages: StoryPage[] | null;
  status: StoredStory["status"];
}
const COLS = "id,title,fun_name,stage,interest,theme_words,pages,status";

function fromRow(r: StoryRow): StoredStory {
  return {
    id: r.id,
    title: r.title ?? "",
    fun_name: r.fun_name,
    stage: r.stage as Stage,
    interest: r.interest,
    theme_words: r.theme_words ?? [],
    pages: Array.isArray(r.pages) ? r.pages : [],
    status: r.status,
  };
}

export async function createStory(s: NewStory): Promise<void> {
  memSet({ id: s.id, title: s.title, fun_name: s.fun_name, stage: s.stage, interest: s.interest,
    theme_words: s.theme_words, pages: [], status: "generating" });
  if (!dbEnabled()) return;
  try {
    await sbInsert("stories", {
      id: s.id,
      session_id: s.session_id,
      variant: variantText(s.variant),
      age_band: s.age_band,
      stage: s.stage,
      interest: s.interest,
      interest_custom: s.interest_custom,
      fun_name: s.fun_name,
      title: s.title,
      theme_words: s.theme_words,
      status: "generating",
      ref: s.ref ?? null,
    });
  } catch (e) {
    console.error("[stories] createStory DB error (kept in memory):", e);
  }
}

export async function updateStory(id: string, patch: StoryPatch): Promise<void> {
  const cur = mem.get(id);
  if (cur) {
    memSet({ ...cur, ...(patch.pages ? { pages: patch.pages } : {}), ...(patch.status ? { status: patch.status } : {}) });
  }
  if (!dbEnabled()) return;
  const row: Record<string, unknown> = {};
  if (patch.pages) row.pages = patch.pages;
  if (patch.status) row.status = patch.status;
  if (patch.model !== undefined) row.model = patch.model;
  if (patch.safety) row.safety = patch.safety;
  if (Object.keys(row).length === 0) return;
  try {
    await sbUpdate("stories", `id=${eq(id)}`, row);
  } catch (e) {
    console.error("[stories] updateStory DB error (kept in memory):", e);
  }
}

export async function getStory(id: string): Promise<StoredStory | null> {
  if (dbEnabled()) {
    try {
      const rows = await sbSelect<StoryRow>("stories", `id=${eq(id)}&select=${COLS}&limit=1`);
      if (rows[0]) return fromRow(rows[0]);
    } catch (e) {
      console.error("[stories] getStory DB error (falling back to memory):", e);
    }
  }
  return mem.get(id) ?? null;
}
