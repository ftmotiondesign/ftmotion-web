-- FTMotion: her işletmeye özel otomatik açılış animasyonu ayarları
-- Supabase SQL Editor'de bir kez çalıştırın.
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS intro_settings jsonb NOT NULL DEFAULT '{"enabled":true,"show_name":true,"duration":2000,"background":"#0b0b0d"}'::jsonb;
COMMENT ON COLUMN public.businesses.intro_settings IS 'QR açılış animasyonu: enabled, show_name, duration(ms), background';
