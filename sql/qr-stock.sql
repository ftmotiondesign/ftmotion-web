-- FTMotion QR/NFC kart envanteri: yalnızca ana yönetici işlemleri
create table if not exists public.ft_qr_stock (
 id bigint generated always as identity primary key,
 code text not null unique check (code ~ '^[A-Z0-9-]{2,40}$'),
 product_type text not null default 'QR Kart' check(product_type in ('QR Kart','NFC Kart','NFC Etiket','Masaüstü')),
 business_id uuid references public.businesses(id) on delete set null,
 note text not null default '',
 created_at timestamptz not null default now(),
 assigned_at timestamptz
);
alter table public.ft_qr_stock enable row level security;
revoke all on public.ft_qr_stock from anon,authenticated;
create or replace function public.ft_admin_stock_list()
returns table(id bigint,code text,product_type text,business_id uuid,business_name text,note text,assigned_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_ftm_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
 return query select s.id,s.code,s.product_type,s.business_id,b.name,s.note,s.assigned_at
 from public.ft_qr_stock s left join public.businesses b on b.id=s.business_id order by s.id desc;
end $$;
create or replace function public.ft_admin_stock_add(p_code text,p_type text,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_ftm_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
 insert into public.ft_qr_stock(code,product_type,note)
 values(upper(trim(p_code)),p_type,left(coalesce(p_note,''),500));
end $$;
create or replace function public.ft_admin_stock_assign(p_id bigint,p_business_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_ftm_admin() then raise exception 'Yönetici yetkisi gerekli'; end if;
 if p_business_id is not null and not exists(select 1 from public.businesses where id=p_business_id) then raise exception 'İşletme bulunamadı'; end if;
 update public.ft_qr_stock set business_id=p_business_id,assigned_at=case when p_business_id is null then null else now() end where id=p_id;
 if not found then raise exception 'Stok kaydı bulunamadı'; end if;
end $$;
revoke all on function public.ft_admin_stock_list() from public,anon;
revoke all on function public.ft_admin_stock_add(text,text,text) from public,anon;
revoke all on function public.ft_admin_stock_assign(bigint,uuid) from public,anon;
grant execute on function public.ft_admin_stock_list() to authenticated;
grant execute on function public.ft_admin_stock_add(text,text,text) to authenticated;
grant execute on function public.ft_admin_stock_assign(bigint,uuid) to authenticated;
