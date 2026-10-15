-- Run in Supabase SQL Editor. One free video request per sponsor application.
create table if not exists public.sponsor_video_requests (
 id uuid primary key default gen_random_uuid(),
 sponsor_request_id uuid not null unique references public.sponsor_requests(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 brief text not null check(char_length(trim(brief)) between 10 and 1500),
 reference_url text,
 status text not null default 'requested' check(status in ('requested','in_progress','completed','rejected')),
 video_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.sponsor_video_requests enable row level security;
grant select,insert,update on public.sponsor_video_requests to authenticated;
drop policy if exists sponsor_video_member_read on public.sponsor_video_requests;
create policy sponsor_video_member_read on public.sponsor_video_requests for select to authenticated using(
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
drop policy if exists sponsor_video_member_create on public.sponsor_video_requests;
create policy sponsor_video_member_create on public.sponsor_video_requests for insert to authenticated with check(
 status='requested' and video_url is null
 and exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
 and exists(select 1 from public.sponsor_requests s where s.id=sponsor_request_id and s.business_id=business_id and s.status <> 'rejected')
);
drop policy if exists sponsor_video_admin_all on public.sponsor_video_requests;
create policy sponsor_video_admin_all on public.sponsor_video_requests for all to authenticated
 using(public.ftm_sponsor_admin()) with check(public.ftm_sponsor_admin());
