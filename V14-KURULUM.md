# FTMotion QR V14 – küçük kapak ve içerik teşhisi

GitHub üzerinde yalnızca `qr/index.html` dosyasını güncelleyin. SQL çalıştırılması gerekmiyor.

- Mobilde kapak 95–125 px.
- Kayıtlı web sitesi URL’si geçerliyse Web Sitesi butonu görünür. Eksik ya da geçersizse uyarı görünür.
- Galeri boşsa yönlendirici mesaj çıkar; galeri görsellerini otomatik icat etmez.
- Ek sayfalar için Supabase okuma hataları ayrı gösterilir.
- Ek sayfa butonları `qr/?slug=...&page=...` test bağlantısı kullanır; bu GitHub Pages için daha güvenilir bir yoldur.

QR yönetimindeki **Web sitesi URL** alanına `https://firma.com` yazıp **Profili Kaydet** yapın. Fotoğraflar için dosya türü 'Galeri fotoğrafı' seçerek yükleyin. Ek Sayfalar'da kayıtlar **Aktif** olmalı.
