-- Sponsor requests: PostgreSQL table privileges (RLS policies remain active).
grant usage on schema public to anon, authenticated;
grant select on table public.sponsor_requests to anon;
grant select, insert on table public.sponsor_requests to authenticated;
grant update on table public.sponsor_requests to authenticated;
-- No delete privilege. RLS still restricts member insert and admin update.
-- Confirm that public.is_ftm_admin() is available before using the admin screen.
