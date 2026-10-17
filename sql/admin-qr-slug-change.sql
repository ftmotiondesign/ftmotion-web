-- FTMotion: QR bağlantı adını yalnızca ana yönetici değiştirir.
-- Supabase SQL Editor'da bir kez çalıştırın.
create or replace function public.ft_admin_change_qr_slug(p_business_id uuid,p_new_slug text)
returns void language plpgsql security definer set search_path=public
as $$
declare old_slug text; clean_slug text;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
  raise exception 'Bu işlem yalnızca ana yöneticiye açıktır.';
 end if;
 clean_slug:=lower(trim(p_new_slug));
 if length(clean_slug) not between 3 and 80 or clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
  raise exception 'Geçersiz QR bağlantı adı.';
 end if;
 select slug into old_slug from public.businesses where id=p_business_id for update;
 if not found then raise exception 'İşletme bulunamadı.'; end if;
 if old_slug=clean_slug then return; end if;
 if exists(select 1 from public.businesses where slug=clean_slug and id<>p_business_id)
 or exists(select 1 from public.qr_short_links where short_slug=clean_slug and business_id<>p_business_id)
 then raise exception 'Bu QR adresi başka bir işletmede kullanılıyor.'; end if;
 -- Eski basılı kodların çözümlenmesi için eski slug'ı kalıcı takma ad olarak sakla.
 if old_slug is not null and old_slug<>'' then
  insert into public.qr_short_links(short_slug,business_id)
  values(old_slug,p_business_id)
  on conflict (short_slug) do nothing;
  if not exists(select 1 from public.qr_short_links where short_slug=old_slug and business_id=p_business_id) then
   raise exception 'Eski QR adresi korunamadı. İşlem iptal edildi.';
  end if;
 end if;
 update public.businesses set slug=clean_slug where id=p_business_id;
end $$;
revoke all on function public.ft_admin_change_qr_slug(uuid,text) from public,anon;
grant execute on function public.ft_admin_change_qr_slug(uuid,text) to authenticated;
