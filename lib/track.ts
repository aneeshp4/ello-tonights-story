// Client analytics: track(name, props) queues events and POSTs batches of
// EventsRequest to /api/events every 2s, when the tab is hidden, and on pagehide
// (navigator.sendBeacon, text/plain JSON body). Every event is console.debug'd so
// reviewers can follow the funnel in devtools. Props are merged with ref/utm.
// If /api/events is missing (404) we stop sending for this page load and keep
// working silently. Signatures of track() / getSessionId() are stable.
import type { EventName, EventsRequest, TrackedEvent } from "./contracts";
import { attributionProps } from "./attribution";
import { getVariant } from "./variant";

const ENDPOINT = "/api/events";
const FLUSH_MS = 2000;
const MAX_BATCH = 50;
const MAX_QUEUE = 500;

let queue: TrackedEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let endpointMissing = false;

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const event: TrackedEvent = {
    name,
    ts: Date.now(),
    path: window.location.pathname,
    props: { ...attributionProps(), ...props },
  };
  console.debug("[track]", name, event.props);
  init();
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= MAX_BATCH) void flush();
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem("ello_sid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ello_sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function takeBatch(): EventsRequest | null {
  if (queue.length === 0) return null;
  const events = queue.splice(0, MAX_BATCH);
  return { session_id: getSessionId(), variant: getVariant(), events };
}

/** Send everything queued now via fetch (keepalive). Safe to call anytime. */
export async function flush(): Promise<void> {
  if (endpointMissing) {
    queue = [];
    return;
  }
  let body: EventsRequest | null;
  while ((body = takeBatch())) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (res.status === 404) {
        endpointMissing = true;
        queue = [];
        return;
      }
    } catch {
      // network error: drop this batch quietly; analytics must never break the app
    }
  }
}

/** Unload-safe flush: sendBeacon each batch, falling back to keepalive fetch. */
function flushBeacon(): void {
  if (endpointMissing) {
    queue = [];
    return;
  }
  let body: EventsRequest | null;
  while ((body = takeBatch())) {
    const json = JSON.stringify(body);
    const sent =
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "text/plain;charset=UTF-8" }));
    if (!sent) {
      fetch(ENDPOINT, { method: "POST", body: json, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
    }
  }
}

function init(): void {
  if (timer !== null) return;
  timer = setInterval(() => void flush(), FLUSH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushBeacon();
  });
  window.addEventListener("pagehide", flushBeacon);
}
