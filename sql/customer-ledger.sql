-- Müşteri ve Teklif Defterim. Additive schema; no changes to existing card data.
create schema if not exists crm_private;
revoke all on schema crm_private from public;
grant usage on schema crm_private to authenticated, anon;

create table public.crm_customers (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 name text not null check(length(trim(name)) between 2 and 150),
 phone text not null default '' check(length(phone)<=30),
 email text not null default '' check(length(email)<=254),
 address text not null default '' check(length(address)<=1000),
 created_at timestamptz not null default now(),
 unique(id,business_id)
);
create index crm_customers_business on public.crm_customers(business_id,created_at desc);
create table public.crm_notes (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 customer_id uuid not null,
 body text not null check(length(trim(body)) between 1 and 5000),
 remind_on date,
 done boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key(customer_id,business_id) references public.crm_customers(id,business_id)
);
create index crm_notes_customer on public.crm_notes(customer_id,business_id,created_at desc);
create index crm_notes_reminder on public.crm_notes(business_id,remind_on) where not done;
create table public.crm_quotes (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 customer_id uuid not null,
 current_revision integer not null default 0,
 share_enabled boolean not null default true,
 work_status text not null default 'waiting' check(work_status in ('waiting','progress','completed')),
 created_at timestamptz not null default now(),
 unique(id,business_id),
 foreign key(customer_id,business_id) references public.crm_customers(id,business_id)
);
create index crm_quotes_customer on public.crm_quotes(customer_id,business_id,created_at desc);
create index crm_quotes_business on public.crm_quotes(business_id,created_at desc);
create table public.crm_quote_versions (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null,
 business_id uuid not null,
 revision integer not null check(revision>0),
 document jsonb not null,
 total_cents bigint not null check(total_cents between 0 and 1000000000000),
 share_token uuid not null unique default gen_random_uuid(),
 share_expires_at timestamptz not null default (now()+interval '90 days'),
 valid_until date not null,
 response text check(response in ('accepted','changes')),
 response_note text check(length(response_note)<=2000),
 responded_at timestamptz,
 created_at timestamptz not null default now(),
 unique(quote_id,revision),
 foreign key(quote_id,business_id) references public.crm_quotes(id,business_id)
);
create index crm_versions_business on public.crm_quote_versions(business_id);
create table public.crm_payments (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 quote_id uuid not null,
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000),
 paid_on date not null default current_date,
 method text not null default 'Havale' check(length(method)<=50),
 memo text not null default '' check(length(memo)<=1000),
 created_at timestamptz not null default now(),
 foreign key(quote_id,business_id) references public.crm_quotes(id,business_id)
);
create index crm_payments_quote on public.crm_payments(quote_id,business_id);
create index crm_payments_business on public.crm_payments(business_id,paid_on desc);

-- Each table is owner/admin only. Public recipients use the narrow token RPCs below.
do $policies$
declare t text;
begin
 foreach t in array array['crm_customers','crm_notes','crm_quotes','crm_quote_versions','crm_payments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy crm_owner_access on public.%I for all to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin())))) with check (exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))))',t);
 end loop;
end $policies$;
grant insert,update on public.crm_customers to authenticated;
grant insert,update,delete on public.crm_notes to authenticated;
grant update(share_enabled,work_status) on public.crm_quotes to authenticated;
-- No direct writes to quote versions or payments, even by their owner.

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
 select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id;
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
 select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id;
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
 'payments',coalesce((select jsonb_agg(jsonb_build_object('amount_cents',p.amount_cents,'paid_on',p.paid_on) order by p.paid_on) from public.crm_payments p where p.quote_id=q.id),'[]'::jsonb))
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
