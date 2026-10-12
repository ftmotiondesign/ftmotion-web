# QR V15 kayıt kontrolü

Bu sürüm, kayıtlı olmayan bilgiyi otomatik olarak yaratmaz.

GitHub deposunda yalnızca `qr/index.html` ve `qr-yonetimi.html` dosyalarını güncelleyin.
SQL çalıştırmanız gerekmez.

QR Yönetimi → Yayın Kontrolü bölümünde:
- Web sitesi kayıtlı değilse İşletme kartı > Web sitesi URL doldurun > Profili Kaydet.
- Galeri 0 ise Galeri fotoğrafı yükleyin; başarılı mesajını görmeden sayfadan ayrılmayın.
- Ek sayfa 0 aktifse Ek Sayfalar > Düzenle > Aktif > Sayfayı Kaydet.
- Ek sayfa erişim hatası varsa Supabase RLS politikalarını ayrıca kontrol edin.

Not: İşletmenin QR sayfasındaki ek sayfa metni gözüküyorsa en az bir ek sayfa yükleniyor olabilir.
