-- Apply after customer-ledger.sql. Catalog, private drafts and auditable corrections.
create table public.crm_products (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 name text not null check(length(trim(name)) between 1 and 200),
 description text not null default '' check(length(description)<=1000),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 100000000000),
 unit text not null default 'adet' check(length(unit) between 1 and 30),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create index crm_products_business on public.crm_products(business_id,active);
alter table public.crm_products enable row level security;
revoke all on public.crm_products from public,anon,authenticated;
grant select,insert,update on public.crm_products to authenticated;
create policy crm_product_owner on public.crm_products for all to authenticated
using(exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))))
with check(exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))));

create table public.crm_quote_drafts (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 user_id uuid not null default auth.uid() references auth.users(id),
 draft_key text not null check(length(draft_key) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=100000),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(business_id,user_id,draft_key)
);
create index crm_drafts_user on public.crm_quote_drafts(user_id,business_id,updated_at desc);
alter table public.crm_quote_drafts enable row level security;
revoke all on public.crm_quote_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.crm_quote_drafts to authenticated;
create policy crm_draft_owner on public.crm_quote_drafts for all to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))))
with check(user_id=(select auth.uid()) and exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))));

alter table public.crm_payments add column voided_at timestamptz,
 add column voided_by uuid references auth.users(id),
 add column void_reason text check(length(void_reason) between 3 and 1000),
 add column replacement_id uuid references public.crm_payments(id);
create index crm_payments_voided_by on public.crm_payments(voided_by) where voided_by is not null;
create index crm_payments_replacement on public.crm_payments(replacement_id) where replacement_id is not null;

create or replace function crm_private.correct_payment(p_payment uuid,p_reason text,p_amount bigint,p_date date,p_method text,p_memo text,p_replacement uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.crm_quotes; old public.crm_payments; replacement public.crm_payments; total bigint; paid bigint;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'Düzeltme veya iptal nedenini yazın'; end if;
 select q0.* into q from public.crm_quotes q0 join public.crm_payments p on p.quote_id=q0.id
 join public.businesses b on b.id=q0.business_id where p.id=p_payment
 and (b.owner_id=auth.uid() or public.is_ftm_admin()) for update of q0;
 if not found then raise exception 'Tahsilata erişim yok'; end if;
 select * into old from public.crm_payments where id=p_payment for update;
 if old.voided_at is not null then
  if old.void_reason=trim(p_reason) and p_amount is null and old.replacement_id is null then return old.id; end if;
  select * into replacement from public.crm_payments where id=old.replacement_id;
  if old.void_reason=trim(p_reason) and replacement.id=p_replacement and replacement.amount_cents=p_amount
   and replacement.paid_on=p_date and replacement.method=p_method and replacement.memo=p_memo then return replacement.id; end if;
  raise exception 'Bu tahsilat daha önce iptal edildi veya düzeltildi';
 end if;
 if p_amount is not null then
  select total_cents into total from public.crm_quote_versions where quote_id=q.id and revision=q.current_revision;
  select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id and voided_at is null and id<>old.id;
  if p_amount<=0 or p_amount>total-paid then raise exception 'Yeni tutar kalan iş bedelini aşamaz ve sıfırdan büyük olmalı'; end if;
  if p_date is null or p_date>(now() at time zone 'Europe/Istanbul')::date or p_replacement is null then raise exception 'Yeni ödeme bilgileri geçersiz'; end if;
  insert into public.crm_payments(id,business_id,quote_id,amount_cents,paid_on,method,memo)
  values(p_replacement,q.business_id,q.id,p_amount,p_date,p_method,p_memo);
 end if;
 update public.crm_payments set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason),replacement_id=case when p_amount is null then null else p_replacement end where id=old.id;
 return case when p_amount is null then old.id else p_replacement end;
end $$;
create or replace function public.crm_correct_payment(p_payment uuid,p_reason text,p_amount bigint,p_date date,p_method text,p_memo text,p_replacement uuid)
returns uuid language sql security invoker set search_path='' as $$select crm_private.correct_payment(p_payment,p_reason,p_amount,p_date,p_method,p_memo,p_replacement)$$;
revoke all on function crm_private.correct_payment(uuid,text,bigint,date,text,text,uuid),public.crm_correct_payment(uuid,text,bigint,date,text,text,uuid) from public,anon,authenticated;
grant execute on function crm_private.correct_payment(uuid,text,bigint,date,text,text,uuid),public.crm_correct_payment(uuid,text,bigint,date,text,text,uuid) to authenticated;

-- Refresh aggregate functions to exclude voided payments.
create or replace function crm_private.issue_quote(p_business uuid,p_customer uuid,p_quote uuid,p_input jsonb,p_expected integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.businesses; c public.crm_customers; q public.crm_quotes;
 item jsonb; items jsonb:='[]'; qty numeric; price bigint; line bigint;
 subtotal bigint:=0; discount bigint; tax numeric; total bigint; paid bigint;
 deadline date; local_today date:=(now() at time zone 'Europe/Istanbul')::date; title text; terms text; ver uuid;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
 if p_expected is null or p_expected<0 then raise exception 'Teklif sürümü gerekli'; end if;
 select * into b from public.businesses where id=p_business and (owner_id=auth.uid() or public.is_ftm_admin());
 if not found then raise exception 'İşletme erişimi yok'; end if;
 select * into c from public.crm_customers where id=p_customer and business_id=p_business;
 if not found then raise exception 'Müşteri bulunamadı'; end if;
 title:=trim(p_input->>'title'); terms:=coalesce(p_input->>'terms','');
 if title is null or length(title) not between 2 and 200 or length(terms)>5000 then raise exception 'Başlık veya şartlar geçersiz'; end if;
 deadline:=(p_input->>'valid_until')::date;
 if deadline is null or deadline<local_today or deadline>local_today+365 then raise exception 'Geçerlilik tarihi bugün ile bir yıl arasında olmalı'; end if;
 if jsonb_typeof(p_input->'items') is distinct from 'array' then raise exception 'İş kalemleri gerekli'; end if;
 if jsonb_array_length(p_input->'items') not between 1 and 100 then raise exception '1–100 iş kalemi girin'; end if;
 for item in select value from jsonb_array_elements(p_input->'items') loop
  qty:=(item->>'quantity')::numeric; price:=(item->>'unit_price_cents')::bigint;
  if qty is null or qty<=0 or qty>100000 or qty<>round(qty,3) or price is null or price<0 or price>100000000000 then raise exception 'Miktar veya fiyat geçersiz'; end if;
  if coalesce(length(trim(item->>'name')),0) not between 1 and 300 then raise exception 'İş kalemi adı gerekli'; end if;
  line:=round(qty*price); subtotal:=subtotal+line;
  items:=items||jsonb_build_array(jsonb_build_object('name',trim(item->>'name'),'quantity',qty,'unit_price_cents',price,'line_cents',line));
 end loop;
 discount:=coalesce((p_input->>'discount_cents')::bigint,0); tax:=coalesce((p_input->>'vat_percent')::numeric,0);
 if discount<0 or discount>subtotal or tax<0 or tax>100 or tax<>round(tax,2) then raise exception 'İndirim veya KDV geçersiz'; end if;
 total:=subtotal-discount+round((subtotal-discount)*tax/100);
 if total>1000000000000 then raise exception 'Teklif tutarı çok yüksek'; end if;
 if p_quote is null then
  if p_expected<>0 then raise exception 'Teklif sürümü geçersiz'; end if;
  insert into public.crm_quotes(business_id,customer_id) values(p_business,p_customer) returning * into q;
 else
  select * into q from public.crm_quotes where id=p_quote and business_id=p_business and customer_id=p_customer for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;
  if q.current_revision<>p_expected then raise exception 'Teklif başka bir ekranda güncellendi. Yenileyin.'; end if;
 end if;
 select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id and voided_at is null;
 if total<paid then raise exception 'Teklif alınan ödemeden düşük olamaz'; end if;
 insert into public.crm_quote_versions(quote_id,business_id,revision,total_cents,valid_until,document)
 values(q.id,p_business,q.current_revision+1,total,deadline,jsonb_build_object(
  'title',title,'terms',terms,'currency','TRY','items',items,'subtotal_cents',subtotal,'discount_cents',discount,
  'vat_percent',tax,'vat_cents',round((subtotal-discount)*tax/100),'total_cents',total,
  'business',jsonb_build_object('name',b.name,'phone',b.phone,'email',b.email,'address',b.address,'logo_url',b.logo_url),
  'customer',jsonb_build_object('name',c.name,'phone',c.phone,'email',c.email,'address',c.address)
 )) returning id into ver;
 update public.crm_quotes set current_revision=current_revision+1 where id=q.id;
 return ver;
end $$;

create or replace function public.crm_issue_quote(p_business uuid,p_customer uuid,p_quote uuid,p_input jsonb,p_expected integer)
returns uuid language sql security invoker set search_path='' as $$select crm_private.issue_quote(p_business,p_customer,p_quote,p_input,p_expected)$$;
revoke all on function crm_private.issue_quote(uuid,uuid,uuid,jsonb,integer),public.crm_issue_quote(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function crm_private.issue_quote(uuid,uuid,uuid,jsonb,integer),public.crm_issue_quote(uuid,uuid,uuid,jsonb,integer) to authenticated;

create or replace function crm_private.record_payment(p_quote uuid,p_amount bigint,p_date date,p_method text,p_memo text,p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.crm_quotes; total bigint; paid bigint; existing public.crm_payments;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
 select q0.* into q from public.crm_quotes q0 join public.businesses b on b.id=q0.business_id
 where q0.id=p_quote and (b.owner_id=auth.uid() or public.is_ftm_admin()) for update of q0;
 if not found then raise exception 'Teklife erişim yok'; end if;
 select * into existing from public.crm_payments where id=p_id;
 if found then
  if existing.quote_id=p_quote and existing.amount_cents=p_amount and existing.paid_on=p_date and existing.method=p_method and existing.memo=p_memo then return p_id; end if;
  raise exception 'Ödeme kimliği başka bir kayıt için kullanıldı';
 end if;
 select total_cents into total from public.crm_quote_versions where quote_id=q.id and revision=q.current_revision;
 select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id and voided_at is null;
 if p_amount is null or p_amount<=0 or p_amount>total-paid then raise exception 'Ödeme kalan tutarı aşamaz ve sıfırdan büyük olmalı'; end if;
 if p_date is null or p_date>(now() at time zone 'Europe/Istanbul')::date then raise exception 'Ödeme tarihi gelecekte olamaz'; end if;
 insert into public.crm_payments(id,business_id,quote_id,amount_cents,paid_on,method,memo)
 values(p_id,q.business_id,q.id,p_amount,p_date,p_method,p_memo);
 return p_id;
end $$;
create or replace function public.crm_record_payment(p_quote uuid,p_amount bigint,p_date date,p_method text,p_memo text,p_id uuid)
returns uuid language sql security invoker set search_path='' as $$select crm_private.record_payment(p_quote,p_amount,p_date,p_method,p_memo,p_id)$$;
revoke all on function crm_private.record_payment(uuid,bigint,date,text,text,uuid),public.crm_record_payment(uuid,bigint,date,text,text,uuid) from public,anon,authenticated;
grant execute on function crm_private.record_payment(uuid,bigint,date,text,text,uuid),public.crm_record_payment(uuid,bigint,date,text,text,uuid) to authenticated;

-- Bearer link intentionally authorizes only the issued document and payment summary.
-- No private notes, customer lists, bank details or internal payment memos are returned.
create or replace function crm_private.shared_quote(p_token uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'quote_id',q.id,'revision',v.revision,'current_revision',q.current_revision,
 'current_total_cents',(select total_cents from public.crm_quote_versions cv where cv.quote_id=q.id and cv.revision=q.current_revision),'document',v.document,'created_at',v.created_at,'valid_until',v.valid_until,'response',v.response,
 'response_note',v.response_note,'responded_at',v.responded_at,'work_status',q.work_status,
 'payments',coalesce((select jsonb_agg(jsonb_build_object('amount_cents',p.amount_cents,'paid_on',p.paid_on) order by p.paid_on) from public.crm_payments p where p.quote_id=q.id and p.voided_at is null),'[]'::jsonb))
 from public.crm_quote_versions v join public.crm_quotes q on q.id=v.quote_id
 where v.share_token=p_token and q.share_enabled and v.share_expires_at>now()
$$;
create or replace function public.crm_shared_quote(p_token uuid) returns jsonb language sql stable security invoker set search_path='' as $$select crm_private.shared_quote(p_token)$$;

create or replace function crm_private.respond_quote(p_token uuid,p_response text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.crm_quote_versions; q public.crm_quotes;
begin
 if p_response is null or p_response not in ('accepted','changes') or coalesce(length(p_note),0)>2000 then raise exception 'Yanıt geçersiz'; end if;
 select q0.* into q from public.crm_quotes q0 join public.crm_quote_versions v0 on v0.quote_id=q0.id where v0.share_token=p_token for update of q0;
 if not found or not q.share_enabled then raise exception 'Bağlantı kullanılamıyor'; end if;
 select * into v from public.crm_quote_versions where share_token=p_token for update;
 if v.share_expires_at<=now() or v.valid_until<(now() at time zone 'Europe/Istanbul')::date then raise exception 'Teklifin süresi doldu'; end if;
 if v.revision<>q.current_revision then raise exception 'Bu teklifin daha yeni bir sürümü var. İşletmeyle iletişime geçin.'; end if;
 if v.response is not null then raise exception 'Yanıtınız daha önce kaydedildi'; end if;
 if p_response='changes' and length(trim(coalesce(p_note,'')))=0 then raise exception 'İstenen değişikliği yazın'; end if;
 update public.crm_quote_versions set response=p_response,response_note=trim(coalesce(p_note,'')),responded_at=now() where id=v.id;
 return jsonb_build_object('response',p_response);
end $$;
create or replace function public.crm_respond_quote(p_token uuid,p_response text,p_note text) returns jsonb language sql security invoker set search_path='' as $$select crm_private.respond_quote(p_token,p_response,p_note)$$;
revoke all on function crm_private.shared_quote(uuid),public.crm_shared_quote(uuid),crm_private.respond_quote(uuid,text,text),public.crm_respond_quote(uuid,text,text) from public,anon,authenticated;
grant execute on function crm_private.shared_quote(uuid),public.crm_shared_quote(uuid),crm_private.respond_quote(uuid,text,text),public.crm_respond_quote(uuid,text,text) to anon,authenticated;
notify pgrst,'reload schema';
