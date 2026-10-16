-- FTMotion -> DijiyeSor publication requests. Run in Supabase SQL Editor.
create table if not exists public.ftm_diji_publication_requests (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','reviewing','published','rejected')),
 diji_business_id text,
 admin_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ftm_diji_publication_unique unique(business_id)
);
create index if not exists ftm_diji_requests_status_idx on public.ftm_diji_publication_requests(status,created_at desc);
alter table public.ftm_diji_publication_requests enable row level security;
revoke all on public.ftm_diji_publication_requests from anon;
grant select,insert on public.ftm_diji_publication_requests to authenticated;
create policy "owner read own publication request" on public.ftm_diji_publication_requests
 for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner submit own business" on public.ftm_diji_publication_requests
 for insert to authenticated with check (
 owner_id = (select auth.uid()) and exists (
 select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())
 )
);
-- Only admins may review via a dedicated policy; keep review fields protected.
create policy "admin read publication requests" on public.ftm_diji_publication_requests
 for select to authenticated using (public.is_ftm_admin());
grant update on public.ftm_diji_publication_requests to authenticated;
create policy "admin update publication requests" on public.ftm_diji_publication_requests
 for update to authenticated using (public.is_ftm_admin()) with check (public.is_ftm_admin());
