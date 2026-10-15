-- Run once in Supabase SQL Editor after sponsor-requests.sql.
alter table public.sponsor_requests drop constraint if exists sponsor_requests_placement_check;
alter table public.sponsor_requests drop constraint if exists sponsor_requests_city_check;
alter table public.sponsor_requests drop constraint if exists sponsor_requests_duration_days_check;
alter table public.sponsor_requests add column if not exists scope text not null default 'city';
alter table public.sponsor_requests add column if not exists district text;
alter table public.sponsor_requests add constraint sponsor_requests_scope_check check(scope in ('country','city','district'));
alter table public.sponsor_requests add constraint sponsor_requests_placement_check check(placement in ('offers','discover'));
alter table public.sponsor_requests add constraint sponsor_requests_duration_days_check check(duration_days in (7,15,30));
alter table public.sponsor_requests add constraint sponsor_requests_target_check check(
 (scope='country' and city='' and district is null)
 or (scope='city' and length(trim(city))>0 and district is null)
 or (scope='district' and length(trim(city))>0 and length(trim(coalesce(district,'')))>0)
);
-- Existing rows remain city-level Çanakkale, 30 days, offers.
