-- FTMotion V6 - yalnızca mevcut V3/V5 şemasına ek yapar.
-- SQL Editor > New query > Run. Mevcut tabloları silmez.
create extension if not exists pgcrypto;
create table if not exists public.services (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 2 and 140),
 tag text not null default '', icon text not null default '◈',
 description text not null default '', detail text not null default '',
 features jsonb not null default '[]'::jsonb check(jsonb_typeof(features)='array'),
 price numeric(12,2) not null default 0 check(price>=0),
 active boolean not null default true,
 sort_order integer not null default 0,
 image_url text not null default '', video_url text not null default '',
 created_at timestamptz not null default now()
);
alter table public.services enable row level security;
create policy "public active catalog" on public.services for select to anon, authenticated using (active or public.is_ftm_admin());
create policy "admin create service" on public.services for insert to authenticated with check(public.is_ftm_admin());
create policy "admin edit service" on public.services for update to authenticated using(public.is_ftm_admin()) with check(public.is_ftm_admin());
create policy "admin delete service" on public.services for delete to authenticated using(public.is_ftm_admin());
grant select on public.services to anon,authenticated;
grant insert,update,delete on public.services to authenticated;
insert into public.services (title,tag,icon,description,detail,features,price,sort_order)
select v.title,v.tag,v.icon,v.description,v.detail,v.features::jsonb,v.price,v.sort_order
from (values
('Görselden Video Oluşturma','YAPAY ZEKÂ','🎬','Fotoğraflardan etkileyici tanıtım videoları.','Fotoğraftan kısa tanıtım ve Reels üretimi.','["Fotoğraftan video", "Dikey video"]',1500,10),
('Sanal Drone Konum Videosu','KONUM','🌍','Harita tabanlı konum tanıtımı.','Sanal harita animasyonuyla konum tanıtımı.','["Konum ve rota", "Marka entegrasyonu"]',2000,20),
('360° Mekân Çekimi','360 TUR','🏛️','İşletmenizi sanal tur ile tanıtın.','360 derece interaktif mekân tanıtımı.','["360 çekim", "Sanal tur"]',3500,30),
('QR / NFC Kart Çözümleri','DİJİTAL KART','📱','Kalıcı QR ve NFC işletme iletişim sayfası.','İşletme bilgi ve bağlantı sayfaları.','["QR kod", "NFC kart"]',1500,40),
('QR Menü Uygulaması','DİJİTAL MENÜ','🍽️','Fotoğraflı kategorili dijital menü.','İşletmenin yönetebildiği menü uygulaması.','["Ürünler", "Kategoriler"]',2500,50),
('Web Sitesi Hazırlama','WEB TASARIM','💻','Mobil uyumlu işletme web sitesi.','İşletmeye özel tanıtım sitesi.','["Mobil uyum", "Profesyonel tasarım"]',4500,60)
) as v(title,tag,icon,description,detail,features,price,sort_order)
where not exists(select 1 from public.services);
-- Var olan V5 fiyatlarını muhafaza et (başlangıç hizmetleri için)
with ids(title,code) as (values ('Görselden Video Oluşturma','video'),('Sanal Drone Konum Videosu','drone'),('360° Mekân Çekimi','tour'),('QR / NFC Kart Çözümleri','qr'),('QR Menü Uygulaması','menu'),('Web Sitesi Hazırlama','web'))
update public.services s set price=(ss.prices->>ids.code)::numeric
from ids cross join public.site_settings ss where ss.id=1 and ss.prices ? ids.code and s.title=ids.title;
-- Public bucket: medyalar internette herkese açık okunur, yükleme ve silme sadece yöneticidir.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ftmotion-media','ftmotion-media',true,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;
create policy "ftm media admin insert" on storage.objects for insert to authenticated with check(bucket_id='ftmotion-media' and public.is_ftm_admin());
create policy "ftm media public read" on storage.objects for select to public using(bucket_id='ftmotion-media');
create policy "ftm media admin remove" on storage.objects for delete to authenticated using(bucket_id='ftmotion-media' and public.is_ftm_admin());
