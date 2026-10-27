-- DRAFT ONLY. Never run on production without backup/review.
-- Apply after 002_loyalty_private_schema_DRAFT.sql, in isolated test database.
-- Atomically consume customer token and record exactly one visit.
-- Only a trusted server holding service_role may invoke this function.
-- The caller must supply verified auth user ID from server JWT, NEVER browser-supplied user ID.
create or replace function cebimde_loyalty.confirm_visit(
  p_token_hash text,
  p_verified_owner_id uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 v_token record;
 v_visit_id uuid;
begin
 if p_token_hash is null or length(p_token_hash) <> 64
    or p_token_hash !~ '^[0-9a-f]{64}$' or p_verified_owner_id is null then
   raise exception 'Invalid request';
 end if;
 select t.id as token_id, t.consumed_at, t.expires_at,
        m.id as membership_id, p.business_id
 into v_token
 from cebimde_loyalty.visit_tokens t
 join cebimde_loyalty.memberships m on m.id=t.membership_id
 join cebimde_loyalty.programs p on p.id=m.program_id
 where t.token_hash=p_token_hash
 for update of t;
 if not found or v_token.consumed_at is not null or v_token.expires_at <= now() then
   raise exception 'Token invalid or expired';
 end if;
 if not exists (
   select 1 from public.businesses b
   join cebimde_loyalty.entitlements e on e.business_id=b.id
   join cebimde_loyalty.programs p on p.business_id=b.id
   where b.id=v_token.business_id and b.owner_id=p_verified_owner_id
   and b.active and p.active and e.loyalty_enabled
   and (e.starts_at is null or e.starts_at<=now())
   and (e.expires_at is null or e.expires_at>now())
 ) then
   raise exception 'Not authorized';
 end if;
 update cebimde_loyalty.visit_tokens set consumed_at=now() where id=v_token.token_id;
 insert into cebimde_loyalty.ledger(membership_id,actor_user_id,event_type,units,token_id)
 values(v_token.membership_id,p_verified_owner_id,'visit',1,v_token.token_id)
 returning id into v_visit_id;
 return v_visit_id;
end $$;
revoke all on function cebimde_loyalty.confirm_visit(text,uuid) from public,anon,authenticated;
-- NOTE: SECURITY INVOKER runs under caller role. Test with service_role only.
-- Server MUST independently verify p_verified_owner_id against the authenticated JWT.
