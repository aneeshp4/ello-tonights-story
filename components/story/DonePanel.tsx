"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { APP_STORE_URL } from "@/lib/links";
import { EmailInput, Honeypot, type SubmitEmail, useEmailForm } from "./emailForm";
import { Yello } from "./Scene";

export function DonePanel({ id, hero, leadDone, onLead, onInlineShown }: {
  id: string; hero: string; leadDone: boolean;
  /** Inline email capture (same submit path as the ask sheet). Omit to hide the form. */
  onLead?: SubmitEmail;
  /** Called when the inline form is on screen (the caller fires email_ask_viewed once). */
  onInlineShown?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/s/${id}?ref=${id}`;
    const data = { title: "Tonight's Story", text: "A story my kid read tonight. Make one for yours!", url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        track("share_clicked", { method: "web_share", story_id: id });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { track("share_clicked", { method: "web_share", cancelled: true, story_id: id }); return; }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
    track("share_clicked", { method: "copy_link", story_id: id });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="ello-card flex flex-col items-center gap-3 text-center">
        <Yello size={72} bounce={false} />
        {leadDone ? (
          <>
            <h2 className="text-h3">Chapter 2 arrives tomorrow at 7pm</h2>
            <p className="text-body text-ink">Check your inbox for a printable copy of tonight&apos;s story.</p>
          </>
        ) : (
          <>
            <h2 className="text-h3">Sweet dreams, {hero}!</h2>
            <p className="text-body text-ink">Great reading tonight. <strong>Chapter 2 comes out tomorrow at 7pm.</strong> Want it in your inbox?</p>
            {onLead && <InlineEmail onSubmit={onLead} onShown={onInlineShown} />}
          </>
        )}
        <Link href={`/print/${id}`} className="text-body font-semibold text-teal-dark underline underline-offset-4"
          onClick={() => track("print_clicked", { from: "done", story_id: id })}>
          🖨️ Print tonight&apos;s story
        </Link>
      </div>

      <div className="ello-card flex flex-col gap-3">
        <h3 className="text-h3">Know a kid who&apos;d love one?</h3>
        <button type="button" className="ello-btn ello-btn--secondary" onClick={share}>
          {copied ? "Link copied!" : "Share a story link"}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-ello-lg bg-teal p-6 text-white shadow-press">
        <h3 className="text-h3">Want Ello to listen while {hero} reads?</h3>
        <p className="text-body">Free app. Ello helps when they get stuck.</p>
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
          className="ello-btn bg-white! text-teal-dark! shadow-none!"
          onClick={() => track("app_cta_clicked", { story_id: id })}>
          Get Ello free
        </a>
      </div>

      <Link href="/make" className="ello-btn ello-btn--secondary"
        onClick={() => track("another_story_clicked", { story_id: id })}>
        Make another story
      </Link>
    </div>
  );
}

/** Inline version of the ask sheet's form, so "Not now" isn't a dead end. */
function InlineEmail({ onSubmit, onShown }: { onSubmit: SubmitEmail; onShown?: () => void }) {
  const form = useEmailForm(onSubmit);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { onShown?.(); }, [onShown]);

  // Keep the field in view when the on-screen keyboard opens (and as it resizes).
  function keepVisible() {
    const el = ref.current;
    if (!el) return;
    const scroll = () => el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(scroll, 300);
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", scroll);
    el.addEventListener("focusout", () => vv.removeEventListener("resize", scroll), { once: true });
  }

  return (
    <form ref={ref} onSubmit={form.submit} className="relative flex w-full flex-col text-left">
      <EmailInput form={form} id="done-email" errId="done-email-err" onFocus={keepVisible} />
      <Honeypot form={form} />
      <button type="submit" className="ello-btn mt-3" disabled={form.busy}>{form.busy ? "Sending…" : "Send me Chapter 2"}</button>
      <p className="mt-2 text-center text-body-s text-ink">One story a night for 3 nights. Unsubscribe anytime.</p>
    </form>
  );
}
