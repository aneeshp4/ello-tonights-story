// STUB: replaced by the analytics agent (batched POST /api/events + sendBeacon).
// Frontend code should import and call these; signatures are stable.
import type { EventName } from "./contracts";

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  if (typeof window !== "undefined") console.debug("[track]", name, props);
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem("ello_sid");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ello_sid", id); }
    return id;
  } catch { return "anon"; }
}
