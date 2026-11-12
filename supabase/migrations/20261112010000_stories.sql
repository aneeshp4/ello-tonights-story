-- Tonight's Story: generated stories + align leads.age_band with the UI.
-- Privacy: the real hero name is NEVER stored. Page text uses the {{hero}} token
-- and share links show fun_name.

-- age bands: align with UI (4-5, 6, 7, 8-9)
alter table public.leads drop constraint if exists leads_age_band_check;
alter table public.leads add constraint leads_age_band_check check (age_band in ('4-5','6','7','8-9'));

create table if not exists public.stories (
  id              text primary key,              -- 10-char nanoid, used in /story/{id} and /s/{id}
  created_at      timestamptz not null default now(),
  session_id      text,
  variant         text,
  age_band        text check (age_band in ('4-5','6','7','8-9')),
  stage           smallint not null check (stage between 0 and 4),
  interest        text not null,
  interest_custom boolean not null default false,
  fun_name        text not null,                 -- shown on share links; real hero name is NEVER stored
  title           text,
  pages           jsonb not null default '[]'::jsonb,   -- [{n, text (with {{hero}}), scene, source}]
  theme_words     text[] not null default '{}',
  status          text not null default 'generating' check (status in ('generating','complete','fallback','failed')),
  model           text,
  safety          jsonb not null default '[]'::jsonb,   -- [{n, verdict, ok, model, regenerated}]
  ref             text                           -- story id this visitor came from (viral attribution)
);
create index if not exists stories_created_at_idx on public.stories (created_at desc);

-- RLS on, no policies: only the server (service_role) reads or writes.
alter table public.stories enable row level security;
