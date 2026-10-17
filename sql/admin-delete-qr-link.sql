-- FTMotion QR bağlantısını yalnızca merkezi yönetici silebilir.
create or replace function public.ft_admin_delete_qr_link(p_business_id uuid,p_short_slug text)
returns void language plpgsql security definer set search_path=public as $$
declare canonical_slug text; remaining_active integer;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
  raise exception 'Yönetici yetkisi gerekli.';
 end if;
 select slug into canonical_slug from public.businesses where id=p_business_id for update;
 if not found then raise exception 'İşletme bulunamadı.'; end if;
 if p_short_slug=canonical_slug then raise exception 'Ana QR adresi silinemez. Önce işletmenin QR adresini değiştirin.'; end if;
 if not exists(select 1 from public.qr_short_links where business_id=p_business_id and short_slug=p_short_slug) then
  raise exception 'Bağlantı bulunamadı.';
 end if;
 select count(*) into remaining_active from public.qr_short_links where business_id=p_business_id and short_slug<>p_short_slug and is_active=true;
 if remaining_active=0 then raise exception 'Son aktif QR bağlantısı silinemez.'; end if;
 delete from public.qr_short_links where business_id=p_business_id and short_slug=p_short_slug;
end $$;
revoke all on function public.ft_admin_delete_qr_link(uuid,text) from public,anon;
grant execute on function public.ft_admin_delete_qr_link(uuid,text) to authenticated;
