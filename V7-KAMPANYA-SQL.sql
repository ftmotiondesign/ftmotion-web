
-- V7: Sektöre göre esnek kampanyalar (V6-SUPABASE.sql sonrasında).
create table if not exists public.service_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(trim(name)) between 3 and 100),
 sector text not null default 'Genel',
 description text not null default '',
 service_ids uuid[] not null default '{}',
 discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 90),
 fixed_price numeric(12,2) check(fixed_price is null or fixed_price >= 0),
 active boolean not null default true,
 featured boolean not null default false,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
alter table public.service_packages enable row level security;
drop policy if exists "packages public read" on public.service_packages;
create policy "packages public read" on public.service_packages
 for select to anon,authenticated using(active or public.is_ftm_admin());
drop policy if exists "packages admin insert" on public.service_packages;
create policy "packages admin insert" on public.service_packages
 for insert to authenticated with check(public.is_ftm_admin());
drop policy if exists "packages admin update" on public.service_packages;
create policy "packages admin update" on public.service_packages
 for update to authenticated using(public.is_ftm_admin()) with check(public.is_ftm_admin());
drop policy if exists "packages admin delete" on public.service_packages;
create policy "packages admin delete" on public.service_packages
 for delete to authenticated using(public.is_ftm_admin());
grant select on public.service_packages to anon,authenticated;
grant insert,update,delete on public.service_packages to authenticated;
