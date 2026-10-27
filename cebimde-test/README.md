# Cebimde Sadakat — güvenli entegrasyon taslağı

**Yalnızca feature/cebimde-sadakat-test dalı. Canlı sisteme uygulanmadı.**

## Koruma
- `businesses`, `qr_short_links`, giriş/şifre akışı, mevcut dijital kart ve web sitesi ekranlarına dokunulmaz.
- Yeni hizmet yetkileri `ft_business_entitlements` tablosunda saklanır.
- **ÖNEMLİ:** Mevcut işletmelerde satır bulunmaması, mevcut dijital kart/web sitesi hizmetini kapatmak anlamına gelmez. Geçiş öncesinde mevcut hakların açıkça eşleştirilmesi ve geriye dönük uyumluluk kodu şarttır.
- Yalnızca sadakat isteyen yeni işletmelerde dijital kart ve web sitesi false; yetkili yönetici daha sonra açabilir.
- Ücretler öneri: 990 / 1990 / 3490 TL/yıl. Katalogda active=false: satışa otomatik açılmaz.
- NFC kart alanlar için ilk 365 gün ücretsiz; gerçek satın alma ve onay tarihi doğrulanmadan otomatik başlatılmaz.
- Süre dolunca veri silinmez; yalnızca sadakat işlem yetkisi sınırlandırılır.
- Reklam/ödemeler ayrı onay gerektirir.

## Test ve canlıya geçiş önkoşulları
1. GitHub yedeği: `backup/2026-10-27-before-cebimde`.
2. Supabase **tam veritabanı + Storage** yedeği alınmalı ve geri yükleme denenmeli. Bu adım henüz tamamlanmadı.
3. Supabase test projesinde SQL dosyasını çalıştır, güvenlik danışmanlarını ve RLS testlerini kontrol et.
4. Var olan 22 işletmenin kart, QR, giriş, site erişimlerinin önce/sonra regresyon testi.
5. Yeni sadakat-only hesabı, NFC ilk yıl, sonradan kart yükseltme, süre bitişi, yönetici onayı testleri.
6. Onay sonrası canlıya ayrı PR ve küçük dağıtım; hiçbir otomatik deploy yok.

## Güvenlik
- SQL yalnızca taslaktır; mevcut `admin_users` ve `businesses` politikaları ile karşılıklı RLS davranışı ayrıca test edilmelidir.
- Audit tablosu için sunucu tarafında güvenli yazma akışı ayrıca kurulmalıdır.
- Kullanıcı metadata'sı yetkilendirme kaynağı değildir.
