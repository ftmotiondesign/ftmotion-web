-- Supabase pgcrypto uzantısı genellikle extensions şemasındadır.
-- Fonksiyonları açık şema ile yeniden oluştur.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.ft_admin_stock_activation(p_id bigint)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare secret text; affected int;
begin
 if not public.is_ftm_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
 secret:=upper(encode(extensions.gen_random_bytes(16),'hex'));
 update public.ft_qr_stock set activation_hash=encode(extensions.digest(secret,'sha256'),'hex'),activation_created_at=now()
 where id=p_id and business_id is null;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Kart bulunamadı veya bir işletmeye atanmış'; end if;
 return secret;
end $$;

create or replace function public.ft_member_stock_activate(p_business_id uuid,p_code text,p_secret text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare card public.ft_qr_stock%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.businesses b where b.id=p_business_id and b.owner_id=auth.uid()) then
 raise exception 'İşletme yetkisi gerekli'; end if;
 select * into card from public.ft_qr_stock where code=upper(trim(p_code)) for update;
 if not found or card.business_id is not null or card.activation_hash is null
 or card.activation_hash<>encode(extensions.digest(upper(trim(p_secret)),'sha256'),'hex') then
 raise exception 'Kart kodu veya aktivasyon kodu geçersiz ya da kart zaten aktif';end if;
 update public.ft_qr_stock set business_id=p_business_id,assigned_at=now(),activation_hash=null,activation_created_at=null where id=card.id;
 return card.code;
end $$;
