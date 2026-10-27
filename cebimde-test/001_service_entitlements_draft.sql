-- TEST-ONLY DRAFT: Do not run on the production FTMotion database before verified backups and staging tests.
-- Additive design: existing businesses, QR URLs, authentication and existing permissions remain untouched.
begin;
create table if not exists public.ft_business_entitlements (
  business_id uuid primary key references public.businesses(id) on delete restrict,
  loyalty_enabled boolean not null default false,
  digital_card_enabled boolean not null default false,
  website_enabled boolean not null default false,
  plan_code text not null default 'none' check (plan_code in ('none','nfc_first_year','starter','professional','corporate')),
  loyalty_starts_at timestamptz,
  loyalty_expires_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint entitlement_dates_valid check (loyalty_expires_at is null or loyalty_starts_at is null or loyalty_expires_at > loyalty_starts_at)
);
create table if not exists public.ft_loyalty_plan_catalog (
  code text primary key check (code in ('starter','professional','corporate','nfc_first_year')),
  name text not null,
  annual_price_try numeric(12,2) not null check (annual_price_try >= 0),
  max_programs integer,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.ft_loyalty_plan_catalog(code,name,annual_price_try,max_programs,active) values
 ('starter','Başlangıç',990,1,false),
 ('professional','Profesyonel',1990,5,false),
 ('corporate','Kurumsal',3490,null,false),
 ('nfc_first_year','NFC ilk yıl',0,null,false)
on conflict (code) do nothing;
create table if not exists public.ft_entitlement_audit (
 id bigint generated always as identity primary key,
 business_id uuid not null references public.businesses(id) on delete restrict,
 actor_id uuid not null references auth.users(id),
 action text not null,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz not null default now()
);
alter table public.ft_business_entitlements enable row level security;
alter table public.ft_loyalty_plan_catalog enable row level security;
alter table public.ft_entitlement_audit enable row level security;
-- Admin status derives from protected admin_users, never editable user_metadata.
create policy "entitlements admin read" on public.ft_business_entitlements for select to authenticated
 using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())));
create policy "entitlements owner read" on public.ft_business_entitlements for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "entitlements admin insert" on public.ft_business_entitlements for insert to authenticated
 with check (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())));
create policy "entitlements admin update" on public.ft_business_entitlements for update to authenticated
 using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())))
 with check (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())));
create policy "catalog authenticated read" on public.ft_loyalty_plan_catalog for select to authenticated using (true);
create policy "catalog admin update" on public.ft_loyalty_plan_catalog for update to authenticated
 using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())))
 with check (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())));
create policy "audit admin read" on public.ft_entitlement_audit for select to authenticated
 using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid())));
-- No INSERT/UPDATE policies for audit; write through a separately audited server-side transaction after review.
commit;
