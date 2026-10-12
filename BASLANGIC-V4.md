# FTMotion V4 — Supabase bağlantısı

Bu pakette `supabase-config.json` gerçek proje URL ve publishable key ile dolduruldu. Secret/service-role key bulunmaz.

**Önemli:** Supabase bağlantısı / yönetim işlemleri yalnızca HTTP(S) sunucusunda çalışır. Dosyaları çift tıklayıp file:// olarak açmayın.

1. Önce yerel test sunucusu: `python -m http.server 8000` (bu klasörde), ardından http://localhost:8000/giris.html
2. Supabase Authentication > URL Configuration: Site URL `https://ftmotion.com`, redirect allowlist `https://ftmotion.com/**` (www kullanılacaksa ayrıca ekle).
3. `giris.html` üzerinden daha önce Supabase Auth'ta oluşturduğunuz e-posta ve şifre ile giriş yapın. `yonetim.html` yönetici yetkisini kontrol eder.
4. `yonetim.html` fiyat, paket, WhatsApp ve tanıtım MP4 adresini Supabase `site_settings` tablosuna kaydeder. `index.html` merkezi ayarları okur.
5. `hizmet.html`, `kampanya.html`, `siparis.html` ve QR/menü demo sayfaları ayrıca test ve tam entegrasyon gerektirir. Görsel yükleme/kalıcı menü henüz tamamlanmış değildir.
6. Sitede mevcut dosyaların üzerine yüklemeden önce yedek alın ve önce geçici önizleme/depo dalında deneyin.

**Güvenlik:** SQL Editor içindeki `database.sql` yapısına göre RLS açık olmalıdır. `admin_users` kaydı doğrulandı. `sb_secret_` veya veritabanı şifresini hiçbir HTML/JS dosyasına koymayın.

**Uyarı:** Yayındaki kampanya/sipariş detay sayfalarında demo fiyatlarını ayrıca canlı tablodan okur hâle getirmeden fiyat tutarlılığı garanti edilmez.
