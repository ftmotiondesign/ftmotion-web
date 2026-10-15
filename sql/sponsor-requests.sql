-- Supabase SQL Editor: run once before using sponsor screens.
create table if not exists public.sponsor_requests (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 campaign_id uuid not null references public.business_campaigns(id) on delete cascade,
 placement text not null default 'offers' check (placement='offers'),
 city text not null default 'Çanakkale' check (city='Çanakkale'),
 duration_days integer not null default 30 check(duration_days=30),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 payment_status text not null default 'pending' check(payment_status in ('pending','confirmed')),
 amount_try numeric(10,2),
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 constraint sponsor_dates check(starts_at is null or ends_at is null or ends_at>starts_at)
);
create index if not exists sponsor_public_idx on public.sponsor_requests(status,payment_status,ends_at);
alter table public.sponsor_requests enable row level security;
-- Use existing is_ftm_admin() authorization function; do not grant based on client claims.
create or replace function public.ftm_sponsor_admin() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.is_ftm_admin(),false)
$$;
drop policy if exists sponsor_owner_read on public.sponsor_requests;
create policy sponsor_owner_read on public.sponsor_requests for select to authenticated using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists sponsor_owner_insert on public.sponsor_requests;
create policy sponsor_owner_insert on public.sponsor_requests for insert to authenticated with check(
 status='pending' and payment_status='pending' and starts_at is null and ends_at is null and amount_try is null
 and exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
 and exists(select 1 from public.business_campaigns c where c.id=campaign_id and c.business_id=business_id)
);
drop policy if exists sponsor_admin_all on public.sponsor_requests;
create policy sponsor_admin_all on public.sponsor_requests for all to authenticated using(public.ftm_sponsor_admin()) with check(public.ftm_sponsor_admin());
drop policy if exists sponsor_public_active on public.sponsor_requests;
create policy sponsor_public_active on public.sponsor_requests for select to anon,authenticated using(
 status='approved' and payment_status='confirmed' and starts_at<=now() and ends_at>now()
 and exists(select 1 from public.businesses b where b.id=business_id and b.active)
);
-- Expiration is enforced by query/RLS time predicates without a cron job.
-- Approved rows may remain in database for reporting after ends_at.
