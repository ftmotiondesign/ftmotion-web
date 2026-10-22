# Müşteri ve Teklif Defterim

`kartim.html` üzerindeki bağlantı veya `musteri-defterim.html` üzerinden açılır. QR sayfası, doğrulanmış oturumu açık işletme sahibine özel defter kısayolu gösterir. Mevcut Supabase girişi kullanılır; işletme sahibi kendi kayıtlarını, ana yönetici seçtiği işletmeyi görür.

## Kullanım

1. Müşteri ekleyin: ad/firma, telefon, e-posta, adres.
2. Hızlı teklif oluşturun: müşteri, iş kalemleri, miktar, birim fiyat, indirim, KDV, geçerlilik ve iş şartları.
3. Form otomatik oluşur. WhatsApp bağlantısı hazır mesajı açar; gönderme işlemini işletme sahibi yapar. PDF / Yazdır, tarayıcının yazdırma ve PDF olarak kaydetme ekranını açar.
4. Müşteri bağlantıyı üyelik gerektirmeden açar, bir kez onay veya değişiklik yanıtı verebilir. Yanıt, bağlantıya erişen kişinin beyanıdır; kimlik doğrulaması veya elektronik imza değildir.
5. Yeni sürüm, önceki belgeyi değiştirmeden yeni içerik ve yeni bağlantı oluşturur. Eski sürüm tekrar onaylanamaz. Paylaşım tüm sürümler için kapatılabilir. Bağlantılar 90 gün geçerlidir.
6. Tahsilat kaydı aynı iş üzerinde birikir. Kalan alacak kartı yalnızca onaylanan veya en az bir ödeme alınan işleri toplar. Ödeme kayıtları fatura/makbuz değildir ve ödeme tahsil etmez.
7. Müşteri dosyasında özel görüşme notu ve isteğe bağlı hatırlatma tarihi girilir. Vadesi gelen açık hatırlatmalar genel bakışta listelenir. Haricî SMS/e-posta/push bildirimi gönderilmez.

## Veri ve güvenlik

Şema `sql/customer-ledger.sql` ile yeni kurulumda uygulanır. Bağlı projeye `customer_quote_ledger` ve `ledger_local_dates_and_historic_payment_summary` migrasyonları uygulanmıştır. Sorgular İstanbul tarihini kullanır. Tüm yeni tablolarda RLS ve açık asgari yetkiler bulunur. Notlar ve ödeme iç notları halka açık sorgulara dahil edilmez. Teklif linki rastgele UUID taşır; hash bölümünde bulunduğundan normal HTTP erişim kayıtlarına veya referrer başlığına taşınmaz.

Teklif ve ödeme toplamı sunucuda kuruş cinsinden hesaplanır. Yeni sürüm ve tahsilatlar aynı teklif satırını kilitler. Tahsilat için tekrar deneme kimliği kullanılır; fazla ödeme reddedilir. Yayınlanmış belge ve ödeme kayıtlarına doğrudan yazma yetkisi yoktur. İlk sürümde tahsilat düzeltme/iptal ekranı ve ücretli abonelik tahsilatı uygulanmamıştır.

## Doğrulama

- `node --test tests/ledger-core.test.mjs`: para hesabı, kuruş yuvarlama, HTML kaçışları, telefon biçimi.
- `tests/ledger-security.sql`: canlı şemada geçici işlem içinde sahiplik, anonim tablo erişimi, token paylaşımı, müşteri yanıtı, teklif sürümleri, fazla ödeme, idempotent tahsilat ve bağlantı kapatma. Tüm örnek kayıtlar rollback edilir.
- Arayüz: sahte verilerle müşteri ekleme, otomatik teklif oluşturma, sürüm açma; gerçek müşteri verisi veya mesaj gönderimi kullanılmadan kontrol edildi.
