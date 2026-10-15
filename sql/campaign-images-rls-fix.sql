-- FTMotion: kampanya görseli yükleme RLS düzeltmesi
-- storage.objects.name sütununu açıkça belirtir.
drop policy if exists "campaign_images_owner_upload" on storage.objects;
create policy "campaign_images_owner_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'campaign-images'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and b.owner_id = (select auth.uid())
  )
);
drop policy if exists "campaign_images_owner_delete" on storage.objects;
create policy "campaign_images_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'campaign-images'
  and exists (
    select 1
    from public.businesses b
    where b.id::text = (storage.foldername(storage.objects.name))[1]
      and b.owner_id = (select auth.uid())
  )
);