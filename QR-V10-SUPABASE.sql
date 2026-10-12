-- FTMotion QR V10 / mevcut verileri silmez
alter table public.businesses add column if not exists qr_description text not null default '';
alter table public.businesses add column if not exists cover_images jsonb not null default '[]'::jsonb;
alter table public.businesses add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table public.businesses add column if not exists streetview_url text not null default '';
alter table public.businesses add column if not exists tour_url text not null default '';
alter table public.businesses add column if not exists location_video_url text not null default '';
alter table public.businesses add column if not exists google_review_url text not null default '';
alter table public.businesses add column if not exists location_text text not null default '';
create table if not exists public.business_pages(
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check(length(trim(title)) between 2 and 100),
 page_type text not null default 'aciklama' check(page_type in ('iban','not','aciklama','diger')),
 content text not null default '',
 iban text not null default '',
 recipient text not null default '',
 active boolean not null default true,
 sort_order int not null default 0,
 created_at timestamptz not null default now(),
 unique(business_id,slug)
);
alter table public.business_pages enable row level security;
drop policy if exists "qr pages read" on public.business_pages;
create policy "qr pages read" on public.business_pages for select to anon,authenticated using(
 exists(select 1 from public.businesses b where b.id=business_id and (b.active and business_pages.active or public.owns_business(b.id)))
);
drop policy if exists "qr pages insert" on public.business_pages;
create policy "qr pages insert" on public.business_pages for insert to authenticated with check(public.owns_business(business_id));
drop policy if exists "qr pages update" on public.business_pages;
create policy "qr pages update" on public.business_pages for update to authenticated using(public.owns_business(business_id)) with check(public.owns_business(business_id));
drop policy if exists "qr pages delete" on public.business_pages;
create policy "qr pages delete" on public.business_pages for delete to authenticated using(public.owns_business(business_id));
grant select on public.business_pages to anon,authenticated;
grant insert,update,delete on public.business_pages to authenticated;
-- Medya: işletme ID'si ile başlayan klasöre yalnızca sahibi yükler.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ftm-qr','ftm-qr',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4'])
 on conflict(id) do nothing;
drop policy if exists "ftm qr public media" on storage.objects;
create policy "ftm qr public media" on storage.objects for select to anon,authenticated using(bucket_id='ftm-qr');
drop policy if exists "ftm qr upload" on storage.objects;
create policy "ftm qr upload" on storage.objects for insert to authenticated with check(
 bucket_id='ftm-qr' and public.owns_business((split_part(name,'/',1))::uuid)
);
drop policy if exists "ftm qr delete" on storage.objects;
create policy "ftm qr delete" on storage.objects for delete to authenticated using(
 bucket_id='ftm-qr' and public.owns_business((split_part(name,'/',1))::uuid)
);
