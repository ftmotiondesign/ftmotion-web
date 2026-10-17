-- Sabit fiziksel QR kodu, atanmış aktif işletmeye yönlendirilir.
create or replace function public.ft_public_stock_destination(p_code text)
returns text language sql stable security definer set search_path=public as $$
 select '/qr/?slug=' || b.slug from public.ft_qr_stock s
 join public.businesses b on b.id=s.business_id
 where s.code=upper(trim(p_code)) and b.active=true and b.slug is not null
 limit 1;
$$;
revoke all on function public.ft_public_stock_destination(text) from public;
grant execute on function public.ft_public_stock_destination(text) to anon,authenticated;
