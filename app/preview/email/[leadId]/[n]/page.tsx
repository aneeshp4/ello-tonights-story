// Fake email previews for the 4-email nurture sequence (AGENT_PLAN.md §9).
// Email SENDING is mocked: in production this payload would go to Customer.io / Resend.
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HERO_TOKEN, INTERESTS, type StoredStory, type Stage } from "@/lib/contracts";
import { getLead, stageFromName, type LeadRow } from "@/lib/db/leads";
import { getStory } from "@/lib/db/stories";
import { APP_STORE_URL } from "@/lib/links";
import { ElloWordmark } from "@/components/brand/ElloWordmark";

export const metadata: Metadata = { title: "Email preview · Tonight's Story", robots: { index: false } };


const STAGE_INFO: Record<Stage, { label: string; can: string; next: string; tip: string }> = {
  0: { label: "Getting ready to read", can: "listens to stories and points at a few words", next: "letter sounds and short words like cat and sun",
    tip: "Run your finger under the words as you read, and pause so they can point at the sight words." },
  1: { label: "Short-vowel words", can: "sounds out short words like cat, sun and big", next: "sounds like sh, ch and th, and blends like fr and st",
    tip: "If they get stuck, cover all but the first letter and slide your finger across, one sound at a time." },
  2: { label: "Digraphs and blends", can: "reads words like ship, frog and duck", next: "long vowels: cake, rain, bee, boat",
    tip: "Point out the two-letter teams (sh, ch, th) before reading a page: they make one sound together." },
  3: { label: "Long vowels", can: "reads words like cake, rain and night", next: "longer words and reading with expression",
    tip: "Ask them to read a page twice: once to figure it out, once to make it sound like talking." },
  4: { label: "Fluent reader", can: "reads most words in a short chapter book", next: "longer stories and talking about what they read",
    tip: "After each chapter, ask one question: \"What do you think happens next?\"" },
};

const SEND_DAY = ["Day 0 · right after signup", "Day 1 · 7pm", "Day 3 · 7pm", "Day 6 · 7pm"];

function maskEmail(email: string): string {
  const [user, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}

function heroize(text: string, name: string) {
  return text.split(HERO_TOKEN).join(name);
}

function interestLabel(interest: string | null): string {
  if (!interest) return "their favorite thing";
  return INTERESTS.find((i) => i.id === interest)?.label.toLowerCase() ?? interest;
}

// cacheComponents is on: request-time data (params + DB reads) must sit under <Suspense>.
export default function EmailPreview(props: PageProps<"/preview/email/[leadId]/[n]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-xl px-4 py-6 text-ink">Loading preview…</main>}>
      <EmailPreviewBody params={props.params} />
    </Suspense>
  );
}

async function EmailPreviewBody({ params }: { params: Promise<{ leadId: string; n: string }> }) {
  const { leadId, n: nRaw } = await params;
  const n = Number(nRaw);
  if (![1, 2, 3, 4].includes(n)) notFound();

  let lead: LeadRow | null = null;
  try {
    lead = await getLead(leadId);
  } catch (e) {
    console.error("[preview] lead lookup failed:", e);
  }
  if (!lead) notFound();
  const story = lead.story_id ? await getStory(lead.story_id) : null;
  const stage = (stageFromName(lead.reading_stage) ?? story?.stage ?? null) as Stage | null;
  // The name the parent typed is stored on the lead (only when they signed up). Older leads
  // have no hero_name, so fall back to the story's fun name.
  const hero = lead.hero_name ?? story?.fun_name ?? "your reader";

  const subject = [
    `${hero}'s story, ready to print`,
    `Chapter 2 is here 📖`,
    `Chapter 3 is waiting in Ello`,
    `How ${hero} is reading: this week's summary`,
  ][n - 1];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <div role="status" className="rounded-ello bg-sun-lighter px-4 py-3 text-body-s font-bold text-ink-darker">
        Preview: email sending is mocked. This is what email {n} of 4 would look like.
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Emails in the sequence">
        {[1, 2, 3, 4].map((i) => (
          <Link key={i} href={`/preview/email/${leadId}/${i}`} className="ello-chip" aria-pressed={i === n}>
            {["D0", "D1", "D3", "D6"][i - 1]}
          </Link>
        ))}
      </nav>

      <article className="ello-card flex flex-col gap-4">
        <header className="border-b-2 border-ink-lighter pb-3 text-body-s text-ink">
          <ElloWordmark height={28} className="mb-3" />
          <p><b>From:</b> Ello &lt;stories@ello.example&gt;</p>
          <p><b>To:</b> {maskEmail(lead.email)}</p>
          <p><b>When:</b> {SEND_DAY[n - 1]}</p>
          <p className="mt-2 text-h3 text-ink-dark">{subject}</p>
        </header>

        {n === 1 && <D0 story={story} hero={hero} />}
        {n === 2 && <D1 story={story} hero={hero} />}
        {n === 3 && <D3 lead={lead} stage={stage} hero={hero} />}
        {n === 4 && <D6 lead={lead} stage={stage} hero={hero} />}

        <footer className="border-t-2 border-ink-lighter pt-3 text-body-s text-ink">
          One story a night for 3 nights, then a weekly tip. Unsubscribe anytime.
        </footer>
      </article>
    </main>
  );
}

function D0({ story, hero }: { story: StoredStory | null; hero: string }) {
  return (
    <section className="flex flex-col gap-3">
      <p>Thanks for reading with {hero} tonight! Here&apos;s the story as a printable booklet, so {hero} can read it again tomorrow, with a pencil to circle the words they sounded out.</p>
      {story ? (
        <>
          <p className="text-h3">{heroize(story.title, hero)}</p>
          {story.pages[0] && <p className="ello-story">{heroize(story.pages[0].text, hero)}</p>}
          <Link href={`/print/${story.id}`} className="ello-btn self-start">Print the story</Link>
          <Link href={`/story/${story.id}`} className="text-teal-dark underline">Read it on screen</Link>
        </>
      ) : (
        <p className="text-ink">(No story is linked to this lead.)</p>
      )}
      <p>Tomorrow at 7pm: Chapter 2.</p>
    </section>
  );
}

function D1({ story, hero }: { story: StoredStory | null; hero: string }) {
  const last = story?.pages[story.pages.length - 1];
  return (
    <section className="flex flex-col gap-3">
      <p>Remember how the story ended last night?</p>
      {last && <blockquote className="ello-story border-l-4 border-teal-lighter pl-3">{heroize(last.text, hero)}</blockquote>}
      <p className="text-h3">Chapter 2{story?.title ? `: more ${heroize(story.title, hero)}` : ""}</p>
      <p className="rounded-ello bg-pastel-teal p-4 text-ink-dark">
        <i>Teaser (mocked):</i> chapter 2 would be generated at the same reading level, picking up from that hook, and linked here.
      </p>
      {story && <Link href={`/story/${story.id}`} className="ello-btn self-start">Read Chapter 2</Link>}
    </section>
  );
}

function D3({ lead, stage, hero }: { lead: LeadRow; stage: Stage | null; hero: string }) {
  const q = new URLSearchParams();
  if (lead.interest) q.set("interest", lead.interest);
  if (stage !== null) q.set("stage", String(stage));
  const deepLink = `ello://story?${q.toString()}`;
  return (
    <section className="flex flex-col gap-3">
      <p>{hero} has read two chapters about {interestLabel(lead.interest)}. Chapter 3 is waiting in the Ello app, where Ello listens while {hero} reads out loud and helps with tricky words.</p>
      <p>We&apos;ve set it up already: same story, same reading level.</p>
      <a href={deepLink} className="ello-btn self-start">Open Chapter 3 in Ello</a>
      <p className="text-body-s text-ink">
        Don&apos;t have Ello yet? <a href={APP_STORE_URL} className="text-teal-dark underline">Get it free on the App Store</a>.
        <br />Deep link: <code className="break-all">{deepLink}</code>
      </p>
    </section>
  );
}

function D6({ lead, stage, hero }: { lead: LeadRow; stage: Stage | null; hero: string }) {
  const info = stage !== null ? STAGE_INFO[stage] : null;
  return (
    <section className="flex flex-col gap-3">
      <p>Here&apos;s where {hero} is as a reader, based on what you told us{lead.age_band ? ` (age ${lead.age_band})` : ""}.</p>
      {info ? (
        <dl className="grid gap-2 rounded-ello bg-pastel-ink p-4">
          <dt className="font-bold">Reading stage</dt><dd>{info.label}</dd>
          <dt className="font-bold">What {hero} can do</dt><dd>{hero} {info.can}.</dd>
          <dt className="font-bold">Up next</dt><dd>{info.next}</dd>
          <dt className="font-bold">Tonight&apos;s tip</dt><dd>{info.tip}</dd>
        </dl>
      ) : (
        <p className="text-ink">(No reading stage on file.)</p>
      )}
      <a href={APP_STORE_URL} className="ello-btn ello-btn--secondary self-start">Let Ello track progress for you</a>
    </section>
  );
}
