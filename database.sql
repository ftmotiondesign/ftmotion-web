-- FTMotion: Supabase SQL Editor içinde bir kez çalıştırın.
create extension if not exists pgcrypto;
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.site_settings(id int primary key default 1 check(id=1), prices jsonb not null default '{}'::jsonb, bundle numeric(12,2) not null default 11900, phone text not null default '', hero_video text not null default '', media jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
insert into public.site_settings(id) values(1) on conflict(id) do nothing;
create table if not exists public.businesses(id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null default 'Yeni işletme', slug text unique, phone text default '', whatsapp text default '', address text default '', instagram text default '', website text default '', maps_url text default '', logo_url text default '', cover_url text default '', active boolean not null default false, created_at timestamptz default now());
create table if not exists public.menu_categories(id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, name text not null, sort_order int default 0);
create table if not exists public.menu_products(id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, category_id uuid references public.menu_categories(id) on delete set null, name text not null, description text default '', price numeric(12,2) not null default 0 check(price>=0), image_url text default '', active boolean not null default true, sort_order int default 0);
create table if not exists public.orders(id uuid primary key default gen_random_uuid(), customer_name text not null, customer_phone text not null, services jsonb not null, quoted_amount numeric(12,2), status text not null default 'new' check(status in ('new','contacted','completed','cancelled')), created_at timestamptz default now());
create or replace function public.is_ftm_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admin_users where user_id=(select auth.uid())) $$;
create or replace function public.owns_business(bid uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.businesses where id=bid and owner_id=(select auth.uid())) or public.is_ftm_admin() $$;
alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.businesses enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_products enable row level security;
alter table public.orders enable row level security;
create policy "admin self lookup" on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create policy "settings public read" on public.site_settings for select to anon,authenticated using(true);
create policy "settings admin edit" on public.site_settings for update to authenticated using(public.is_ftm_admin()) with check(public.is_ftm_admin());
create policy "business public active" on public.businesses for select to anon,authenticated using(active or owner_id=(select auth.uid()) or public.is_ftm_admin());
create policy "business create own" on public.businesses for insert to authenticated with check(owner_id=(select auth.uid()) or public.is_ftm_admin());
create policy "business update own" on public.businesses for update to authenticated using(owner_id=(select auth.uid()) or public.is_ftm_admin()) with check(owner_id=(select auth.uid()) or public.is_ftm_admin());
create policy "category read" on public.menu_categories for select to anon,authenticated using(exists(select 1 from public.businesses b where b.id=business_id and (b.active or b.owner_id=(select auth.uid()) or public.is_ftm_admin())));
create policy "category insert" on public.menu_categories for insert to authenticated with check(public.owns_business(business_id));
create policy "category update" on public.menu_categories for update to authenticated using(public.owns_business(business_id)) with check(public.owns_business(business_id));
create policy "category delete" on public.menu_categories for delete to authenticated using(public.owns_business(business_id));
create policy "product read" on public.menu_products for select to anon,authenticated using(exists(select 1 from public.businesses b where b.id=business_id and (b.active or b.owner_id=(select auth.uid()) or public.is_ftm_admin())));
create policy "product insert" on public.menu_products for insert to authenticated with check(public.owns_business(business_id));
create policy "product update" on public.menu_products for update to authenticated using(public.owns_business(business_id)) with check(public.owns_business(business_id));
create policy "product delete" on public.menu_products for delete to authenticated using(public.owns_business(business_id));
create policy "orders admin read" on public.orders for select to authenticated using(public.is_ftm_admin());
create policy "orders admin update" on public.orders for update to authenticated using(public.is_ftm_admin()) with check(public.is_ftm_admin());
-- Güvenlik: kamuya anonim sipariş INSERT yetkisi verilmez; siparişler WhatsApp üzerinden başlatılır.
-- İlk yönetici için Auth > Users ekranından kullanıcı UUID'sini kopyalayın ve SQL Editor içinde:
-- insert into public.admin_users(user_id) values ('BURAYA-GERCEK-KULLANICI-UUID') on conflict do nothing;
