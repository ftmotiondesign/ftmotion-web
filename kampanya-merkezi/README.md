# Kampanya Merkezi — Aşama 1 (izole test)

Bu klasör canlı kartvizit/panel dosyalarına dokunmadan müşteri kayıt ve kanal bazlı izin akışının prototipidir.

## Koruma / yedek
1. main dalının SHA değerini kaydedin ve release etiketi oluşturun.
2. Supabase veritabanının bağımsız yedeğini alın; geri yüklemeyi ayrı test projesinde doğrulayın.
3. Storage bucket dosyalarını ayrıca yedekleyin; DB yedeği Storage nesnelerini içermez.
4. Canlı işletme, QR yönlendirme, oturum açma ve panel için önce/sonra smoke test yapın.
5. Bu dalda test tamamlanmadan main'e birleştirmeyin.

## Veritabanı tasarımı
Mevcut crm_customers satış/teklif CRM'sine aittir. Kampanya alıcılarını ayrı campaign_contacts tablosunda tutun. campaign_consents tablosunda kanal, durum, metin sürümü, kaynak, zaman, ispat ve ret bilgisi bulunmalıdır. Tek işletmenin verileri diğerine kapalı olmalı; RLS politikaları mevcut owns_business fonksiyonu incelendikten sonra uygulanmalıdır. İzin geçmişi append-only tutulmalı. Önceden var olan CRM müşterilerini otomatik pazarlama izni verilmiş saymayın.

## Testler
- Aynı telefon/e-posta aynı işletmede yinelenmesin; farklı işletmelerde bağımsız olsun.
- WhatsApp izni olmadan WhatsApp gönderimi mümkün olmasın.
- E-posta izni olmadan e-posta gönderimi mümkün olmasın.
- Ret sonrası sonraki kampanyalarda alıcı hariç tutulsun.
- Kullanıcı A, işletme B kayıtlarını göremesin.
- Form girişleri XSS/uzunluk/telefon/e-posta doğrulamasından geçsin.
- Gerçek gönderim ve canlı DB yazımı bu prototipte KAPALI.

## Yayına geçiş
Önce test Supabase projesinde migration + RLS testleri; sonra ayrı PR incelemesi ve kontrollü yayın. Rollback: eski main commit'ine dönüş, DB için ileri uyumlu migration; canlı DB restore son çare.
