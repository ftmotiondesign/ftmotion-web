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

Teklif ve ödeme toplamı sunucuda kuruş cinsinden hesaplanır. Yeni sürüm ve tahsilatlar aynı teklif satırını kilitler. Tahsilat için tekrar deneme kimliği kullanılır; fazla ödeme reddedilir. Yayınlanmış belge ve ödeme kayıtlarına doğrudan yazma yetkisi yoktur. Ücretli abonelik tahsilatı uygulanmamıştır.

## Doğrulama

- `node --test tests/ledger-core.test.mjs`: para hesabı, kuruş yuvarlama, HTML kaçışları, telefon biçimi.
- `tests/ledger-security.sql`: canlı şemada geçici işlem içinde sahiplik, anonim tablo erişimi, token paylaşımı, müşteri yanıtı, teklif sürümleri, fazla ödeme, idempotent tahsilat ve bağlantı kapatma. Tüm örnek kayıtlar rollback edilir.
- Arayüz: sahte verilerle müşteri ekleme, otomatik teklif oluşturma, sürüm açma; gerçek müşteri verisi veya mesaj gönderimi kullanılmadan kontrol edildi.

## İş akışı güncellemesi

`sql/customer-ledger-workflow.sql`, ilk şemadan sonra uygulanır; mevcut veriler korunur.

- Müşteri, teklif ve tahsilat bölümleri seçilince genel özet kapanır, bölüm başlığına odaklanılır. Özet kartları da ilgili listeyi açar. Mobil menü iki satırda sabittir; listeler yatay kaydırma gerektirmeyen kartlardır.
- Ürün/hizmetler fiyat, birim ve açıklamayla kaydedilir; arşivlenip geri alınabilir. Teklife eklendikten sonra fiyat değişiklikleri eski teklifleri etkilemez.
- Yarım teklifler kullanıcı ve işletme kapsamında cihazda anında, hesapta kısa gecikmeyle saklanır. Yeni teklif ve her teklif revizyonu ayrı taslak taşır. Taslaklarım üzerinden devam edilir; gönderilmiş belge ile taslak ayrı tutulur. Eşitleme hatası kullanıcıya gösterilir.
- Tahsilat düzeltme/iptal nedeni zorunludur. Orijinal ödeme korunur; düzeltmede aynı işlem içinde yeni ödeme oluşturulur. İptal edilen tutarlar, kalan alacaktan ve müşteriye açık ödeme özetinden çıkarılır. RPC yetkiyi sunucuda kontrol eder, satır kilidi ve tekrar deneme kimliği kullanır.
- Takvim, tarihli açık müşteri notlarını ve yanıtsız tekliflerin geçerlilik günlerini gösterir. SMS/push gönderilmez.
- Konuşarak doldurma, destekleyen tarayıcıda kullanıcı mikrofon düğmesine bastığında çalışır. Ses tarayıcının konuşma hizmetiyle işlenir. Yazılan/dikte edilen metnin toplam fiyatı rakam veya Türkçe sayı sözcüklerinden çıkarılır, varsa tam müşteri adı eşleştirilir. Alanlar işletme sahibi tarafından kontrol edilerek gönderilir; serbest konuşmanın her ayrıntısını ayrıştıran bir yapay zekâ servisi değildir.
- PDF, yerel olarak sunulan sabit sürümlü pdf-lib 1.17.1 / fontkit 1.1.1 ve Türkçe destekli DejaVu Sans yazı tipiyle tarayıcıda oluşturulur. Metin seçilebilir, uzun belgeler sayfalanır. Desteklenen cihazlarda dosya paylaşılır; diğerlerinde indirilebilir. Otomatik indirme engellenirse görünür “PDF hazır — indir” bağlantısı kalır.

Doğrulama: 8 Node testi (Türkçe tutar çözümleme, iptal edilmiş tahsilatların dışlanması, taslak birleştirme ve çok sayfalı PDF dahil); gerçek şemada rollback edilen kapsam/ürün/taslak/düzeltme/iptal testleri; mobil genişlikte müşteri geçişi, katalogdan ekleme, yenileme sonrası taslak açma, takvim ve ödeme düzeltme arayüz kontrolü. PDF üretimi ve Türkçe karakterler test edilip render edildi. Bulut tarayıcısının indirme olayı yakalanamadı; oluşturulan dosyanın görünür indirme bağlantısı doğrulandı.
