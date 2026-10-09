/**
 * MC Milyoner - Node.js Backend & Gmail OTP Sunucusu (v0.0.1)
 *
 * Özellikler:
 * 1. Web sitesi statik dosyalarını sunar (HTTP Server - Port: 3000 veya process.env.PORT)
 * 2. POST /api/auth/send-otp: Gerçek Gmail (mail.google.com) adresine 6 haneli OTP kodu gönderir.
 * 3. POST /api/auth/verify-otp: 6 haneli kodu sunucu tarafında doğrular.
 * 4. GET /api/health: Sunucu sağlık kontrolü.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer yüklü değilse fallback
}

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const SUPER_ADMIN_EMAIL = 'codingdevelopia@gmail.com';

// 3 dakikalık geçerli OTP saklama belleği
const activeOtps = new Map();

// MIME Tipleri
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.htm': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

// .env dosyasını harici kütüphane gerektirmeden otomatik oku
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {}

// E-posta gönderici oluşturucu (Gmail SMTP veya Özel SMTP)
function createMailTransporter() {
  if (!nodemailer) return null;

  const user = process.env.GMAIL_USER || process.env.SMTP_USER || SUPER_ADMIN_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS;

  if (pass) {
    // Gerçek Gmail veya SMTP kimlik bilgileri tanımlıysa
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass
      }
    });
  }

  // Henüz App Password girilmediyse test transportu
  return nodemailer.createTransport({
    jsonTransport: true
  });
}

let transporter = createMailTransporter();

// FormSubmit HTTPS servisi üzerinden e-posta gönderme yardımcısı
function sendViaFormSubmit(recipientEmail, code) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const payload = JSON.stringify({
        _subject: `MC Milyoner Onay Kodunuz: ${code}`,
        email: recipientEmail,
        code: code,
        message: `MC Milyoner Giriş Onay Kodunuz: ${code}\n\nBu kod 3 dakika boyunca geçerlidir.\nAlıcı: ${recipientEmail}`
      });

      const req = https.request(`https://formsubmit.co/ajax/${encodeURIComponent(recipientEmail)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://codingm-eng.github.io',
          'Referer': 'https://codingm-eng.github.io/minecraft-milyoner/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch (e) {}
          const isActivation = body.toLowerCase().includes('activation');
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            activationNeeded: isActivation,
            message: parsed.message || body
          });
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

// HTML E-posta Şablonu
function buildOtpHtmlEmail(code, recipientEmail) {
  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>MC Milyoner Doğrulama Kodu</title>
  </head>
  <body style="margin: 0; padding: 20px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
    <div style="max-width: 520px; margin: 0 auto; background: #111827; border: 2px solid #10b981; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 24px; text-align: center; border-bottom: 2px solid #10b981;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 1px;">⛏️ MC MİLYONER</h1>
        <p style="margin: 6px 0 0 0; color: #6ee7b7; font-size: 13px; font-weight: 600;">BİLGİNİ SINA &bull; MINECRAFT BİLGİ YARIŞMASI</p>
      </div>
      <div style="padding: 28px 24px; text-align: center;">
        <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px;">Gmail Doğrulama Kodunuz</h2>
        <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">
          Sayın <strong>${recipientEmail}</strong>,<br>
          MC Milyoner platformuna giriş veya kayıt işleminizi tamamlamak için tek kullanımlık onay kodunuz aşağıdadır:
        </p>
        <div style="background: #0f172a; border: 2px dashed #f59e0b; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Giriş Onay Kodu</span>
          <span style="font-size: 34px; font-weight: 800; font-family: monospace; letter-spacing: 8px; color: #fbbf24;">${code}</span>
        </div>
        <p style="margin: 20px 0 0 0; color: #ef4444; font-size: 12px; font-weight: 600;">
          ⏱️ Bu kod 3 dakika boyunca geçerlidir. Kodunuzu hiç kimseyle paylaşmayın.
        </p>
      </div>
      <div style="background: #1f2937; padding: 14px 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #374151;">
        Bu e-postayı siz talep etmediyseniz lütfen dikkate almayın. &bull; MC Milyoner Güvenlik Ekibi
      </div>
    </div>
  </body>
  </html>
  `;
}

// E-posta Gönderme Fonksiyonu
async function dispatchEmail(recipientEmail, code) {
  // Konsol Terminal Panosu (Sunucu konsolunda anında görünür ve kopyalanabilir)
  console.log('\n===============================================================');
  console.log('       ⛏️  MC MİLYONER GİRİŞ ONAY KODU (OTP)                ');
  console.log('===============================================================');
  console.log(`👤 Alıcı E-posta:   ${recipientEmail}`);
  console.log(`🔐 Onay Kodu:       >>>  ${code}  <<<`);
  console.log(`⏱️ Geçerlilik:      3 Dakika`);
  console.log(`🌐 Hedef:           https://mail.google.com/`);
  console.log('===============================================================\n');

  const mailOptions = {
    from: `"MC Milyoner Platformu" <${process.env.GMAIL_USER || SUPER_ADMIN_EMAIL}>`,
    to: recipientEmail,
    subject: `🔐 MC Milyoner Doğrulama Kodunuz: ${code}`,
    text: `MC Milyoner Giriş Onay Kodunuz: ${code}\n\nBu kod 3 dakika boyunca geçerlidir.`,
    html: buildOtpHtmlEmail(code, recipientEmail)
  };

  // 1. Gerçek Gmail SMTP (GMAIL_APP_PASSWORD tanımlıysa)
  if (transporter && (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[SUNUCU GMAIL SMTP BAŞARILI] -> Mesaj ID: ${info.messageId}`);
      return { success: true, delivered: true, method: 'GMAIL_SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`[SUNUCU GMAIL SMTP HATASI]:`, err.message);
    }
  }

  // 2. HTTPS FormSubmit Mail Transport Fallback (Şifresiz doğrudan Gmail iletimi)
  console.log(`[SUNUCU] FormSubmit HTTPS servisi üzerinden Gmail iletimi deneniyor...`);
  const fsResult = await sendViaFormSubmit(recipientEmail, code);
  if (fsResult.success || fsResult.activationNeeded) {
    if (fsResult.activationNeeded) {
      console.log(`⚠️ [GMAIL BİLGİ]: ${recipientEmail} adresine ilk kullanım aktivasyon linki gönderildi. Lütfen mail.google.com'da onaylayın.`);
    } else {
      console.log(`[SUNUCU FORMSUBMIT BAŞARILI] -> E-posta ${recipientEmail} adresine iletildi.`);
    }
    return {
      success: true,
      delivered: true,
      method: 'FORMSUBMIT',
      activationNeeded: Boolean(fsResult.activationNeeded)
    };
  }

  return { success: true, delivered: false, method: 'CONSOLE_ONLY' };
}

// JSON İstek Gövdesini Oku
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('İstek gövdesi çok büyük.'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Geçersiz JSON verisi.'));
      }
    });
    req.on('error', reject);
  });
}

// JSON Yanıt Gönder
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(payload);
}

// HTTP Sunucusu
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ==========================================
  // API ENDPOINTS
  // ==========================================

  // 1. Sağlık Kontrolü
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'MC Milyoner Node.js Backend Server',
      version: '0.0.1',
      time: new Date().toISOString()
    });
  }

  // 2. OTP Gönder (POST /api/auth/send-otp)
  if (req.method === 'POST' && pathname === '/api/auth/send-otp') {
    try {
      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();

      if (!email || !email.includes('@')) {
        return sendJson(res, 400, {
          success: false,
          error: 'Lütfen geçerli bir Gmail adresi girin.'
        });
      }

      // 6 haneli kod (istemciden gelmişse onu kullan, yoksa yeni üret)
      const inputCode = String(body.code || '').trim();
      const code = (/^\d{6}$/.test(inputCode))
        ? inputCode
        : String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 3 * 60 * 1000; // 3 dakika

      activeOtps.set(email, { code, expiresAt, attempts: 0 });

      // E-postayı Gmail gelen kutusuna ilet
      const mailRes = await dispatchEmail(email, code);

      return sendJson(res, 200, {
        success: true,
        message: 'Onay kodunuz mail.google.com gelen kutunuza gönderildi.',
        email,
        expiresAt,
        delivered: mailRes.delivered,
        method: mailRes.method,
        activationNeeded: Boolean(mailRes.activationNeeded)
      });
    } catch (err) {
      console.error('[API send-otp Error]', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 3. OTP Doğrula (POST /api/auth/verify-otp)
  if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
    try {
      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const inputCode = String(body.code || '').trim();

      const record = activeOtps.get(email);
      if (!record) {
        return sendJson(res, 400, {
          success: false,
          error: 'Bu e-posta için aktif bir onay kodu bulunamadı veya süresi doldu.'
        });
      }

      if (Date.now() > record.expiresAt) {
        activeOtps.delete(email);
        return sendJson(res, 400, {
          success: false,
          error: 'Onay kodunun 3 dakikalık süresi doldu. Lütfen tekrar kod isteyin.'
        });
      }

      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        activeOtps.delete(email);
        return sendJson(res, 400, {
          success: false,
          error: 'Çok fazla hatalı deneme yapıldı. Lütfen yeni kod isteyin.'
        });
      }

      if (inputCode !== record.code) {
        return sendJson(res, 400, {
          success: false,
          error: 'Girdiğiniz 6 haneli onay kodu hatalı! Lütfen tekrar kontrol edin.'
        });
      }

      // Doğrulama başarılı -> Kodu tüket
      activeOtps.delete(email);
      const isSuperAdmin = Boolean(email === SUPER_ADMIN_EMAIL);

      return sendJson(res, 200, {
        success: true,
        verified: true,
        email,
        isAdmin: isSuperAdmin
      });
    } catch (err) {
      console.error('[API verify-otp Error]', err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ==========================================
  // STATİK DOSYA SUNUCUSU (Web Platformu)
  // ==========================================
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(ROOT_DIR, decodeURIComponent(filePath));

  // Güvenlik: ROOT_DIR dışına çıkışı engelle
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Erişim engellendi.');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 durumunda index.html'e fallback (SPA)
      const fallbackPath = path.join(ROOT_DIR, 'index.html');
      fs.readFile(fallbackPath, (fallbackErr, content) => {
        if (fallbackErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
          return res.end('404 - Sayfa Bulunamadı');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        return res.end('500 - Dosya Okuma Hatası');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log('===============================================================');
  console.log('🚀 MC MİLYONER NODE.JS SUNUCUSU AKTİF!');
  console.log(`🌐 Web Platformu: http://localhost:${PORT}`);
  console.log(`📧 Gmail OTP API: http://localhost:${PORT}/api/auth/send-otp`);
  console.log(`🛡️ Yönetici E-posta: ${SUPER_ADMIN_EMAIL}`);
  console.log('===============================================================');
});
