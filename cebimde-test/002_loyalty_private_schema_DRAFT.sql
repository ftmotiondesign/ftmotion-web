-- Cebimde Sadakat: güvenli hazırlık taslağı. ÜRETİMDE ÇALIŞTIRILMADI.
-- Mevcut public.businesses / auth / QR tablolarına dokunmaz.
-- Şema API'ye açılmamalı; erişim ileride sunucu tarafı doğrulanmış uç noktalarla sağlanır.
begin;
create schema if not exists cebimde_loyalty;
revoke all on schema cebimde_loyalty from public, anon, authenticated;
create table if not exists cebimde_loyalty.programs (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 title text not null,
 visits_per_reward integer not null default 10 check (visits_per_reward between 2 and 100),
 reward_title text not null,
 active boolean not null default false,
 created_at timestamptz not null default now(),
 unique(business_id)
);
create table if not exists cebimde_loyalty.memberships (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references cebimde_loyalty.programs(id) on delete restrict,
 customer_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(program_id, customer_user_id)
);
create table if not exists cebimde_loyalty.visit_tokens (
 id uuid primary key default gen_random_uuid(),
 membership_id uuid not null references cebimde_loyalty.memberships(id) on delete restrict,
 token_hash text not null unique,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists cebimde_loyalty.ledger (
 id uuid primary key default gen_random_uuid(),
 membership_id uuid not null references cebimde_loyalty.memberships(id) on delete restrict,
 actor_user_id uuid references auth.users(id) on delete set null,
 event_type text not null check (event_type in ('visit','reward_earned','reward_redeemed','points_earned','points_spent','adjustment')),
 units integer not null check (units <> 0),
 token_id uuid unique references cebimde_loyalty.visit_tokens(id) on delete restrict,
 note text,
 created_at timestamptz not null default now()
);
create table if not exists cebimde_loyalty.entitlements (
 business_id uuid primary key references public.businesses(id) on delete restrict,
 loyalty_enabled boolean not null default false,
 starts_at timestamptz,
 expires_at timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_membership_created on cebimde_loyalty.ledger(membership_id,created_at desc);
create index if not exists loyalty_tokens_membership on cebimde_loyalty.visit_tokens(membership_id,expires_at);
alter table cebimde_loyalty.programs enable row level security;
alter table cebimde_loyalty.memberships enable row level security;
alter table cebimde_loyalty.visit_tokens enable row level security;
alter table cebimde_loyalty.ledger enable row level security;
alter table cebimde_loyalty.entitlements enable row level security;
revoke all on all tables in schema cebimde_loyalty from public, anon, authenticated;
commit;
-- Uygulamaya bağlamadan önce: sunucu endpointi, auth+business ownership,
-- atomik token tüketimi, yarış koşulları, idempotency, testler, denetim ve yedek şart.
