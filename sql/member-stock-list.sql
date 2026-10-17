-- Üye yalnızca kendi işletmesine atanmış fiziksel kartları görebilir.
create or replace function public.ft_member_stock_list(p_business_id uuid)
returns table(code text,product_type text,assigned_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.businesses b
  where b.id=p_business_id and b.owner_id=auth.uid()
 ) then raise exception 'Bu işletmenin kartlarını görüntüleme yetkiniz yok.'; end if;
 return query select s.code,s.product_type,s.assigned_at
 from public.ft_qr_stock s where s.business_id=p_business_id order by s.assigned_at desc nulls last,s.id desc;
end $$;
revoke all on function public.ft_member_stock_list(uuid) from public,anon;
grant execute on function public.ft_member_stock_list(uuid) to authenticated;
