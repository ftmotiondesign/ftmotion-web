-- Run once in Supabase SQL Editor. Private image uploads for free sponsor video requests.
alter table public.sponsor_video_requests add column if not exists image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sponsor-video-assets','sponsor-video-assets',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists sponsor_video_image_owner_upload on storage.objects;
create policy sponsor_video_image_owner_upload on storage.objects for insert to authenticated
with check(bucket_id='sponsor-video-assets'
 and exists(select 1 from public.businesses b where b.id=(split_part(name,'/',1))::uuid and b.owner_id=auth.uid())
 and exists(select 1 from public.sponsor_requests r where r.id=(split_part(name,'/',2))::uuid and r.business_id=(split_part(name,'/',1))::uuid and r.status<>'rejected'));
drop policy if exists sponsor_video_image_owner_read on storage.objects;
create policy sponsor_video_image_owner_read on storage.objects for select to authenticated
using(bucket_id='sponsor-video-assets' and exists(select 1 from public.businesses b where b.id=(split_part(name,'/',1))::uuid and b.owner_id=auth.uid()));
drop policy if exists sponsor_video_image_admin_read on storage.objects;
create policy sponsor_video_image_admin_read on storage.objects for select to authenticated
using(bucket_id='sponsor-video-assets' and public.ftm_sponsor_admin());
