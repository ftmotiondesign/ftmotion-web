-- FTMotion teklif ve destek talepleri: mevcut orders tablosunu değiştirmez.
create table if not exists public.contact_requests (
 id uuid primary key default gen_random_uuid(),
 request_type text not null check (request_type in ('quote','support')),
 customer_name text not null check (char_length(customer_name) between 2 and 150),
 customer_phone text not null check (char_length(customer_phone) between 7 and 35),
 service_details text not null default '',
 message text not null default '',
 status text not null default 'new' check (status in ('new','contacted','completed','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated;
grant insert on public.contact_requests to anon, authenticated;
grant select, update on public.contact_requests to authenticated;
drop policy if exists "ftm contact submit" on public.contact_requests;
create policy "ftm contact submit" on public.contact_requests for insert to anon, authenticated
with check (status='new' and char_length(service_details)<=2000 and char_length(message)<=3000);
drop policy if exists "ftm contact admin read" on public.contact_requests;
create policy "ftm contact admin read" on public.contact_requests for select to authenticated
using (public.is_ftm_admin());
drop policy if exists "ftm contact admin update" on public.contact_requests;
create policy "ftm contact admin update" on public.contact_requests for update to authenticated
using (public.is_ftm_admin()) with check (public.is_ftm_admin());
-- Public inserts should be rate-limited using Captcha/Edge Function before high traffic.
