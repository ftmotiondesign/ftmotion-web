-- FTMotion kampanya görselleri: Supabase SQL Editor'de bir kez çalıştırın.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('campaign-images','campaign-images',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "campaign_images_public_read" on storage.objects;
create policy "campaign_images_public_read" on storage.objects
for select to anon,authenticated using (bucket_id='campaign-images');

drop policy if exists "campaign_images_owner_upload" on storage.objects;
create policy "campaign_images_owner_upload" on storage.objects
for insert to authenticated with check (
 bucket_id='campaign-images'
 and exists (
  select 1 from public.businesses b
  where b.id::text=(storage.foldername(name))[1]
  and b.owner_id=auth.uid()
 )
);

drop policy if exists "campaign_images_owner_delete" on storage.objects;
create policy "campaign_images_owner_delete" on storage.objects
for delete to authenticated using (
 bucket_id='campaign-images'
 and exists (
  select 1 from public.businesses b
  where b.id::text=(storage.foldername(name))[1]
  and b.owner_id=auth.uid()
 )
);