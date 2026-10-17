-- FTMotion QR bağlantı durumları (Supabase SQL Editor'da bir kez çalıştırılır)
alter table public.qr_short_links add column if not exists is_active boolean not null default true;
create or replace function public.ft_admin_list_qr_links(p_business_id uuid)
returns table(short_slug text,is_active boolean)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Yönetici yetkisi gerekli'; end if;
 return query select q.short_slug,q.is_active from public.qr_short_links q where q.business_id=p_business_id order by q.short_slug;
end $$;
create or replace function public.ft_admin_set_qr_link_active(p_business_id uuid,p_short_slug text,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Yönetici yetkisi gerekli'; end if;
 update public.qr_short_links set is_active=p_active where business_id=p_business_id and short_slug=p_short_slug;
 if not found then raise exception 'Bağlantı bulunamadı'; end if;
end $$;
revoke all on function public.ft_admin_list_qr_links(uuid) from public,anon;
revoke all on function public.ft_admin_set_qr_link_active(uuid,text,boolean) from public,anon;
grant execute on function public.ft_admin_list_qr_links(uuid) to authenticated;
grant execute on function public.ft_admin_set_qr_link_active(uuid,text,boolean) to authenticated;
-- Public QR sayfası is_active alanını okuyabilmelidir; mevcut SELECT RLS politikasını kontrol edin.
