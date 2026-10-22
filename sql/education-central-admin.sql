-- FTMotion central education oversight. Existing platform admins only.
create table if not exists education.platform_tracking (
 tenant_id text primary key references education.institutions(id) on delete cascade,
 status text not null default 'new' check(status in ('new','trial','active','followup','archived')),
 plan text not null default '' check(length(plan)<=100),
 renewal_date date, notes text not null default '' check(length(notes)<=4000),
 updated_at timestamptz not null default now(), updated_by uuid,
 revision integer not null default 0
);
alter table education.platform_tracking enable row level security;
create table if not exists education.platform_audit (
 id bigint generated always as identity primary key,
 tenant_id text not null references education.institutions(id) on delete cascade,
 actor uuid not null, created_at timestamptz not null default now(),
 summary text not null
);
alter table education.platform_audit enable row level security;
create index if not exists platform_audit_tenant_created_idx on education.platform_audit(tenant_id,created_at desc);
revoke all on education.platform_tracking,education.platform_audit from public,anon,authenticated;

create or replace function public.education_platform_admin(p_action text default 'overview',p_tenant text default null,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_claims jsonb:=auth.jwt(); v_result jsonb; v_before education.platform_tracking%rowtype; v_status text;
begin
 if v_user is null or not exists(select 1 from public.admin_users where user_id=v_user)
 or not exists(select 1 from auth.sessions where user_id=v_user and id::text=v_claims->>'session_id') then
  raise exception 'Bu panel yalnızca FTMotion yöneticisine açıktır.' using errcode='42501';
 end if;
 if p_action not in ('overview','detail','save') then raise exception 'Geçersiz işlem.';end if;
 if p_action in ('detail','save') and not exists(select 1 from education.institutions where id=p_tenant) then raise exception 'Kurum bulunamadı.';end if;
 if p_action='save' then
  if jsonb_typeof(p_data)<>'object' then raise exception 'Geçersiz kayıt.';end if;
  v_status:=p_data->>'status';
  if v_status is null or v_status not in ('new','trial','active','followup','archived') or length(coalesce(p_data->>'notes',''))>4000 or length(coalesce(p_data->>'plan',''))>100 then raise exception 'Takip bilgileri geçersiz.';end if;
  -- Serialize first saves too, and reject stale browser revisions.
  perform 1 from education.institutions where id=p_tenant for update;
  select * into v_before from education.platform_tracking where tenant_id=p_tenant;
  if coalesce(v_before.revision,0)<>coalesce((p_data->>'revision')::integer,-1) then raise exception 'Kayıt başka bir oturumda değişti. Yenileyin.' using errcode='40001';end if;
  insert into education.platform_tracking(tenant_id,status,plan,renewal_date,notes,updated_at,updated_by,revision)
  values(p_tenant,v_status,coalesce(p_data->>'plan',''),nullif(p_data->>'renewal_date','')::date,coalesce(p_data->>'notes',''),now(),v_user,1)
  on conflict(tenant_id) do update set status=excluded.status,plan=excluded.plan,renewal_date=excluded.renewal_date,notes=excluded.notes,updated_at=now(),updated_by=v_user,revision=education.platform_tracking.revision+1;
  insert into education.platform_audit(tenant_id,actor,summary) values(p_tenant,v_user,'Kurum takip bilgileri güncellendi');
 end if;
 if p_action='overview' then
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created desc),'[]'::jsonb) into v_result from (
   select i.id,i.name,i.slug,i.created,i.revision,
   coalesce(t.status,'new') as status,coalesce(t.plan,'') as plan,t.renewal_date,t.updated_at,
   (select m.email from education.memberships m where m.tenant_id=i.id and m.user_id=i.owner limit 1) as owner_email,
   jsonb_array_length(coalesce(i.data::jsonb->'students','[]')) as students,
   jsonb_array_length(coalesce(i.data::jsonb->'exams','[]')) as exams,
   jsonb_array_length(coalesce(i.data::jsonb->'questions','[]')) as questions,
   jsonb_array_length(coalesce(i.data::jsonb->'results','[]')) as results,
   (select count(*) from education.memberships m where m.tenant_id=i.id) as members,
   (select count(*) from education.memberships m where m.tenant_id=i.id and m.role='teacher') as teachers,
   (select count(*) from education.memberships m where m.tenant_id=i.id and m.role='parent') as parents,
   (select count(*) from education.invitations n where n.tenant_id=i.id and n.used_by is null and n.expires>extract(epoch from now())*1000) as pending_invites
   from education.institutions i left join education.platform_tracking t on t.tenant_id=i.id
  ) r;
  return jsonb_build_object('institutions',v_result,'updated_at',now());
 end if;
 select jsonb_build_object(
  'tracking',coalesce((select to_jsonb(t) from education.platform_tracking t where tenant_id=p_tenant),jsonb_build_object('status','new','plan','','notes','','renewal_date',null,'revision',0)),
  'members',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'email',m.email,'role',m.role) order by m.role,m.name) from education.memberships m where m.tenant_id=p_tenant),'[]'::jsonb),
  'invitations',coalesce((select jsonb_agg(jsonb_build_object('email',n.email,'role',n.role,'created',n.created,'expires',n.expires,'state',case when n.used_by is not null then 'used' when n.expires<extract(epoch from now())*1000 then 'expired' else 'pending' end) order by n.created desc) from (select * from education.invitations where tenant_id=p_tenant order by created desc limit 100) n),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select summary,created_at from education.platform_audit where tenant_id=p_tenant order by created_at desc limit 30) a),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.education_platform_admin(text,text,jsonb) from public,anon;
grant execute on function public.education_platform_admin(text,text,jsonb) to authenticated;
comment on function public.education_platform_admin(text,text,jsonb) is 'Existing FTMotion admins, live Auth session required. Aggregated education oversight and commercial follow-up only; no role grants or tenant impersonation.';
