# FTMotion QR V16 — Ek Sayfa Bağlantıları

Bu sürüm yalnızca **3 dosyayı** değiştirir:
- `404.html` (depo kökü) — GitHub Pages dinamik QR adreslerini yeni QR sayfasına aktarır.
- `qr/index.html` — IBAN, not, açıklama için ayrı sayfa görünümü ve geri dön bağlantısı.
- `qr-yonetimi.html` — Ek sayfaların bağlantıları artık 200 dönen `/qr/?slug=...&page=...` biçiminde açılır, kaydetme hatası formun altında görünür.

Supabase SQL değişikliği gerekmez. Mevcut işletmeleri veya sayfa kayıtlarını silmez.

Test: İşletme seç → Ek Sayfalar → + Sayfa Ekle → başlık, slug, içerik doldur → Sayfayı Kaydet → Görüntüle. QR kartta ek sayfa kutusu görünmeli ve tıklanınca ayrı görünüm açılmalı.

Not: Basılacak QR'lar için `ftmotion.com/qr/slug` yönlendirmelerini alan adı/hosting üzerinde HTTP 200 olarak sağlamlaştırmalıyız. GitHub Pages'in 404 tabanlı yönlendirmesi geçici test çözümüdür.
