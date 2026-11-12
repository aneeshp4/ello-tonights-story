"use client";
import { useEffect, useRef } from "react";
import { EmailInput, Honeypot, type SubmitEmail, useEmailForm } from "./emailForm";

export function AskSheet({ hero, onSubmit, onDismiss }: {
  hero: string;
  onSubmit: SubmitEmail;
  onDismiss: () => void;
}) {
  const form = useEmailForm(onSubmit);
  const { busy, submit } = form;
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

  return (
    <div ref={overlay} className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center bg-ink-darker/40" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <form onSubmit={submit} className="max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-t-ello-lg bg-white px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-card">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-lighter" />
        <p className="mb-1 text-3xl" aria-hidden>📬</p>
        <h2 id="ask-title" className="text-h3 text-ink-dark">{hero}&apos;s story isn&apos;t over</h2>
        <p className="mb-4 text-body text-ink">
          <strong>Chapter 2 arrives in your inbox tomorrow at 7pm</strong>, plus a printable copy of tonight&apos;s story.
        </p>
        <EmailInput form={form} id="ask-email" errId="ask-err" />
        <Honeypot form={form} />
        <button type="submit" className="ello-btn mt-4" disabled={busy}>{busy ? "Sending…" : "Send me Chapter 2"}</button>
        <button type="button" className="mt-3 w-full py-3 text-body font-semibold text-ink" onClick={onDismiss} disabled={busy}>Not now</button>
        <p className="mt-2 text-center text-body-s text-ink">One story a night for 3 nights, starring {hero}. Unsubscribe anytime.</p>
      </form>
    </div>
  );
}
