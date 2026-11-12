// Shared contracts between the story engine, data APIs, and frontend.
// Change only via a PR that updates every consumer. See AGENT_PLAN.md.

export const AGE_BANDS = ["4-5", "6", "7", "8-9"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type Stage = 0 | 1 | 2 | 3 | 4;
export const AGE_DEFAULT_STAGE: Record<AgeBand, Stage> = { "4-5": 1, "6": 2, "7": 3, "8-9": 4 };

export const INTERESTS = [
  { id: "dinosaurs", label: "Dinosaurs", emoji: "🦕" },
  { id: "trucks", label: "Trucks", emoji: "🚚" },
  { id: "space", label: "Space", emoji: "🚀" },
  { id: "dogs", label: "Dogs", emoji: "🐶" },
  { id: "sharks", label: "Sharks", emoji: "🦈" },
  { id: "soccer", label: "Soccer", emoji: "⚽" },
  { id: "mermaids", label: "Mermaids", emoji: "🧜" },
  { id: "robots", label: "Robots", emoji: "🤖" },
  { id: "bugs", label: "Bugs", emoji: "🐛" },
  { id: "cooking", label: "Cooking", emoji: "🍕" },
  { id: "castles", label: "Castles", emoji: "🏰" },
  { id: "unicorns", label: "Unicorns", emoji: "🦄" },
] as const;

export const SCENES = [
  "outdoors-day", "outdoors-night", "bedroom", "kitchen", "water", "space",
  "forest", "city", "farm", "castle", "sports-field",
] as const;
export type Scene = (typeof SCENES)[number];

export type AskVariant = "end" | "mid";
export type HeadlineVariant = "a" | "b";
export interface Variant { ask: AskVariant; h: HeadlineVariant }

// ---- POST /api/story --------------------------------------------------------
export interface StoryRequest {
  hero: string;              // 1-12 chars, never stored server-side
  fun_name: string;          // shown on share links
  age_band: AgeBand;
  interest: string;          // chip id or custom text (<=40 chars)
  interest_custom: boolean;
  stage: Stage;
  session_id: string;
  variant: Variant;
  ref?: string | null;
}

export interface StoryPage {
  n: number;                 // 1..5
  text: string;              // over the wire: real hero name; in DB: "{{hero}}" token
  scene: Scene;
  source: "model" | "fallback";
}

// Response: application/x-ndjson, one StreamMsg per line.
export type StreamMsg =
  | { type: "story"; id: string; title: string; theme_words: string[] }
  | ({ type: "page" } & StoryPage)
  | { type: "done"; status: "complete" | "fallback" }
  | { type: "rejected"; field: "hero" | "interest"; suggestion?: string } // input guard failed
  | { type: "error"; message: string };

// GET story for reload / share: server component reads DB; shape:
export interface StoredStory {
  id: string;
  title: string;
  fun_name: string;
  stage: Stage;
  interest: string;
  theme_words: string[];
  pages: StoryPage[];        // text contains "{{hero}}"
  status: "generating" | "complete" | "fallback" | "failed";
}
export const HERO_TOKEN = "{{hero}}";

// ---- POST /api/lead ---------------------------------------------------------
export interface LeadRequest {
  email: string;
  story_id: string | null;
  session_id: string;
  variant: Variant;
  age_band: AgeBand | null;
  stage: Stage | null;
  interest: string | null;
  consent: boolean;
  ref?: string | null;
  utm?: Record<string, string>;
  website?: string;          // honeypot, must be empty
}
export type LeadResponse = { ok: true; lead_id: string } | { ok: false; error: "invalid_email" | "rate_limited" | "server" };

// ---- POST /api/events -------------------------------------------------------
export const EVENT_NAMES = [
  "landing_viewed", "share_landing_viewed", "cta_clicked", "step_viewed", "step_completed",
  "fun_name_used", "interest_selected", "input_rejected", "reading_check_completed",
  "story_requested", "page_ready", "story_failed", "safety_check_failed", "story_page_viewed",
  "next_page_waited", "story_finished", "kid_reaction_rated", "print_clicked", "email_ask_viewed",
  "email_ask_dismissed", "lead_submitted", "share_clicked", "app_cta_clicked", "another_story_clicked",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];
export interface TrackedEvent { name: EventName; ts: number; path: string; props?: Record<string, unknown> }
export interface EventsRequest { session_id: string; variant: Variant | null; events: TrackedEvent[] }
