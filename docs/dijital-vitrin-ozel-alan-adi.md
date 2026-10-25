# Dijital Vitrin — özel alan adı entegrasyonu (tasarım sözleşmesi)

Durum: Test/geliştirme dalı. Canlıya alınmadı.

## Temel kurallar
- Mevcut /qr/, /k/, üyelik, kart şablonları ve QR stok/atama akışları değiştirilmez.
- İşletmenin kalıcı QR kimliği alan adından bağımsızdır. Var olan QR basımları korunur.
- Dijital Vitrin ayrı yetki (entitlement) olarak yönetilir; kartvizit yetkisi ayrı kalır.
- İşletme önce vitrin, sonra kart satın alabilir. Aynı işletme kaydı ve aynı kalıcı QR korunur.
- Vitrin için varsayılan yayın adresi: ftmotion.com/vitrin/{slug} (planlanan yol; henüz canlı değil).
- Özel alan adı opsiyoneldir; ilk yayın FTMotion adresinde yapılabilir.
- Alan adı silinirse veya doğrulama bozulursa güvenli FTMotion vitrini kullanılabilir; kalıcı QR kaybolmaz.

## Alan adı kayıtları (önerilen yeni tablo)
vitrin_domains:
- id (uuid PK)
- business_id (mevcut işletme FK; şema incelendikten sonra kesinleşecek)
- hostname (benzersiz, normalize edilmiş)
- status (pending | verifying | active | failed | disabled)
- verification_token (gizli sunucu tarafı doğrulama değeri)
- ssl_status (pending | active | failed)
- created_at, verified_at, updated_at
- is_primary (işletme başına en fazla birincil alan adı)

## Bağlantı akışı
1. İşletme panelde alan adını ekler.
2. Alan adı sahipliği DNS TXT doğrulamasıyla kontrol edilir; alan adı başkasının işletmesine bağlanamaz.
3. Hosting/SSL sağlayıcısında alan adı tanımlanır ve sertifika hazır olana kadar 'active' yapılmaz.
4. Sunucu, gelen Host başlığını yalnızca doğrulanmış ve aktif hostname eşlemesinden çözer.
5. İçerik aynı işletmenin vitrini üzerinden sunulur; yönetim işlemleri oturum ve işletme yetkisiyle korunur.
6. Birincil adres değişirse canonical ve yönlendirme kuralları uygulanır; kalıcı QR hedefi ayrı tutulur.

## Güvenlik ve geriye dönük uyumluluk
- Mevcut tabloları silme/yeniden adlandırma yok; yeni tablolar için RLS ve işletme sahipliği kontrolü zorunlu.
- DNS kaydının girilmesi tek başına alan adı sahipliği kanıtı sayılmaz.
- SSL hazır değilken HTTP üzerinden hassas bilgi sunulmaz.
- Bilinmeyen Host ile başka işletmenin vitrini açılmaz.
- Vitrin aboneliği bitince mevcut kartvizit işlevleri etkilenmez.
- Canlıya çıkmadan önce: mevcut QR linkleri, NFC yönlendirmeleri, kullanıcı girişleri, vitrin URL, özel alan adı, mobil görünüm regresyon testleri.

## Uygulama ön koşulları
- Supabase mevcut işletme şeması ve RLS politikaları incelenecek.
- Cloudflare/hosting alan adı otomasyonu ve maliyetleri doğrulanacak.
- Tanıtım amaçlı pastane/restoran demo kodu doğrulanacak (sipariş/mutfak projesiyle karıştırılmayacak).
- Değişiklikler önce test dalında ve test ortamında doğrulanacak; canlı main'e otomatik aktarılmayacak.
