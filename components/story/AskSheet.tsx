"use client";
import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-ink-darker/40" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-t-ello-lg bg-white px-5 pb-8 pt-6 shadow-card">
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
        <p className="mt-2 text-center text-body-s text-ink">One story a night for 3 nights. Unsubscribe anytime.</p>
      </form>
    </div>
  );
}
