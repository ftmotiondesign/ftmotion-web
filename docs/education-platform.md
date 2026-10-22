# FTMotion Eğitim

- Entry: https://ftmotion.com/egitim-uygulama
- Pilot: https://ftmotion.com/tek-secenek-akademi
- Authentication: Supabase email/password, verified email, dedicated `ftmotion-education-session-v1` browser session. Business-card sessions use their existing storage.
- Backend: Supabase Edge Function `education-api`, with server-side user/session verification, membership authorization and a private `education` schema. The browser cannot execute the database RPCs. Public resolve/manifest routes expose only institution name, slug and app metadata.
- Existing institution, membership and invitation were copied server-to-server. The private transfer payload and credentials are not in this repository. Verified email links the imported membership on first login.
- Slugs stay stable if the institution is renamed. Reserved platform paths and duplicate institution names receive a suffix. QR and `/k/` handling in `404.html` is retained. Known pilot links have a real static directory; newly created slugs use the Pages fallback.
- Auth confirmation/recovery redirects should allow `https://ftmotion.com/egitim-uygulama/**`. These settings are managed in Supabase Auth URL Configuration. Auth email is enabled and confirmation remains required. SMTP delivery and an actual user's password login require end-user verification.
- `egitim-uygulama/vendor/supabase-2.118.0.js` is the pinned browser bundle from `@supabase/supabase-js` 2.118.0 (MIT).

## Tests

Run `npm install` inside `tests/education`, then `npm test`. `tests/education/security.sql` checks the deployed database boundaries inside a rolled-back transaction. The API integration tests use an isolated in-memory database and cover role scoping, invitations, concurrent revision checks, exams, answers, grading and media.

## Deployment

GitHub Pages serves the static files. Deploy the versioned files in `supabase/functions/education-api` to the existing `ftmotion` project. JWT verification is performed inside the function with Auth `getUser` and a live server session check; gateway JWT verification is disabled to support that path and the narrow public slug/manifest endpoints. Runtime service credentials are provided by Supabase and never shipped to browsers.
