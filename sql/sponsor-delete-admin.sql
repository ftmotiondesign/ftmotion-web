-- FTMotion: sponsor başvurularını yalnızca merkezi yönetici silebilir.
-- Mevcut sponsor_admin_all RLS politikası korunur.
grant delete on table public.sponsor_requests to authenticated;
drop policy if exists sponsor_admin_delete on public.sponsor_requests;
create policy sponsor_admin_delete on public.sponsor_requests
for delete to authenticated
using (public.is_ftm_admin());
-- Not: Mevcut sponsor_admin_all politikası da yöneticiye erişim tanımlar.
