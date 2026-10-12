# FTMotion QR / NFC V10

## Kurulum
1. Supabase SQL Editor içinde `QR-V10-SUPABASE.sql` çalıştır. Bu kod önceki işletme kayıtlarını silmez.
2. GitHub `ftmotion-web` deposu ana dizinine `panel.html`, `qr-yonetimi.html`, `404.html` yükle. `qr/index.html` dosyasını qr klasörüne, `shared/supabase-client.js` dosyasını shared klasörüne koy. Mevcut shared/supabase-client.js aynıysa değiştirmeye gerek yok.
3. `supabase-config.json` zaten mevcut; ana dizinde kalmalı. Secret / service_role anahtarı yükleme.
4. QR yönetimi: `https://ftmotiondesign.github.io/ftmotion-web/qr-yonetimi.html`
5. QR sayfası: `https://ftmotiondesign.github.io/ftmotion-web/qr/isletme-adi`. Örnekteki `isletme-adi` işletmenin kayıtlı slug değeridir.
6. `ftmotion.com` DNS bağlandığında kalıcı baskı QR adresini `https://ftmotion.com/qr/isletme-adi` kullanacak şekilde planla. Alan adı bağlanmadan basılı kart üretme.

## Bilinmesi gerekenler
- GitHub Pages dinamik rota desteklemez. Buradaki özel `404.html`, alt URL'leri tarayıcıda işleyerek sayfayı görüntüler. Bazı botlar HTTP 404 görecektir. **Kalıcı ve gerçek 200 yanıtlı QR URL için Cloudflare Pages (SPA fallback), rewrite destekli hosting ya da işletme başına statik dosya üretimi önerilir.**
- QR kartın görünmesi için işletmenin `active=true` olması ve slug bilgisinin doldurulması gerekir.
- Klasör yolu UUID işyeri kimliğiyle başlar; Storage RLS ile sahibi sınırlandırılır.
- Fotoğraf/video yüklemede tek dosya sınırı 50 MB'dir; Supabase projesinin kendi yükleme üst sınırı daha düşük olabilir.
- Kapak ve logo eski dosyayı değiştirince eski dosya Storage'dan otomatik silinmez. Medya temizliği sonraki sürüme bırakılmıştır.
- IBAN girişi metin alanıdır, banka hesabının sahibi ve gerçekliği doğrulanmaz. İşletme sahibinin sorumluluğundadır.
- Profil görüntüleyen kişiler kaydet butonundan VCF indirir, cihazın rehberine otomatik yazılmaz.
- Düzenleme ekranında işletme oluşturma ve aktivasyon mevcut yönetim sayfasından yapılır.
