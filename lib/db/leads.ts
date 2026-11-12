// Lead persistence + column mapping helpers. Server-only.
import { sbInsert, sbSelect, eq } from "../supabase";
import type { AgeBand, Stage } from "../contracts";

// `leads.reading_stage` is text; we store a readable stage name.
export const STAGE_NAMES = ["pre", "cvc", "digraphs", "longvowels", "fluent"] as const;
export function stageName(s: Stage | null | undefined): string | null {
  return s === null || s === undefined ? null : STAGE_NAMES[s] ?? null;
}
export function stageFromName(name: string | null | undefined): Stage | null {
  const i = STAGE_NAMES.indexOf(name as (typeof STAGE_NAMES)[number]);
  return i >= 0 ? (i as Stage) : null;
}

export interface LeadRow {
  id: string;
  created_at: string;
  email: string;
  age_band: AgeBand | null;
  reading_stage: string | null;
  interest: string | null;
  story_id: string | null;
  variant: string | null;
  session_id: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  consent: boolean;
  hero_name: string | null; // first name/nickname for Chapter 2 emails; never logged
}

export async function insertLead(row: Omit<LeadRow, "id" | "created_at">): Promise<string> {
  const out = await sbInsert<{ id: string }>("leads", row, { returning: true, select: "id" });
  if (!out[0]?.id) throw new Error("lead insert returned no id");
  return out[0].id;
}

export async function getLead(id: string): Promise<LeadRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sbSelect<LeadRow>("leads", `id=${eq(id)}&select=*&limit=1`);
  return rows[0] ?? null;
}
