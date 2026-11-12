-- Hero name (first name or nickname) on the lead, so Chapter 2 emails can use it.
-- Stored only when a parent gives their email. Stories keep the {{hero}} token.
-- The API validates it (letters, <=16 chars, profanity filter) and stores null on failure.
alter table public.leads add column if not exists hero_name text;
alter table public.leads drop constraint if exists leads_hero_name_len;
alter table public.leads add constraint leads_hero_name_len check (hero_name is null or char_length(hero_name) between 1 and 16);
