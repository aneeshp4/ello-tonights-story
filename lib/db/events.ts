// Server-side event insert (used by /api/events, and available to the story
// engine for page_ready etc.). Server-only. Never throws.
import { sbInsert, supabaseConfigured } from "../supabase";
import type { EventName } from "../contracts";

export interface EventRow {
  session_id: string;
  name: EventName;
  variant: string | null;      // "ask=end,h=a" (see variantText in lib/supabase.ts)
  path: string | null;
  props: Record<string, unknown>;
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (!rows.length || !supabaseConfigured()) return;
  try {
    await sbInsert("events", rows as unknown as Record<string, unknown>[]);
  } catch (e) {
    console.error("[events] insert failed:", e);
  }
}
