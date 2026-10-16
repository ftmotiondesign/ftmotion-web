-- FTMotion analytics foundation. Apply in Supabase SQL editor after review.
create table if not exists public.ftm_analytics_events (
 id bigint generated always as identity primary key,
 business_key text not null,
 source text not null check (source in ('qr','cebimde','dijiyesor','sponsor')),
 event_type text not null check (event_type in ('view','impression','click','save')),
 target text not null default '',
 visitor_hash text,
 occurred_at timestamptz not null default now()
);
create index if not exists ftm_analytics_lookup_idx on public.ftm_analytics_events (business_key,occurred_at desc);
create index if not exists ftm_analytics_source_idx on public.ftm_analytics_events (source,event_type,occurred_at desc);
alter table public.ftm_analytics_events enable row level security;
revoke all on public.ftm_analytics_events from anon, authenticated;
-- Public events are recorded via a constrained RPC; no direct SELECT permission is granted.
create or replace function public.ftm_track_event(p_business_key text,p_source text,p_event_type text,p_target text default '',p_visitor_hash text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 if length(trim(coalesce(p_business_key,''))) not between 1 and 160
 or p_source not in ('qr','cebimde','dijiyesor','sponsor')
 or p_event_type not in ('view','impression','click','save')
 or length(coalesce(p_target,'')) > 100
 or length(coalesce(p_visitor_hash,'')) > 128 then
   raise exception 'Invalid analytics event';
 end if;
 insert into public.ftm_analytics_events(business_key,source,event_type,target,visitor_hash)
 values(trim(p_business_key),p_source,p_event_type,coalesce(p_target,''),nullif(p_visitor_hash,''));
end $$;
revoke all on function public.ftm_track_event(text,text,text,text,text) from public;
grant execute on function public.ftm_track_event(text,text,text,text,text) to anon,authenticated;
-- IMPORTANT: Before production, add edge rate limiting, bot filtering, and
-- authorized reporting RPCs based on actual business ownership schema.
