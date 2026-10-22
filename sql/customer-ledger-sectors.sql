-- Sector profiles remain private to the business. Historical documents are snapshots.
create table public.crm_ledger_settings (
 business_id uuid primary key references public.businesses(id),
 sector text not null check(sector in ('general','driving_school','education','wholesale')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.crm_ledger_settings enable row level security;
revoke all on public.crm_ledger_settings from public,anon,authenticated;
grant select,insert,update on public.crm_ledger_settings to authenticated;
create policy crm_settings_owner on public.crm_ledger_settings for all to authenticated
using(exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))))
with check(exists(select 1 from public.businesses b where b.id=business_id and (b.owner_id=(select auth.uid()) or (select public.is_ftm_admin()))));
alter table public.crm_customers add column sector_data jsonb not null default '{}'::jsonb check(jsonb_typeof(sector_data)='object' and octet_length(sector_data::text)<=16000);
create or replace function crm_private.sector_config() returns jsonb language sql immutable security invoker set search_path='' as $config$select '{"general": {"customer": [], "quote": [], "stages": ["new", "contacted", "proposed", "followup", "active", "closed"]}, "driving_school": {"customer": [{"key": "license_class", "label": "Ehliyet sınıfı", "type": "text"}, {"key": "period", "label": "Kayıt / kurs dönemi", "type": "text"}, {"key": "lesson_preference", "label": "Ders tercihi", "type": "select", "options": ["Belirtilmedi", "Hafta içi", "Hafta sonu", "Akşam"]}], "quote": [{"key": "license_class", "label": "Ehliyet sınıfı", "type": "text"}, {"key": "period", "label": "Kurs dönemi", "type": "text"}, {"key": "included_services", "label": "Dahil olan hizmetler", "type": "text"}], "stages": ["new", "contacted", "proposed", "followup", "registered", "closed"]}, "education": {"customer": [{"key": "guardian_name", "label": "Veli adı soyadı", "type": "text"}, {"key": "grade", "label": "Sınıf / seviye", "type": "text"}, {"key": "program", "label": "İlgilenilen eğitim programı", "type": "text"}, {"key": "term", "label": "Eğitim dönemi", "type": "text"}], "quote": [{"key": "grade", "label": "Sınıf / seviye", "type": "text"}, {"key": "program", "label": "Eğitim programı", "type": "text"}, {"key": "term", "label": "Eğitim dönemi", "type": "text"}], "stages": ["new", "contacted", "proposed", "followup", "registered", "closed"]}, "wholesale": {"customer": [{"key": "contact_person", "label": "Yetkili kişi", "type": "text"}, {"key": "city", "label": "İl / ilçe", "type": "text"}, {"key": "payment_terms", "label": "Görüşülen ödeme şartları", "type": "text"}, {"key": "delivery_address", "label": "Teslimat adresi", "type": "textarea"}], "quote": [{"key": "delivery_method", "label": "Teslim şekli", "type": "select", "options": ["Belirlenecek", "Kargo", "Nakliye", "Elden teslim"]}, {"key": "delivery_date", "label": "Planlanan teslim tarihi", "type": "date"}, {"key": "payment_terms", "label": "Ödeme şartları", "type": "text"}], "stages": ["new", "contacted", "proposed", "ordered", "delivered", "followup"]}}'::jsonb$config$;
create or replace function crm_private.validate_sector_data(p_sector text,p_data jsonb,p_kind text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare config jsonb:=crm_private.sector_config(); entry record; descriptor jsonb; allowed boolean; result jsonb:='{}'; value text;
begin
 if p_sector is null or not config ? p_sector or p_kind not in ('customer','quote') or p_kind is null then raise exception 'Sektör bilgisi geçersiz'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Sektör alanları geçersiz'; end if;
 for entry in select * from jsonb_each(p_data) loop
  if jsonb_typeof(entry.value)<>'string' then raise exception 'Sektör alanları metin olmalı'; end if;
  value:=trim(entry.value#>>'{}');
  if length(value)>400 then raise exception 'Sektör alanları en fazla 400 karakter olabilir'; end if;
  if entry.key='stage' and p_kind='customer' then
   if not (config->p_sector->'stages') ? value then raise exception 'Takip aşaması geçersiz'; end if;
  else
   select f into descriptor from jsonb_array_elements(config->p_sector->p_kind) f where f->>'key'=entry.key;
   if not found then raise exception 'Bu sektör için tanımlanmamış alan: %',entry.key; end if;
   if value<>'' and descriptor->>'type'='select' and not (descriptor->'options') ? value then raise exception 'Alan seçeneği geçersiz'; end if;
   if value<>'' and descriptor->>'type'='date' then
    if value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Teslim tarihi geçersiz'; end if;
    perform value::date;
   end if;
  end if;
  result:=result||jsonb_build_object(entry.key,value);
 end loop;
 return result;
end $$;
revoke all on function crm_private.sector_config(),crm_private.validate_sector_data(text,jsonb,text) from public,anon,authenticated;
grant execute on function crm_private.sector_config(),crm_private.validate_sector_data(text,jsonb,text) to authenticated;

create or replace function crm_private.guard_customer_sector_data() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry record; cleaned jsonb:='{}';
begin
 if jsonb_typeof(new.sector_data)<>'object' then raise exception 'Sektör bilgileri geçersiz'; end if;
 for entry in select * from jsonb_each(new.sector_data) loop
  cleaned:=cleaned||jsonb_build_object(entry.key,crm_private.validate_sector_data(entry.key,entry.value,'customer'));
 end loop;
 new.sector_data:=cleaned;return new;
end $$;
revoke all on function crm_private.guard_customer_sector_data() from public,anon,authenticated;
create trigger crm_customer_sector_guard before insert or update of sector_data on public.crm_customers for each row execute function crm_private.guard_customer_sector_data();

-- Invoker RPC uses existing ownership RLS and modifies only the selected sector's JSON path.
create or replace function public.crm_save_sector_customer(p_business uuid,p_customer uuid,p_common jsonb,p_sector text,p_details jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.crm_customers; details jsonb;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
 details:=crm_private.validate_sector_data(p_sector,p_details,'customer');
 if p_customer is null then
  insert into public.crm_customers(business_id,name,phone,email,address,sector_data)
  values(p_business,trim(p_common->>'name'),trim(coalesce(p_common->>'phone','')),trim(coalesce(p_common->>'email','')),trim(coalesce(p_common->>'address','')),jsonb_build_object(p_sector,details)) returning * into result;
 else
  update public.crm_customers c set name=trim(p_common->>'name'),phone=trim(coalesce(p_common->>'phone','')),email=trim(coalesce(p_common->>'email','')),address=trim(coalesce(p_common->>'address','')),sector_data=jsonb_set(c.sector_data,array[p_sector],details,true)
  where c.id=p_customer and c.business_id=p_business returning * into result;
  if not found then raise exception 'Müşteri bulunamadı veya erişiminiz yok'; end if;
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.crm_save_sector_customer(uuid,uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_save_sector_customer(uuid,uuid,jsonb,text,jsonb) to authenticated;

create or replace function crm_private.issue_quote(p_business uuid,p_customer uuid,p_quote uuid,p_input jsonb,p_expected integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.businesses; c public.crm_customers; q public.crm_quotes;
 item jsonb; items jsonb:='[]'; qty numeric; price bigint; line bigint;
 subtotal bigint:=0; discount bigint; tax numeric; total bigint; paid bigint;
 deadline date; local_today date:=(now() at time zone 'Europe/Istanbul')::date; title text; terms text; ver uuid; sector_key text; sector_details jsonb;
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
 if p_quote is not null then
  select coalesce(document->>'sector','general') into sector_key from public.crm_quote_versions where quote_id=q.id and revision=q.current_revision;
 else
  select sector into sector_key from public.crm_ledger_settings where business_id=p_business;
 end if;
 sector_key:=coalesce(p_input->>'sector',sector_key,'general');
 sector_details:=crm_private.validate_sector_data(sector_key,coalesce(p_input->'sector_details','{}'::jsonb),'quote');
 select coalesce(sum(amount_cents),0) into paid from public.crm_payments where quote_id=q.id and voided_at is null;
 if total<paid then raise exception 'Teklif alınan ödemeden düşük olamaz'; end if;
 insert into public.crm_quote_versions(quote_id,business_id,revision,total_cents,valid_until,document)
 values(q.id,p_business,q.current_revision+1,total,deadline,jsonb_build_object(
  'title',title,'terms',terms,'sector',sector_key,'sector_details',sector_details,'currency','TRY','items',items,'subtotal_cents',subtotal,'discount_cents',discount,
  'vat_percent',tax,'vat_cents',round((subtotal-discount)*tax/100),'total_cents',total,
  'business',jsonb_build_object('name',b.name,'phone',b.phone,'email',b.email,'address',b.address,'logo_url',b.logo_url),
  'customer',jsonb_build_object('name',c.name,'phone',c.phone,'email',c.email,'address',c.address)
 )) returning id into ver;
 update public.crm_quotes set current_revision=current_revision+1 where id=q.id;
 return ver;
end $$;


notify pgrst,'reload schema';
