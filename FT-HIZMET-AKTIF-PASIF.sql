-- Supabase SQL Editor'de bir kez çalıştırın.
create table if not exists public.ft_service_visibility (
 service_id integer primary key check(service_id between 0 and 8),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.ft_service_visibility(service_id,active)
select n,true from generate_series(0,8) as n on conflict(service_id) do nothing;
alter table public.ft_service_visibility enable row level security;
grant select on public.ft_service_visibility to anon,authenticated;
grant insert,update on public.ft_service_visibility to authenticated;
drop policy if exists "Public service visibility read" on public.ft_service_visibility;
create policy "Public service visibility read" on public.ft_service_visibility for select to anon,authenticated using(true);
drop policy if exists "Admins manage service visibility" on public.ft_service_visibility;
create policy "Admins manage service visibility" on public.ft_service_visibility for all to authenticated
using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
