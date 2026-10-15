-- FTMotion Keşfet sponsor medya yönetimi
create table if not exists public.discover_sponsor_media (
 id uuid primary key default gen_random_uuid(),
 title text not null default 'Sponsor',
 media_url text not null,
 media_type text not null check (media_type in ('image','video')),
 target_url text,
 active boolean not null default false,
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
alter table public.discover_sponsor_media enable row level security;
drop policy if exists "discover_media_public_active" on public.discover_sponsor_media;
create policy "discover_media_public_active" on public.discover_sponsor_media for select to anon,authenticated using (active=true or public.is_ftm_admin());
drop policy if exists "discover_media_admin_insert" on public.discover_sponsor_media;
create policy "discover_media_admin_insert" on public.discover_sponsor_media for insert to authenticated with check (public.is_ftm_admin());
drop policy if exists "discover_media_admin_update" on public.discover_sponsor_media;
create policy "discover_media_admin_update" on public.discover_sponsor_media for update to authenticated using (public.is_ftm_admin()) with check (public.is_ftm_admin());
drop policy if exists "discover_media_admin_delete" on public.discover_sponsor_media;
create policy "discover_media_admin_delete" on public.discover_sponsor_media for delete to authenticated using (public.is_ftm_admin());
grant select on public.discover_sponsor_media to anon,authenticated;
grant insert,update,delete on public.discover_sponsor_media to authenticated;
-- Mevcut sponsor-video-assets bucket'ına yönetici yükleme yetkisi
drop policy if exists "discover_admin_upload" on storage.objects;
create policy "discover_admin_upload" on storage.objects for insert to authenticated with check (bucket_id='sponsor-video-assets' and (storage.foldername(name))[1]='discover' and public.is_ftm_admin());
drop policy if exists "discover_admin_read" on storage.objects;
create policy "discover_admin_read" on storage.objects for select to anon,authenticated using (bucket_id='sponsor-video-assets' and (storage.foldername(name))[1]='discover');

-- QR kartı bağlantısı
alter table public.discover_sponsor_media add column if not exists qr_url text;
