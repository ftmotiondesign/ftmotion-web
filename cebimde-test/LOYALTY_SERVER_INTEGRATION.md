# Cebimde Sadakat — sunucu entegrasyon sözleşmesi (geliştirme)
Bu dosya yalnızca feature/cebimde-sadakat-test dalındadır; canlı yayın veya veritabanı değişikliği değildir.

## Güven sınırı
- Müşteri ve işletme ayrı Supabase Auth oturumlarıyla giriş yapar.
- Tarayıcıya yalnızca publishable/anon anahtar verilir. service_role yalnızca sunucuda.
- Müşteri, kendi üyeliği için 120 saniye geçerli rastgele en az 128 bitlik QR token ister. Tokenın kendisi veritabanında saklanmaz, SHA-256 hash saklanır.
- İşletme, oturumundan kimliği doğrulanmış kullanıcı olarak tokenı sunucuya gönderir. İstekten business_id, customer_id, visit_count gibi yetki belirleyen alanlar kabul edilmez; işletme kimliği yetkili businesses.owner_id ilişkisiyle sunucuda bulunur.
- Sunucu, işletmenin sadakat hakkının aktif olduğunu ve tokenın ilgili işletmenin programındaki müşteriye ait olduğunu doğrular.
- Atomik veritabanı işleminde token FOR UPDATE ile kilitlenir; süresi ve consumed_at kontrol edilir; consumed_at yazılır; tek ziyaret ledger kaydı eklenir. Herhangi bir adım başarısızsa işlem geri alınır.
- Hediye tesliminde aynı üyelik için eşzamanlı talepler kilitlenir; mevcut ziyaretlerden kazanılan ve daha önce teslim edilen hediyeler hesaplanır; yeterli bakiye varsa bir teslimat hareketi kaydedilir.
- Ziyaret/hediye geçmişi sadece ilgili müşteri, işletme sahibi ve yetkili FTMotion yöneticisine sunucu tarafında filtrelenerek gösterilir.
- Her önemli işlemde actor_user_id, zaman, ilgili üyelik ve token kimliği kaydedilir. Ham token ve kişisel veriler loglara yazılmaz.

## Planlanan uç noktalar (henüz kurulmadı)
POST /loyalty/token — müşteri: kendi üyeliği için geçici QR token
POST /loyalty/visits/confirm — işletme: {token}; doğrula ve +1 ziyaret
POST /loyalty/rewards/redeem — işletme: {membership_id}; hediye teslimini onayla
GET /loyalty/me — müşteri: kendi sadakat kartları ve geçmişi
GET /loyalty/business — işletme: yalnızca kendi sadakat programı ve işlemleri

## Yayın kapıları
1. V41 arayüzü değişmeden bağlanacak; müşteri ekranında işletme/admin butonları olmayacak.
2. Ayrı test ortamında iki gerçek oturumla uçtan uca QR denemesi yapılacak.
3. Aynı tokenla eşzamanlı iki onay denemesinde yalnızca bir ziyaret yazılacak.
4. Başka işletmenin tokenı, yetkisiz işletme ve aboneliği bitmiş işletme reddedilecek.
5. Eşzamanlı iki hediye teslimi, bir hediyeyi iki kez düşüremeyecek.
6. Yedek, geri dönüş ve güvenlik incelemesi tamamlanmadan canlıya alınmayacak.

## Yerel test
`node --test cebimde-test/loyalty-domain.test.mjs`
11 test başarıyla çalıştırıldı (2026-10-27). Bu yalnızca saf iş mantığı testidir; sunucu, veritabanı veya kamera testi değildir.
