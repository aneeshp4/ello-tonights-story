"use client";
import { useEffect, useRef, useState } from "react";
import type { LeadResponse } from "@/lib/contracts";

const ERRORS: Record<string, string> = {
  invalid_email: "That email doesn't look quite right.",
  rate_limited: "Too many tries. Please wait a bit and try again.",
  server: "Something went wrong. Try again?",
};

export function AskSheet({ hero, onSubmit, onDismiss }: {
  hero: string;
  onSubmit: (email: string, website: string) => Promise<LeadResponse>;
  onDismiss: () => void;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);

  // Lock the page behind the sheet. overflow:hidden alone doesn't stop iOS Safari from
  // scrolling the body on touch, so pin the body with position:fixed and restore the
  // scroll position on close.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const y = window.scrollY;
    const prev = { html: html.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    html.style.overflow = "hidden";
    Object.assign(body.style, { position: "fixed", top: `-${y}px`, width: "100%", overflow: "hidden" });
    return () => {
      html.style.overflow = prev.html;
      Object.assign(body.style, { position: prev.position, top: prev.top, width: prev.width, overflow: prev.overflow });
      window.scrollTo(0, y);
    };
  }, []);

  // Keep the sheet inside the visible area when the on-screen keyboard opens: size the
  // overlay to the visual viewport (iOS doesn't shrink the layout viewport for the keyboard).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = overlay.current;
    if (!vv || !el) return;
    const fit = () => { el.style.height = `${vv.height}px`; el.style.top = `${vv.offsetTop}px`; };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, []);

  // Escape closes the sheet, same as "Not now".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onDismiss]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 254) { setErr(ERRORS.invalid_email); return; }
    setBusy(true); setErr(null);
    const res = await onSubmit(v, website);
    setBusy(false);
    if (!res.ok) setErr(ERRORS[res.error] ?? ERRORS.server);
  }

  return (
    <div ref={overlay} className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center bg-ink-darker/40" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <form onSubmit={submit} className="max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-t-ello-lg bg-white px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-card">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-lighter" />
        <p className="mb-1 text-3xl" aria-hidden>📬</p>
        <h2 id="ask-title" className="text-h3 text-ink-dark">{hero}&apos;s story isn&apos;t over</h2>
        <p className="mb-4 text-body text-ink">
          <strong>Chapter 2 arrives in your inbox tomorrow at 7pm</strong>, plus a printable copy of tonight&apos;s story.
        </p>
        <label htmlFor="ask-email" className="sr-only">Email</label>
        <input
          id="ask-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          className="ello-input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required
          aria-invalid={!!err} aria-describedby={err ? "ask-err" : undefined}
        />
        {/* honeypot: real people never see or fill this */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website <input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
        {err && <p id="ask-err" className="mt-2 text-body-s font-semibold text-coral-dark">{err}</p>}
        <button type="submit" className="ello-btn mt-4" disabled={busy}>{busy ? "Sending…" : "Send me Chapter 2"}</button>
        <button type="button" className="mt-3 w-full py-3 text-body font-semibold text-ink" onClick={onDismiss} disabled={busy}>Not now</button>
        <p className="mt-2 text-center text-body-s text-ink">One story a night for 3 nights, starring {hero}. Unsubscribe anytime.</p>
      </form>
    </div>
  );
}
