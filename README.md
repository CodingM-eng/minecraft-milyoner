# Kim Milyoner Olmak İster? — Minecraft Edition 💎🟢

Minecraft temalı, tamamen interaktif ve Türkçe **"Kim Milyoner Olmak İster? — Minecraft Edition"** çok oyunculu web bilgi yarışması ve turnuva platformu.

- **Canlı Web Sitesi (Frontend):** https://codingm-eng.github.io/minecraft-milyoner/
- **GitHub Deposu:** https://github.com/CodingM-eng/minecraft-milyoner
- **Backend Sunucusu:** Node.js (`server.js`) — REST API, Gmail OTP, Stripe, Telegram Bot & Sesli Sohbet

---

## ✨ Özellikler

- **115+ Özgün Türkçe Minecraft Sorusu**: 18 farklı kategoride (*Mobs, Bloklar, Eşyalar, Crafting, Redstone, Enchantments, Nether, End, Biyomlar, Köylüler, Yapılar, Minecraft mekanikleri, Komutlar, Java Edition, Bedrock Edition, Minecraft tarihçesi, Güncellemeler, Nadir bilgiler*).
- **Rastgele ve Adil Soru Sistemi**: Her yeni oyunda sorular zorluk seviyesine göre (`1–5: Kolay`, `6–10: Orta`, `11–15: Zor`) rastgele seçilir ve aynı oyunda hiçbir soru tekrar etmez.
- **15 Basamaklı Emerald Ödül Merdiveni**: `100 Emerald`'dan `5.000.000 Emerald` büyük ödüle kadar ilerleyen ödül sistemi.
- **4 Çalışan Joker**:
  - **%50 / 50**: İki yanlış cevabı eler.
  - **Seyirciye Sor**: A, B, C ve D şıkları için yüzdelik seyirci oylaması grafiği gösterir.
  - **Köylüye Sor**: Bilge Köylü ipucu verir.
  - **Soruyu Değiştir**: Aynı zorluk seviyesinden yeni bir soru getirir.
- **Güvenli Kimlik Doğrulama**:
  - Gmail OTP (kriptografik sunucu tarafı 6 haneli kod)
  - Firebase Authentication & Google Sign-In
  - Telegram HMAC SHA-256 imzalı derin bağlantı girişi
  - Discord OAuth2 hesap bağlama
  - Ayrı Yönetici Girişi (`codingdevelopia@gmail.com` Salted SHA-256)
- **Ekonomi ve Mağaza**: Emerald ve Netherite bakiyeleri, VIP/MVIP rütbeleri, kozmetikler, Stripe Checkout.
- **Parti ve Turnuva**: Parti oluşturma, jüri sistemi, WebRTC sesli sohbet ve davetler.
- **Destek ve Moderasyon**: 24/7 Biletleme sistemi, hata/öneri bildirimleri, küfür filtresi, susturma (mute).

---

## 🚀 Render.com Ücretsiz Backend Dağıtım Rehberi

GitHub Pages yalnızca statik HTML/JS/CSS dosyaları barındırır. `server.js` Node.js backend servislerini (OTP, Stripe, Telegram, Discord, Destek) çalıştırmak için Render üzerinde **Free Web Service** oluşturabilirsiniz:

### 1. Render Web Servisi Oluşturma
1. [Render Dashboard](https://dashboard.render.com/) adresine gidin.
2. **New +** -> **Web Service** seçin.
3. GitHub deponuzu (`CodingM-eng/minecraft-milyoner`) bağlayın.
4. Temel ayarları yapın:
   - **Name:** `minecraft-milyoner` (veya istediğiniz bir ad)
   - **Region:** `Frankfurt (EU Central)`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
   - **Health Check Path:** `/api/health`

*(Alternatif: Depodaki `render.yaml` dosyası sayesinde **New +** -> **Blueprint** seçerek tek tıkla otomatik kurabilirsiniz.)*

### 2. Gizli Ortam Değişkenleri (Environment Variables)
Render paneli **Environment** sekmesinden aşağıdaki değişkenleri tanımlayın:

| Değişken Adı | Açıklama |
|--------------|----------|
| `NODE_ENV` | `production` |
| `SUPER_ADMIN_EMAIL` | `codingdevelopia@gmail.com` |
| `GMAIL_USER` | Gmail adresiniz (örn. `ornek@gmail.com`) |
| `GMAIL_APP_PASSWORD` | 16 haneli Google Uygulama Şifresi ([Nasıl Alınır?](https://myaccount.google.com/apppasswords)) |
| `TELEGRAM_BOT_TOKEN` | @BotFather üzerinden alınan Telegram bot tokeni |
| `TELEGRAM_BOT_USERNAME` | Telegram bot kullanıcı adı (örn. `MCMilyonerBot`) |
| `TELEGRAM_CHAT_ID` | Bot duyuru/anket kanalı veya grup ID'si |
| `DISCORD_CLIENT_ID` | Discord Developer Portal Client ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal Client Secret |
| `STRIPE_SECRET_KEY` | Stripe gizli anahtarı (`sk_test_...` veya `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook imza anahtarı (`whsec_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe genel anahtarı (`pk_test_...` veya `pk_live_...`) |

### 3. Sağlık Kontrolü (Health Check)
Deploy tamamlandıktan sonra tarayıcınızdan veya terminalden:
```bash
curl https://<render-servis-adiniz>.onrender.com/api/health
```
Aşağıdaki gibi bir JSON yanıtı döndüğünde sunucunuz hazırdır:
```json
{
  "status": "ok",
  "service": "MC Milyoner Node.js Backend Server",
  "version": "2.0.0",
  "features": ["AUTH_OTP", "STRIPE_CHECKOUT", "STRIPE_WEBHOOKS", "DISCOUNTS", "TELEGRAM_POLLS", "EXTRA_LIFE", "FRIENDS", "PARTY_JURY"]
}
```

### 4. Canlı Sitede (GitHub Pages) Backend Adresini Bağlama
1. Canlı siteye gidin: https://codingm-eng.github.io/minecraft-milyoner/
2. Giriş kapısındaki **"⚙️ Backend Sunucu (API) Bağlantı Ayarı"** düğmesine tıklayın.
3. Render servis adresinizi girin (Örn: `https://minecraft-milyoner.onrender.com` — sonuna `/api` koymayın).
4. **"🔍 Bağlantıyı Test Et"** düğmesine basarak `GET /api/health` yanıtının yeşil yandığını görün.
5. **"💾 Sunucu Adresini Kaydet"** düğmesine basın. Ayar tarayıcınızın `localStorage` alanına kalıcı olarak kaydedilir ve sonraki ziyaretlerde otomatik kullanılır.

---

## ⚠️ Render Free Planı ve Kalıcı Veri (Persistence) Bilgisi

Render Free planı kullanırken aşağıdaki hususları göz önünde bulundurun:

1. **Uyku Modu (Cold Start):**
   Render Free servisleri 15 dakika boyunca istek almazsa otomatik uykuya geçer. Uyku sonrasındaki ilk istekte sunucunun açılması ~50 saniye sürebilir. Bu durum bir hata değildir.
2. **Geçici Disk (Ephemeral Filesystem):**
   Render Free konteynerleri yeniden başlatıldığında veya yeni commit deploy edildiğinde yerel diske (`./data/*.json`) yazılan geçici dosyalar sıfırlanabilir.
3. **Kalıcı Veritabanı Önerisi (Firestore / External DB):**
   Üretim ortamında kullanıcı profilleri, bakiyeler ve başarımlar `firebase-config.js` ve `firestore.rules` üzerinden Cloud Firestore'a kaydedilir. Kritik veriler için Firebase veya MongoDB Atlas gibi harici kalıcı veritabanı kullanılmalıdır.

---

## 🧪 Testleri Çalıştırma

Tüm güvenlik ve API kurallarını doğrulamak için:

```bash
npm test
```
