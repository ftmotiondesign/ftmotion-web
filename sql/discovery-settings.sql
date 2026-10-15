-- FTMotion İşletme Keşfet tercihleri. Supabase SQL Editor'da bir defa çalıştırın.
create table if not exists public.business_discovery_settings (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 show_discover boolean not null default false,
 is_listed boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.business_discovery_settings enable row level security;
drop policy if exists "discovery settings public read" on public.business_discovery_settings;
create policy "discovery settings public read" on public.business_discovery_settings for select to anon,authenticated using (true);
drop policy if exists "discovery settings owner insert" on public.business_discovery_settings;
create policy "discovery settings owner insert" on public.business_discovery_settings for insert to authenticated with check (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "discovery settings owner update" on public.business_discovery_settings;
create policy "discovery settings owner update" on public.business_discovery_settings for update to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
insert into public.business_discovery_settings (business_id,show_discover,is_listed)
select id,false,true from public.businesses on conflict (business_id) do nothing;
