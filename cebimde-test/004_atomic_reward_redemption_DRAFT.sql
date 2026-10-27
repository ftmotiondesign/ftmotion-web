-- DRAFT ONLY: run in disposable test database after 002 schema.
-- Server must validate the caller JWT and pass the verified owner id.
-- The private schema is NOT exposed to the browser Data API.
create or replace function cebimde_loyalty.redeem_reward(
 p_membership_id uuid, p_verified_owner_id uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 v_program record;
 v_visits bigint;
 v_redeemed bigint;
 v_redemption_id uuid;
begin
 if p_membership_id is null or p_verified_owner_id is null then
   raise exception 'Invalid request';
 end if;
 -- Serialize all redemptions for a membership.
 perform 1 from cebimde_loyalty.memberships
 where id = p_membership_id for update;
 if not found then raise exception 'Membership not found'; end if;
 select p.business_id,p.visits_per_reward into v_program
 from cebimde_loyalty.memberships m
 join cebimde_loyalty.programs p on p.id=m.program_id
 join public.businesses b on b.id=p.business_id
 join cebimde_loyalty.entitlements e on e.business_id=b.id
 where m.id=p_membership_id and b.owner_id=p_verified_owner_id
   and b.active and p.active and e.loyalty_enabled
   and (e.starts_at is null or e.starts_at<=now())
   and (e.expires_at is null or e.expires_at>now());
 if not found then raise exception 'Not authorized'; end if;
 select count(*) filter(where event_type='visit'),
        count(*) filter(where event_type='reward_redeemed')
 into v_visits,v_redeemed
 from cebimde_loyalty.ledger where membership_id=p_membership_id;
 if v_visits / v_program.visits_per_reward <= v_redeemed then
   raise exception 'No reward available';
 end if;
 insert into cebimde_loyalty.ledger
 (membership_id,actor_user_id,event_type,units,note)
 values(p_membership_id,p_verified_owner_id,'reward_redeemed',1,'Business-confirmed reward delivery')
 returning id into v_redemption_id;
 return v_redemption_id;
end $$;
revoke all on function cebimde_loyalty.redeem_reward(uuid,uuid)
 from public,anon,authenticated;
-- CRITICAL: visit writes must also serialize on the membership row, or
-- snapshot isolation and concurrent administrative adjustments need further review.
-- Before release, test 2 simultaneous redemptions and reward threshold changes.
