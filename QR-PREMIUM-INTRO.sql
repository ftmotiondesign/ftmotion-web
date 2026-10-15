-- Supabase SQL Editor: yöneticinin atadığı ücretli intro alanı
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS premium_intro_url text;
-- Üyeler bu sütunu doğrudan güncelleyemesin.
CREATE OR REPLACE FUNCTION public.ft_guard_premium_intro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.premium_intro_url IS DISTINCT FROM OLD.premium_intro_url
 AND auth.uid() IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'Özel intro yalnızca yönetici tarafından değiştirilebilir';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ft_premium_intro_guard ON public.businesses;
CREATE TRIGGER ft_premium_intro_guard BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.ft_guard_premium_intro();
CREATE OR REPLACE FUNCTION public.ft_admin_set_premium_intro(p_business_id uuid,p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Yetkisiz işlem';
 END IF;
 IF p_url IS NOT NULL AND (length(p_url)>1500 OR p_url !~* '^https://[^[:space:]]+\.(mp4|webm)(\?[^[:space:]]*)?$') THEN
  RAISE EXCEPTION 'HTTPS MP4 veya WebM URL gerekiyor';
 END IF;
 UPDATE public.businesses SET premium_intro_url=p_url WHERE id=p_business_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'İşletme bulunamadı'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ft_admin_set_premium_intro(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ft_admin_set_premium_intro(uuid,text) TO authenticated;
