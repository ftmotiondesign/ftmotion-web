// Deno Supabase Edge Function draft — NOT deployed.
// Endpoint: POST /loyalty-confirm-visit
// Secrets (server only): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Security: validate the JWT using auth.getUser; never trust a user ID in the body.
// Database access requires a private-schema RPC made through the server-only client.
// The private schema MUST be exposed to the service-only API or the SQL function
// invoked through a trusted server DB connection. Do not expose private RPC publicly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
Deno.serve(async (request) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const fail = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), { status, headers });
  if (request.method !== "POST") return fail(405, "Method not allowed");
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(authHeader)) return fail(401, "Authentication required");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return fail(503, "Not configured");
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: userData, error: userError } =
    await auth.auth.getUser(authHeader.replace(/^Bearer\s+/,""));
  if (userError || !userData.user) return fail(401, "Invalid session");
  let body: unknown;
  try { body = await request.json(); } catch { return fail(400, "Invalid JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Invalid body");
  const token = (body as Record<string, unknown>).token;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{22,256}$/.test(token))
    return fail(400, "Invalid token");
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  // BLOCKED until private-schema access is securely configured and isolated DB tests pass.
  // The SQL function expects the authenticated owner ID, derived above from getUser().
  // Never enable without server-side verification of schema exposure and privileges.
  void admin; void hash;
  return fail(503, "Visit confirmation not enabled until database integration tests pass");
});
