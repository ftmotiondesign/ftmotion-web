-- FTMotion V30: Ortak duyuru sistemi (Supabase SQL Editor)
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 1 and 150),
 body text not null check (length(trim(body)) between 1 and 10000),
 active boolean not null default false,
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid()
);
alter table public.announcements enable row level security;
grant select,insert,update,delete on public.announcements to authenticated;
-- Çalıştırma tekrarında aynı politikaları güvenle günceller.
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select to authenticated
using (active = true or public.is_ftm_admin());
drop policy if exists "announcements_admin_insert" on public.announcements;
create policy "announcements_admin_insert" on public.announcements for insert to authenticated
with check (public.is_ftm_admin() and created_by = (select auth.uid()));
drop policy if exists "announcements_admin_update" on public.announcements;
create policy "announcements_admin_update" on public.announcements for update to authenticated
using (public.is_ftm_admin()) with check (public.is_ftm_admin());
drop policy if exists "announcements_admin_delete" on public.announcements;
create policy "announcements_admin_delete" on public.announcements for delete to authenticated
using (public.is_ftm_admin());
