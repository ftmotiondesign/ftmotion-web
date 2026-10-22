-- Run against the connected project. All fixture changes are rolled back.
begin;
create function pg_temp.assert_true(ok boolean,description text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',description; end if; end$$;
create function pg_temp.assert_denied(command text) returns void language plpgsql as $$begin execute command;raise exception 'Expected access denial';exception when insufficient_privilege then return;end$$;
select set_config('test.owner',(select owner_id::text from public.businesses where owner_id is not null and owner_id not in (select user_id from public.admin_users) limit 1),true);
select pg_temp.assert_true(current_setting('test.owner')<>'','non-admin fixture owner available');
select set_config('test.business',gen_random_uuid()::text,true),set_config('test.customer',gen_random_uuid()::text,true),set_config('test.payment',gen_random_uuid()::text,true);
insert into public.businesses(id,owner_id,name,slug,active) values(current_setting('test.business')::uuid,current_setting('test.owner')::uuid,'CRM rollback test','crm-test-'||current_setting('test.business'),false);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
insert into public.crm_customers(id,business_id,name,phone) values(current_setting('test.customer')::uuid,current_setting('test.business')::uuid,'Test Customer','05000000000');
insert into public.crm_notes(business_id,customer_id,body) values(current_setting('test.business')::uuid,current_setting('test.customer')::uuid,'PRIVATE_NOT_TO_SHARE');
select set_config('test.version',public.crm_issue_quote(current_setting('test.business')::uuid,current_setting('test.customer')::uuid,null,jsonb_build_object('title','4 Kamera Montaj','valid_until',current_date+15,'items',jsonb_build_array(jsonb_build_object('name','Kamera ve montaj','quantity',1,'unit_price_cents',1800000))),0)::text,true);
select set_config('test.quote',quote_id::text,true),set_config('test.token',share_token::text,true) from public.crm_quote_versions where id=current_setting('test.version')::uuid;
select pg_temp.assert_true((select total_cents=1800000 from public.crm_quote_versions where id=current_setting('test.version')::uuid),'server total is 18000 TL');
select public.crm_record_payment(current_setting('test.quote')::uuid,500000,current_date,'Havale','PRIVATE_PAYMENT_MEMO',current_setting('test.payment')::uuid);
select public.crm_record_payment(current_setting('test.quote')::uuid,500000,current_date,'Havale','PRIVATE_PAYMENT_MEMO',current_setting('test.payment')::uuid);
select pg_temp.assert_true((select count(*)=1 and sum(amount_cents)=500000 from public.crm_payments where quote_id=current_setting('test.quote')::uuid),'payment retry is idempotent');
select pg_temp.assert_denied('update public.crm_quote_versions set document=''{}'' where id='''||current_setting('test.version')||'''');
select pg_temp.assert_denied('delete from public.crm_payments where id='''||current_setting('test.payment')||'''');
do $$begin
 begin perform public.crm_record_payment(current_setting('test.quote')::uuid,1300001,current_date,'Nakit','',gen_random_uuid());raise exception 'FAIL: overpayment allowed';exception when raise_exception then if sqlerrm like 'FAIL:%' then raise;end if;end;
end$$;
-- Anonymous recipient cannot enumerate tables, but can read one issued token.
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_denied('select * from public.crm_customers');
select pg_temp.assert_denied('select * from public.crm_quote_versions');
select pg_temp.assert_denied('select * from public.crm_payments');
select pg_temp.assert_true(public.crm_shared_quote(gen_random_uuid()) is null,'random share token returns no document');
select pg_temp.assert_true(public.crm_shared_quote(current_setting('test.token')::uuid)->'document'->>'title'='4 Kamera Montaj','valid token reads issued document');
select pg_temp.assert_true(public.crm_shared_quote(current_setting('test.token')::uuid)::text not like '%PRIVATE_%','no private notes or payment memos leak');
select public.crm_respond_quote(current_setting('test.token')::uuid,'accepted','Tamam');
select pg_temp.assert_true(public.crm_shared_quote(current_setting('test.token')::uuid)->>'response'='accepted','recipient response persisted');
-- A different signed-in account cannot list or write this business data.
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.crm_customers where business_id=current_setting('test.business')::uuid),'other owner cannot read customer');
select pg_temp.assert_true((select count(*)=0 from public.crm_notes where business_id=current_setting('test.business')::uuid),'other owner cannot read notes');
select pg_temp.assert_true((select count(*)=0 from public.crm_quotes where business_id=current_setting('test.business')::uuid),'other owner cannot read quotes');
select pg_temp.assert_true((select count(*)=0 from public.crm_payments where business_id=current_setting('test.business')::uuid),'other owner cannot read payments');
select pg_temp.assert_denied('insert into public.crm_customers(business_id,name) values('''||current_setting('test.business')||''',''Intruder'')');
do $$begin
 begin perform public.crm_issue_quote(current_setting('test.business')::uuid,current_setting('test.customer')::uuid,null,jsonb_build_object('title','Intruder'),0);raise exception 'FAIL: unauthorized quote allowed';exception when raise_exception then if sqlerrm like 'FAIL:%' then raise;end if;end;
end$$;
-- Revision creates a fresh document; old content and acceptance remain intact.
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
select set_config('test.new_version',public.crm_issue_quote(current_setting('test.business')::uuid,current_setting('test.customer')::uuid,current_setting('test.quote')::uuid,jsonb_build_object('title','6 Kamera Montaj','valid_until',current_date+15,'items',jsonb_build_array(jsonb_build_object('name','Kamera ve montaj','quantity',1,'unit_price_cents',2200000))),1)::text,true);
select pg_temp.assert_true((select document->>'title'='4 Kamera Montaj' and response='accepted' from public.crm_quote_versions where id=current_setting('test.version')::uuid),'original document immutable');
select pg_temp.assert_true((select revision=2 and response is null from public.crm_quote_versions where id=current_setting('test.new_version')::uuid),'revision requires new response');
do $$begin
 begin perform public.crm_issue_quote(current_setting('test.business')::uuid,current_setting('test.customer')::uuid,current_setting('test.quote')::uuid,jsonb_build_object('title','Stale Edit','valid_until',current_date+15,'items',jsonb_build_array(jsonb_build_object('name','Test','quantity',1,'unit_price_cents',2200000))),1);raise exception 'FAIL: stale edit allowed';exception when raise_exception then if sqlerrm like 'FAIL:%' then raise;end if;end;
end$$;
update public.crm_quotes set share_enabled=false where id=current_setting('test.quote')::uuid;
select pg_temp.assert_true(public.crm_shared_quote(current_setting('test.token')::uuid) is null,'revoked token returns no document');
rollback;
select 'PASS: ownership, immutable revisions, bearer sharing, customer response, payment retry and overpayment checks. Fixtures rolled back.' as result;
