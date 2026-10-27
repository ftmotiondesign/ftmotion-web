// Cebimde Sadakat domain logic. Pure functions, no database or live credentials.
// This module is a testable reference for a future authenticated server endpoint.
export function earnedRewards(visits, threshold = 10) {
  if (!Number.isSafeInteger(visits) || visits < 0) throw new Error("Invalid visits");
  if (!Number.isSafeInteger(threshold) || threshold < 2 || threshold > 100) throw new Error("Invalid threshold");
  return Math.floor(visits / threshold);
}
export function balanceFromLedger(events, threshold = 10) {
  let visits = 0, redeemed = 0, points = 0;
  const tokenIds = new Set();
  for (const e of events) {
    if (!Number.isSafeInteger(e.units) || e.units === 0) throw new Error("Invalid ledger units");
    if (e.event_type === "visit") {
      if (e.units !== 1 || !e.token_id || tokenIds.has(e.token_id)) throw new Error("Invalid or duplicate visit");
      tokenIds.add(e.token_id);
      visits++;
    } else if (e.event_type === "reward_redeemed") {
      if (e.units !== 1) throw new Error("Invalid redemption");
      redeemed++;
      if (redeemed > earnedRewards(visits, threshold)) throw new Error("Reward overdraft");
    } else if (e.event_type === "points_earned" || e.event_type === "points_spent") {
      const delta = e.event_type === "points_earned" ? e.units : -e.units;
      if (e.units < 1) throw new Error("Invalid points");
      points += delta;
      if (points < 0) throw new Error("Points overdraft");
    }
  }
  return { visits, rewardsEarned: earnedRewards(visits, threshold), rewardsRedeemed: redeemed,
    rewardsAvailable: earnedRewards(visits, threshold) - redeemed, points };
}
export function tokenIsValid({ expires_at, consumed_at }, now = Date.now()) {
  return !consumed_at && Number.isFinite(Date.parse(expires_at)) && Date.parse(expires_at) > now;
}
// IMPORTANT: These helpers are NOT authorization. Production MUST perform atomic
// token consumption and ledger writes in a transaction on the server, after
// verifying the authenticated business owner, active entitlement and membership.
// Never accept arbitrary business_id/customer_id or visit count from the browser.
