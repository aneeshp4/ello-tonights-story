"use client";
// Shared email-capture logic for the ask sheet (modal) and the inline form on the done panel:
// same validation, error copy, honeypot and input attributes.
import { useState } from "react";
import type { LeadResponse } from "@/lib/contracts";

export const EMAIL_ERRORS: Record<string, string> = {
  invalid_email: "That email doesn't look quite right.",
  rate_limited: "Too many tries. Please wait a bit and try again.",
  server: "Something went wrong. Try again?",
};

export type SubmitEmail = (email: string, website: string) => Promise<LeadResponse>;

export function useEmailForm(onSubmit: SubmitEmail) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.length > 254) { setErr(EMAIL_ERRORS.invalid_email); return; }
    setBusy(true); setErr(null);
    const res = await onSubmit(v, website);
    setBusy(false);
    if (!res.ok) setErr(EMAIL_ERRORS[res.error] ?? EMAIL_ERRORS.server);
  }

  return { email, setEmail, website, setWebsite, busy, err, submit };
}

type Form = ReturnType<typeof useEmailForm>;

/** The email input (mobile keyboard hints included) with its error line. */
export function EmailInput({ form, id, errId, onFocus }: { form: Form; id: string; errId: string; onFocus?: () => void }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">Email</label>
      <input
        id={id} type="email" inputMode="email" autoComplete="email" enterKeyHint="send" placeholder="you@example.com"
        className="ello-input" value={form.email} onChange={(e) => form.setEmail(e.target.value)} maxLength={254} required
        aria-invalid={!!form.err} aria-describedby={form.err ? errId : undefined} onFocus={onFocus}
      />
      {form.err && <p id={errId} className="mt-2 text-body-s font-semibold text-coral-dark">{form.err}</p>}
    </>
  );
}

/** Honeypot: real people never see or fill this. */
export function Honeypot({ form }: { form: Form }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Website <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => form.setWebsite(e.target.value)} /></label>
    </div>
  );
}
