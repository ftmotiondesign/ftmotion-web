# QR + Cebimde analytics (development branch)

This branch contains the **initial tracking foundation**, not a deployed dashboard.

1. Review and execute `supabase/analytics.sql` in the correct Supabase project.
2. Load `/assets/ftm-analytics.js` in QR and Cebimde pages only after inspecting their actual event handlers.
3. Call `FTMAnalytics.track(db,{businessKey:b.id,source:'qr',eventType:'view'})` after successful business load; call with `eventType:'click',target:'whatsapp'` on a real action.
4. For Cebimde use `source:'cebimde'` and stable shared business identifiers; deduplicate DijiyeSor and QR records using an explicit mapping table.
5. Before production: rate-limit the public RPC at the edge, add bot filtering, consent/privacy notices as needed, secure aggregated reporting RPCs using existing ownership functions, and test mobile + desktop.

**Security:** Event table has RLS enabled, no direct public read permissions. The insert RPC is public and thus susceptible to fake events until rate limiting is added. Do not treat numbers as verified traffic before anti-abuse measures are deployed.


## 2026-10-16: Supabase production configuration verified by SQL Editor screenshots
The user created `public.ftm_analytics_events` with UUID `id`, text `business_key`, `source`, `event_type`, nullable `target` and `visitor_hash`, and timestamptz `occurred_at`. The user created `ftm_track_event(text,text,text,text,text)` as a SECURITY DEFINER SQL function that accepts active UUID businesses and only sources `qr` / `cebimde`, types `view` / `click` / `save`. EXECUTE granted to anon and authenticated. User created `ftm_analytics_summary(uuid,integer)` restricted to business owner by `auth.uid()` and granted to authenticated. One manual test row was inserted, verified and then deleted.

**IMPORTANT:** `supabase/analytics.sql` was drafted earlier and DOES NOT MATCH the live database: it uses bigint identity IDs and a less restrictive RPC. Do NOT run it on the existing database or use it to overwrite the current RPCs. Treat it as historical proposal only. Do not merge this PR until schema is reconciled and security is tested.

The browser analytics helper now rejects non-UUID business keys, and unsupported event types/sources. Therefore DijiyeSor-only IDs are NOT logged to the QR analytics table; business mapping remains future work.

Production risks to resolve before merging: anonymous callers can fabricate unlimited events (rate limiting / anti-bot needed); visitor IDs are browser-local and unique counts are approximate; 3650-day filter is not truly all-time; member ownership RPC must be tested from a real authenticated account, and owner-only access tested with another account; `cebimde-test` needs actual user click verification.
