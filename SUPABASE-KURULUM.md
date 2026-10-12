# Canlı üyelik kurulum adımları

1. Supabase projesi aç. Authentication > Providers bölümünde Email girişini etkinleştir.
2. `supabase-config.example.json` dosyasını `supabase-config.json` adıyla kopyala. `url` ve publishable (anon) key değerlerini kendi panelinden doldur. **Service role key asla web dosyasına koyma.**
3. Supabase Auth için Site URL ve Redirect URLs ayarlarına canlı alan adını ekle.
4. `giris.html` gerçek kayıt/giriş yapar. `panel.html` gerçek oturum kontrolü yapar. Ancak mevcut `qr/index.html` ve `menu/index.html` yalnızca tarayıcıda çalışan demo sayfalarıdır. Gerçek müşteriye açılmadan önce işletme bazlı tablolar, storage ve Row Level Security (RLS) ile entegre edilmeleri gerekir.
5. Fiyat yöneticisi de henüz localStorage kullanır; canlıda yalnızca yöneticiye özel bir arayüz ve RLS politikalarıyla merkezi kayıt yapılmalıdır.
6. Görsel/video URL'lerini Cloudinary yerine kendi seçtiğin depolama hizmetinden kullan; demo dosyalar harici URL gösterir, dosya yükleme yapmaz.
