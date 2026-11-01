-- FTMotion Başol pilot: REVIEW ONLY. Do not apply to production without testing.
-- Existing businesses, corporate_employees and QR routes are untouched.
create table if not exists public.ft_person_cards (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 full_name text not null,
 phone text, whatsapp text, email text, photo_url text,
 is_published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.ft_person_business_links (
 person_id uuid not null references public.ft_person_cards(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 sort_order integer not null default 0,
 primary key(person_id,business_id)
);
create index if not exists ft_person_cards_owner_idx on public.ft_person_cards(owner_id);
alter table public.ft_person_cards enable row level security;
alter table public.ft_person_business_links enable row level security;
create policy "owner read personal cards" on public.ft_person_cards for select to authenticated using (owner_id=(select auth.uid()));
create policy "public read published personal cards" on public.ft_person_cards for select to anon using (is_published=true);
create policy "owner create personal cards" on public.ft_person_cards for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owner update personal cards" on public.ft_person_cards for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "owner delete personal cards" on public.ft_person_cards for delete to authenticated using (owner_id=(select auth.uid()));
create policy "owner read person firms" on public.ft_person_business_links for select to authenticated using (exists(select 1 from public.ft_person_cards p where p.id=person_id and p.owner_id=(select auth.uid())));
create policy "public read published person firms" on public.ft_person_business_links for select to anon using (exists(select 1 from public.ft_person_cards p where p.id=person_id and p.is_published=true));
create policy "owner attach owned firms" on public.ft_person_business_links for insert to authenticated with check (
 exists(select 1 from public.ft_person_cards p where p.id=person_id and p.owner_id=(select auth.uid()))
 and exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
);
create policy "owner detach firms" on public.ft_person_business_links for delete to authenticated using (exists(select 1 from public.ft_person_cards p where p.id=person_id and p.owner_id=(select auth.uid())));
-- Before rollout: confirm public.businesses RLS allows published business display;
-- reserve person slugs against existing QR short links; add delegated per-person permissions.
