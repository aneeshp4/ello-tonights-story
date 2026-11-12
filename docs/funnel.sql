-- Tonight's Story: funnel reads for the Supabase SQL editor.
-- Source: public.events (session_id, name, variant, path, props jsonb, created_at).
-- Each step counts DISTINCT sessions. Change the date window in `params`.
--
-- `events.variant` is text written by /api/events as 'ask=end,h=a'
-- (see variantText() in lib/supabase.ts); we parse it to (ask, h).
-- A session's arm = its FIRST event's variant (assignment is sticky via the
-- ello_v cookie; a later ?ask= override would otherwise split a session).
-- The ask-placement test is retired: new sessions are always ask='end', so the
-- live comparison is the headline (h). Sessions from before the change may still
-- show ask='mid'; filter on created_at if you want only the current flow.
-- page_ready is written server-side by /api/story (one row per page, real
-- session_id from the request); page 1 is the "story ready" funnel step below.
-- Older rows came from the client (props.client = true, page 1 only); the
-- bool_or per session counts either kind once, so the step reads the same.

-- ============================================================================
-- 1) Main funnel per variant (ask x h)
-- ============================================================================
with params as (
  select now() - interval '14 days' as since
),
ev as (
  select e.*,
         substring(e.variant from 'ask=([a-z]+)') as v_ask,
         substring(e.variant from 'h=([a-z]+)') as v_h
  from public.events e, params p
  where e.created_at >= p.since
),
arm as (  -- first-seen variant per session
  select distinct on (session_id) session_id, v_ask as ask, v_h as h
  from ev
  where v_ask is not null
  order by session_id, created_at
),
steps as (
  select session_id,
    bool_or(name = 'landing_viewed')                                  as landing,
    bool_or(name = 'cta_clicked')                                     as cta,
    bool_or(name = 'reading_check_completed')                         as reading_check,
    bool_or(name = 'page_ready' and (props ->> 'page')::int = 1)      as page1_ready,
    bool_or(name = 'story_page_viewed' and (props ->> 'page')::int = 1) as page1_viewed,
    bool_or(name = 'story_finished')                                  as finished,
    bool_or(name = 'email_ask_viewed')                                as ask_viewed,
    bool_or(name = 'lead_submitted')                                  as lead,
    avg((props ->> 'score')::numeric) filter (where name = 'kid_reaction_rated') as reaction
  from ev
  group by session_id
)
select
  a.ask, a.h,
  count(*) filter (where s.landing)        as landing_viewed,
  count(*) filter (where s.cta)            as cta_clicked,
  count(*) filter (where s.reading_check)  as reading_check_completed,
  count(*) filter (where s.page1_ready)    as page1_ready,
  count(*) filter (where s.page1_viewed)   as page1_viewed,
  count(*) filter (where s.finished)       as story_finished,
  count(*) filter (where s.ask_viewed)     as email_ask_viewed,
  count(*) filter (where s.lead)           as lead_submitted,
  -- Primary metric (riskiest link): leads / sessions that saw page 1
  round(100.0 * count(*) filter (where s.lead)
        / nullif(count(*) filter (where s.page1_viewed), 0), 1) as lead_per_page1_pct,
  -- Headline test: CTA rate off the landing
  round(100.0 * count(*) filter (where s.cta)
        / nullif(count(*) filter (where s.landing), 0), 1)      as cta_per_landing_pct,
  -- Guardrail: mean kid reaction (score as sent by the reader, e.g. 1..3)
  round(avg(s.reaction), 2)                                     as kid_reaction_avg,
  count(s.reaction)                                             as kid_reaction_n
from arm a
join steps s using (session_id)
group by a.ask, a.h
order by a.ask, a.h;

-- ============================================================================
-- 2) Same funnel collapsed to the `ask` test only (the first test, §12)
-- ============================================================================
with ev as (
  select e.*,
         substring(e.variant from 'ask=([a-z]+)') as v_ask
  from public.events e
  where e.created_at >= now() - interval '14 days'
),
arm as (
  select distinct on (session_id) session_id, v_ask as ask
  from ev where v_ask is not null
  order by session_id, created_at
)
select a.ask,
  count(distinct ev.session_id) filter (where name = 'story_page_viewed' and (props ->> 'page')::int = 1) as page1_viewed,
  count(distinct ev.session_id) filter (where name = 'email_ask_viewed') as email_ask_viewed,
  count(distinct ev.session_id) filter (where name = 'lead_submitted')   as lead_submitted,
  round(100.0 * count(distinct ev.session_id) filter (where name = 'lead_submitted')
        / nullif(count(distinct ev.session_id) filter (where name = 'story_page_viewed' and (props ->> 'page')::int = 1), 0), 1)
    as lead_per_page1_pct,
  round(avg((props ->> 'score')::numeric) filter (where name = 'kid_reaction_rated'), 2) as kid_reaction_avg
from arm a
join ev using (session_id)
group by a.ask
order by a.ask;

-- ============================================================================
-- 3) Share-loop attribution: shared story → new visitor → lead
--    `ref` = the story id in /s/{id}?ref={id}. The client merges ref (from the
--    ello_attr cookie) into every event's props, so a referred visitor's later
--    lead_submitted also carries props.ref.
-- ============================================================================
with ref_sessions as (
  select session_id, min(props ->> 'ref') as ref, min(created_at) as first_seen
  from public.events
  where name = 'share_landing_viewed' and props ->> 'ref' is not null
    and created_at >= now() - interval '30 days'
  group by session_id
),
outcomes as (
  select r.ref, r.session_id,
    bool_or(e.name = 'cta_clicked')                                       as cta,
    bool_or(e.name = 'story_page_viewed' and (e.props ->> 'page')::int = 1) as page1,
    bool_or(e.name = 'lead_submitted')                                    as lead
  from ref_sessions r
  join public.events e on e.session_id = r.session_id and e.created_at >= r.first_seen
  group by r.ref, r.session_id
)
select ref as shared_story_id,
  count(*)                          as share_landing_sessions,
  count(*) filter (where cta)       as made_one_cta,
  count(*) filter (where page1)     as read_page1,
  count(*) filter (where lead)      as leads,
  round(100.0 * count(*) filter (where lead) / nullif(count(*), 0), 1) as lead_pct
from outcomes
group by ref
order by share_landing_sessions desc
limit 50;

-- Overall viral coefficient-ish: shares clicked vs. referred leads
select
  (select count(distinct session_id) from public.events where name = 'share_clicked'
     and created_at >= now() - interval '30 days')                       as sharing_sessions,
  (select count(distinct session_id) from public.events where name = 'share_landing_viewed'
     and created_at >= now() - interval '30 days')                       as referred_sessions,
  (select count(distinct session_id) from public.events where name = 'lead_submitted'
     and props ->> 'ref' is not null and created_at >= now() - interval '30 days') as referred_leads;

-- ============================================================================
-- 4) Attribution by utm_source (paid/organic channel tests)
-- ============================================================================
select coalesce(props ->> 'utm_source', '(none)') as utm_source,
  count(distinct session_id) filter (where name = 'landing_viewed') as landing_viewed,
  count(distinct session_id) filter (where name = 'lead_submitted') as lead_submitted
from public.events
where created_at >= now() - interval '30 days'
group by 1
order by landing_viewed desc;

-- ============================================================================
-- 5) Story latency (page 1)
--    Event ownership (AGENT_PLAN.md §10): /api/story writes page_ready for every
--    page (path '/api/story', props.latency_ms = server time to generate that
--    page). The client no longer sends page_ready; rows with props.client = true
--    are from before that change and are excluded here. The client's view of the
--    wait is story_page_viewed{page:1}.ttfp_ms (request -> page 1 on screen).
-- ============================================================================
select 'server page_ready.latency_ms' as metric,
  count(*) as n,
  percentile_cont(0.5) within group (order by (props ->> 'latency_ms')::numeric) as p50_ms,
  percentile_cont(0.9) within group (order by (props ->> 'latency_ms')::numeric) as p90_ms
from public.events
where name = 'page_ready' and (props ->> 'page')::int = 1
  and props ->> 'latency_ms' is not null and coalesce(props ->> 'client', 'false') <> 'true'
  and created_at >= now() - interval '14 days'
union all
select 'client story_page_viewed.ttfp_ms',
  count(*),
  percentile_cont(0.5) within group (order by (props ->> 'ttfp_ms')::numeric),
  percentile_cont(0.9) within group (order by (props ->> 'ttfp_ms')::numeric)
from public.events
where name = 'story_page_viewed' and (props ->> 'page')::int = 1
  and props ->> 'ttfp_ms' is not null
  and created_at >= now() - interval '14 days';

-- Failures by who logged them (server = {type:"error"} from /api/story; client = network,
-- non-OK status incl. 429 rate_limited, or a stream that ended without done/error).
select coalesce(props ->> 'source', '(untagged, pre-change)') as source,
  props ->> 'reason' as reason,
  count(*) as failures,
  count(distinct session_id) as sessions
from public.events
where name = 'story_failed' and created_at >= now() - interval '14 days'
group by 1, 2
order by failures desc;
