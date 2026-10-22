-- Education records are isolated from business cards and are never exposed to browser roles.
create schema if not exists education;
revoke all on schema education from public,anon,authenticated;
grant usage on schema education to service_role;
create table education.institutions(id text primary key,name text not null,owner text not null,data text not null,revision integer not null default 0,created text not null,slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
create table education.memberships(id text primary key,tenant_id text not null references education.institutions(id),user_id text not null,email text not null,role text not null check(role in ('admin','teacher','student','parent')),student_id text,name text not null,unique(tenant_id,user_id));
create index education_member_user on education.memberships(user_id);
create index education_member_email on education.memberships(lower(email));
create index education_owner on education.institutions(owner);
create table education.invitations(id text primary key,tenant_id text not null references education.institutions(id),email text not null,role text not null check(role in ('teacher','student','parent')),student_id text,expires bigint not null,used_by text,created text not null);
create index education_invite_tenant on education.invitations(tenant_id);
create table education.attempts(id text primary key,tenant_id text not null references education.institutions(id),user_id text not null,student_id text not null,exam_id text not null,questions text not null,answers text not null,expires bigint not null,finished integer not null default 0,penalty integer not null default 0,title text not null);
create unique index education_one_active_attempt on education.attempts(tenant_id,user_id) where finished=0;
create table education.media_assets(id text primary key,tenant_id text not null references education.institutions(id),kind text not null,subject_id text not null,object_key text not null,mime text not null,updated text not null,unique(tenant_id,kind,subject_id));
create table education.blob_objects(key text primary key,data text not null);
alter table education.institutions enable row level security;
revoke all on education.institutions from public,anon,authenticated;
grant select,insert,update,delete on education.institutions to service_role;
alter table education.memberships enable row level security;
revoke all on education.memberships from public,anon,authenticated;
grant select,insert,update,delete on education.memberships to service_role;
alter table education.invitations enable row level security;
revoke all on education.invitations from public,anon,authenticated;
grant select,insert,update,delete on education.invitations to service_role;
alter table education.attempts enable row level security;
revoke all on education.attempts from public,anon,authenticated;
grant select,insert,update,delete on education.attempts to service_role;
alter table education.media_assets enable row level security;
revoke all on education.media_assets from public,anon,authenticated;
grant select,insert,update,delete on education.media_assets to service_role;
alter table education.blob_objects enable row level security;
revoke all on education.blob_objects from public,anon,authenticated;
grant select,insert,update,delete on education.blob_objects to service_role;

-- Only the verified-user Edge Function may run these fixed, parameterized statements.
create or replace function public.education_query(statements jsonb) returns jsonb
language plpgsql security invoker set search_path=education,pg_temp as $fn$
declare item jsonb; template text; parts text[]; args jsonb; query text; idx integer; n bigint:=0; rows jsonb; result jsonb:='[]';
begin
 if jsonb_typeof(statements)<>'array' or jsonb_array_length(statements)>20 then raise exception 'Invalid batch';end if;
 for item in select value from jsonb_array_elements(statements) loop
  template:=item->>'sql'; args:=item->'args';
  if not(template=any(array['DELETE FROM blob_objects WHERE key=?','DELETE FROM invitations WHERE id=? AND tenant_id=? AND used_by IS NULL','DELETE FROM media_assets WHERE id=? AND object_key=?','DELETE FROM memberships WHERE id=? AND tenant_id=?','INSERT INTO attempts(id,tenant_id,user_id,student_id,exam_id,questions,answers,expires,finished,penalty,title) VALUES(?,?,?,?,?,?,?,?,0,?,?)','INSERT INTO blob_objects(key,data) VALUES(?,?)','INSERT INTO institutions(id,name,owner,data,revision,created,slug) VALUES(?,?,?,?,0,?,?)','INSERT INTO invitations(id,tenant_id,email,role,student_id,expires,used_by,created) SELECT ?,?,?,?,?,?,NULL,? WHERE changes()=1','INSERT INTO invitations(id,tenant_id,email,role,student_id,expires,used_by,created) VALUES(?,?,?,?,?,?,NULL,?)','INSERT INTO media_assets(id,tenant_id,kind,subject_id,object_key,mime,updated) VALUES(?,?,?,?,?,?,?)','INSERT INTO memberships(id,tenant_id,user_id,email,role,student_id,name) SELECT ?,tenant_id,?,email,role,student_id,? FROM invitations WHERE id=? AND used_by IS NULL AND expires>?','INSERT INTO memberships(id,tenant_id,user_id,email,role,student_id,name) VALUES(?,?,?,?,?,NULL,?)','SELECT * FROM attempts WHERE id=? AND tenant_id=? AND user_id=?','SELECT * FROM attempts WHERE id=? AND tenant_id=? AND user_id=? AND finished=0','SELECT * FROM attempts WHERE tenant_id=? AND user_id=? AND finished=0 LIMIT 1','SELECT * FROM attempts WHERE tenant_id=? AND user_id=? AND finished=0 ORDER BY expires DESC LIMIT 1','SELECT * FROM institutions WHERE id=?','SELECT * FROM invitations WHERE id=? AND used_by IS NULL AND expires>?','SELECT * FROM media_assets WHERE id=? AND tenant_id=?','SELECT * FROM media_assets WHERE tenant_id=? AND kind=? AND subject_id=?','SELECT * FROM memberships WHERE tenant_id=? AND id=?','SELECT * FROM memberships WHERE tenant_id=? AND user_id=?','SELECT COUNT(*) AS n FROM institutions WHERE owner=?','SELECT COUNT(*) AS n FROM invitations WHERE tenant_id=? AND used_by IS NULL AND expires>?','SELECT a.id,a.kind,a.subject_id,a.updated,a.object_key,a.mime,m.email FROM media_assets a LEFT JOIN memberships m ON m.id=a.subject_id AND m.tenant_id=a.tenant_id WHERE a.tenant_id=?','SELECT data FROM blob_objects WHERE key=?','SELECT id FROM institutions WHERE slug=?','SELECT id FROM memberships WHERE tenant_id=? AND email=?','SELECT id FROM memberships WHERE tenant_id=? AND user_id=?','SELECT id,email,role,student_id,expires FROM invitations WHERE tenant_id=? AND used_by IS NULL AND expires>?','SELECT id,name,slug FROM institutions WHERE slug=?','SELECT id,user_id,email,role,student_id,name FROM memberships WHERE tenant_id=?','SELECT m.tenant_id,m.role,m.student_id,i.name,i.slug FROM memberships m JOIN institutions i ON i.id=m.tenant_id WHERE m.user_id=? ORDER BY i.created','UPDATE attempts SET answers=? WHERE id=? AND tenant_id=? AND user_id=? AND finished=0 AND answers=? AND expires>?','UPDATE attempts SET finished=1 WHERE id=? AND tenant_id=?','UPDATE institutions SET data=?,name=?,revision=revision+1 WHERE id=? AND revision=?','UPDATE institutions SET data=?,revision=revision+1 WHERE id=? AND revision=?','UPDATE invitations SET used_by=? WHERE id=? AND used_by IS NULL','UPDATE media_assets SET object_key=?,mime=?,updated=? WHERE id=? AND object_key=?'])) then raise exception 'Query not allowed';end if;
  parts:=string_to_array(template,'?');
  if jsonb_array_length(args)<>array_length(parts,1)-1 then raise exception 'Argument mismatch';end if;
  query:=parts[1];
  for idx in 2..array_length(parts,1) loop
   query:=query || quote_nullable(args->>(idx-2)) || parts[idx];
  end loop;
  query:=replace(query,'changes()',n::text);
  if template like 'SELECT %' then
   execute 'SELECT coalesce(jsonb_agg(to_jsonb(row)),''[]''::jsonb) FROM ('||query||') row' into rows;
   n:=jsonb_array_length(rows);
  else
   execute query; get diagnostics n=row_count;rows:='[]';
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('results',rows,'meta',jsonb_build_object('changes',n)));
 end loop;
 return result;
end $fn$;
revoke all on function public.education_query(jsonb) from public,anon,authenticated;
grant execute on function public.education_query(jsonb) to service_role;

-- Verified email links migrated memberships. User-editable metadata never grants a role.
create or replace function education.link_identity(p_user uuid,p_email text,p_session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,pg_temp as $fn$
declare member record;
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then raise exception 'Session expired';end if;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=lower(p_email) and email_confirmed_at is not null) then raise exception 'Email not verified';end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),0));
 for member in select * from education.memberships where lower(email)=lower(p_email) and user_id<>p_user::text for update loop
  if not exists(select 1 from education.memberships where tenant_id=member.tenant_id and user_id=p_user::text) then
   update education.institutions set owner=p_user::text where id=member.tenant_id and owner=member.user_id and member.role='admin';
   update education.attempts set user_id=p_user::text where tenant_id=member.tenant_id and user_id=member.user_id;
   update education.memberships set user_id=p_user::text where id=member.id;
  end if;
 end loop;
 return true;
end $fn$;
revoke all on function education.link_identity(uuid,text,uuid) from public,anon,authenticated;
grant execute on function education.link_identity(uuid,text,uuid) to service_role;
create or replace function public.education_link_identity(p_user uuid,p_email text,p_session uuid) returns boolean
language sql security invoker set search_path=education,pg_temp as $fn$ select education.link_identity(p_user,p_email,p_session); $fn$;
revoke all on function public.education_link_identity(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.education_link_identity(uuid,text,uuid) to service_role;
