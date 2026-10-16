# QR + Cebimde analytics (development branch)

This branch contains the **initial tracking foundation**, not a deployed dashboard.

1. Review and execute `supabase/analytics.sql` in the correct Supabase project.
2. Load `/assets/ftm-analytics.js` in QR and Cebimde pages only after inspecting their actual event handlers.
3. Call `FTMAnalytics.track(db,{businessKey:b.id,source:'qr',eventType:'view'})` after successful business load; call with `eventType:'click',target:'whatsapp'` on a real action.
4. For Cebimde use `source:'cebimde'` and stable shared business identifiers; deduplicate DijiyeSor and QR records using an explicit mapping table.
5. Before production: rate-limit the public RPC at the edge, add bot filtering, consent/privacy notices as needed, secure aggregated reporting RPCs using existing ownership functions, and test mobile + desktop.

**Security:** Event table has RLS enabled, no direct public read permissions. The insert RPC is public and thus susceptible to fake events until rate limiting is added. Do not treat numbers as verified traffic before anti-abuse measures are deployed.
