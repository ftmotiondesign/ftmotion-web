# QR V11 Kurulum

1. ZIP içindeki `qr-yonetimi.html` dosyasını GitHub deposunun **kök dizinindeki aynı dosyayla** değiştirin. Diğer sayfaları değiştirmeyin.
2. Yönetici veya işletme hesabıyla giriş yapın, `qr-yonetimi.html` açın.
3. İşletmeyi seçince QR otomatik oluşturulur. PNG İndir ile 1200×1200 PNG dosyası iner. Bağlantıyı Kopyala da kullanılabilir.
4. İşletmenin slug değeri kaydedilince QR otomatik güncellenir. **Slug daha sonra değişirse basılı QR kodlar geçersiz olur.**
5. QR görselinin içindeki URL halen GitHub Pages test alan adını kullanır. Basılı kart siparişi vermeden önce `ftmotion.com` altında 200 HTTP yanıtı veren kalıcı rotaları kurun; yayınlanan QR kodlarını sonrasında alan adı değişecekse baskıya göndermeyin.
6. CDN'den QR kütüphanesi yüklenir; ilk kullanımda internet gerekir. Bu sürüm yeni veritabanı tablosu gerektirmez.

**Not:** İşletme kayıtlarının oluşturulması mevcut işletme yönetiminde yapılır. V11, kaydedilmiş işletmelere QR üretir ve PNG indirir.
