-- Fix image upload policy: avoid casting a business name/path to UUID.
-- Paths remain <business_id>/<sponsor_request_id>/<random_filename>.
drop policy if exists sponsor_video_image_owner_upload on storage.objects;
create policy sponsor_video_image_owner_upload on storage.objects
for insert to authenticated
with check (
 bucket_id='sponsor-video-assets'
 and exists (
   select 1 from public.businesses b
   join public.sponsor_requests r on r.business_id=b.id
   where b.owner_id=auth.uid()
     and b.id::text=split_part(name,'/',1)
     and r.id::text=split_part(name,'/',2)
     and r.status<>'rejected'
 )
);
drop policy if exists sponsor_video_image_owner_read on storage.objects;
create policy sponsor_video_image_owner_read on storage.objects
for select to authenticated
using (
 bucket_id='sponsor-video-assets'
 and exists (
   select 1 from public.businesses b
   where b.owner_id=auth.uid()
     and b.id::text=split_part(name,'/',1)
 )
);
