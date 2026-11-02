-- TEST ONLY: review before running against production.
-- Explicit opt-in defaults to false; no existing customer is published.
alter table public.businesses
  add column if not exists directory_visible boolean not null default false;

-- Only public presentation fields, never owner_id/email/phone.
-- Invoker security means existing businesses RLS still applies.
create or replace view public.ftmotion_directory
with (security_invoker = true)
as
select name, slug, logo_url, cover_url, qr_description
from public.businesses
where active is true
  and directory_visible is true
  and nullif(trim(slug), '') is not null;

grant select on public.ftmotion_directory to anon, authenticated;
-- Before rollout: verify RLS policies and explicit customer consent.
