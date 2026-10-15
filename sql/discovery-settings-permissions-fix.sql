-- FTMotion Keşfet ayarları: tablo erişim yetkileri
-- RLS politikalarını değiştirmez; tabloya erişim izni verir.
grant usage on schema public to anon, authenticated;
grant select on table public.business_discovery_settings to anon;
grant select, insert, update on table public.business_discovery_settings to authenticated;
-- İşletme sahibinin kendi kaydına erişimi mevcut RLS politikalarıyla sınırlıdır.
