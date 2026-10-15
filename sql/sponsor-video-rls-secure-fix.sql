-- Replace upload check with a security-definer ownership verifier.
-- Never disable Storage RLS.
create or replace function public.can_upload_sponsor_video_asset(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    join public.sponsor_requests r on r.business_id = b.id
    where b.owner_id = (select auth.uid())
      and b.id::text = split_part(object_name, '/', 1)
      and r.id::text = split_part(object_name, '/', 2)
      and r.status <> 'rejected'
      and array_length(string_to_array(object_name, '/'), 1) = 3
  );
$$;
revoke all on function public.can_upload_sponsor_video_asset(text) from public;
grant execute on function public.can_upload_sponsor_video_asset(text) to authenticated;

drop policy if exists sponsor_video_image_owner_upload on storage.objects;
create policy sponsor_video_image_owner_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sponsor-video-assets'
  and public.can_upload_sponsor_video_asset(name)
);

drop policy if exists sponsor_video_image_owner_read on storage.objects;
create policy sponsor_video_image_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'sponsor-video-assets'
  and (
    public.can_upload_sponsor_video_asset(name)
    or public.ftm_sponsor_admin()
  )
);
