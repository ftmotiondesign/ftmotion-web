-- FTMotion kampanyalar: Supabase SQL Editor'de bir kez çalıştırın.
create table if not exists public.business_campaigns (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 120),
 description text not null default '',
 image_url text,
 cta_label text not null default 'Hemen Katıl',
 cta_url text,
 starts_on date,
 ends_on date,
 active boolean not null default true,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint campaign_date_range check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create index if not exists business_campaigns_lookup on public.business_campaigns(business_id,active,ends_on);
alter table public.business_campaigns enable row level security;
drop policy if exists campaign_public_read on public.business_campaigns;
create policy campaign_public_read on public.business_campaigns for select to anon,authenticated using (
 active and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date)
 and exists(select 1 from public.businesses b where b.id=business_id and b.active=true)
);
drop policy if exists campaign_owner_read on public.business_campaigns;
create policy campaign_owner_read on public.business_campaigns for select to authenticated using (
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
drop policy if exists campaign_owner_insert on public.business_campaigns;
create policy campaign_owner_insert on public.business_campaigns for insert to authenticated with check (
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
drop policy if exists campaign_owner_update on public.business_campaigns;
create policy campaign_owner_update on public.business_campaigns for update to authenticated using (
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
) with check (
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
drop policy if exists campaign_owner_delete on public.business_campaigns;
create policy campaign_owner_delete on public.business_campaigns for delete to authenticated using (
 exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())
);
