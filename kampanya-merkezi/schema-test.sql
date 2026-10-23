-- FTMotion Campaign Center / test environment ONLY.
-- Run on an isolated Supabase branch after confirming backups.
create table if not exists public.campaign_contacts (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 full_name text not null check (char_length(trim(full_name)) between 2 and 120),
 phone text, email text,
 created_at timestamptz not null default now(),
 constraint campaign_contact_channel check (nullif(trim(coalesce(phone,'')),'') is not null or nullif(trim(coalesce(email,'')),'') is not null)
);
create index if not exists campaign_contacts_business_idx on public.campaign_contacts(business_id);
create unique index if not exists campaign_contacts_business_phone_unique on public.campaign_contacts(business_id,phone) where phone is not null;
create unique index if not exists campaign_contacts_business_email_unique on public.campaign_contacts(business_id,lower(email)) where email is not null;
alter table public.campaign_contacts enable row level security;
create policy campaign_contacts_owner_select on public.campaign_contacts for select to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy campaign_contacts_owner_insert on public.campaign_contacts for insert to authenticated with check (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy campaign_contacts_owner_update on public.campaign_contacts for update to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))) with check (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create table if not exists public.campaign_consents (
 id uuid primary key default gen_random_uuid(),
 contact_id uuid not null references public.campaign_contacts(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 channel text not null check (channel in ('whatsapp','email')),
 decision text not null check (decision in ('granted','revoked')),
 notice_version text not null,
 source text not null check (char_length(source) between 1 and 100),
 recorded_at timestamptz not null default now(),
 evidence_ref text,
 constraint campaign_consents_notice_nonempty check (char_length(trim(notice_version))>0)
);
create index if not exists campaign_consents_contact_idx on public.campaign_consents(contact_id,channel,recorded_at desc);
alter table public.campaign_consents enable row level security;
-- Consent events are append-only: no UPDATE/DELETE policies.
create policy campaign_consents_owner_select on public.campaign_consents for select to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
-- Consent creation must be handled by a validated server-side endpoint that verifies
-- contact.business_id = consent.business_id and captures reliable evidence.
-- No client INSERT policy intentionally. No anon write grants.
revoke all on public.campaign_consents from anon,authenticated;
grant select on public.campaign_consents to authenticated;
revoke all on public.campaign_contacts from anon;
grant select,insert,update on public.campaign_contacts to authenticated;
