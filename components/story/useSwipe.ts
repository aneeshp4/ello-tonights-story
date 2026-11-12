"use client";
import { useEffect, useRef } from "react";

// Horizontal swipe page-turning for the reader, with pointer events + a transform.
// - The element should have `touch-action: pan-y`: the browser keeps vertical panning
//   (scrolling a long page's text box, pull-to-refresh) and hands us horizontal moves.
// - Direction locks after the first ~10px. Vertical: we let go entirely.
// - The page follows the finger, rubber-bands where there's nowhere to go, and on release
//   slides out/in (or just switches, under prefers-reduced-motion).
// - A horizontal drag swallows the click that follows it, so a swipe that ends on a theme
//   word doesn't open its hint.

const LOCK_PX = 10;
const OUT_MS = 150;
const IN_MS = 220;

export interface SwipeOptions {
  enabled: boolean;
  canNext: boolean;
  canPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

function reducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** `el` is the element that moves (pass it via a callback ref so the hook sees it mount). */
export function useSwipe(el: HTMLElement | null, opts: SwipeOptions) {
  const o = useRef(opts);
  useEffect(() => { o.current = opts; });

  useEffect(() => {
    if (!el) return;
    const node: HTMLElement = el;
    let id: number | null = null;
    let x0 = 0, y0 = 0, t0 = 0, dx = 0;
    let axis: "x" | "y" | null = null;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const set = (tx: number, ms = 0) => {
      node.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.2,1)` : "none";
      node.style.transform = tx ? `translate3d(${tx}px,0,0)` : "";
    };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
    const allowed = (d: number) => (d < 0 ? o.current.canNext : o.current.canPrev);
    // Rubber band: resistance grows with distance, capped at ~1/5 of the width.
    const rubber = (d: number) => {
      const w = node.clientWidth || 320;
      return Math.sign(d) * (w / 5) * (1 - 1 / (Math.abs(d) / w * 2 + 1));
    };

    function down(e: PointerEvent) {
      if (!o.current.enabled || id !== null || !e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      clearTimers();
      set(0);
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); dx = 0; axis = null;
    }

    function move(e: PointerEvent) {
      if (e.pointerId !== id) return;
      dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "y") { id = null; return; } // vertical: the browser scrolls, we stay out of it
        try { node.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (e.cancelable) e.preventDefault(); // no text selection while mouse-dragging
      set(allowed(dx) ? dx : rubber(dx));
    }

    function up(e: PointerEvent) {
      if (e.pointerId !== id) return;
      id = null;
      if (axis !== "x") return;
      // Eat the click that a drag ends with.
      const eat = (c: MouseEvent) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener("click", eat, { capture: true, once: true });
      later(() => window.removeEventListener("click", eat, { capture: true }), 0);

      const w = node.clientWidth || 320;
      const v = dx / Math.max(1, performance.now() - t0); // px/ms
      const commit = allowed(dx) && (Math.abs(dx) > w * 0.22 || (Math.abs(dx) > 30 && Math.abs(v) > 0.35));
      if (!commit) { set(0, 200); return; }
      const sign = dx < 0 ? -1 : 1;
      const turn = () => (sign < 0 ? o.current.onNext() : o.current.onPrev());
      if (reducedMotion()) { set(0); turn(); return; }
      set(sign * w, OUT_MS);
      later(() => {
        turn();
        set(-sign * w * 0.6); // new page starts on the far side…
        later(() => { void node.offsetWidth; set(0, IN_MS); }, 16); // …and slides in
        later(() => set(0), 16 + IN_MS + 30);
      }, OUT_MS);
    }

    function cancel(e: PointerEvent) {
      if (e.pointerId !== id) return;
      id = null;
      if (axis === "x") set(0, 200);
    }

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    return () => {
      clearTimers();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.style.transform = "";
      node.style.transition = "";
    };
  }, [el]);
}
