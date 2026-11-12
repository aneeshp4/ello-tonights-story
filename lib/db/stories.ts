// STUB (in-memory): replaced by the data agent with Supabase-backed versions.
// Signatures are stable; server-only.
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

const mem = new Map<string, StoredStory>();

export async function createStory(s: NewStory): Promise<void> {
  mem.set(s.id, { id: s.id, title: s.title, fun_name: s.fun_name, stage: s.stage, interest: s.interest,
    theme_words: s.theme_words, pages: [], status: "generating" });
}
export async function updateStory(id: string, patch: StoryPatch): Promise<void> {
  const cur = mem.get(id); if (!cur) return;
  mem.set(id, { ...cur, ...(patch.pages ? { pages: patch.pages } : {}), ...(patch.status ? { status: patch.status } : {}) });
}
export async function getStory(id: string): Promise<StoredStory | null> {
  return mem.get(id) ?? null;
}
