# Başol Yapı — İş Yönetimi pilotu

Pilot işletme: `basol-yapi`

## Erişim
- Müşteri Talep: yalnızca FTMotion ana yönetimi bu işletme için onayladıktan sonra kamuya açık kartta görünür.
- Usta Hakediş: hiçbir zaman kamuya açık kartta listelenmez. Sadece işletmenin yetkilendirdiği, kimliği doğrulanmış ustalar erişebilir.
- İşletme paneli: yalnızca aynı işletmeye ait talepleri ve hakedişleri okuyabilir.
- Diğer işletmeler: modüller varsayılan kapalıdır.
- Ücretlendirme: modül bazlı ve ana yönetici onaylı; fiyat henüz belirlenmedi.

## Veri modeli (uygulama öncesi)
- business_modules: business_id, module_key, approved_by_admin, enabled, approved_at
- worker_memberships: business_id, user_id, status
- work_claims: business_id, worker_user_id, job_description, amount_try, status, created_at
- customer_requests: business_id, customer_name, phone, request_type, description, status, created_at

## Güvenlik gereklilikleri
- Supabase RLS tüm tablolarda açık olmalı.
- İstemci tarafından gönderilen business_id ve worker_user_id yetkilendirme yerine geçmez.
- Hakediş ekleme: sadece aktif üyeliği olan doğrulanmış usta.
- Hakediş okuma: kaydı oluşturan usta veya aynı işletmenin yetkili yöneticisi.
- Hakediş onayı: sadece işletme yöneticisi.
- Modül aktivasyonu: sadece FTMotion ana yöneticisi, sunucu tarafında doğrulanarak.
- Müşteri talebi ekleme: spam sınırlaması ve doğrulama ile; anonim okuma yasak.
- Usta özel URL'si tek başına erişim yetkisi vermez.

## Durum
Bu dal canlı sistemden ayrılmış güvenli çalışma dalıdır. Canlı kart ve veritabanında henüz değişiklik yoktur.
