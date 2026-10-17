-- Yalnızca atanmamış QR/NFC stok kayıtlarını sil.
create or replace function public.ft_admin_stock_delete(p_id bigint)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_ftm_admin() then
  raise exception 'Bu işlem yalnızca ana yöneticiye açıktır.';
 end if;
 delete from public.ft_qr_stock
 where id=p_id and business_id is null;
 if not found then
  raise exception 'Stok bulunamadı veya işletmeye atanmış. Önce atamayı kaldırın.';
 end if;
end $$;
revoke all on function public.ft_admin_stock_delete(bigint) from public,anon;
grant execute on function public.ft_admin_stock_delete(bigint) to authenticated;
