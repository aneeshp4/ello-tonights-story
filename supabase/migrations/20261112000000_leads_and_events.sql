-- Tonight's Story: lead capture + funnel events.
-- Privacy: no child name, photo, school, or DOB is ever stored. The kid's
-- (optional, pretend-by-default) name lives only in the browser for the story.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text not null check (position('@' in email) > 1),
  age_band      text check (age_band in ('4-5','6-7','8-9')),
  reading_stage text,                 -- e.g. 'pre', 'cvc', 'digraphs', 'longvowels', 'fluent'
  interest      text,                 -- e.g. 'sharks'
  story_id      text,                 -- which generated story they asked to save
  variant       text,                 -- A/B arm
  session_id    text,                 -- anon id, joins to events
  referrer      text,
  utm           jsonb not null default '{}'::jsonb,
  consent       boolean not null default false
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text not null,
  name        text not null,
  variant     text,
  path        text,
  props       jsonb not null default '{}'::jsonb
);
create index if not exists events_name_created_idx on public.events (name, created_at desc);
create index if not exists events_session_idx on public.events (session_id);

-- Lock both tables: RLS on, no policies => anon/authenticated keys can't read or write.
-- Only the server (service_role key, via Next.js API routes) touches them.
alter table public.leads  enable row level security;
alter table public.events enable row level security;

-- Funnel view for quick reads in the SQL editor.
create or replace view public.funnel as
select variant, name, count(distinct session_id) as sessions
from public.events
group by variant, name
order by variant, sessions desc;
alter view public.funnel set (security_invoker = true);
