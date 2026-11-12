# AGENT_PLAN.md: Tonight's Story

The build plan for this repo. Read it before writing code, and keep it current when a decision changes.
Visual flow and copy (reviewed with comments): https://claude.ai/artifact/HERoTDtcKqPf3bfHCTRKwF

> **Next.js 16 note:** see `AGENTS.md`. This Next version has breaking changes. Read `node_modules/next/dist/docs/` before using routing, middleware/proxy, caching or streaming APIs. Don't write from memory.

---

## 1. What we're building

This is a lead gen web tool for **Ello**, an AI reading teacher for kids aged 5–9. It's a take-home: about 3 hours, ship-shaped, testable with real families within 2 weeks, and no ad spend.

**The product:** a parent picks what their kid is obsessed with, plus how well the kid reads. In about 3 seconds they're reading page 1 of a short story about that obsession. The story is **decodable**: it only uses the phonics patterns the kid can sound out, so the kid can read it themselves. We ask for an email **after** the story, offering chapter 2 tomorrow night. Chapter 3 lives in the Ello app.

### Theory of action
| Step | What happens |
|---|---|
| Hook | A parent at 8pm whose kid is bored by school readers. They get a free story right away, no signup. |
| Reach | The share link `/s/{id}` lets parents show off "a story Mo read by himself" and carries a "Make one for your kid" button. A class-chat version for teachers comes later. |
| Convert | The email series runs D0 printable, D1 chapter 2, D3 "chapter 3 is in Ello" (deep link with interest and stage preloaded). |
| Belief | Kids read more when the book is about their thing. Parents trade an email to keep a story going that their kid actually finished. |
| **Riskiest link** | Story finished → email submitted. **Metric:** `lead_submitted / story_page_viewed{page:1}`. **Guardrail:** the `kid_reaction_rated` score must not drop. |

### Privacy rules (non-negotiable)
- We never ask for a child's full name, photo, school or date of birth.
- The **hero name** is a first name or nickname (≤16 chars). It goes to the generation request, but **stories never store it**: before a story is saved, the name is replaced with the `{{hero}}` token, and share links show the `fun_name` instead.
- The hero name is stored **only on the lead**, and only when the parent gives their email, so Chapter 2 emails can use it (`leads.hero_name`). `/api/lead` validates it with the same guard as `/api/story` (length, letters, profanity) and stores `null` if it fails. It is **never logged** (lead insert errors log only the status code).
- Copy must stay honest about this: no "stays on your device" claims. Landing: "First name or nickname only. We never ask for a full name, photo or school." `/make` step 1: "First name or nickname. We use it in the story, and in Chapter 2 if you sign up."
- A lead record holds only `email, hero_name, age_band, reading_stage, interest, story_id, variant, session_id, referrer, utm, consent`.
- Use demo data only while building ("Mo", "Captain Pickle"), never real kids.

---

## 2. Status

| Area | State |
|---|---|
| Repo | `github.com/aneeshp4/ello-tonights-story`, public |
| Hosting | Render web service `srv-dbqmoq0ae00c738sk0rg`, https://ello-tonights-story.onrender.com, region virginia, **free plan** (switch to Starter before submitting so it doesn't cold-start). Auto-deploys on every push to `main`. Created through the API, **not** Blueprint-synced, so `render.yaml` is documentation only. Change env vars through the Render API or the dashboard. |
| Supabase | Project `jrvyzxfbinniltwiyndz` (us-east-1), linked. CLI: `npx supabase …` (v3.1.0; `db push --remote`). `leads` (incl. `hero_name`), `events`, `funnel` and `stories` are migrated. |
| Brand | Ello tokens in `app/globals.css`, `styles/ello.css` and the Tailwind v4 theme. Classes include `.ello-card`, `.ello-chip`, `.ello-story`, `font-story`, `text-h1`… The source is the Ello Figma (brand pages 34–53). |
| App | All 4 build PRs are merged: landing, `/make`, streaming reader + ask sheet + done/share, `/s`, `/print`, email previews, `/api/story` (OpenRouter + decodable check + Jev), `/api/lead`, `/api/events`, A/B proxy. The Render service is live and auto-deploys `main`. |
| Models | Benchmarked; see §6. |

---

## 3. Environment variables

| Key | Secret | Value / purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | All LLM and decision calls. The key has a $10 limit. |
| `SUPABASE_URL` | yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Never import it into client components. |
| `STORY_MODEL` | no | `google/gemini-3.1-flash-lite` |
| `STORY_MODEL_FALLBACK` | no | `deepseek/deepseek-v4.1-flash` |
| `SAFETY_MODEL` | no | `typesafe/jev-1.14` (pinned; don't use `~typesafe/jev-latest`) |
| `SAFETY_MODEL_FALLBACK` | no | `google/gemini-3.1-flash-lite` |

Local values live in `.env.local`, which git ignores. Production values are set on the Render service. **Never commit a secret. The repo is public.**

---

## 4. App structure

```
app/
  page.tsx                    Landing (screen 0)
  make/page.tsx               Builder: steps 1–3 in one client component; starts the stream
  story/[id]/page.tsx         Reader (screen 4) + reaction + email ask sheet (5) + done/share (6)
  s/[id]/page.tsx             Shared story, read-only, hero = fun_name, CTA "Make one for your kid"
  print/[id]/page.tsx         Print layout (booklet-ish, 1 page per sheet half), uses window.print()
  preview/email/[leadId]/[n]/page.tsx   Fake email previews D0/D1/D3/D6 (sending is mocked)
  api/story/route.ts          POST: generate + stream pages (NDJSON)
  api/lead/route.ts           POST: capture lead
  api/events/route.ts         POST: batch analytics
lib/
  openrouter.ts               chat() + decide() helpers
  story/prompt.ts             system/user prompts per stage
  story/stages.ts             stage definitions, sight words, age defaults
  story/decodable.ts          word-list checker
  story/generate.ts           page loop: generate → checks → retry → fallback
  safety/input.ts             input guards (name, interest, email)
  safety/output.ts            Jev check + fallback
  supabase.ts                 server-only client (service role)
  track.ts                    client track() → batched POST /api/events (sendBeacon on unload)
  variant.ts                  A/B assignment (cookie + URL override)
  ratelimit.ts                in-memory token bucket (one instance on Render; fine for the prototype)
content/fallback/*.json       pre-written, human-reviewed stories
supabase/migrations/*.sql
```

The story streams from `/make`. When page 1 arrives, the client does `router.replace('/story/{id}')` and keeps reading the same stream, or it renders the reader inline and updates the URL. If the reader is reloaded, it reads the saved story from the DB and gets the hero name from `sessionStorage`, falling back to `fun_name`.

---

## 5. Screens and frontend

The design is mobile first (about 393px), with large type and one main action per screen, built with Ello tokens.

| # | Route / state | Contents | Events |
|---|---|---|---|
| 0 | `/` | Headline (A/B), subhead, 3-page example book (swipe with scroll-snap, tap dots, ←/→ on desktop, arrow keys), CTA "Make tonight's story", privacy line, "From Ello" line | `landing_viewed`, `cta_clicked` |
| 1 | `/make` step 1 | "Who's tonight's story about?": "Your reader's first name or nickname" (16 chars max, helper "They'll be the hero of the story.", placeholder "e.g. Mo") + "🎲 Use a silly name instead", privacy note "First name or nickname. We use it in the story, and in Chapter 2 if you sign up.", "How old is your reader?" (helper "So we pick words they can read.") with chips `4–5 · 6 · 7 · 8–9`. Later steps say the name, or "your reader" if none. | `step_viewed`, `fun_name_used`, `step_completed{step:1, age_band}` |
| 2 | `/make` step 2 | 12 interest chips (dinosaurs, trucks, space, dogs, sharks, soccer, mermaids, robots, bugs, cooking, castles, unicorns) + free text (40 chars max) | `interest_selected{interest, custom}`, `input_rejected{field}` |
| 3 | `/make` step 3 | "Which can {hero} read on their own? Tap the hardest one." Cards: `cat · sun`, `ship · frog`, `cake · rain`, `because · night`, plus chips "Not reading yet" and "Not sure" | `reading_check_completed{stage, source}`, `story_requested` |
| — | loading | Yello + "Writing a {interest} story with words {hero} can sound out…" + reading tip. Waits **only for page 1**. | `page_ready{page:1,…}` |
| 4 | `/story/[id]` | A fixed full-height (`h-dvh`) column so nothing moves between pages: scene, a text box that fills the leftover space and scrolls inside itself (with a "more ↓" cue), a fixed-height parent-tip box, and a fixed-height controls row (page dots + "Next page"). If the next page isn't ready, the text box shows Yello "turning the page…" and the button stays put. **Last page:** the controls row turns into "The End. How did {hero} do?" 😍 🙂 😕 / Skip + "📬 Chapter 2 comes out tomorrow at 7pm". `story_finished` fires when the last page is reached. | `story_page_viewed{page}`, `next_page_waited{page, wait_ms}`, `story_finished`, `kid_reaction_rated{score}`, `print_clicked` |
| 5 | sheet on the last page | Opens over the last page after the rating (or Skip). "{hero}'s story isn't over": "Chapter 2 arrives in your inbox tomorrow at 7pm, plus a printable copy", email input, "Send me Chapter 2", "Not now", "One story a night for 3 nights, starring {hero}. Unsubscribe anytime." The page behind is locked (`position: fixed` body), and the sheet fits the visual viewport so the keyboard can't cover the input. **The email ask only ever comes at the end of the story** (the mid-story gate is retired). | `email_ask_viewed{ask:'end'}`, `lead_submitted`, `email_ask_dismissed` |
| 6 | reader, done state | "Not now" lands here: "Sweet dreams, {hero}! Chapter 2 comes out tomorrow at 7pm. Want it in your inbox?" + "Send me Chapter 2" (reopens the sheet). After signup: "Chapter 2 arrives tomorrow at 7pm". Share button (Web Share API with copy-link fallback) → `/s/{id}?ref={id}`, app card "Want Ello to listen while {hero} reads?" + "Get Ello free" (App Store link), "Make another story" | `share_clicked`, `app_cta_clicked`, `another_story_clicked` |
| — | `/s/[id]` | Read-only story with `fun_name`, CTA → `/make?ref={id}` | `share_landing_viewed{ref}` |

**Highlighting:** client-side, highlight words that match the stage's *target* pattern (e.g. stage 2 → `sh|ch|th|wh|ck` or an initial/final blend). Theme words (§7) get a different highlight with the tip "Help with: dinosaur".

**Fun names list:** Captain Pickle, Rocket Rex, Pip, Zip, Bean, Moss, Tug, Sunny, Biscuit, Nova. All are decodable-ish and gender-neutral.

---

## 6. OpenRouter usage

Every model call goes through OpenRouter with `Authorization: Bearer $OPENROUTER_API_KEY`. Send `HTTP-Referer` and `X-Title: Tonight's Story` headers.

### 6a. Story generation: chat completions
`POST https://openrouter.ai/api/v1/chat/completions`
```jsonc
{
  "models": ["<STORY_MODEL>", "<STORY_MODEL_FALLBACK>"],   // OpenRouter falls back automatically
  "stream": false,              // one page is ~40 tokens; streaming per page isn't worth it, we stream *pages*
  "temperature": 0.8,
  "max_tokens": 250,
  "reasoning": { "enabled": false },
  "response_format": { "type": "json_schema", "json_schema": { "name": "page", "strict": true, "schema": {
      "type": "object", "additionalProperties": false, "required": ["text", "scene"],
      "properties": {
        "text":  { "type": "string" },
        "scene": { "type": "string", "enum": ["outdoors-day","outdoors-night","bedroom","kitchen","water","space","forest","city","farm","castle","sports-field"] }
  }}}},
  "messages": [ system(stage rules), user(hero, interest, page n of 5, story-so-far, beat for this page) ]
}
```
- **Benchmarked** (page 1, stage 2, n=2): Gemini 3.1 Flash Lite took about 0.8s total and stayed on topic and decodable. DeepSeek v4.1 Flash took 0.9–1.9s, was cheapest, and drifted once ("Mo is a hen"). GPT-5 nano ran past the word caps. Claude Haiku 5.5 returned empty output (unexplored).
- **Cost:** about $0.001 per 5-page story.
- **One call per page, in order.** Pass the earlier pages as context, plus a **beat plan** so the story has a shape: p1 set-up with the hero and the interest, p2 a small goal, p3 a gentle problem, p4 solved, p5 a cozy ending + **open hook** for chapter 2 ("But what was under the shell?").
- **Hero name:** pass the real name. Tell the model to repeat the name instead of using pronouns, which also helps decodability. Before saving, replace the name with `{{hero}}` (case-insensitive, whole word).

### 6b. Safety: Jev decision model, called directly
Jev is **not** on chat completions. Use `POST https://openrouter.ai/api/alpha/decisions` (an alpha endpoint).
```jsonc
{
  "model": "typesafe/jev-1.14",
  "state": "<page text with real hero name>",
  "questions": {
    "verdict": { "type": "choice",
      "instructions": "Classify this page of a bedtime story for children aged 4-9.",
      "criteria": {
        "safe": "Gentle, kid-appropriate. Mild resolved tension like a lost toy that is found is fine.",
        "scary": "Monsters attacking, being lost or abandoned, darkness as a threat, kidnapping, nightmares.",
        "violence": "Violence, injury, blood, death, weapons.",
        "suggestive": "Anything sexual, romantic or suggestive.",
        "profanity": "Swearing, slurs or insults.",
        "dangerous": "Dangerous imitable acts like knives, fire, matches, medicine, running into roads.",
        "cruelty": "Bullying or cruelty."
      } },
    "ok": { "type": "noul", "instructions": "Is this page appropriate to show a 5-year-old at bedtime?" }
  }
}
```
The response is `answers.verdict.choice`, `.probabilities`, `.confidence`, and `answers.ok.noul` (a 0–1 score). The other question types are `score` (needs `criteria: []`) and `box`.
**Pass rule:** `verdict.choice === "safe" && ok.noul >= 0.8`.
**Benchmarked:** 0.19–0.44s, 14/14 correct across safe, scary, dangerous, suggestive, profanity and two harmless pages, the same answer every run, $0.000022 per check. Harmless pages scored ok ≈ 0.88–0.91 and unsafe ones 0.05–0.36.
**If Jev errors or times out (1.5s):** run the same policy as a JSON-output chat call on `SAFETY_MODEL_FALLBACK` (Gemini Flash Lite, ~0.7s, 10/10). If both fail, treat the page as **unsafe**.
Don't use `typesafe/jev-router`. It's a model *router* with variable latency (up to 16s) and variable cost.

---

## 7. Stages and the decodable check

| Stage | Tap | Allowed | Words per page |
|---|---|---|---|
| 0 pre-reader | "Not reading yet" | Read-aloud story; we mark 3 sight words for the kid to point at | 8–12 |
| 1 CVC | `cat · sun` | short vowels in CVC words (+ plural -s) | 15–30 |
| 2 digraphs/blends | `ship · frog` | stage 1 + sh ch th wh ck ng, initial/final blends, -ll -ss -ff | 15–30 |
| 3 long vowels | `cake · rain` | stage 2 + magic-e, ai ay ee ea oa ow igh, -ed/-ing | 30–45 |
| 4 fluent | `because · night` | open vocabulary, short sentences | 30–45 |

**Age default when "Not sure":** 4-5 → 1, 6 → 2, 7 → 3, 8-9 → 4.
**Sight words** (stages 1–3): a, the, is, to, I, he, she, we, me, be, was, said, of, you, are, they, my, do, go, no, so, here, there, what, for, have, like, look, see, come, some, one, two, all, his, her, put, push, pull.
**Theme words:** at most 2 non-decodable interest words per story (e.g. "dinosaur", "mermaid"), shown to the parent as "Help with: …". Ask the model to use each one at most once per page.

**`decodable.ts`:** tokenize, then lowercase and strip punctuation. A word passes if it's a sight word, a theme word, the hero token, or matches the stage's pattern grammar (a regex per stage built from the allowed graphemes). A page passes if `offlist <= 1` (stages 1–2) or `<= 3` (stage 3). Stages 0 and 4 only get the length check. Also enforce the word caps: over the cap means regenerate.

---

## 8. `POST /api/story`: the page loop

Request: `{ hero, age_band, interest, interest_custom, stage, session_id, variant, ref }`
1. **Input guard** (`lib/safety/input.ts`, also run client-side):
   - **hero:** 1–12 chars, `^[\p{L}][\p{L} '\-]*$`u, passes the profanity filter (`obscenity` npm package with its English dataset).
   - **interest custom:** ≤40 chars, passes the profanity filter and a topic blocklist (weapons, gore, horror, adult, drugs, brand names), then a Jev check: `{ok: noul "Is this a fine topic for a kids' bedtime story?"}`. On failure: `input_rejected`, and the client maps it to the closest chip.
   - **rate limit:** 10 stories per IP per hour.
2. Insert a `stories` row (`status:'generating'`) and stream `{"type":"story","id":…}`.
3. For each page 1..5: **generate → run the decodable check and Jev in parallel → pass?** If it fails, regenerate once. If it fails again, or there's no page within 8s, use the fallback page for this beat. Stream `{"type":"page","n":1,"text":"…","scene":"…","source":"model|fallback"}`.
4. Update the row (`pages`, `status: complete|fallback`, `safety`, `model`). Stream `{"type":"done"}`.
5. Log `page_ready{page, latency_ms, regenerated, fallback, safety_blocked}` server-side to `events`.

Response: `Content-Type: application/x-ndjson`, streamed. The client parses it line by line.
**Targets:** page 1 p50 < 3s and p90 < 6s; generation stays ahead of a reading kid.

## 9. `POST /api/lead`
Request: `{ email, story_id, session_id, variant, age_band, stage, interest, consent, hero?, ref, utm, website /*honeypot*/ }`
- `hero` (optional): checked with `checkHero()` from `lib/safety/input.ts`; stored as `leads.hero_name`, or `null` if it fails. Never logged.
- `email`: trim, lowercase, ≤254 chars, simple RFC-ish regex. Rate limit 5/IP/hour. If the honeypot is filled, return 200 and drop the request.
- Insert into `leads`. Return `{ ok, lead_id }`.
- **Email sending is mocked.** `/preview/email/{lead_id}/{1..4}` renders the 4 sequence emails from the lead and the story (D0 printable link, D1 chapter 2 teaser, D3 "Chapter 3 is waiting in Ello" with deep link `ello://story?interest=…&stage=…` → App Store fallback, D6 reading-stage summary). In production this payload would go to Customer.io or Resend.

## 10. `POST /api/events`
Request: `{ session_id, events: [{ name, ts, path, props }] }`, max 50 per batch. Event names are checked against an allowlist; anything else is dropped. Each event's `props` JSON is capped at 2KB. Insert into `events` with `variant` from the cookie.
Client: `track(name, props)` queues events and flushes every 2s, on `visibilitychange`, and via `navigator.sendBeacon` on page hide. It also `console.debug`s each event so reviewers can see the funnel in devtools.

**Event allowlist:** `landing_viewed, share_landing_viewed, cta_clicked, step_viewed, step_completed, fun_name_used, interest_selected, input_rejected, reading_check_completed, story_requested, page_ready, story_failed, safety_check_failed, story_page_viewed, next_page_waited, story_finished, kid_reaction_rated, print_clicked, email_ask_viewed, email_ask_dismissed, lead_submitted, share_clicked, app_cta_clicked, another_story_clicked`
Every event carries `session_id`, `variant`, `ref` and `utm_*`.

---

## 11. Database (Supabase Postgres)

Both tables have RLS on and **no policies**. Only the server, using the service role key, reads or writes.

**`leads`** (exists): `id uuid pk, created_at, email, hero_name text null (≤16 chars, check constraint; migration 20261112020000), age_band, reading_stage, interest, story_id, variant, session_id, referrer, utm jsonb, consent bool`
**`stories`** (exists): see the migration below.
**`events`** (exists): `id bigint identity, created_at, session_id, name, variant, path, props jsonb`
**`funnel`** view (exists): distinct sessions per `(variant, name)`.

**Stories migration** (applied, `supabase/migrations/20261112010000_stories.sql`):
```sql
-- age bands: align with UI (4-5, 6, 7, 8-9)
alter table public.leads drop constraint if exists leads_age_band_check;
alter table public.leads add constraint leads_age_band_check check (age_band in ('4-5','6','7','8-9'));

create table public.stories (
  id            text primary key,              -- 10-char nanoid, used in /story/{id} and /s/{id}
  created_at    timestamptz not null default now(),
  session_id    text,
  variant       text,
  age_band      text check (age_band in ('4-5','6','7','8-9')),
  stage         smallint not null check (stage between 0 and 4),
  interest      text not null,
  interest_custom boolean not null default false,
  fun_name      text not null,                 -- shown on share links; real hero name is NEVER stored
  title         text,
  pages         jsonb not null default '[]',   -- [{n, text (with {{hero}}), scene, source}]
  theme_words   text[] not null default '{}',
  status        text not null default 'generating' check (status in ('generating','complete','fallback','failed')),
  model         text,
  safety        jsonb not null default '[]',   -- [{n, verdict, ok, model, regenerated}]
  ref           text                            -- story id this visitor came from (viral attribution)
);
create index stories_created_at_idx on public.stories (created_at desc);
alter table public.stories enable row level security;
```
Apply with `npx supabase db push`. The project is already linked.

---

## 12. A/B testing
`lib/variant.ts` runs on first visit (`proxy.ts`). It assigns a cookie `ello_v` = `{ask: 'end', h: 'a'|'b'}`, 50/50 on `h`. URL param `?h=` overrides it and is saved. The variant goes on every event and on the lead.
- **Live test: the headline (`h`).**
  - **Headline a:** "A story your kid can read by themselves. About the thing they love."
  - **Headline b:** "Turn their obsession into reading practice."
  - Read `lead_submitted / story_page_viewed{page:1}` per arm, and check `kid_reaction_rated` as the guardrail (`docs/funnel.sql`).
- **Ask placement test: retired.** The email ask only comes at the end of the story. User feedback: the mid-story gate interrupted the story, and "Not now" let people skip it anyway. `ask` stays in the cookie and contract for compatibility: old `mid` cookies and `?ask=mid` normalise to `end`, and `/api/story` forces `end`. In `funnel.sql` the ask breakdown is now a single `end` row (older sessions may still show `mid`).

---

## 13. Fallback content
`content/fallback/{stage}/{interest|generic}.json` holds 5 pages each, following the beat plan, using `{{hero}}`. Start with `generic` for stages 0–4 plus trucks, dinosaurs, space and sharks for stages 1–3. These are AI-drafted, **then a human reads every one**. They're the safety net, so they skip the model checks.

---

## 14. Real vs faked (for the write-up)
- **Real:**
  - Story generation, page-by-page streaming, the decodable check, Jev safety
  - Input guards, lead capture to Supabase, analytics events to Supabase
  - A/B assignment, share links, print view
- **Faked:**
  - Email sending: preview pages only
  - Chapters 2–3: preview teaser
  - App deep link: goes to the App Store
  - Illustrations: CSS and emoji scenes
- **Not built:** AI images, audio, accounts, the teacher/class-chat version.

---

## 15. Build order
1. Migration (§11) → `db push`.
2. `lib/openrouter.ts`, `stages.ts`, `decodable.ts`, `safety/*`; check them with a small script against the benchmark pages.
3. `/api/story` NDJSON loop + fallback content.
4. `/make` + reader (`/story/[id]`), streaming end to end. **This is the riskiest link, so make it work for real first.**
5. `/api/lead` + email sheet + done/share; `/s/[id]`.
6. `track()` + `/api/events` + variant cookie; check the `funnel` view in Supabase.
7. Landing polish, print view, email previews.
8. Switch Render to Starter, test on a phone, write the README and the AI-usage note.

## 16. Open questions
- Include stage 0 pre-readers, or keep the promise to "they read it themselves"? Default: include them, labeled "read together".
- Hero name on share links: auto-swap to `fun_name` (current default) or ask at share time?
- SMS opt-in as a second channel? The Figma has a US SMS opt-in screen. A possible later variant of the ask.
