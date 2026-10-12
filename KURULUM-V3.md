# FTMotion V3 — canlı veritabanı kurulumu

1. Supabase üzerinde yeni proje oluşturun. SQL Editor > New query bölümünde `database.sql` dosyasının içeriğini çalıştırın.
2. Authentication > URL Configuration > Site URL değerini `https://ftmotion.com` olarak ayarlayın. Redirect URL'lere `https://ftmotion.com/**` ekleyin. E-posta doğrulama ayarını kontrol edin.
3. `supabase-config.example.json` dosyasını `supabase-config.json` olarak çoğaltın; proje URL'sini ve PUBLIC publishable/anon key'i girin. **service_role/secret key koymayın**.
4. `giris.html` üzerinden yönetici hesabınızı oluşturun ve e-posta onayını tamamlayın. Authentication > Users ekranından kullanıcı UUID'sini alın; SQL Editor'de `insert into public.admin_users(user_id) values ('GERCEK-UUID') on conflict do nothing;` çalıştırın.
5. Dosyaları mevcut ftmotion.com sitenizin ana dizinine yayınlayın. `yonetim.html` merkezi fiyat panelidir. `isletme-yonetimi.html` işletme/QR bilgileri ile menü kategori ve ürünlerini Supabase'de saklar.
6. SQL'de `businesses.active` varsayılan olarak `false` olur; halka açık müşteri sayfalarının açılması ayrıca hazırlanmalıdır. `qr/index.html` ve `menu/index.html` hâlâ ayrı yerel demo sayfalarıdır; gerçek QR ziyaretçi deneyimi ve fotoğraf dosya yükleme sistemi bu V3'e dahil DEĞİLDİR.
7. Site ana sayfası Supabase yapılandırması yoksa demo fiyatlarıyla çalışır; bu fiyatlar gerçek merkezi fiyatlar değildir. Admin yetkisi yalnızca RLS kontrolüyle verilir.
8. Canlıya geçmeden önce kullanıcı izinlerini farklı test hesaplarıyla sınayın; SQL dosyasını aynı veritabanına tekrar tekrar çalıştırırken politika isim çakışması olabilir.

Not: Google Cloud/Cloudinary kullanılmaz. Supabase ücretsiz katmanın kullanım limitleri vardır ve kalıcı ücretsiz garanti değildir. Siparişler şimdilik WhatsApp üzerinden başlatılır, order tablosuna anonim yazma kapalıdır.
