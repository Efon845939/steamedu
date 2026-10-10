# Deploy rehberi (ücretsiz)

Hedef: jüri linke tıkladığında uygulama birkaç saniyede açılsın, öğretmen kodu kimsede olmasın.

## Neden bu kurulum

| Parça | Host | Neden |
|---|---|---|
| Frontend (React) + API (FastAPI) | **Vercel Hobby** | `vercel.json` ikisini tek projede kuruyor: site `/`, API `/api`. Tek domain olduğu için CORS ayarı gerekmiyor. Fonksiyonlar uyumaz; soğuk başlangıç ~1-2 sn. |
| Veritabanı | **MongoDB Atlas M0** | Kalıcı ücretsiz, 512 MB. Bu proje için fazlasıyla yeter. |

Render'ın ücretsiz planı 15 dakika boşta kalınca uyuyor ve ilk istek ~50 sn bekletiyor. Jüri o 50 saniyede sekmeyi kapatır, o yüzden backend için seçmedik.

## 1. MongoDB Atlas

1. https://cloud.mongodb.com → yeni proje → **Create cluster** → **M0 (Free)**, sağlayıcı AWS, bölge **Frankfurt (eu-central-1)**.
2. **Database Access** → kullanıcı oluştur, şifreyi "Autogenerate" ile üret ve sadece bir parola yöneticisine kaydet.
   Yetki olarak "Atlas admin" değil, **Specific Privileges → `readWrite` @ `steamedu`** seç. Şifre sızarsa zarar bu veritabanıyla sınırlı kalır.
3. **Network Access** → **Allow access from anywhere** (`0.0.0.0/0`).
   Vercel Hobby'de sabit çıkış IP'si yok, o yüzden mecburen her IP'ye açıyoruz. TLS sadece trafiği şifreler, kimin bağlanabileceğini kısıtlamaz.
   Yani tek kilit `MONGO_URL` içindeki şifre: onu hiçbir yere yapıştırma. Gerçek öğrencilerle pilot yaparsan isim yerine takma ad kullandır, gereksiz kişisel veri toplama.
4. **Connect → Drivers** → `mongodb+srv://...` bağlantı adresini kopyala, `<password>` kısmına şifreyi yaz.

## 2. Vercel

1. https://vercel.com → GitHub ile giriş → **Add New → Project** → `Efon845939/steamedu` reposunu import et.
   Root Directory repo kökü kalsın; `vercel.json` iki servisi kendisi tanımlıyor.
2. **Environment Variables** kısmına bunları **sen** gir (chat'e, repoya, ekran görüntüsüne asla yapıştırma):

   | Anahtar | Değer |
   |---|---|
   | `MONGO_URL` | Atlas'tan kopyaladığın `mongodb+srv://...` adresi |
   | `DB_NAME` | `steamedu` |
   | `JWT_SECRET_KEY` | Uzun rastgele bir dize. Üretmek için: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
   | `TEACHER_SIGNUP_CODE` | Kendi seçtiğin **yeni** kod (en az 12 karakter). Git geçmişindeki eski kodu kullanma, o artık herkese açık. |
   | `SEED_DEMO_ACCOUNTS` | `false` |

   `REACT_APP_BACKEND_URL` ve `CORS_ORIGINS` boş kalsın; site ve API aynı domainde.
3. **Settings → Functions → Region** → **Frankfurt (fra1)**. Atlas ile aynı bölgede olunca her API çağrısı daha hızlı.
4. **Deploy**.

## 3. Kontrol

1. `https://<proje-adın>.vercel.app/api/health` → `{"status":"ok"}` görmelisin.
   `503 database unreachable` görürsen: `MONGO_URL` şifresi yanlış ya da Atlas Network Access adımı eksik.
2. Ana sayfada **öğretmen** olarak kayıt ol (kendi kodunla).
3. Öğretmen panelinde **Load starter content** butonuna bas. Quiz, aktivite ve Debug Arena içerikleri yüklenir.

## 4. Jüri erişimi

`SEED_DEMO_ACCOUNTS=true` yapma: o hesapların şifreleri repoda açık, canlı sitede herkes "doğrulanmış öğretmen" olarak girebilir.
Bunun yerine:

1. Kendi kodunla jüri için ayrı bir öğretmen hesabı aç (ör. `solve_reviewer`) ve güçlü bir şifre ver.
2. Bu kullanıcı adı ve şifreyi sadece Solve başvuru formundaki erişim alanına yaz.
3. Misconception heatmap boş görünmesin diye birkaç test öğrenci hesabıyla tanı quizini çöz.
   Bunlar test hesabı; başvuruda "kullanıcı" diye sayma.

## 5. Kodu değiştirmek

Kod sızarsa: Vercel → Settings → Environment Variables → `TEACHER_SIGNUP_CODE` değerini değiştir → **Redeploy**.
Eski kod hemen çalışmaz hale gelir; mevcut öğretmen hesapları etkilenmez.

## Yerelde çalıştırmak

```bash
cp backend/.env.example backend/.env    # değerleri doldur
pip install -r backend/requirements-dev.txt
cd backend && uvicorn server:app --reload
```

Testler sunucu gerektirmez: `cd backend && pytest`. Canlı sunucuya karşı koşan eski testler `REACT_APP_BACKEND_URL` tanımlı değilse atlanır.

## Plan B

Vercel import sırasında `services` ayarını kabul etmezse: frontend'i Vercel'de (`frontend/` kökü) bırak, backend'i Render'a (`backend/`, start komutu `uvicorn server:app --host 0.0.0.0 --port $PORT`) koy.
Sonra frontend'e `REACT_APP_BACKEND_URL=<render adresi>`, backend'e `CORS_ORIGINS=<vercel adresi>` ekle.
Render uyumasın diye UptimeRobot gibi ücretsiz bir servisle `/api/health` adresine 5 dakikada bir istek attır.
