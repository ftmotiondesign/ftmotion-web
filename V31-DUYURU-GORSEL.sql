-- FTMotion V31 - Duyuru görselleri: V30 SQL kurulumundan sonra çalıştırın.
alter table public.announcements add column if not exists image_url text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('announcement-images','announcement-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
-- Yalnızca yönetici duyuru görseli yükleyebilir. Public bucket görselleri açık bağlantıdan gösterir.
drop policy if exists "ftm_announcement_images_admin_insert" on storage.objects;
create policy "ftm_announcement_images_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id='announcement-images' and public.is_ftm_admin());
-- Dosya silme ve değiştirme tanımlı değildir; yeni yüklemeler benzersiz ad taşır.
