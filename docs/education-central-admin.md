# Education platform oversight

Entry: https://ftmotion.com/egitim-yonetim/ — also linked from the existing management center sidebar as **Eğitim Ana Yönetimi**.

Uses the existing FTMotion website Auth session and existing `public.admin_users`; no new administrator account or role grant. Institution administrators do not qualify unless separately authorized as an existing platform administrator.

The `education_platform_admin` RPC verifies `auth.uid()`, current membership in `admin_users`, and an existing matching Auth session on every operation. The authenticated-only security-definer RPC intentionally exposes fixed overview/detail/save operations on the otherwise private education schema. Its empty search path, schema-qualified objects and lack of dynamic SQL are deliberate. Private tracking/audit tables have RLS enabled and no client grants/policies; direct reads/writes are blocked. The advisor's authenticated-definer warning is expected for this checked administrative RPC.

Overview returns institution metadata, owner contact, membership and invitation counts, and aggregate student/question/exam/result counts; it does not return question contents, answers or educational records. Detail returns membership contact/role lists, latest 100 invitation statuses, private commercial tracking metadata and latest 30 platform audit entries. No invitation secrets are returned.

Tracking status, plan, renewal date and notes are internal operational records. They do not suspend institution access, grant memberships, change a student's records or indicate verified payments. Saves use row locking and revision comparison, and create an audit entry in the same transaction.

Apply `sql/education-central-admin.sql` using the existing database migration workflow. Validate with `tests/education/platform-admin-security.sql`; the test requires an existing platform-admin Auth session and institution, performs only rolled-back writes, and never exports sessions or tokens.

Browser QA uses synthetic preview fixtures for overview, search, detail and save. A real user's password sign-in is not automated. Existing FTMotion admins can sign in on the new page using their website email/password. Logout ends the local website session and clears displayed records.
