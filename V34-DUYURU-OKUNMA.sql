-- FTMotion V34 · Duyuru okunma takibi (oturum bazlı)
-- Her üye kendi hesabı adına okuma işaretler; diğer üyelerin verisini göremez.
CREATE TABLE IF NOT EXISTS public.announcement_reads (
 announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (announcement_id,user_id)
);
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.announcement_reads TO authenticated;
DROP POLICY IF EXISTS "announcement_reads_select_own" ON public.announcement_reads;
CREATE POLICY "announcement_reads_select_own" ON public.announcement_reads FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS "announcement_reads_insert_own" ON public.announcement_reads;
CREATE POLICY "announcement_reads_insert_own" ON public.announcement_reads FOR INSERT TO authenticated
WITH CHECK (user_id=(select auth.uid()) AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id=announcement_id AND a.active=true));
DROP POLICY IF EXISTS "announcement_reads_update_own" ON public.announcement_reads;
CREATE POLICY "announcement_reads_update_own" ON public.announcement_reads FOR UPDATE TO authenticated
USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
