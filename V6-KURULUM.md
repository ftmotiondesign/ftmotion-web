# FTMotion V6 Kurulum

1. **Önce Supabase SQL Editor** üzerinde `V6-SUPABASE.sql` dosyasının tamamını çalıştır. Mevcut veritabanını silmez.
2. Supabase Storage > `ftmotion-media` kovasının oluştuğunu doğrula. Herkese açık medya bağlantıları kullanılır; yalnızca admin yükleyebilir/silebilir.
3. `yonetim.html`, `index.html` ve `hizmet.html` dosyalarını GitHub deposunun köküne yükle. Diğer dosyaları değiştirmek gerekmez.
4. Yönetim paneline giriş yap. `Hizmetler & Fiyatlar` alanından hizmet yönet, dosyaları bilgisayarından yükle.
5. `Medya Kütüphanesi` bölümünden dosya bağlantılarını kopyala, silmeden önce kullanım yerlerini kontrol et.

**ÖNEMLİ:** Bu V6 sürümünde hizmetlerin ana sayfada dinamik listelenmesi bağlandı. `hizmet.html` artık yeni hizmetleri Supabase üzerinden okur. Ancak `kampanya.html` ve `siparis.html` V5 kataloglarını kullanır; yeni hizmetlerden sipariş almadan önce bu sayfaların da uyarlanması gerekir.

**Fiyatlar:** V6 hizmet fiyatları `services` tablosundan gelir. Kampanya fiyatı eski `site_settings.bundle` alanından gelir. Paket indirim kuralı yeni hizmet sayısı için henüz tanımlı değildir.

**Güvenlik:** Gizli `sb_secret_` veya service_role anahtarını GitHub'a yükleme. Storage dosyaları herkese açıktır, özel dosyalar için uygun değildir. Video yüklemeleri Supabase planında kapasite/aktarım sınırına takılabilir.
