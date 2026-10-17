-- FTMotion Kurumsal Kartlar v1
-- Supabase SQL Editor'da bir kez çalıştırın.
create table if not exists public.corporate_employees (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 full_name text not null check (char_length(trim(full_name)) between 2 and 120),
 job_title text not null default '',
 phone text not null default '',
 whatsapp text not null default '',
 email text not null default '',
 photo_url text,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (business_id, slug)
);
create index if not exists corporate_employees_business_idx on public.corporate_employees(business_id);
alter table public.corporate_employees enable row level security;
drop policy if exists corporate_employees_public_read on public.corporate_employees;
create policy corporate_employees_public_read on public.corporate_employees for select to anon, authenticated
using (is_active and exists (select 1 from public.businesses b where b.id=business_id and b.active=true));
drop policy if exists corporate_employees_owner_read on public.corporate_employees;
create policy corporate_employees_owner_read on public.corporate_employees for select to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
drop policy if exists corporate_employees_owner_insert on public.corporate_employees;
create policy corporate_employees_owner_insert on public.corporate_employees for insert to authenticated
with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
drop policy if exists corporate_employees_owner_update on public.corporate_employees;
create policy corporate_employees_owner_update on public.corporate_employees for update to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
drop policy if exists corporate_employees_owner_delete on public.corporate_employees;
create policy corporate_employees_owner_delete on public.corporate_employees for delete to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
grant select on public.corporate_employees to anon;
grant select,insert,update,delete on public.corporate_employees to authenticated;
