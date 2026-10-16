-- FTMotion: Açılış videosu yönetici ayarları
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS premium_intro_url text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS intro_settings jsonb DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.ft_admin_save_intro_settings(p_business_id uuid,p_url text,p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Yönetici yetkisi gerekli'; END IF;
 IF p_url IS NOT NULL AND (length(p_url)>1500 OR p_url !~* '^https://[^[:space:]]+\.mp4(\?[^[:space:]]*)?$') THEN RAISE EXCEPTION 'Geçerli HTTPS MP4 URL gerekli'; END IF;
 UPDATE public.businesses SET premium_intro_url=p_url,intro_settings=jsonb_set(coalesce(intro_settings,'{}'::jsonb),'{enabled}',to_jsonb(coalesce(p_enabled,false)),true) WHERE id=p_business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'İşletme bulunamadı'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ft_admin_save_intro_settings(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ft_admin_save_intro_settings(uuid,text,boolean) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('business-intros','business-intros',true,10485760,ARRAY['video/mp4'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=10485760,allowed_mime_types=ARRAY['video/mp4'];
DROP POLICY IF EXISTS "ft_admin_intro_upload" ON storage.objects;
CREATE POLICY "ft_admin_intro_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK
(bucket_id='business-intros' AND EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()));
