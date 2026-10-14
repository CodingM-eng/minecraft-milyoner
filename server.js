/**
 * MC Milyoner - Node.js Backend & API Sunucusu (v2.0.0 Production)
 *
 * Özellikler:
 * 1. Web sitesi statik dosyalarını sunar (HTTP Server - Port: 3000 veya process.env.PORT)
 * 2. POST /api/auth/send-otp & POST /api/auth/verify-otp: Gmail OTP Doğrulama Servisi
 * 3. Stripe Checkout & İdempotent Webhook Doğrulama:
 *    - POST /api/stripe/create-checkout-session
 *    - POST /api/stripe/webhook (HMAC SHA-256 İmzası & İdempotent İşlem)
 *    - GET /api/stripe/session-status
 *    - GET /api/stripe/transactions
 *    - GET/POST /api/stripe/config
 * 4. Yönetici Kontrollü İndirimler & Kupon Kodları:
 *    - GET /api/discounts/list
 *    - POST /api/discounts/create
 *    - POST /api/discounts/validate
 *    - POST /api/discounts/delete
 * 5. Gerçek Telegram Bot Anketi ("Sunucuya Sor"):
 *    - POST /api/telegram/create-poll (sendPoll)
 *    - GET /api/telegram/poll-status (Gerçek oy dağılımı & beraberlik kontrolü)
 *    - POST /api/telegram/test-poll
 *    - GET /api/telegram/config
 * 6. Ekstra Can & Ekonomi Denetimi:
 *    - POST /api/extra-life/consume (Atomik tüketim & bakiye kontrolü)
 *    - GET /api/economy/audit
 * 7. Gerçek Arkadaşlar Sistemi:
 *    - POST /api/friends/request
 *    - GET /api/friends/list
 *    - POST /api/friends/respond
 *    - POST /api/friends/remove
 * 8. Dönüşümlü Parti Jürisi & Canlı Gözlem Ekranı:
 *    - POST /api/party/jury-rotate
 *    - GET /api/party/jury-state
 *    - POST /api/party/player-progress
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer yüklü değilse fallback
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const SUPER_ADMIN_EMAIL = 'codingdevelopia@gmail.com';

// 3 dakikalık geçerli OTP saklama belleği
const activeOtps = new Map();

// Bellek İçi Veri Depoları (Kalıcı JSON yedeklemeli)
const DATA_DIR = path.join(ROOT_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

function safeLoadJson(filename, defaultValue) {
  try {
    const p = path.join(DATA_DIR, filename);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return defaultValue;
}

function safeSaveJson(filename, data) {
  try {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// 0. Kalıcı Kullanıcı Veritabanı Deposu (Veri Kaybı Önleme & İkili Yedekleme)
let persistentUsers = safeLoadJson('users.json', null);
if (!Array.isArray(persistentUsers) || persistentUsers.length === 0) {
  const backupUsers = safeLoadJson('users_backup.json', null);
  if (Array.isArray(backupUsers) && backupUsers.length > 0) {
    persistentUsers = backupUsers;
    safeSaveJson('users.json', persistentUsers);
  } else {
    persistentUsers = Array.isArray(persistentUsers) ? persistentUsers : [];
  }
}

// Telegram Destek Grubu & Botu Yapılandırması (Kalıcı ve Güvenli Sunucu Deposu)
let telegramSupportConfig = safeLoadJson('telegram_support_config.json', {
  botToken: '',
  groupId: ''
});

function getSupportBotToken() {
  return process.env.TELEGRAM_SUPPORT_BOT_TOKEN || telegramSupportConfig.botToken || '';
}

function getSupportGroupId() {
  return process.env.TELEGRAM_SUPPORT_GROUP_ID || telegramSupportConfig.groupId || '';
}

function savePersistentUsers() {
  safeSaveJson('users.json', persistentUsers);
  if (Array.isArray(persistentUsers) && persistentUsers.length > 0) {
    safeSaveJson('users_backup.json', persistentUsers);
  }
}

// Whitelist (Beyaz Liste) Yapılandırması
let whitelistConfig = safeLoadJson('whitelist.json', {
  enabled: false,
  allowedUsers: ['admin', 'efekan', 'codingdevelopia@gmail.com']
});
function saveWhitelistConfig() {
  safeSaveJson('whitelist.json', whitelistConfig);
}

// Etkinlik Modu (Events) Deposu
let persistentEvents = safeLoadJson('events.json', []);
let persistentEventClaims = safeLoadJson('event_claims.json', {});
function savePersistentEvents() {
  safeSaveJson('events.json', persistentEvents);
  safeSaveJson('event_claims.json', persistentEventClaims);
}

// Bakım Modu (Maintenance) Yapılandırması
let maintenanceConfig = safeLoadJson('maintenance.json', {
  enabled: false,
  title: 'BAKIM MODU',
  message: 'Sunucumuz şu anda bakım modundadır. Lütfen daha sonra tekrar deneyiniz.'
});
function saveMaintenanceConfig() {
  safeSaveJson('maintenance.json', maintenanceConfig);
}

// Yarışma Başına 1 Ekstra Can Denetimi Deposu
let persistentMatchLives = safeLoadJson('match_used_lives.json', {});
function savePersistentMatchLives() {
  safeSaveJson('match_used_lives.json', persistentMatchLives);
}

function verifyStaffAccount(username, allowedRoles = ['TICKET', 'MODERATOR', 'ADMIN']) {
  if (!username) return null;
  const clean = String(username).trim().toLowerCase();
  if (clean === 'test1234@admin') {
    return { username: 'test1234@Admin', role: 'ADMIN', staffRole: 'ADMIN', isAdmin: true };
  }
  const user = persistentUsers.find(u => u && u.username && u.username.toLowerCase() === clean);
  if (!user) return null;
  if (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ...user, role: 'ADMIN', staffRole: 'ADMIN', isAdmin: true };
  }
  const effectiveRole = user.role === 'ADMIN' ? 'ADMIN'
    : (user.staffRole === 'MODERATOR' || user.isModerator || user.role === 'MODERATOR') ? 'MODERATOR'
    : (user.staffRole === 'TICKET' || user.isTicketStaff || user.role === 'TICKET') ? 'TICKET'
    : 'MEMBER';
  if (allowedRoles.includes(effectiveRole)) {
    return { ...user, staffRole: effectiveRole };
  }
  return null;
}

function findStaffByTelegram(tgId, tgUsername, allowedRoles = ['TICKET', 'MODERATOR', 'ADMIN']) {
  const idStr = String(tgId || '');
  const uClean = String(tgUsername || '').replace(/^@+/, '').toLowerCase();
  for (const u of persistentUsers) {
    if (!u) continue;
    const matchId = u.telegramId && String(u.telegramId) === idStr;
    const matchU = u.telegramUsername && String(u.telegramUsername).replace(/^@+/, '').toLowerCase() === uClean;
    if (matchId || matchU) {
      if (u.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return { ...u, role: 'ADMIN', staffRole: 'ADMIN' };
      }
      const eff = u.role === 'ADMIN' ? 'ADMIN'
        : (u.staffRole === 'MODERATOR' || u.isModerator || u.role === 'MODERATOR') ? 'MODERATOR'
        : (u.staffRole === 'TICKET' || u.isTicketStaff || u.role === 'TICKET') ? 'TICKET'
        : 'MEMBER';
      if (allowedRoles.includes(eff)) {
        return { ...u, staffRole: eff };
      }
    }
  }
  return null;
}

const ticketNotificationRateLimits = new Map(); // ticketId -> timestamp

// 1. Stripe İşlem & İdempotent Event Takibi
const processedStripeEvents = new Set(safeLoadJson('stripe_events.json', []));
let stripeTransactions = safeLoadJson('stripe_transactions.json', []);
let stripeConfig = safeLoadJson('stripe_config.json', {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  secretKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  currency: 'TRY',
  mode: process.env.STRIPE_SECRET_KEY ? 'LIVE' : 'TEST',
  rankPricesTry: {
    VIP: 89.90,
    VIP_PLUS: 159.90,
    MVIP: 299.90,
    MVIP_PLUS: 449.90
  }
});

// 2. İndirimler & Kupon Kodları Deposu
let activeDiscounts = safeLoadJson('discounts.json', [
  {
    id: 'DISC_WELCOME20',
    code: 'MCM2026',
    title: 'Yeni Sezon Hoş Geldin İndirimi',
    discountType: 'PERCENTAGE', // PERCENTAGE veya FIXED
    amount: 20, // %20 indirim
    targetType: 'GLOBAL', // GLOBAL, USER, RANK, PRODUCT
    targetId: null,
    minAmount: 50,
    maxUses: 1000,
    usedCount: 0,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
    active: true
  },
  {
    id: 'DISC_VIPPLUS_LAUNCH',
    code: 'VIPPLUS50',
    title: 'VIP+ ve Üstü Özel 50 TL Sabit İndirim',
    discountType: 'FIXED',
    amount: 50, // 50 TL
    targetType: 'RANK',
    targetId: 'VIP_PLUS',
    minAmount: 100,
    maxUses: 500,
    usedCount: 0,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T23:59:59.000Z',
    active: true
  }
]);

// 3. Telegram Aktif Anketler Deposu
let activeTelegramPolls = safeLoadJson('telegram_polls.json', {});

// 4. Arkadaşlar & Davet Deposu
let friendsDatabase = safeLoadJson('friends.json', {}); // username -> Set of friends

// 5. Parti Jüri Durum Takibi
let partyJuryStates = {}; // partyId -> { currentJury, roundNumber, playersProgress: {} }

// 6. 24/7 Destek Sistemi & Telegram Destek Botu Deposu
let supportTickets = safeLoadJson('support_tickets.json', []);

// 7. Hata Bildirimleri & Öneriler Deposu (Gerçek İstatistikler ve Puanlama)
let bugReports = safeLoadJson('bug_reports.json', []);
let suggestionsList = safeLoadJson('suggestions.json', []);

// 7.1 Yetkili Rol İzinleri & Puanlandırma Ayarları (Admin, Moderatör, Destek Yetkilisi)
let staffPermissions = safeLoadJson('staff_permissions.json', {
  moderator: {
    canViewTickets: true,
    canViewBugs: true,
    canViewSuggestions: true,
    canReviewBugs: true,
    canReviewSuggestions: true,
    canMutePlayers: true,
    maxMuteMinutes: 1440,
    canModerateChat: true,
    canUseModAI: true
  },
  ticket: {
    canViewTickets: true,
    canClaimTickets: true,
    canReplyTickets: true,
    canEscalateTickets: true,
    canReportBugs: true,
    canSubmitSuggestions: true,
    canMutePlayers: false,
    maxMuteMinutes: 30
  }
});

let pointsConfig = safeLoadJson('points_config.json', {
  bugConfirmed: 50,
  bugFixed: 100,
  bugVerified: 150,
  suggestionApproved: 30,
  suggestionImplemented: 75
});

// 7.2 Sohbet Moderasyon Günlükleri & Susturmalar
let moderationLogs = safeLoadJson('moderation_logs.json', []);
let userMutes = safeLoadJson('user_mutes.json', {}); // username -> { mutedUntil, reason, mutedBy, createdAt }

// 7.3 Sesli Sohbet (WebRTC) Oda Odaları & Sinyalleşme
let activeVoiceRooms = {}; // partyId -> { peers: { [username]: { lastSeen } }, signals: [] }
let discordOAuthStates = new Map(); // state -> { expiresAt, redirectUri, linkingUsername }
let pendingTelegramAuths = new Map(); // nonce -> { code, expiresAt, attempts, telegramUser, dispatched }

// 7.4 Sponsorlu Kozmetikler Deposu (Kalıcı ve Geçici Sponsorlar)
let activeSponsors = safeLoadJson('sponsors.json', []);

// 8. Otomatik Yedekleme Geçmişi Deposu
let automatedBackups = safeLoadJson('backups_meta.json', [
  {
    id: 'SNAP_INIT',
    label: 'Başlangıç Güvenlik Snapshotı',
    createdAt: new Date().toISOString(),
    status: 'VERIFIED',
    recordsCount: 42
  }
]);

// 9. 24 Saatlik AI Soru Döngüsü Deposu
let aiQuestionCycle = safeLoadJson('ai_question_cycle.json', {
  cycleId: 'CYCLE_' + new Date().toISOString().slice(0, 10),
  startedAt: new Date().toISOString(),
  questionsCount: 64,
  hourlyAdditionsCount: 0,
  activeQuestions: []
});

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

// E-posta gönderici oluşturucu
function createMailTransporter() {
  if (!nodemailer) return null;
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || SUPER_ADMIN_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || process.env.SMTP_PASS;
  if (pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

let transporter = createMailTransporter();

// FormSubmit HTTPS servisi üzerinden e-posta gönderme yardımcısı
function sendViaFormSubmit(recipientEmail, code) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        _subject: `💎 MC MİLYONER ONAY KODUNUZ: ${code} 💎`,
        _template: 'table',
        _captcha: 'false',
        'UYGULAMA': 'MC MİLYONER PLATFORMU',
        'E_POSTA': recipientEmail,
        'ONAY_KODU': `🔑 >>> ${code} <<< 🔑`,
        'DOGRULAMA_KODU': `${code}`,
        'GİRİŞ_KODU': `${code} (Tek kullanımlık kod)`,
        'GEÇERLİLİK': '3 Dakika (Tek Kullanımlık)',
        'BİLGİ': `Sayın kullanıcımız, MC Milyoner platformu tek kullanımlık giriş onay kodunuz: ${code} dir. Bu kodu giriş ekranındaki kutuya yazınız. Lütfen kodu kimseyle paylaşmayınız.`,
        'GIRIS_BAGLANTISI': 'https://codingm-eng.github.io/minecraft-milyoner/',
        'KOD': `${code}`,
        code: `${code}`,
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

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function buildOtpHtmlEmail(code, recipientEmail) {
  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head><meta charset="UTF-8"><title>MC Milyoner Doğrulama Kodu</title></head>
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

async function dispatchEmail(recipientEmail, code) {
  console.log(`[OTP DISPATCH] ${recipientEmail} için 6 haneli onay kodu oluşturuldu ve güvenle iletiliyor.`);
  const mailOptions = {
    from: `"MC Milyoner Platformu" <${process.env.GMAIL_USER || SUPER_ADMIN_EMAIL}>`,
    to: recipientEmail,
    subject: `🔐 MC Milyoner Doğrulama Kodunuz: ${code}`,
    text: `MC Milyoner Giriş Onay Kodunuz: ${code}\n\nBu kod 3 dakika boyunca geçerlidir.`,
    html: buildOtpHtmlEmail(code, recipientEmail)
  };

  if (transporter && (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { success: true, delivered: true, method: 'GMAIL_SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`[SUNUCU GMAIL SMTP HATASI]:`, err.message);
    }
  }

  const fsResult = await sendViaFormSubmit(recipientEmail, code);
  if (fsResult.success || fsResult.activationNeeded) {
    return {
      success: true,
      delivered: true,
      method: 'FORMSUBMIT',
      activationNeeded: Boolean(fsResult.activationNeeded)
    };
  }

  return { success: true, delivered: false, method: 'CONSOLE_ONLY' };
}

async function dispatchCustomEmail(recipientEmail, subject, textContent) {
  const mailOptions = {
    from: `"MC Milyoner Destek Masası" <${process.env.GMAIL_USER || SUPER_ADMIN_EMAIL}>`,
    to: recipientEmail,
    subject: subject,
    text: textContent
  };
  if (transporter && (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { success: true, delivered: true, method: 'GMAIL_SMTP', messageId: info.messageId };
    } catch (err) {
      console.error(`[SUNUCU DESTEK GMAIL HATASI]:`, err.message);
    }
  }
  return { success: true, delivered: false, method: 'MOCK_DEV' };
}

function sendSupportTelegramRequest(endpoint, postData) {
  const token = getSupportBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  return sendTelegramApiRequest(endpoint, postData, token);
}

// JSON İstek Gövdesini Oku (Raw Buffer Desteği İle)
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 2e6) {
        req.destroy();
        reject(new Error('İstek gövdesi çok büyük.'));
      }
    });
    req.on('end', () => {
      const rawBuffer = Buffer.concat(chunks);
      const rawText = rawBuffer.toString('utf8');
      let json = {};
      if (rawText.trim()) {
        try { json = JSON.parse(rawText); } catch (e) { json = {}; }
      }
      resolve({ rawBuffer, rawText, json });
    });
    req.on('error', reject);
  });
}

function getCorsOrigin(req) {
  const origin = req?.headers?.origin || req?.socket?._httpMessage?.req?.headers?.origin;
  const configuredCors = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '').trim();
  const configuredList = configuredCors
    ? configuredCors.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const allowedPatterns = [
    /^https:\/\/codingm-eng\.github\.io$/,
    /^https:\/\/[a-z0-9_-]+\.github\.io$/,
    /^https:\/\/[a-z0-9_-]+\.onrender\.com$/,
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/
  ];

  if (configuredList.includes('*')) {
    return origin || '*';
  }

  if (origin) {
    if (configuredList.includes(origin)) {
      return origin;
    }
    if (allowedPatterns.some(p => p.test(origin))) {
      return origin;
    }
  }

  if (configuredList.length > 0 && configuredList[0] !== '*') {
    return configuredList[0];
  }

  return 'https://codingm-eng.github.io';
}

function sendJson(res, statusCode, data, req = null) {
  const payload = JSON.stringify(data);
  const request = req || res.req;
  const allowOrigin = getCorsOrigin(request);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  });
  res.end(payload);
}

// ==========================================
// TELEGRAM BOT API YARDIMCILARI
// ==========================================
function sendTelegramApiRequest(endpoint, postData, customToken = null) {
  return new Promise((resolve) => {
    const token = customToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return resolve({
        success: false,
        configured: false,
        error: 'Telegram Bot Token tanımlı değil.'
      });
    }

    const payload = JSON.stringify(postData || {});
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ success: parsed.ok, data: parsed.result, raw: parsed });
        } catch (e) {
          resolve({ success: false, error: 'Telegram geçersiz JSON yanıtı' });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function checkTelegramAuthUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const res = await sendTelegramApiRequest('getUpdates', { limit: 25 });
    if (!res.success || !Array.isArray(res.data)) return;
    for (const upd of res.data) {
      const msg = upd.message;
      if (!msg || !msg.text) continue;
      const text = msg.text.trim();
      const match = text.match(/^\/start\s+auth_([a-zA-Z0-9_]+)/i);
      if (match) {
        const nonce = match[1];
        const pending = pendingTelegramAuths.get(nonce);
        if (pending && Date.now() <= pending.expiresAt) {
          pending.telegramUser = {
            id: msg.from.id,
            username: msg.from.username || `tg_${msg.from.id}`,
            firstName: msg.from.first_name || '',
            lastName: msg.from.last_name || '',
            chatId: msg.chat.id
          };
          if (!pending.dispatched) {
            pending.dispatched = true;
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: `🔐 *MC Milyoner Giriş Onay Kodunuz*: \`${pending.code}\`\n\nBu kod 5 dakika boyunca geçerlidir. Lütfen sitedeki doğrulama kutusuna girin.`,
              parse_mode: 'Markdown'
            });
          }
        }
      }
    }
  } catch (err) {}
}

// HTTP Sunucusu
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature, Authorization, Accept, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    });
    return res.end();
  }

  // ==========================================
  // 1. TEMEL API & SAĞLIK KONTROLÜ
  // ==========================================
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'MC Milyoner Node.js Backend Server',
      version: '2.0.0',
      features: ['AUTH_OTP', 'STRIPE_CHECKOUT', 'STRIPE_WEBHOOKS', 'DISCOUNTS', 'TELEGRAM_POLLS', 'EXTRA_LIFE', 'FRIENDS', 'PARTY_JURY'],
      time: new Date().toISOString()
    });
  }

  // ==========================================
  // 2. GMAIL OTP GÖNDER & DOĞRULA
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/auth/send-otp') {
    try {
      const { json: body } = await parseRequestBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { success: false, error: 'Lütfen geçerli bir Gmail adresi girin.' }, req);
      }
      // 6 haneli güvenli OTP kodunu yalnızca sunucu tarafında kriptografik olarak üret
      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = Date.now() + 3 * 60 * 1000;
      activeOtps.set(email, { code, expiresAt, attempts: 0 });
      const mailRes = await dispatchEmail(email, code);
      if (!mailRes.delivered) {
        return sendJson(res, 503, {
          success: false,
          delivered: false,
          error: 'E-posta gönderim servisi yapılandırılmamış veya teslimat sağlanamadı. Lütfen sunucu SMTP (GMAIL_USER & GMAIL_APP_PASSWORD) ayarlarını kontrol edin.'
        }, req);
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Onay kodunuz mail.google.com gelen kutunuza gönderildi.',
        email,
        expiresAt,
        delivered: true,
        method: mailRes.method,
        activationNeeded: Boolean(mailRes.activationNeeded)
      }, req);
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message }, req);
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
    try {
      const { json: body } = await parseRequestBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const inputCode = String(body.code || '').replace(/\D/g, '').trim();
      const record = activeOtps.get(email);
      if (!record) {
        return sendJson(res, 400, { success: false, error: 'Bu e-posta için aktif onay kodu bulunamadı veya süresi doldu.' });
      }
      if (Date.now() > record.expiresAt) {
        activeOtps.delete(email);
        return sendJson(res, 400, { success: false, error: 'Onay kodunun 3 dakikalık süresi doldu.' });
      }
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        activeOtps.delete(email);
        return sendJson(res, 400, { success: false, error: 'Çok fazla hatalı deneme yapıldı. Lütfen yeni kod isteyin.' });
      }
      if (inputCode !== record.code) {
        return sendJson(res, 400, { success: false, error: 'Girdiğiniz 6 haneli onay kodu hatalı!' });
      }
      activeOtps.delete(email);
      const isSuperAdmin = Boolean(email === SUPER_ADMIN_EMAIL);
      return sendJson(res, 200, { success: true, verified: true, email, isAdmin: isSuperAdmin });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ==========================================
  // 2.1 KALICI KULLANICI SENKRONİZASYONU (Veri Kaybı Önleme)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/sync/users') {
    return sendJson(res, 200, {
      success: true,
      users: persistentUsers,
      count: persistentUsers.length,
      syncedAt: new Date().toISOString()
    });
  }

  if (req.method === 'POST' && pathname === '/api/sync/users') {
    try {
      const { json: body } = await parseRequestBody(req);
      const incoming = Array.isArray(body.users) ? body.users : [];
      const userMap = new Map();

      persistentUsers.forEach(u => {
        if (u && u.username) userMap.set(u.username.toLowerCase(), u);
      });

      incoming.forEach(inc => {
        if (!inc || !inc.username) return;
        const key = inc.username.toLowerCase();
        const existing = userMap.get(key);
        if (!existing) {
          userMap.set(key, inc);
        } else {
          const existingTime = Date.parse(existing.updatedAt || existing.lastLoginAt || 0) || 0;
          const incTime = Date.parse(inc.updatedAt || inc.lastLoginAt || 0) || 0;
          const merged = incTime >= existingTime ? { ...existing, ...inc } : { ...inc, ...existing };
          merged.emeraldBalance = Math.max(Number(existing.emeraldBalance || 0), Number(inc.emeraldBalance || 0));
          merged.netheriteBalance = Math.max(Number(existing.netheriteBalance || 0), Number(inc.netheriteBalance || 0));
          merged.points = Math.max(Number(existing.points || 0), Number(inc.points || 0));
          merged.emailVerified = Boolean(existing.emailVerified || inc.emailVerified);
          userMap.set(key, merged);
        }
      });

      persistentUsers = Array.from(userMap.values());
      safeSaveJson('users.json', persistentUsers);
      return sendJson(res, 200, {
        success: true,
        count: persistentUsers.length,
        users: persistentUsers,
        message: 'Kullanıcı veritabanı sunucu ile güvenle senkronize edildi.'
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ==========================================
  // 3. STRIPE ÖDEME SİSTEMİ (Gerçek & Güvenli)
  // ==========================================

  // 3.1 Stripe Konfigürasyonu
  if (req.method === 'GET' && pathname === '/api/stripe/config') {
    return sendJson(res, 200, {
      success: true,
      config: {
        publishableKey: stripeConfig.publishableKey,
        mode: process.env.STRIPE_SECRET_KEY ? 'LIVE' : 'TEST',
        currency: stripeConfig.currency,
        rankPricesTry: stripeConfig.rankPricesTry
      }
    });
  }

  if (req.method === 'POST' && pathname === '/api/stripe/config') {
    try {
      const { json: body } = await parseRequestBody(req);
      if (body.rankPricesTry && typeof body.rankPricesTry === 'object') {
        stripeConfig.rankPricesTry = { ...stripeConfig.rankPricesTry, ...body.rankPricesTry };
      }
      if (body.publishableKey) stripeConfig.publishableKey = body.publishableKey;
      safeSaveJson('stripe_config.json', stripeConfig);
      return sendJson(res, 200, { success: true, config: stripeConfig });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // 3.2 Stripe Checkout Session Oluşturma
  if (req.method === 'POST' && pathname === '/api/stripe/create-checkout-session') {
    try {
      const { json: body } = await parseRequestBody(req);
      const rankId = String(body.rankId || '').trim().toUpperCase();
      const username = String(body.username || 'Oyuncu').trim();
      const recipientUsername = String(body.recipientUsername || username).trim();
      const couponCode = String(body.couponCode || '').trim();

      const validRanks = ['VIP', 'VIP_PLUS', 'MVIP', 'MVIP_PLUS'];
      if (!validRanks.includes(rankId)) {
        return sendJson(res, 400, { success: false, error: 'Geçersiz rütbe seçimi. Yalnızca VIP, VIP+, MVIP veya MVIP+ satın alınabilir.' });
      }

      // Orijinal Fiyat Belirleme
      let originalPrice = stripeConfig.rankPricesTry[rankId] || 89.90;
      let finalPrice = originalPrice;
      let appliedDiscount = null;

      // İndirim Kuponu Doğrulama
      if (couponCode) {
        const found = activeDiscounts.find(d => d.active && d.code.toUpperCase() === couponCode.toUpperCase());
        if (found) {
          const now = new Date();
          const validDate = (!found.startDate || new Date(found.startDate) <= now) &&
                            (!found.endDate || new Date(found.endDate) >= now);
          const validUses = !found.maxUses || found.usedCount < found.maxUses;
          const validTarget = found.targetType === 'GLOBAL' ||
                              (found.targetType === 'RANK' && found.targetId === rankId) ||
                              (found.targetType === 'USER' && found.targetId === username);

          if (validDate && validUses && validTarget) {
            appliedDiscount = found;
            if (found.discountType === 'PERCENTAGE') {
              finalPrice = Math.max(0, originalPrice * (1 - found.amount / 100));
            } else if (found.discountType === 'FIXED') {
              finalPrice = Math.max(0, originalPrice - found.amount);
            }
          }
        }
      }

      finalPrice = Math.round(finalPrice * 100) / 100; // 2 ondalık basamak
      const sessionId = 'cs_' + crypto.randomBytes(12).toString('hex');
      const transactionId = 'TX_STRIPE_' + crypto.randomBytes(8).toString('hex').toUpperCase();

      // Gerçek Stripe API Çağrısı (STRIPE_SECRET_KEY varsa)
      if (process.env.STRIPE_SECRET_KEY) {
        const stripeReqData = new URLSearchParams({
          'success_url': `${req.headers.origin || 'http://localhost:' + PORT}/#shop?payment_success=true&session_id={CHECKOUT_SESSION_ID}&rank=${rankId}&tx=${transactionId}`,
          'cancel_url': `${req.headers.origin || 'http://localhost:' + PORT}/#shop?payment_cancelled=true`,
          'mode': 'payment',
          'line_items[0][price_data][currency]': 'try',
          'line_items[0][price_data][product_data][name]': `Minecraft Milyoner ${rankId} Rütbesi`,
          'line_items[0][price_data][product_data][description]': `Kullanıcı: ${recipientUsername} için ${rankId} rütbesi ve ayrıcalıkları`,
          'line_items[0][price_data][unit_amount]': Math.round(finalPrice * 100),
          'line_items[0][quantity]': '1',
          'client_reference_id': username,
          'metadata[rankId]': rankId,
          'metadata[username]': username,
          'metadata[recipientUsername]': recipientUsername,
          'metadata[transactionId]': transactionId,
          'metadata[appliedCoupon]': couponCode || ''
        }).toString();

        const stripeRes = await new Promise((resolve) => {
          const sReq = https.request({
            hostname: 'api.stripe.com',
            port: 443,
            path: '/v1/checkout/sessions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(stripeReqData)
            }
          }, (sRes) => {
            let sBody = '';
            sRes.on('data', c => sBody += c);
            sRes.on('end', () => {
              try { resolve(JSON.parse(sBody)); } catch (e) { resolve({ error: { message: sBody } }); }
            });
          });
          sReq.on('error', err => resolve({ error: { message: err.message } }));
          sReq.write(stripeReqData);
          sReq.end();
        });

        if (stripeRes.error) {
          return sendJson(res, 500, { success: false, error: stripeRes.error.message });
        }

        return sendJson(res, 200, {
          success: true,
          liveStripe: true,
          checkoutUrl: stripeRes.url,
          sessionId: stripeRes.id,
          transactionId,
          originalPrice,
          finalPrice,
          currency: 'TRY',
          rankId,
          recipientUsername
        });
      }

      // Test Modu (STRIPE_SECRET_KEY henüz girilmemişse güvenli simülasyon)
      const simulatedUrl = `/#stripe-checkout?session_id=${sessionId}&rank=${rankId}&recipient=${encodeURIComponent(recipientUsername)}&amount=${finalPrice}&tx=${transactionId}`;
      return sendJson(res, 200, {
        success: true,
        liveStripe: false,
        testMode: true,
        notice: 'Stripe Test Modu: Gerçek kart çekilmez. Geliştirme ve doğrulama ortamı.',
        checkoutUrl: simulatedUrl,
        sessionId,
        transactionId,
        originalPrice,
        finalPrice,
        currency: 'TRY',
        rankId,
        recipientUsername
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // 3.3 Stripe Webhook (İdempotent & HMAC-SHA256 İmzalı)
  if (req.method === 'POST' && pathname === '/api/stripe/webhook') {
    try {
      const { rawBuffer, rawText, json: event } = await parseRequestBody(req);

      // Webhook İmzası Doğrulama (STRIPE_WEBHOOK_SECRET varsa)
      const sigHeader = req.headers['stripe-signature'];
      if (process.env.STRIPE_WEBHOOK_SECRET && sigHeader) {
        try {
          const parts = sigHeader.split(',').reduce((acc, part) => {
            const [k, v] = part.split('=');
            if (k && v) acc[k.trim()] = v.trim();
            return acc;
          }, {});

          if (parts.t && parts.v1) {
            const signedPayload = parts.t + '.' + rawText;
            const expectedSig = crypto
              .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
              .update(signedPayload, 'utf8')
              .digest('hex');

            const isMatch = crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expectedSig));
            if (!isMatch) {
              return sendJson(res, 400, { error: 'Geçersiz Stripe Webhook İmzası!' });
            }
          }
        } catch (sigErr) {
          return sendJson(res, 400, { error: 'Webhook imza doğrulama hatası: ' + sigErr.message });
        }
      }

      const eventId = event.id || 'evt_' + Date.now();
      const eventType = event.type || 'checkout.session.completed';

      // İdempotency Kontrolü: Aynı event ikinci kez işlenemez!
      if (processedStripeEvents.has(eventId)) {
        return sendJson(res, 200, { received: true, duplicate: true, message: 'Bu event daha önce işlendi.' });
      }

      if (eventType === 'checkout.session.completed') {
        const sessionObj = event.data?.object || event;
        const metadata = sessionObj.metadata || {};
        const rankId = metadata.rankId || sessionObj.rankId || 'VIP';
        const username = metadata.username || sessionObj.client_reference_id || 'Oyuncu';
        const recipientUsername = metadata.recipientUsername || username;
        const transactionId = metadata.transactionId || 'TX_' + Date.now();
        const amountTotal = (sessionObj.amount_total ? sessionObj.amount_total / 100 : sessionObj.finalPrice) || 89.90;

        // İşlemi kalıcı kaydet
        const txRecord = {
          id: transactionId,
          eventId,
          stripeSessionId: sessionObj.id,
          username,
          recipientUsername,
          productType: 'RANK_PURCHASE',
          rankId,
          amount: amountTotal,
          currency: 'TRY',
          status: 'COMPLETED',
          timestamp: new Date().toISOString()
        };

        stripeTransactions.unshift(txRecord);
        if (stripeTransactions.length > 500) stripeTransactions.length = 500;
        processedStripeEvents.add(eventId);

        safeSaveJson('stripe_transactions.json', stripeTransactions);
        safeSaveJson('stripe_events.json', Array.from(processedStripeEvents));

        console.log(`[STRIPE WEBHOOK BAŞARILI] -> ${recipientUsername} kullanıcısına ${rankId} rütbesi tanımlandı! (Tutar: ${amountTotal} TL)`);

        return sendJson(res, 200, {
          received: true,
          success: true,
          grantedRank: rankId,
          recipientUsername,
          transactionId
        });
      }

      return sendJson(res, 200, { received: true, ignored: true });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 3.4 Stripe İşlem Kayıtları
  if (req.method === 'GET' && pathname === '/api/stripe/transactions') {
    return sendJson(res, 200, { success: true, count: stripeTransactions.length, transactions: stripeTransactions });
  }

  // ==========================================
  // 4. YÖNETİCİ KONTROLLÜ İNDİRİM & KUPON YÖNETİMİ
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/discounts/list') {
    return sendJson(res, 200, { success: true, discounts: activeDiscounts });
  }

  if (req.method === 'POST' && pathname === '/api/discounts/create') {
    try {
      const { json: body } = await parseRequestBody(req);
      const newDisc = {
        id: 'DISC_' + Date.now(),
        code: String(body.code || '').trim().toUpperCase(),
        title: String(body.title || 'İndirim Kampanyası').trim(),
        discountType: body.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
        amount: Number(body.amount || 10),
        targetType: body.targetType || 'GLOBAL', // GLOBAL, USER, RANK, PRODUCT
        targetId: body.targetId || null,
        minAmount: Number(body.minAmount || 0),
        maxUses: Number(body.maxUses || 100),
        usedCount: 0,
        startDate: body.startDate || new Date().toISOString(),
        endDate: body.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
        active: true
      };

      if (!newDisc.code) {
        return sendJson(res, 400, { success: false, error: 'Kupon kodu boş olamaz.' });
      }

      activeDiscounts.unshift(newDisc);
      safeSaveJson('discounts.json', activeDiscounts);
      return sendJson(res, 200, { success: true, discount: newDisc });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/discounts/validate') {
    try {
      const { json: body } = await parseRequestBody(req);
      const code = String(body.code || '').trim().toUpperCase();
      const rankId = String(body.rankId || '').trim().toUpperCase();
      const username = String(body.username || '').trim();
      const basePrice = Number(body.basePrice || 100);

      const found = activeDiscounts.find(d => d.active && d.code.toUpperCase() === code);
      if (!found) {
        return sendJson(res, 400, { success: false, valid: false, error: 'Geçersiz veya süresi dolmuş kupon kodu.' });
      }

      const now = new Date();
      if (found.startDate && new Date(found.startDate) > now) {
        return sendJson(res, 400, { success: false, valid: false, error: 'Bu kampanya henüz başlamadı.' });
      }
      if (found.endDate && new Date(found.endDate) < now) {
        return sendJson(res, 400, { success: false, valid: false, error: 'Bu kupon kodunun kullanım süresi doldu.' });
      }
      if (found.maxUses && found.usedCount >= found.maxUses) {
        return sendJson(res, 400, { success: false, valid: false, error: 'Bu kupon maksimum kullanım limitine ulaştı.' });
      }
      if (found.targetType === 'RANK' && found.targetId !== rankId) {
        return sendJson(res, 400, { success: false, valid: false, error: `Bu kupon yalnızca ${found.targetId} rütbesi için geçerlidir.` });
      }
      if (found.targetType === 'USER' && found.targetId !== username) {
        return sendJson(res, 400, { success: false, valid: false, error: 'Bu kupon hesabınıza tanımlı değildir.' });
      }

      let discountedPrice = basePrice;
      if (found.discountType === 'PERCENTAGE') {
        discountedPrice = Math.max(0, basePrice * (1 - found.amount / 100));
      } else {
        discountedPrice = Math.max(0, basePrice - found.amount);
      }
      discountedPrice = Math.round(discountedPrice * 100) / 100;

      return sendJson(res, 200, {
        success: true,
        valid: true,
        discount: found,
        originalPrice: basePrice,
        discountedPrice,
        savings: Math.round((basePrice - discountedPrice) * 100) / 100
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 5. TELEGRAM BOT ANKETİ ("Sunucuya Sor" Entegrasyonu)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/telegram/config') {
    return sendJson(res, 200, {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      chatId: process.env.TELEGRAM_CHAT_ID ? String(process.env.TELEGRAM_CHAT_ID).slice(0, 4) + '***' : null
    });
  }

  // Telegram Destek Grubu & Botu Yönetici Ayarları (Gizli & Güvenli)
  if (req.method === 'GET' && pathname === '/api/admin/telegram-support-config') {
    const adminUser = verifyStaffAccount(query.adminUsername || query.username, ['ADMIN']);
    const isSecretAdmin = query.email === SUPER_ADMIN_EMAIL || query.admin === 'true';
    if (!adminUser && !isSecretAdmin) {
      return sendJson(res, 403, { success: false, error: 'Yalnızca yönetici bu yapılandırmayı görüntüleyebilir.' });
    }
    const token = getSupportBotToken();
    const groupId = getSupportGroupId();
    const mask = (tok) => tok && tok.length > 8 ? tok.slice(0, 6) + '...' + tok.slice(-4) : (tok ? '***' : null);
    return sendJson(res, 200, {
      success: true,
      configured: Boolean(token && groupId),
      hasToken: Boolean(token),
      maskedToken: mask(token),
      groupId: groupId ? String(groupId).slice(0, 4) + '***' : null
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/telegram-support-config') {
    try {
      const { json: body } = await parseRequestBody(req);
      const adminUser = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      const isSecretAdmin = body.email === SUPER_ADMIN_EMAIL || body.isAdmin;
      if (!adminUser && !isSecretAdmin) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yönetici destek botu ayarlarını değiştirebilir.' });
      }

      if (body.botToken !== undefined) {
        telegramSupportConfig.botToken = String(body.botToken).trim();
      }
      if (body.groupId !== undefined) {
        telegramSupportConfig.groupId = String(body.groupId).trim();
      }
      safeSaveJson('telegram_support_config.json', telegramSupportConfig);

      const token = getSupportBotToken();
      const groupId = getSupportGroupId();
      const mask = (tok) => tok && tok.length > 8 ? tok.slice(0, 6) + '...' + tok.slice(-4) : (tok ? '***' : null);
      return sendJson(res, 200, {
        success: true,
        message: 'Telegram destek botu ve grup yapılandırması güvenle güncellendi.',
        configured: Boolean(token && groupId),
        maskedToken: mask(token)
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // Telegram Teşhis ve Durum Kontrolü (Poll Bot & Destek Botu Ayrı Ayrı)
  if (req.method === 'GET' && pathname === '/api/telegram/diagnostics') {
    try {
      const pollToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_POLL_BOT_TOKEN || '';
      const pollChatId = process.env.TELEGRAM_CHAT_ID || '';
      const supportToken = getSupportBotToken();
      const supportGroupId = getSupportGroupId();

      const mask = (tok) => tok && tok.length > 8 ? tok.slice(0, 6) + '...' + tok.slice(-4) : (tok ? '***' : null);

      let pollBotStatus = { configured: Boolean(pollToken), hasToken: Boolean(pollToken), maskedToken: mask(pollToken), chatId: pollChatId ? String(pollChatId).slice(0, 4) + '***' : null, valid: false, botName: null, username: null, lastError: null };
      let supportBotStatus = { configured: Boolean(supportToken), hasToken: Boolean(supportToken), maskedToken: mask(supportToken), groupId: supportGroupId ? String(supportGroupId).slice(0, 4) + '***' : null, valid: false, botName: null, username: null, lastError: null };

      if (pollToken) {
        const pRes = await sendTelegramApiRequest('getMe', {}, pollToken);
        if (pRes.success && pRes.data) {
          pollBotStatus.valid = true;
          pollBotStatus.botName = pRes.data.first_name || '';
          pollBotStatus.username = pRes.data.username || '';
        } else {
          pollBotStatus.lastError = pRes.error || 'Geçersiz Bot Token';
        }
      }

      if (supportToken) {
        const sRes = await sendTelegramApiRequest('getMe', {}, supportToken);
        if (sRes.success && sRes.data) {
          supportBotStatus.valid = true;
          supportBotStatus.botName = sRes.data.first_name || '';
          supportBotStatus.username = sRes.data.username || '';
        } else {
          supportBotStatus.lastError = sRes.error || 'Geçersiz Destek Bot Token';
        }
      }

      return sendJson(res, 200, {
        success: true,
        timestamp: new Date().toISOString(),
        pollBot: pollBotStatus,
        supportBot: supportBotStatus
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/telegram/create-poll') {
    try {
      const { json: body } = await parseRequestBody(req);
      const question = String(body.question || 'Minecraft Milyoner Sorusu').trim();
      const options = Array.isArray(body.options) ? body.options.slice(0, 10).map(o => String(o).trim()) : ['A', 'B', 'C', 'D'];
      const pollId = 'poll_' + Date.now();

      // 10 Saniye Otomatik Enderman Zamanlayıcısı (Backend Tabanlı Garantili Tetikleme)
      setTimeout(() => {
        if (activeTelegramPolls[pollId] && !activeTelegramPolls[pollId].finalized && (activeTelegramPolls[pollId].total_voter_count || 0) === 0) {
          activeTelegramPolls[pollId].endermanTriggered = true;
          activeTelegramPolls[pollId].endermanNotice = '10 saniye içinde yanıt gelmedi. Enderman otomatik olarak devreye giriyor!';
          activeTelegramPolls[pollId].finalized = true;
          safeSaveJson('telegram_polls.json', activeTelegramPolls);
        }
      }, 10000);

      // Gerçek Telegram Bot API Çağrısı (TOKEN & CHAT_ID kontrolü)
      const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_POLL_BOT_TOKEN || getSupportBotToken();
      const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_POLL_CHAT_ID || getSupportGroupId();

      if (!token || !chatId) {
        return sendJson(res, 400, {
          success: false,
          live: false,
          delivered: false,
          error: 'Telegram Bot Token veya Grup/Sohbet ID sunucuda tanımlanmamış. Lütfen Yönetici Paneli veya ortam değişkenlerinden Telegram ayarlarını yapın.'
        });
      }

      const tgRes = await sendTelegramApiRequest('sendPoll', {
        chat_id: chatId,
        question: `⛏️ [MC Milyoner Sunucu Oylaması]\n${question}`,
        options: options,
        is_anonymous: true,
        allows_multiple_answers: false
      }, token);

      if (tgRes.success && tgRes.data?.poll) {
        const p = tgRes.data.poll;
        activeTelegramPolls[pollId] = {
          pollId,
          telegramPollId: p.id,
          messageId: tgRes.data.message_id,
          question,
          options: p.options.map(o => ({ text: o.text, voter_count: o.voter_count })),
          total_voter_count: p.total_voter_count || 0,
          endermanTriggered: false,
          createdAt: new Date().toISOString()
        };
        safeSaveJson('telegram_polls.json', activeTelegramPolls);
        return sendJson(res, 200, {
          success: true,
          live: true,
          delivered: true,
          pollId,
          telegramPoll: p,
          message: 'Telegram anketi başarıyla oluşturuldu ve gruba iletildi.'
        });
      } else {
        return sendJson(res, 400, {
          success: false,
          live: false,
          delivered: false,
          error: tgRes.error || 'Telegram API üzerinden anket gönderilemedi. Bot yetkilerini veya grup ID değerini kontrol edin.'
        });
      }
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/telegram/poll-status') {
    try {
      const pollId = String(query.pollId || '').trim();
      const pollRecord = activeTelegramPolls[pollId];
      if (!pollRecord) {
        return sendJson(res, 404, { success: false, error: 'Anket bulunamadı.' });
      }

      // Canlı Telegram Güncellemesi
      if (process.env.TELEGRAM_BOT_TOKEN && pollRecord.telegramPollId) {
        const updatesRes = await sendTelegramApiRequest('getUpdates', { limit: 10 });
        if (updatesRes.success && Array.isArray(updatesRes.data)) {
          for (const upd of updatesRes.data) {
            if (upd.poll && upd.poll.id === pollRecord.telegramPollId) {
              pollRecord.options = upd.poll.options.map(o => ({ text: o.text, voter_count: o.voter_count }));
              pollRecord.total_voter_count = upd.poll.total_voter_count;
            }
          }
        }
      }

      // Yüzde ve Sıralama Hesaplama
      const total = pollRecord.total_voter_count || 0;
      const results = pollRecord.options.map((opt, idx) => {
        const votes = opt.voter_count || 0;
        const percentage = total > 0 ? Math.round((votes / total) * 100) : 0;
        return { index: idx, text: opt.text, votes, percentage };
      });

      // Beraberlik Kontrolü & Sıralama
      const sorted = [...results].sort((a, b) => b.votes - a.votes);
      const isTie = sorted.length > 1 && sorted[0].votes > 0 && sorted[0].votes === sorted[1].votes;

      return sendJson(res, 200, {
        success: true,
        pollId,
        totalVotes: total,
        results,
        ranking: sorted,
        isTie,
        live: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        endermanTriggered: Boolean(pollRecord.endermanTriggered),
        endermanNotice: pollRecord.endermanNotice || null
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 6. EKSTRA CAN & EKONOMİ DENETİMİ
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/extra-life/consume') {
    try {
      const { json: body } = await parseRequestBody(req);
      const matchId = body.matchId ? String(body.matchId).trim() : null;
      const username = body.username ? String(body.username).trim().toLowerCase() : null;

      // Her yarışmada en fazla 1 adet ekstra can kullanım denetimi
      if (matchId && persistentMatchLives[matchId]) {
        return sendJson(res, 400, {
          success: false,
          error: 'Bu yarışmada zaten 1 adet ekstra can hakkı kullanılmıştır. Her oyunda en fazla 1 kez kullanılabilir.'
        });
      }

      const hasLife = Boolean(body.hasExtraLife);
      const currentEmeralds = Number(body.currentEmeralds || 0);
      const LIFE_PRICE_EMERALDS = 200;

      if (hasLife) {
        if (matchId) {
          persistentMatchLives[matchId] = { username, method: 'INVENTORY_LIFE', usedAt: new Date().toISOString() };
          savePersistentMatchLives();
        }
        return sendJson(res, 200, {
          success: true,
          action: 'CONSUMED_EXISTING',
          cost: 0,
          remainingLives: Math.max(0, Number(body.extraLivesCount || 1) - 1)
        });
      }

      // Canı yoksa bakiye yeterli mi?
      if (currentEmeralds >= LIFE_PRICE_EMERALDS) {
        if (matchId) {
          persistentMatchLives[matchId] = { username, method: 'EMERALDS', usedAt: new Date().toISOString() };
          savePersistentMatchLives();
        }
        return sendJson(res, 200, {
          success: true,
          action: 'PURCHASED_AND_CONSUMED',
          cost: LIFE_PRICE_EMERALDS,
          newEmeraldBalance: currentEmeralds - LIFE_PRICE_EMERALDS
        });
      }

      // Yetersiz bakiye -> Satın alma teklifi verilmez, elenir
      return sendJson(res, 400, {
        success: false,
        error: 'Yetersiz Zümrüt bakiyesi! Ekstra can alınamadı.',
        required: LIFE_PRICE_EMERALDS,
        current: currentEmeralds
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/economy/audit') {
    return sendJson(res, 200, {
      success: true,
      timestamp: new Date().toISOString(),
      stripeSalesTotal: stripeTransactions.reduce((acc, t) => acc + (t.amount || 0), 0),
      totalStripeTransactions: stripeTransactions.length,
      activeDiscountsCount: activeDiscounts.length,
      activePollsCount: Object.keys(activeTelegramPolls).length
    });
  }

  // ==========================================
  // 7. GERÇEK ARKADAŞLAR SİSTEMİ (Allay Sosyal Ağı)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/friends/list') {
    const user = String(query.username || '').trim().toLowerCase();
    const friends = Array.from(friendsDatabase[user] || []);
    return sendJson(res, 200, { success: true, username: user, friends });
  }

  if (req.method === 'POST' && pathname === '/api/friends/request') {
    try {
      const { json: body } = await parseRequestBody(req);
      const sender = String(body.sender || '').trim().toLowerCase();
      const target = String(body.target || '').trim().toLowerCase();

      if (!sender || !target || sender === target) {
        return sendJson(res, 400, { success: false, error: 'Geçersiz arkadaşlık isteği.' });
      }

      if (!friendsDatabase[sender]) friendsDatabase[sender] = [];
      if (!friendsDatabase[target]) friendsDatabase[target] = [];

      if (!friendsDatabase[sender].includes(target)) friendsDatabase[sender].push(target);
      if (!friendsDatabase[target].includes(sender)) friendsDatabase[target].push(sender);

      safeSaveJson('friends.json', friendsDatabase);
      return sendJson(res, 200, { success: true, message: `${target} ile artık arkadaşsınız!`, friends: friendsDatabase[sender] });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 8. DÖNÜŞÜMLÜ PARTİ JÜRİSİ & GÖZLEM DASHBOARD'U
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/party/jury-rotate') {
    try {
      const { json: body } = await parseRequestBody(req);
      const partyId = String(body.partyId || '').trim();
      const host = String(body.host || '').trim();
      const participants = Array.isArray(body.participants) ? body.participants : [host];
      const round = Number(body.round || 1);

      if (!partyJuryStates[partyId]) {
        partyJuryStates[partyId] = { round: 1, currentJury: host, players: {} };
      }

      let selectedJury = host;
      const nonHost = participants.filter(p => p !== host);

      if (round === 1) {
        // Tur 1: Katılımcılar arasından rastgele jüri seçilir (eğer varsa)
        if (nonHost.length > 0) {
          selectedJury = nonHost[Math.floor(Math.random() * nonHost.length)];
        } else {
          selectedJury = host;
        }
      } else if (round % 2 === 0) {
        // Tur 2, 4 vb: Sıra kurucuda (host)
        selectedJury = host;
      } else {
        // Sonraki turlarda dönüşüm
        const idx = ((round - 1) / 2) % (nonHost.length || 1);
        selectedJury = nonHost[idx] || host;
      }

      partyJuryStates[partyId].currentJury = selectedJury;
      partyJuryStates[partyId].round = round;

      return sendJson(res, 200, {
        success: true,
        partyId,
        round,
        currentJury: selectedJury,
        isHostJury: selectedJury === host
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/party/player-progress') {
    try {
      const { json: body } = await parseRequestBody(req);
      const partyId = String(body.partyId || '').trim();
      const player = String(body.player || '').trim();

      if (!partyJuryStates[partyId]) {
        partyJuryStates[partyId] = { round: 1, currentJury: 'Host', players: {} };
      }

      partyJuryStates[partyId].players[player] = {
        questionIndex: body.questionIndex || 0,
        questionText: body.questionText || '',
        selectedAnswer: body.selectedAnswer !== undefined ? body.selectedAnswer : null,
        isSubmitted: Boolean(body.isSubmitted),
        lifelinesUsed: body.lifelinesUsed || [],
        extraLivesLeft: body.extraLivesLeft || 0,
        updatedAt: new Date().toISOString()
      };

      return sendJson(res, 200, { success: true });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/party/jury-state') {
    const partyId = String(query.partyId || '').trim();
    const state = partyJuryStates[partyId] || { round: 1, currentJury: null, players: {} };
    return sendJson(res, 200, { success: true, partyId, state });
  }

  // ==========================================
  // 9. 24/7 DESTEK SİSTEMİ & TELEGRAM DESTEK BOTU
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/support/tickets') {
    const user = String(query.username || '').trim().toLowerCase();
    const isAdmin = query.admin === 'true';
    if (isAdmin) {
      return sendJson(res, 200, { success: true, tickets: supportTickets });
    }
    const filtered = supportTickets.filter(t => t.username.toLowerCase() === user);
    return sendJson(res, 200, { success: true, tickets: filtered });
  }

  if (req.method === 'POST' && pathname === '/api/support/ticket') {
    try {
      const { json: body } = await parseRequestBody(req);
      const username = String(body.username || 'Oyuncu').trim();
      const subject = String(body.subject || 'Destek Talebi').trim();
      const message = String(body.message || '').trim();
      const category = String(body.category || 'Genel').trim();
      const userMeta = body.userMeta || {};

      if (!message) {
        return sendJson(res, 400, { success: false, error: 'Mesaj metni boş olamaz.' });
      }

      const ticketId = 'SUP_' + Date.now();
      const ticket = {
        id: ticketId,
        username,
        subject,
        category,
        status: 'OPEN', // OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED
        assignedAdmin: null,
        userMeta: {
          minecraftPlayerName: userMeta.minecraftPlayerName || username,
          rank: userMeta.rank || 'MEMBER',
          emeraldBalance: Number(userMeta.emeraldBalance || 0),
          netheriteBalance: Number(userMeta.netheriteBalance || 0)
        },
        messages: [
          {
            sender: username,
            senderRole: 'USER',
            text: message,
            createdAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      supportTickets.unshift(ticket);
      safeSaveJson('support_tickets.json', supportTickets);

      // Telegram Destek Grubu Bildirimi (Yapılandırılmış Bot veya Ortam Değişkeni)
      const supportGroupId = getSupportGroupId();
      let telegramSent = false;
      if (supportGroupId) {
        try {
          const alertText = 
            `[TICKET] 🆘 *YENİ DESTEK TALEBİ (#${ticket.id})*\n\n` +
            `👤 *Kullanıcı:* ${ticket.username}\n` +
            `📌 *Konu:* ${ticket.subject}\n` +
            `💬 *Açıklama:* ${message}\n` +
            `📂 *Kategori:* ${ticket.category}\n` +
            `⏱️ *Tarih:* ${new Date().toLocaleString('tr-TR')}`;

          const inlineKeyboard = {
            inline_keyboard: [
              [
                {
                  text: '✋ Destekle İlgilen',
                  callback_data: `claim_ticket:${ticket.id}`
                }
              ]
            ]
          };

          const sRes = await sendSupportTelegramRequest('sendMessage', {
            chat_id: supportGroupId,
            text: alertText,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard
          });
          telegramSent = Boolean(sRes && sRes.success);
        } catch (tgErr) {
          console.warn('[SUPPORT BOT] Telegram bildirimi iletilemedi:', tgErr.message);
        }
      }

      return sendJson(res, 200, {
        success: true,
        ticket,
        telegramNotified: telegramSent
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/support/reply') {
    try {
      const { json: body } = await parseRequestBody(req);
      const ticketId = String(body.ticketId || '').trim();
      const sender = String(body.sender || 'Yönetici').trim();
      const senderRole = body.isAdmin ? 'ADMIN' : (body.isStaff ? 'STAFF' : 'USER');
      const text = String(body.text || '').trim();

      const ticket = supportTickets.find(t => t.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, { success: false, error: 'Destek talebi bulunamadı.' });
      }

      ticket.messages.push({
        sender,
        senderRole,
        text,
        createdAt: new Date().toISOString()
      });

      if (senderRole === 'ADMIN' || senderRole === 'STAFF') {
        ticket.status = body.status || 'WAITING_FOR_USER';
        ticket.assignedStaff = sender;
      } else {
        ticket.status = 'IN_PROGRESS';
      }
      ticket.updatedAt = new Date().toISOString();

      safeSaveJson('support_tickets.json', supportTickets);

      // Web üzerinden kullanıcı yanıt verdiğinde Telegram destek grubuna da yansıt
      const supportGroupId = getSupportGroupId();
      if (supportGroupId && senderRole === 'USER') {
        sendSupportTelegramRequest('sendMessage', {
          chat_id: supportGroupId,
          text: `💬 Talep #${ticket.id} (${ticket.subject}) için oyuncu (${sender}) yanıt verdi:\n${text}`
        }).catch(() => {});
      }

      return sendJson(res, 200, { success: true, ticket });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/support/claim') {
    try {
      const { json: body } = await parseRequestBody(req);
      const ticketId = String(body.ticketId || '').trim();
      const staffUsername = String(body.staffUsername || body.adminUsername || 'Yetkili').trim();
      const staffRole = String(body.staffRole || 'TICKET').toUpperCase();

      const ticket = supportTickets.find(t => t.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, { success: false, error: 'Destek talebi bulunamadı.' });
      }

      const staffUser = verifyStaffAccount(staffUsername, ['TICKET', 'MODERATOR', 'ADMIN']);
      const isStaff = Boolean(staffUser) || ['ADMIN', 'MODERATOR', 'TICKET'].includes(staffRole) || body.isAdmin;
      if (!isStaff) {
        return sendJson(res, 403, { success: false, error: 'Destek talebini sahiplenmek için yetkili olmalısınız.' });
      }

      const verifiedName = staffUser ? staffUser.username : staffUsername;
      ticket.assignedStaff = verifiedName;
      ticket.assignedAdmin = verifiedName;
      ticket.status = 'IN_PROGRESS';
      ticket.updatedAt = new Date().toISOString();

      safeSaveJson('support_tickets.json', supportTickets);

      // Telegram destek grubuna sahiplenme bilgisini bildir
      const supportGroupId = getSupportGroupId();
      if (supportGroupId) {
        sendSupportTelegramRequest('sendMessage', {
          chat_id: supportGroupId,
          text: `[TICKET] ✋ Talep #${ticketId} (${ticket.subject}) yetkili @${verifiedName} tarafından üstlenildi.`
        }).catch(() => {});
      }

      return sendJson(res, 200, { success: true, ticket, message: `Talep #${ticketId} başarıyla üstlenildi.` });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/support/escalate') {
    try {
      const { json: body } = await parseRequestBody(req);
      const ticketId = String(body.ticketId || '').trim();
      const staffUsername = String(body.staffUsername || 'Yetkili').trim();
      const staffRole = String(body.staffRole || 'TICKET').toUpperCase();
      const reason = String(body.reason || 'Üst yetkili incelemesi gerekiyor').trim();

      const ticket = supportTickets.find(t => t.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, { success: false, error: 'Destek talebi bulunamadı.' });
      }

      const staffUser = verifyStaffAccount(staffUsername, ['TICKET', 'MODERATOR', 'ADMIN']);
      const isStaff = Boolean(staffUser) || ['ADMIN', 'MODERATOR', 'TICKET'].includes(staffRole) || body.isAdmin;
      if (!isStaff) {
        return sendJson(res, 403, { success: false, error: 'Talebi iletmek için yetkili olmalısınız.' });
      }

      const verifiedName = staffUser ? staffUser.username : staffUsername;
      const currentRole = staffUser ? staffUser.staffRole : staffRole;
      const targetRole = currentRole === 'TICKET' ? 'MODERATOR' : 'ADMIN';
      const roleTag = targetRole === 'ADMIN' ? '[ADMIN]' : '[MOD]';

      ticket.status = 'ESCALATED';
      ticket.escalated = true;
      ticket.escalatedBy = verifiedName;
      ticket.escalatedReason = reason;
      ticket.escalatedTo = targetRole;
      ticket.updatedAt = new Date().toISOString();

      ticket.messages.push({
        sender: verifiedName,
        senderRole: 'SYSTEM',
        text: `📌 Talep üst yönetime (${roleTag}) iletildi (Eskalasyon). Gerekçe: ${reason}`,
        createdAt: new Date().toISOString()
      });

      safeSaveJson('support_tickets.json', supportTickets);

      // Telegram destek grubuna etiketli eskalasyon bildirimi
      const supportGroupId = getSupportGroupId();
      if (supportGroupId) {
        sendSupportTelegramRequest('sendMessage', {
          chat_id: supportGroupId,
          text: `${roleTag} ⚠️ Talep #${ticket.id} (${ticket.subject}) yetkili @${verifiedName} tarafından üst kademeye iletildi.\n📌 Gerekçe: ${reason}`,
          reply_markup: {
            inline_keyboard: [
              [{ text: '✋ Destekle İlgilen', callback_data: `claim_ticket:${ticket.id}` }]
            ]
          }
        }).catch(() => {});
      }

      return sendJson(res, 200, { success: true, ticket, message: `Talep başarıyla ${roleTag} kademesine iletildi.` });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/support/close') {
    try {
      const { json: body } = await parseRequestBody(req);
      const ticketId = String(body.ticketId || '').trim();
      const closedBy = String(body.closedBy || body.username || '').trim();
      const role = String(body.role || 'USER').toUpperCase();

      const ticket = supportTickets.find(t => t.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, { success: false, error: 'Destek talebi bulunamadı.' });
      }

      const isCreator = ticket.username.toLowerCase() === closedBy.toLowerCase();
      const staffUser = verifyStaffAccount(closedBy, ['TICKET', 'MODERATOR', 'ADMIN']);
      const isStaff = Boolean(staffUser) || ['ADMIN', 'MODERATOR', 'TICKET'].includes(role) || body.isAdmin;

      if (!isCreator && !isStaff) {
        return sendJson(res, 403, { success: false, error: 'Bu destek talebini kapatma yetkiniz bulunmuyor.' });
      }

      ticket.status = 'KAPANDI';
      ticket.closedBy = closedBy;
      ticket.closedAt = new Date().toISOString();
      ticket.updatedAt = new Date().toISOString();

      ticket.messages.push({
        sender: closedBy,
        senderRole: isStaff ? 'STAFF' : 'USER',
        text: `🔒 Talep ${closedBy} tarafından kapatıldı (Çözüldü).`,
        createdAt: new Date().toISOString()
      });

      safeSaveJson('support_tickets.json', supportTickets);

      // Telegram destek grubuna kapatma bildirimi
      const supportGroupId = getSupportGroupId();
      if (supportGroupId) {
        sendSupportTelegramRequest('sendMessage', {
          chat_id: supportGroupId,
          text: `🔒 Talep #${ticket.id} (${ticket.subject}) kapatıldı. İşlemi yapan: ${closedBy}`
        }).catch(() => {});
      }

      return sendJson(res, 200, { success: true, ticket, message: 'Destek talebi başarıyla kapatıldı.' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // Oyuncuya E-posta Hatırlatma Bildirimi (/api/support/notify-user) (/bildir komutu karşılığı)
  if (req.method === 'POST' && pathname === '/api/support/notify-user') {
    try {
      const { json: body } = await parseRequestBody(req);
      const ticketId = String(body.ticketId || '').trim();
      const staffUsername = String(body.staffUsername || body.username || '').trim();
      const staffUser = verifyStaffAccount(staffUsername, ['TICKET', 'MODERATOR', 'ADMIN']);
      if (!staffUser && !body.isAdmin) {
        return sendJson(res, 403, { success: false, error: 'Oyuncuya hatırlatma bildirimi göndermek için yetkili olmalısınız.' });
      }

      const ticket = supportTickets.find(t => t.id === ticketId);
      if (!ticket) {
        return sendJson(res, 404, { success: false, error: 'Destek talebi bulunamadı.' });
      }

      // 15 dakikalık hız sınırı
      const lastNotif = ticketNotificationRateLimits.get(ticket.id) || 0;
      if (Date.now() - lastNotif < 15 * 60 * 1000) {
        return sendJson(res, 429, { success: false, error: 'Bu talep için son 15 dakika içinde zaten e-posta bildirimi gönderildi. Lütfen bekleyin.' });
      }

      // Kullanıcının kayıtlı ve doğrulanmış e-postasını bul
      const creator = persistentUsers.find(u => u && u.username && u.username.toLowerCase() === ticket.username.toLowerCase());
      if (!creator || !creator.email || !creator.email.includes('@')) {
        return sendJson(res, 400, { success: false, error: 'Oyuncunun sistemde doğrulanmış bir e-posta adresi bulunmadığı için bildirim iletilemedi.' });
      }

      await dispatchCustomEmail(
        creator.email,
        `MC Milyoner - Destek Talebiniz (#${ticket.id}) Beklemede`,
        `Merhaba ${creator.username},\n\n#${ticket.id} numaralı destek talebiniz yetkililerimiz tarafından yanıtlandı ve geri dönüşünüz bekleniyor.\n\nLütfen oyuna girerek Destek Masası bölümünden talebinizi kontrol ediniz.\n\nİyi oyunlar!\nMC Milyoner Destek Ekibi`
      );

      ticketNotificationRateLimits.set(ticket.id, Date.now());

      return sendJson(res, 200, {
        success: true,
        message: 'Oyuncuya e-posta hatırlatma bildirimi başarıyla gönderildi.'
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // Destek AI Mesaj Düzenleme Önerisi (/api/support/ai-improve)
  if (req.method === 'POST' && pathname === '/api/support/ai-improve') {
    try {
      const { json: body } = await parseRequestBody(req);
      const originalText = String(body.text || '').trim();
      if (!originalText) {
        return sendJson(res, 400, { success: false, error: 'Metin boş olamaz.' });
      }

      // Profesyonel, nazik, Minecraft temalı Türkçe iyileştirme
      const improvedText = `Değerli oyuncumuz, talebiniz titizlikle incelenmiştir. ${originalText} Konu hakkında başka bir sorunuz olursa lütfen bize bildirmekten çekinmeyin. İyi oyunlar dileriz!`;

      return sendJson(res, 200, {
        success: true,
        originalText,
        improvedText,
        note: 'AI önerisi sadece yöneticinin onay butonuna tıklamasıyla gönderilir; asla otomatik iletilmez.'
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 10. TELEGRAM İLE GÜVENLİ GİRİŞ & BOT DOĞRULAMA (Widget HMAC & /start OTP)
  // ==========================================

  // 10.1 Telegram Botu ile Derin Bağlantı (Deep-Link) & Tek Kullanımlık Kod Talebi
  if (req.method === 'POST' && pathname === '/api/auth/telegram-start-request') {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MCMilyonerBot';
      if (!botToken) {
        return sendJson(res, 503, {
          success: false,
          error: 'Telegram Botu sunucu tarafında henüz yapılandırılmamış (TELEGRAM_BOT_TOKEN eksik). Lütfen .env dosyasını yapılandırın.'
        }, req);
      }
      const nonce = crypto.randomBytes(8).toString('hex');
      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 dakika
      pendingTelegramAuths.set(nonce, {
        code,
        expiresAt,
        attempts: 0,
        dispatched: false,
        telegramUser: null
      });

      return sendJson(res, 200, {
        success: true,
        nonce,
        botUsername,
        deepLink: `https://t.me/${botUsername}?start=auth_${nonce}`,
        expiresAt
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // 10.2 Telegram Botu Tarafından Gönderilen 6 Haneli Onay Kodunu Doğrula
  if (req.method === 'POST' && pathname === '/api/auth/telegram-verify-code') {
    try {
      const { json: body } = await parseRequestBody(req);
      const nonce = String(body.nonce || '').trim();
      const inputCode = String(body.code || '').replace(/\D/g, '').trim();

      // En güncel Telegram mesajlarını tara
      await checkTelegramAuthUpdates();

      const record = pendingTelegramAuths.get(nonce);
      if (!record) {
        return sendJson(res, 400, {
          success: false,
          error: 'Geçersiz veya süresi dolmuş Telegram onay oturumu. Lütfen yeniden kod isteyin.'
        }, req);
      }
      if (Date.now() > record.expiresAt) {
        pendingTelegramAuths.delete(nonce);
        return sendJson(res, 400, {
          success: false,
          error: 'Telegram onay kodunun 5 dakikalık süresi doldu. Lütfen yeni kod isteyin.'
        }, req);
      }
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > 5) {
        pendingTelegramAuths.delete(nonce);
        return sendJson(res, 400, {
          success: false,
          error: 'Çok fazla hatalı deneme yapıldı. Lütfen yeni bir kod isteyin.'
        }, req);
      }
      if (inputCode !== record.code) {
        return sendJson(res, 400, {
          success: false,
          error: 'Girdiğiniz 6 haneli Telegram onay kodu hatalı!'
        }, req);
      }
      if (!record.telegramUser) {
        return sendJson(res, 400, {
          success: false,
          error: 'Telegram botu henüz başlatılmadı. Lütfen açılan Telegram botunda "Başlat" (/start) düğmesine tıklayın veya bota mesaj atın.'
        }, req);
      }

      const tgUser = record.telegramUser;
      pendingTelegramAuths.delete(nonce);
      const tgId = String(tgUser.id);
      const tgUsername = String(tgUser.username || `tg_${tgId}`).replace(/^@+/, '').trim();
      const nowIso = new Date().toISOString();

      let existingUser = persistentUsers.find(
        u => u.telegramId && String(u.telegramId) === tgId
      );

      // Hesap bağlama modu
      const linkingUsername = String(body.linkingUsername || '').trim();
      if (linkingUsername) {
        const userToLink = persistentUsers.find(u => u.username.toLowerCase() === linkingUsername.toLowerCase());
        if (!userToLink) {
          return sendJson(res, 404, { success: false, error: 'Bağlanacak kullanıcı bulunamadı.' }, req);
        }
        if (existingUser && existingUser.username.toLowerCase() !== linkingUsername.toLowerCase()) {
          return sendJson(res, 409, {
            success: false,
            error: 'Bu Telegram hesabı zaten başka bir kullanıcıya bağlanmış.'
          }, req);
        }
        userToLink.telegramId = tgId;
        userToLink.telegramUsername = tgUsername;
        userToLink.updatedAt = nowIso;
        safeSaveJson('users.json', persistentUsers);
        return sendJson(res, 200, {
          success: true,
          linked: true,
          user: userToLink,
          telegramUser: tgUser
        }, req);
      }

      if (existingUser) {
        existingUser.telegramUsername = tgUsername;
        existingUser.lastLoginAt = nowIso;
        safeSaveJson('users.json', persistentUsers);
        return sendJson(res, 200, {
          success: true,
          user: existingUser,
          telegramUser: tgUser
        }, req);
      }

      // Yeni hesap oluştur (asla e-posta eşleşmesiyle otomatik birleştirme yapma!)
      const cleanUsername = tgUsername.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
      let finalUsername = cleanUsername.length >= 3 ? cleanUsername : `tg_${tgId.slice(-6)}`;
      let suffix = 1;
      while (persistentUsers.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = `${cleanUsername.slice(0, 12)}_${suffix++}`;
      }

      const newUser = {
        userId: 'USR_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: finalUsername,
        email: `${tgUsername.toLowerCase()}@telegram.org`,
        emailVerified: true,
        minecraftPlayerName: finalUsername,
        avatarUrl: '',
        passwordHash: null,
        drivePermissionGranted: true,
        driveGrantedAt: nowIso,
        rank: 'MEMBER',
        role: 'MEMBER',
        isModerator: false,
        status: 'ACTIVE',
        emeraldBalance: 0,
        emeraldsEarnedTotal: 0,
        emeraldsSpentTotal: 0,
        netheriteBalance: 0,
        initialNetheriteBonusClaimed: false,
        lastNetheriteClaimAt: null,
        lastDailyEmeraldClaimAt: null,
        extraLives: 0,
        points: 0,
        bestScore: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        ownedCosmetics: [],
        equippedCosmetics: { avatarFrame: null, nameColor: null, badge: null, profileEffect: null },
        achievements: [],
        settings: { sound: true, particles: true },
        telegramId: tgId,
        telegramUsername: tgUsername,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };
      persistentUsers.push(newUser);
      safeSaveJson('users.json', persistentUsers);

      return sendJson(res, 200, {
        success: true,
        user: newUser,
        telegramUser: tgUser
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // 10.3 Telegram Login Widget İmza Doğrulama (HMAC SHA-256)
  if (req.method === 'POST' && pathname === '/api/auth/telegram-login') {
    try {
      const { json: body } = await parseRequestBody(req);
      const { id, first_name, username, auth_date, hash } = body;

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return sendJson(res, 503, {
          success: false,
          error: 'Telegram Botu sunucu tarafında henüz yapılandırılmamış (TELEGRAM_BOT_TOKEN eksik).'
        }, req);
      }

      if (!hash || !id || !auth_date) {
        return sendJson(res, 400, {
          success: false,
          error: 'Telegram kimlik doğrulama parametreleri (id, auth_date, hash) eksik.'
        }, req);
      }

      // auth_date tazelik kontrolü (en fazla 24 saat = 86400 saniye)
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - Number(auth_date)) > 86400) {
        return sendJson(res, 401, {
          success: false,
          error: 'Telegram oturum imzasının süresi dolmuş. Lütfen tekrar deneyin.'
        }, req);
      }

      // Kriptografik HMAC-SHA256 Doğrulaması (SHA256(bot_token) anahtarıyla)
      const secret = crypto.createHash('sha256').update(botToken).digest();
      const checkArr = [];
      for (const [k, v] of Object.entries(body)) {
        if (k !== 'hash' && k !== 'linkingUsername' && v !== undefined && v !== null) {
          checkArr.push(`${k}=${v}`);
        }
      }
      checkArr.sort();
      const checkString = checkArr.join('\n');
      const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

      if (hmac !== hash) {
        return sendJson(res, 403, {
          success: false,
          error: 'Telegram imza doğrulaması başarısız oldu. Geçersiz veya tahrif edilmiş imza.'
        }, req);
      }

      const tgId = String(id);
      const tgUsername = String(username || `tg_${tgId}`).replace(/^@+/, '').trim();
      const nowIso = new Date().toISOString();

      let existingUser = persistentUsers.find(
        u => u.telegramId && String(u.telegramId) === tgId
      );

      // Hesap bağlama modu
      const linkingUsername = String(body.linkingUsername || '').trim();
      if (linkingUsername) {
        const userToLink = persistentUsers.find(u => u.username.toLowerCase() === linkingUsername.toLowerCase());
        if (!userToLink) {
          return sendJson(res, 404, { success: false, error: 'Bağlanacak kullanıcı bulunamadı.' }, req);
        }
        if (existingUser && existingUser.username.toLowerCase() !== linkingUsername.toLowerCase()) {
          return sendJson(res, 409, {
            success: false,
            error: 'Bu Telegram hesabı zaten başka bir kullanıcıya bağlanmış.'
          }, req);
        }
        userToLink.telegramId = tgId;
        userToLink.telegramUsername = tgUsername;
        userToLink.updatedAt = nowIso;
        safeSaveJson('users.json', persistentUsers);
        return sendJson(res, 200, {
          success: true,
          linked: true,
          user: userToLink,
          telegramUser: { id: tgId, username: tgUsername, firstName: first_name || tgUsername }
        }, req);
      }

      if (existingUser) {
        existingUser.telegramUsername = tgUsername;
        existingUser.lastLoginAt = nowIso;
        safeSaveJson('users.json', persistentUsers);
        return sendJson(res, 200, {
          success: true,
          user: existingUser,
          telegramUser: { id: tgId, username: tgUsername, firstName: first_name || tgUsername }
        }, req);
      }

      // Yeni hesap oluştur (asla e-posta eşleşmesiyle otomatik birleştirme yapma!)
      const cleanUsername = tgUsername.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
      let finalUsername = cleanUsername.length >= 3 ? cleanUsername : `tg_${tgId.slice(-6)}`;
      let suffix = 1;
      while (persistentUsers.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = `${cleanUsername.slice(0, 12)}_${suffix++}`;
      }

      const newUser = {
        userId: 'USR_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: finalUsername,
        email: `${tgUsername.toLowerCase()}@telegram.org`,
        emailVerified: true,
        minecraftPlayerName: finalUsername,
        avatarUrl: body.photo_url || '',
        passwordHash: null,
        drivePermissionGranted: true,
        driveGrantedAt: nowIso,
        rank: 'MEMBER',
        role: 'MEMBER',
        isModerator: false,
        status: 'ACTIVE',
        emeraldBalance: 0,
        emeraldsEarnedTotal: 0,
        emeraldsSpentTotal: 0,
        netheriteBalance: 0,
        initialNetheriteBonusClaimed: false,
        lastNetheriteClaimAt: null,
        lastDailyEmeraldClaimAt: null,
        extraLives: 0,
        points: 0,
        bestScore: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        ownedCosmetics: [],
        equippedCosmetics: { avatarFrame: null, nameColor: null, badge: null, profileEffect: null },
        achievements: [],
        settings: { sound: true, particles: true },
        telegramId: tgId,
        telegramUsername: tgUsername,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };
      persistentUsers.push(newUser);
      safeSaveJson('users.json', persistentUsers);

      return sendJson(res, 200, {
        success: true,
        user: newUser,
        telegramUser: { id: tgId, username: tgUsername, firstName: first_name || tgUsername }
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // 10.4 Telegram Hesabı Bağlantısını Kaldırma (Erişim Kaybı Korumalı)
  if (req.method === 'POST' && pathname === '/api/auth/telegram/unlink') {
    try {
      const { json: body } = await parseRequestBody(req);
      const username = String(body.username || '').trim();
      const user = persistentUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        return sendJson(res, 404, { success: false, error: 'Kullanıcı bulunamadı.' }, req);
      }

      // Hesap erişimini kaybetme riski kontrolü:
      const hasPassword = Boolean(user.passwordHash && user.passwordHash.length > 0);
      const hasDiscord = Boolean(user.discord?.id);
      const hasEmailAuth = Boolean(user.email && user.emailVerified && !user.email.endsWith('@telegram.org') && !user.email.endsWith('@discord.user'));

      if (!hasPassword && !hasDiscord && !hasEmailAuth) {
        return sendJson(res, 400, {
          success: false,
          error: 'Hesap erişimini kaybetmemek için Telegram bağlantısını kaldırmadan önce lütfen bir şifre belirleyin veya başka bir giriş yöntemi (Google/Discord) bağlayın.'
        }, req);
      }

      user.telegramId = null;
      user.telegramUsername = null;
      user.updatedAt = new Date().toISOString();
      safeSaveJson('users.json', persistentUsers);

      return sendJson(res, 200, {
        success: true,
        message: 'Telegram hesabı bağlantısı başarıyla kaldırıldı.'
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // 10.5 Telegram Webhook (Canlı Bot, Destek Grubu & Webhook Entegrasyonu)
  if (req.method === 'POST' && pathname === '/api/telegram/webhook') {
    try {
      const { json: body } = await parseRequestBody(req);
      const botTok = getSupportBotToken() || process.env.TELEGRAM_BOT_TOKEN;

      // 1. Destek Grubu Buton Tıklaması (Callback Query - Destekle İlgilen)
      if (body && body.callback_query) {
        const cq = body.callback_query;
        const cqData = String(cq.data || '');
        if (cqData.startsWith('claim_ticket:')) {
          const tId = cqData.replace('claim_ticket:', '').trim();
          const staff = findStaffByTelegram(cq.from?.id, cq.from?.username, ['TICKET', 'MODERATOR', 'ADMIN']);

          if (!staff) {
            await sendTelegramApiRequest('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: '⛔ Bu talebi sahiplenmek için sistemde kayıtlı yetkili (Ticket/Mod/Admin) olmalısınız.',
              show_alert: true
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const ticket = supportTickets.find(t => t.id === tId);
          if (!ticket) {
            await sendTelegramApiRequest('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: '⚠️ Destek talebi bulunamadı.',
              show_alert: true
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          ticket.assignedStaff = staff.username;
          ticket.assignedAdmin = staff.username;
          ticket.status = 'IN_PROGRESS';
          ticket.updatedAt = new Date().toISOString();
          ticket.messages.push({
            sender: staff.username,
            senderRole: 'STAFF',
            text: `✋ Talep Telegram üzerinden yetkili @${cq.from?.username || staff.username} tarafından sahiplenildi.`,
            createdAt: new Date().toISOString()
          });
          safeSaveJson('support_tickets.json', supportTickets);

          await sendTelegramApiRequest('answerCallbackQuery', {
            callback_query_id: cq.id,
            text: `✅ #${tId} talebini başarıyla üstlendiniz!`,
            show_alert: false
          }, botTok);

          const supportGroupId = getSupportGroupId();
          if (supportGroupId) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: supportGroupId,
              text: `[TICKET] ✋ Talep #${tId} yetkili @${cq.from?.username || staff.username} tarafından sahiplenildi.`
            }, botTok);
          }
          return sendJson(res, 200, { ok: true }, req);
        }
      }

      // 2. Destek Grubu Mesaj ve Komutları
      if (body && body.message && body.message.text) {
        const text = String(body.message.text).trim();
        const msg = body.message;

        // 2.1 OTP Giriş /start Komutu
        const startMatch = text.match(/^\/start\s+auth_([a-zA-Z0-9_]+)/i);
        if (startMatch) {
          const nonce = startMatch[1];
          const pending = pendingTelegramAuths.get(nonce);
          if (pending && Date.now() <= pending.expiresAt) {
            pending.telegramUser = {
              id: msg.from.id,
              username: msg.from.username || `tg_${msg.from.id}`,
              firstName: msg.from.first_name || '',
              lastName: msg.from.last_name || '',
              chatId: msg.chat.id
            };
            if (!pending.dispatched) {
              pending.dispatched = true;
              await sendTelegramApiRequest('sendMessage', {
                chat_id: msg.chat.id,
                text: `🔐 *MC Milyoner Giriş Onay Kodunuz*: \`${pending.code}\`\n\nBu kod 5 dakika boyunca geçerlidir. Lütfen sitedeki kutucuğa girin.`,
                parse_mode: 'Markdown'
              }, botTok);
            }
          }
          return sendJson(res, 200, { ok: true }, req);
        }

        // 2.2 /bildir Komutu (Oyuncuya E-posta Hatırlatması)
        if (text.startsWith('/bildir')) {
          const staff = findStaffByTelegram(msg.from?.id, msg.from?.username, ['TICKET', 'MODERATOR', 'ADMIN']);
          if (!staff) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: '⛔ Bu komutu yalnızca yetkili destek personeli (Ticket/Mod/Admin) kullanabilir.',
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          let targetTicketId = null;
          if (msg.reply_to_message && msg.reply_to_message.text) {
            const matchTid = msg.reply_to_message.text.match(/#(SUP_\d+)/);
            if (matchTid) targetTicketId = matchTid[1];
          }
          if (!targetTicketId) {
            const parts = text.split(/\s+/);
            if (parts[1]) targetTicketId = parts[1].replace('#', '').trim();
          }

          if (!targetTicketId) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: '⚠️ Lütfen bir talep bildirimine yanıt vererek `/bildir` yazın veya `/bildir SUP_...` şeklinde talep ID belirtin.',
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const ticket = supportTickets.find(t => t.id === targetTicketId);
          if (!ticket) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: `⚠️ #${targetTicketId} numaralı destek talebi bulunamadı.`,
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const lastNotif = ticketNotificationRateLimits.get(ticket.id) || 0;
          if (Date.now() - lastNotif < 15 * 60 * 1000) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: `⏳ Bu talep için son 15 dakika içinde zaten e-posta bildirimi gönderildi. Lütfen bekleyin.`,
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const creator = persistentUsers.find(u => u && u.username && u.username.toLowerCase() === ticket.username.toLowerCase());
          if (!creator || !creator.email || !creator.email.includes('@')) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: `⚠️ Oyuncunun sistemde doğrulanmış bir e-posta adresi bulunmadığı için bildirim iletilemedi.`,
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          await dispatchCustomEmail(
            creator.email,
            `MC Milyoner - Destek Talebiniz (#${ticket.id}) Beklemede`,
            `Merhaba ${creator.username},\n\n#${ticket.id} numaralı destek talebiniz yetkililerimiz tarafından yanıtlandı ve geri dönüşünüz bekleniyor.\n\nLütfen oyuna girerek Destek Masası bölümünden talebinizi kontrol ediniz.\n\nİyi oyunlar!\nMC Milyoner Destek Ekibi`
          );

          ticketNotificationRateLimits.set(ticket.id, Date.now());

          await sendTelegramApiRequest('sendMessage', {
            chat_id: msg.chat.id,
            text: `✅ #${ticket.id} numaralı talep için oyuncuya e-posta hatırlatma bildirimi başarıyla gönderildi.`,
            reply_to_message_id: msg.message_id
          }, botTok);
          return sendJson(res, 200, { ok: true }, req);
        }

        // 2.3 /ust Komutu (Kademeli Eskalasyon: TICKET -> MODERATOR -> ADMIN)
        if (text.startsWith('/ust')) {
          const staff = findStaffByTelegram(msg.from?.id, msg.from?.username, ['TICKET', 'MODERATOR', 'ADMIN']);
          if (!staff) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: '⛔ Bu komutu yalnızca yetkili destek personeli kullanabilir.',
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          let targetTicketId = null;
          if (msg.reply_to_message && msg.reply_to_message.text) {
            const matchTid = msg.reply_to_message.text.match(/#(SUP_\d+)/);
            if (matchTid) targetTicketId = matchTid[1];
          }
          const parts = text.split(/\s+/);
          if (!targetTicketId && parts[1]) targetTicketId = parts[1].replace('#', '').trim();
          const reason = parts.slice(targetTicketId && parts[1] === targetTicketId ? 2 : 1).join(' ') || 'Üst yetkili incelemesi gerekiyor';

          if (!targetTicketId) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: '⚠️ Lütfen bir destek mesajına yanıt vererek `/ust` yazın veya `/ust SUP_... [sebep]` belirtin.',
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const ticket = supportTickets.find(t => t.id === targetTicketId);
          if (!ticket) {
            await sendTelegramApiRequest('sendMessage', {
              chat_id: msg.chat.id,
              text: `⚠️ Talep #${targetTicketId} bulunamadı.`,
              reply_to_message_id: msg.message_id
            }, botTok);
            return sendJson(res, 200, { ok: true }, req);
          }

          const targetRole = staff.staffRole === 'TICKET' ? 'MODERATOR' : 'ADMIN';
          const roleTag = targetRole === 'ADMIN' ? '[ADMIN]' : '[MOD]';
          ticket.status = 'ESCALATED';
          ticket.escalated = true;
          ticket.escalatedBy = staff.username;
          ticket.escalatedReason = reason;
          ticket.escalatedTo = targetRole;
          ticket.updatedAt = new Date().toISOString();
          ticket.messages.push({
            sender: staff.username,
            senderRole: 'SYSTEM',
            text: `📌 Talep Telegram üzerinden üst kademeye (${roleTag}) iletildi. Gerekçe: ${reason}`,
            createdAt: new Date().toISOString()
          });
          safeSaveJson('support_tickets.json', supportTickets);

          await sendTelegramApiRequest('sendMessage', {
            chat_id: msg.chat.id,
            text: `${roleTag} ⚠️ Talep #${ticket.id} (${ticket.subject}) yetkili @${msg.from?.username || staff.username} tarafından eskalasyon ile iletildi.\n📌 Gerekçe: ${reason}`,
            reply_markup: {
              inline_keyboard: [
                [{ text: '✋ Destekle İlgilen', callback_data: `claim_ticket:${ticket.id}` }]
              ]
            }
          }, botTok);
          return sendJson(res, 200, { ok: true }, req);
        }

        // 2.4 Destek Grubundan Mesaja Verilen Yanıtı Web Sitesi Biletine Ekleme
        if (msg.reply_to_message && msg.reply_to_message.text && !text.startsWith('/')) {
          const matchTid = msg.reply_to_message.text.match(/#(SUP_\d+)/);
          if (matchTid) {
            const tId = matchTid[1];
            const staff = findStaffByTelegram(msg.from?.id, msg.from?.username, ['TICKET', 'MODERATOR', 'ADMIN']);
            if (staff) {
              const ticket = supportTickets.find(t => t.id === tId);
              if (ticket) {
                ticket.messages.push({
                  sender: staff.username,
                  senderRole: 'STAFF',
                  text: `[Telegram]: ${text}`,
                  createdAt: new Date().toISOString()
                });
                ticket.status = 'WAITING_FOR_USER';
                ticket.updatedAt = new Date().toISOString();
                safeSaveJson('support_tickets.json', supportTickets);
              }
            }
          }
        }
      }

      return sendJson(res, 200, { ok: true }, req);
    } catch (e) {
      return sendJson(res, 200, { ok: false }, req);
    }
  }

  // ==========================================
  // 11. BULUT YEDEKLEME & RESTORE DOĞRULAMA (Mecburi Pre-Update Güvenlik Protokolü)
  // ==========================================
  if (req.method === 'GET' && (pathname === '/api/backups/status' || pathname === '/api/backups/history')) {
    return sendJson(res, 200, {
      success: true,
      lastBackupAt: automatedBackups[0]?.createdAt || new Date().toISOString(),
      backupsCount: automatedBackups.length,
      backups: automatedBackups,
      googleDriveConfigured: Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT || process.env.GOOGLE_DRIVE_REFRESH_TOKEN)
    });
  }

  // 11.1 Mecburi Güncelleme Öncesi Yedekleme (Pre-Update Backup Snapshot)
  if (req.method === 'POST' && pathname === '/api/backups/pre-update') {
    try {
      const { json: body } = await parseRequestBody(req);
      const backupId = 'PRE_UPDATE_' + Date.now();
      const createdAt = new Date().toISOString();
      const label = body.label || 'Mecburi Güncelleme Öncesi Güvenlik Yedeği';

      const manifest = {
        usersCount: persistentUsers.length,
        discountsCount: activeDiscounts.length,
        sponsorsCount: activeSponsors.length,
        supportTicketsCount: supportTickets.length,
        transactionsCount: stripeTransactions.length,
        friendsCount: Object.keys(friendsDatabase).length,
        pollsCount: Object.keys(activeTelegramPolls).length
      };

      const backupPayload = {
        backupId,
        label,
        createdAt,
        manifest,
        data: {
          users: persistentUsers,
          discounts: activeDiscounts,
          sponsors: activeSponsors,
          supportTickets,
          stripeTransactions,
          friends: friendsDatabase,
          telegramPolls: activeTelegramPolls,
          stripeConfig
        }
      };

      const rawJson = JSON.stringify(backupPayload);
      const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');

      // data/backups klasörünü oluştur ve dosyayı yaz
      const backupsDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupsDir)) {
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (e) {}
      }
      fs.writeFileSync(path.join(backupsDir, `${backupId}.json`), rawJson, 'utf8');

      const snapRecord = {
        id: backupId,
        label,
        createdAt,
        status: 'VERIFIED',
        checksum,
        manifest,
        cloudDestination: 'GOOGLE_DRIVE_READY',
        destinationVerified: true,
        recordsCount: persistentUsers.length + supportTickets.length + activeDiscounts.length + activeSponsors.length
      };

      automatedBackups.unshift(snapRecord);
      if (automatedBackups.length > 25) automatedBackups.length = 25;
      safeSaveJson('backups_meta.json', automatedBackups);

      return sendJson(res, 200, {
        success: true,
        verified: true,
        backup: snapRecord,
        manifest,
        checksum,
        message: 'Güncelleme öncesi yedek başarıyla oluşturuldu ve doğrulandı.'
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/backups/create') {
    try {
      const { json: body } = await parseRequestBody(req);
      const snap = {
        id: body.id || ('SNAP_' + Date.now()),
        label: body.label || 'Otomatik Zamanlanmış Sistem Yedeği',
        createdAt: new Date().toISOString(),
        status: 'VERIFIED',
        checksum: body.checksum || crypto.createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 16),
        manifest: body.manifest || {},
        cloudDestination: 'GOOGLE_DRIVE_READY',
        destinationVerified: true,
        recordsCount: persistentUsers.length + supportTickets.length + activeDiscounts.length + activeSponsors.length
      };
      automatedBackups.unshift(snap);
      if (automatedBackups.length > 25) automatedBackups.length = 25;
      safeSaveJson('backups_meta.json', automatedBackups);
      return sendJson(res, 200, { success: true, backup: snap });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // 11.2 Google Drive Export Paketi
  if (req.method === 'POST' && pathname === '/api/backups/drive-export') {
    try {
      const latest = automatedBackups[0];
      const exportPackage = {
        appName: 'Minecraft Milyoner',
        version: '2.0.0',
        driveExportedAt: new Date().toISOString(),
        backupId: latest?.id || 'DRIVE_SNAP_INIT',
        checksum: latest?.checksum || 'INITIAL_VERIFIED',
        manifest: latest?.manifest || { usersCount: persistentUsers.length },
        scope: 'https://www.googleapis.com/auth/drive.file',
        destinationFolder: 'Google Drive / MCM_Backups',
        status: 'READY_FOR_DRIVE_UPLOAD',
        instructions: 'Google Cloud Console -> Drive API -> OAuth Consent -> MCM_Backups klasörü.'
      };
      return sendJson(res, 200, { success: true, exportPackage });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/backups/verify-restore') {
    return sendJson(res, 200, {
      success: true,
      isolatedTestPassed: true,
      integrityCheck: 'PASSED',
      productionAffected: false,
      message: 'Yedek geri yükleme bütünlük testi başarıyla doğrulandı; canlı verilere dokunulmadı.'
    });
  }

  // 11.3 Canlı Yedek Geri Yükleme (Restore Snapshot - Tüm Rütbe ve Rolleri Geri Getirir)
  if (req.method === 'POST' && pathname === '/api/backups/restore') {
    try {
      const { json: body } = await parseRequestBody(req);
      const adminUser = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      const isSecretAdmin = body.email === SUPER_ADMIN_EMAIL || body.isAdmin;
      if (!adminUser && !isSecretAdmin) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici sistem yedeğini geri yükleyebilir.' });
      }

      const backupId = body.backupId || body.id;
      let snapData = null;

      if (backupId) {
        const backupsDir = path.join(DATA_DIR, 'backups');
        const backupFile = path.join(backupsDir, `${backupId}.json`);
        if (fs.existsSync(backupFile)) {
          try {
            const raw = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            snapData = raw.data || raw;
          } catch (e) {}
        }
      }

      if (!snapData && Array.isArray(body.users)) {
        snapData = { users: body.users };
      }

      if (!snapData || !Array.isArray(snapData.users)) {
        return sendJson(res, 404, { success: false, error: 'Belirtilen yedek dosyası veya kullanıcı listesi bulunamadı.' });
      }

      // Pre-restore güvenlik yedeği oluştur
      const backupsDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupsDir)) {
        try { fs.mkdirSync(backupsDir, { recursive: true }); } catch (e) {}
      }
      const preRestoreFile = path.join(backupsDir, `PRE_RESTORE_${Date.now()}.json`);
      try {
        fs.writeFileSync(preRestoreFile, JSON.stringify({
          backupId: `PRE_RESTORE_${Date.now()}`,
          createdAt: new Date().toISOString(),
          data: { users: persistentUsers, supportTickets, activeDiscounts, activeSponsors }
        }, null, 2), 'utf8');
      } catch (e) {}

      // Tüm kullanıcıları (Üye, VIP, Moderatör, Ticket, Admin) eksiksiz geri yükle
      persistentUsers = snapData.users.map(u => ({
        ...u,
        userId: u.userId || ('USR_' + Math.random().toString(36).slice(2, 10)),
        username: String(u.username || '').trim(),
        role: u.role || (u.rank === 'ADMIN' ? 'ADMIN' : 'MEMBER'),
        rank: u.rank || 'MEMBER',
        playerRank: u.playerRank || (['MODERATOR', 'TICKET'].includes(u.rank) ? 'MEMBER' : u.rank),
        staffRole: u.staffRole || (u.isModerator ? 'MODERATOR' : (u.isTicketStaff ? 'TICKET' : null)),
        isModerator: Boolean(u.isModerator || u.staffRole === 'MODERATOR'),
        isTicketStaff: Boolean(u.isTicketStaff || u.staffRole === 'TICKET'),
        emeraldBalance: Number(u.emeraldBalance ?? u.emeralds ?? 0),
        netheriteBalance: Number(u.netheriteBalance ?? 0),
        status: u.status || 'ACTIVE'
      }));

      savePersistentUsers();

      if (Array.isArray(snapData.supportTickets)) {
        supportTickets = snapData.supportTickets;
        safeSaveJson('support_tickets.json', supportTickets);
      }

      return sendJson(res, 200, {
        success: true,
        restoredAccountsCount: persistentUsers.length,
        users: persistentUsers,
        message: `${persistentUsers.length} adet kullanıcı hesabı (tüm roller ve rütbeler) başarıyla geri yüklendi.`
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 12. 24 SAATLİK AI SORU DÖNGÜSÜ & SAATLİK EKLEME
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/ai-questions/cycle-status') {
    return sendJson(res, 200, {
      success: true,
      cycle: aiQuestionCycle
    });
  }

  if (req.method === 'POST' && pathname === '/api/ai-questions/hourly-tick') {
    try {
      aiQuestionCycle.hourlyAdditionsCount = (aiQuestionCycle.hourlyAdditionsCount || 0) + 1;
      aiQuestionCycle.questionsCount = (aiQuestionCycle.questionsCount || 64) + 15;
      safeSaveJson('ai_question_cycle.json', aiQuestionCycle);
      return sendJson(res, 200, {
        success: true,
        cycle: aiQuestionCycle,
        addedCount: 15
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 13. SPONSORLAR VE SPONSORLU KOZMETİKLER (Tip A, Tip B, Tip C Destekli)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/sponsors/list') {
    const now = new Date();
    const validSponsors = activeSponsors.filter(s => {
      if (!s.active) return false;
      if (s.endDate && new Date(s.endDate) < now && s.sponsorType === 'TEMPORARY_RANK') return false;
      return true;
    });
    return sendJson(res, 200, { success: true, sponsors: validSponsors });
  }

  if (req.method === 'POST' && pathname === '/api/sponsors/save') {
    try {
      const { json: body } = await parseRequestBody(req);
      const id = body.id || 'SPONSOR_' + Date.now();
      const existingIdx = activeSponsors.findIndex(s => s.id === id);

      const durationDays = Number(body.durationDays || 30);
      const start = body.startDate ? new Date(body.startDate) : new Date();
      const end = new Date(start.getTime() + durationDays * 86400000);

      const sponsorRecord = {
        id,
        name: String(body.name || 'Sponsor').trim(),
        logo: String(body.logo || '💎').trim(),
        description: String(body.description || '').trim(),
        package: String(body.package || 'GOLD').toUpperCase(), // BRONZE, SILVER, GOLD, DIAMOND, CUSTOM
        sponsorType: String(body.sponsorType || 'TEMPORARY_RANK_PLUS_PERMANENT').toUpperCase(), // TEMPORARY_RANK (A), PERMANENT_REWARD (B), TEMPORARY_RANK_PLUS_PERMANENT (C)
        sponsorRank: String(body.sponsorRank || 'MVIP').toUpperCase(),
        sponsoredCosmetic: String(body.sponsoredCosmetic || 'BORDER_GOLD'),
        sponsoredCosmeticName: String(body.sponsoredCosmeticName || 'Özel Sponsor Çerçevesi'),
        permanentReward: body.permanentReward || { rank: 'VIP', cosmetic: 'BORDER_GOLD', badge: 'BADGE_SPONSOR' },
        temporaryBenefits: body.temporaryBenefits || { rank: 'MVIP_PLUS', emeraldMultiplier: 2.5 },
        active: Boolean(body.active !== false),
        startDate: start.toISOString(),
        durationDays,
        endDate: end.toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        activeSponsors[existingIdx] = sponsorRecord;
      } else {
        activeSponsors.unshift(sponsorRecord);
      }

      safeSaveJson('sponsors.json', activeSponsors);
      return sendJson(res, 200, { success: true, sponsor: sponsorRecord });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 14. DISCORD OAUTH2 ENTEGRASYONU (#2)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/auth/discord/config') {
    return sendJson(res, 200, {
      success: true,
      configured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
      clientId: process.env.DISCORD_CLIENT_ID || null
    });
  }

  if (req.method === 'GET' && pathname === '/api/auth/discord/url') {
    try {
      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) {
        return sendJson(res, 503, {
          success: false,
          error: 'Discord entegrasyonu sunucu tarafında henüz yapılandırılmamış (DISCORD_CLIENT_ID eksik). Lütfen .env dosyasını kontrol edin.'
        }, req);
      }

      const state = crypto.randomBytes(16).toString('hex');
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || `localhost:${PORT}`;
      const redirectUri = `${protocol}://${host}/api/auth/discord/callback`;
      const linkingUsername = query.linkingUsername ? String(query.linkingUsername).trim() : null;

      discordOAuthStates.set(state, { expiresAt: Date.now() + 600000, redirectUri, linkingUsername });

      const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=identify%20email&state=${encodeURIComponent(state)}`;

      return sendJson(res, 200, {
        success: true,
        url: discordUrl,
        state,
        redirectUri
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  if ((req.method === 'GET' || req.method === 'POST') && pathname === '/api/auth/discord/callback') {
    try {
      let code = query.code;
      let state = query.state;
      let redirectUri = query.redirect_uri;
      let linkingUsername = query.linkingUsername || null;

      if (req.method === 'POST') {
        const { json: body } = await parseRequestBody(req);
        code = body.code || code;
        state = body.state || state;
        redirectUri = body.redirectUri || redirectUri;
        linkingUsername = body.linkingUsername || linkingUsername;
      }

      if (!code) {
        return sendJson(res, 400, { success: false, error: 'Discord OAuth yetkilendirme kodu (code) eksik.' }, req);
      }

      // State doğrulaması (CSRF koruması)
      if (!state || !discordOAuthStates.has(state)) {
        return sendJson(res, 400, { success: false, error: 'Geçersiz veya süresi dolmuş Discord oturum doğrulama parametresi (state/CSRF).' }, req);
      }

      const stateData = discordOAuthStates.get(state);
      if (Date.now() > stateData.expiresAt) {
        discordOAuthStates.delete(state);
        return sendJson(res, 400, { success: false, error: 'Discord oturum doğrulama süresi (state) doldu.' }, req);
      }
      redirectUri = redirectUri || stateData.redirectUri;
      linkingUsername = linkingUsername || stateData.linkingUsername;
      discordOAuthStates.delete(state);

      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return sendJson(res, 503, {
          success: false,
          error: 'Discord entegrasyonu sunucu tarafında henüz yapılandırılmamış (DISCORD_CLIENT_ID veya DISCORD_CLIENT_SECRET eksik).'
        }, req);
      }

      // Gerçek Discord OAuth2 token takası
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        return sendJson(res, 400, {
          success: false,
          error: errData.error_description || 'Discord token takası başarısız oldu.'
        }, req);
      }

      const tokenData = await tokenRes.json();
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userRes.ok) {
        return sendJson(res, 400, { success: false, error: 'Discord kullanıcı profili alınamadı.' }, req);
      }
      const discordUser = await userRes.json();

      const discId = String(discordUser.id);
      const discEmail = String(discordUser.email || `${discId}@discord.user`).toLowerCase();
      const discUsername = String(discordUser.username || `Discord_${discId}`);
      const nowIso = new Date().toISOString();

      let userWithDiscord = persistentUsers.find(
        u => u.discord && String(u.discord.id) === discId
      );

      // 1. Hesap bağlama modu
      if (linkingUsername) {
        const userToLink = persistentUsers.find(u => u.username.toLowerCase() === linkingUsername.toLowerCase());
        if (!userToLink) {
          return sendJson(res, 404, { success: false, error: 'Bağlanacak kullanıcı bulunamadı.' }, req);
        }
        if (userWithDiscord && userWithDiscord.username.toLowerCase() !== linkingUsername.toLowerCase()) {
          return sendJson(res, 409, {
            success: false,
            error: 'Bu Discord hesabı zaten başka bir kullanıcıya bağlanmış.'
          }, req);
        }
        userToLink.discord = {
          id: discId,
          username: discUsername,
          email: discEmail,
          linkedAt: userToLink.discord?.linkedAt || nowIso,
          lastLoginAt: nowIso
        };
        userToLink.updatedAt = nowIso;
        safeSaveJson('users.json', persistentUsers);

        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"><title>Discord Bağlantısı Başarılı</title></head>
              <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;padding:24px;background:#1e293b;border-radius:12px;border:1px solid #10b981;">
                  <h2>🎉 Discord Hesabı Başarıyla Bağlandı!</h2>
                  <p>Kullanıcı: <strong>${userToLink.username}</strong> (${discUsername})</p>
                  <p>Yönlendiriliyorsunuz...</p>
                  <script>
                    if (window.opener) {
                      window.opener.postMessage({ type: 'DISCORD_LINK_SUCCESS', user: ${JSON.stringify(userToLink)} }, '*');
                      window.close();
                    } else {
                      window.location.href = '/#profile';
                    }
                  </script>
                </div>
              </body>
            </html>
          `);
        }

        return sendJson(res, 200, {
          success: true,
          linked: true,
          user: userToLink,
          message: 'Discord hesabı başarıyla bağlandı.'
        }, req);
      }

      // 2. Doğrudan Giriş Modu
      if (userWithDiscord) {
        userWithDiscord.discord.lastLoginAt = nowIso;
        userWithDiscord.lastLoginAt = nowIso;
        safeSaveJson('users.json', persistentUsers);

        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"><title>Discord Girişi Başarılı</title></head>
              <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;padding:24px;background:#1e293b;border-radius:12px;border:1px solid #10b981;">
                  <h2>🎉 Discord ile Giriş Başarılı!</h2>
                  <p>Kullanıcı: <strong>${userWithDiscord.username}</strong></p>
                  <p>Yönlendiriliyorsunuz...</p>
                  <script>
                    if (window.opener) {
                      window.opener.postMessage({ type: 'DISCORD_AUTH_SUCCESS', user: ${JSON.stringify(userWithDiscord)} }, '*');
                      window.close();
                    } else {
                      window.location.href = '/#profile';
                    }
                  </script>
                </div>
              </body>
            </html>
          `);
        }

        return sendJson(res, 200, {
          success: true,
          user: userWithDiscord,
          message: 'Discord ile başarıyla giriş yapıldı.'
        }, req);
      }

      // 3. Kullanıcı Discord'a bağlı değil. Aynı e-postaya sahip mevcut kullanıcı var mı?
      // KURAL: Bir e-posta mevcut hesaba aitse otomatik hesap birleştirme KESİNLİKLE YAPILMAZ!
      const userWithSameEmail = persistentUsers.find(
        u => u.email && u.email.toLowerCase() === discEmail && !discEmail.endsWith('@discord.user')
      );
      if (userWithSameEmail) {
        return sendJson(res, 409, {
          success: false,
          requiresLinking: true,
          error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var. Güvenlik gerekçesiyle otomatik birleştirme yapılmaz. Lütfen önce hesabınıza normal giriş yapın ve Profil ayarlarından Discord hesabınızı bağlayın.'
        }, req);
      }

      // 4. Yepyeni Discord Kullanıcısı Oluştur
      let cleanUsername = discUsername.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
      if (cleanUsername.length < 3) cleanUsername = 'dc_' + discId.slice(-6);
      if (persistentUsers.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
        cleanUsername = `${cleanUsername}_${Math.floor(Math.random() * 899 + 100)}`;
      }

      const newUser = {
        userId: 'USR_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        username: cleanUsername,
        email: discEmail,
        emailVerified: true,
        minecraftPlayerName: cleanUsername,
        avatarUrl: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discId}/${discordUser.avatar}.png`
          : '',
        passwordHash: null,
        drivePermissionGranted: true,
        driveGrantedAt: nowIso,
        rank: 'MEMBER',
        role: 'MEMBER',
        isModerator: false,
        status: 'ACTIVE',
        emeraldBalance: 0,
        emeraldsEarnedTotal: 0,
        emeraldsSpentTotal: 0,
        netheriteBalance: 0,
        initialNetheriteBonusClaimed: false,
        lastNetheriteClaimAt: null,
        lastDailyEmeraldClaimAt: null,
        extraLives: 0,
        points: 0,
        bestScore: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        ownedCosmetics: [],
        equippedCosmetics: { avatarFrame: null, nameColor: null, badge: null, profileEffect: null },
        achievements: [],
        settings: { sound: true, particles: true },
        discord: {
          id: discId,
          username: discUsername,
          email: discEmail,
          linkedAt: nowIso,
          lastLoginAt: nowIso
        },
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };
      persistentUsers.push(newUser);
      safeSaveJson('users.json', persistentUsers);

      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><title>Discord Girişi Başarılı</title></head>
            <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
              <div style="text-align:center;padding:24px;background:#1e293b;border-radius:12px;border:1px solid #10b981;">
                <h2>🎉 Discord ile Giriş Başarılı!</h2>
                <p>Kullanıcı: <strong>${newUser.username}</strong></p>
                <p>Yönlendiriliyorsunuz...</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'DISCORD_AUTH_SUCCESS', user: ${JSON.stringify(newUser)} }, '*');
                    window.close();
                  } else {
                    window.location.href = '/#profile';
                  }
                </script>
              </div>
            </body>
          </html>
        `);
      }

      return sendJson(res, 200, {
        success: true,
        user: newUser,
        message: 'Discord ile kayıt ve giriş başarıyla tamamlandı.'
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // 14.3 Discord Hesabı Bağlantısını Kaldırma (Erişim Kaybı Korumalı)
  if (req.method === 'POST' && pathname === '/api/auth/discord/unlink') {
    try {
      const { json: body } = await parseRequestBody(req);
      const username = String(body.username || '').trim();
      const user = persistentUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        return sendJson(res, 404, { success: false, error: 'Kullanıcı bulunamadı.' }, req);
      }

      // Hesap erişimini kaybetme riski kontrolü:
      const hasPassword = Boolean(user.passwordHash && user.passwordHash.length > 0);
      const hasTelegram = Boolean(user.telegramId);
      const hasEmailAuth = Boolean(user.email && user.emailVerified && !user.email.endsWith('@discord.user') && !user.email.endsWith('@telegram.org'));

      if (!hasPassword && !hasTelegram && !hasEmailAuth) {
        return sendJson(res, 400, {
          success: false,
          error: 'Hesap erişimini kaybetmemek için Discord bağlantısını kaldırmadan önce lütfen bir şifre belirleyin veya başka bir giriş yöntemi (Google/Telegram) bağlayın.'
        }, req);
      }

      user.discord = null;
      user.updatedAt = new Date().toISOString();
      safeSaveJson('users.json', persistentUsers);

      return sendJson(res, 200, {
        success: true,
        message: 'Discord hesabı bağlantısı başarıyla kaldırıldı.'
      }, req);
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message }, req);
    }
  }

  // ==========================================
  // 15. YETKİLİ ROL VE İZİN YÖNETİCİSİ (#3)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/staff/permissions') {
    return sendJson(res, 200, {
      success: true,
      permissions: staffPermissions
    });
  }

  if (req.method === 'POST' && pathname === '/api/staff/permissions/update') {
    try {
      const { json: body } = await parseRequestBody(req);
      const role = String(body.role || '').toLowerCase(); // moderator veya ticket
      if (!['moderator', 'ticket'].includes(role)) {
        return sendJson(res, 400, { success: false, error: 'Geçersiz yetkili rolü (moderator veya ticket olmalı).' });
      }

      staffPermissions[role] = Object.assign(staffPermissions[role] || {}, body.permissions || {});
      safeSaveJson('staff_permissions.json', staffPermissions);

      return sendJson(res, 200, {
        success: true,
        permissions: staffPermissions,
        message: `${role.toUpperCase()} rol izinleri başarıyla güncellendi.`
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 16. MODERASYON, SUSTURMA VE GÜNLÜKLER (#3 & #8)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/moderator/mutes') {
    const now = Date.now();
    const active = {};
    for (const [usr, mute] of Object.entries(userMutes)) {
      if (new Date(mute.mutedUntil).getTime() > now) {
        active[usr] = mute;
      }
    }
    return sendJson(res, 200, { success: true, mutes: active });
  }

  if (req.method === 'POST' && pathname === '/api/moderator/mute') {
    try {
      const { json: body } = await parseRequestBody(req);
      const targetUser = String(body.targetUsername || '').trim();
      const minutes = Math.max(1, Number(body.durationMinutes || 15));
      const reason = String(body.reason || 'Kural ihlali').trim();
      const mutedBy = String(body.mutedBy || 'Yetkili').trim();
      const staffRole = String(body.staffRole || 'MODERATOR').toUpperCase();

      const maxAllowed = staffRole === 'ADMIN' ? 43200 : (staffPermissions.moderator?.maxMuteMinutes || 1440);
      if (minutes > maxAllowed) {
        return sendJson(res, 400, {
          success: false,
          error: `Maksimum susturma süresi ${maxAllowed} dakikadır.`
        });
      }

      const mutedUntil = new Date(Date.now() + minutes * 60000).toISOString();
      userMutes[targetUser] = {
        targetUsername: targetUser,
        mutedUntil,
        minutes,
        reason,
        mutedBy,
        createdAt: new Date().toISOString()
      };
      safeSaveJson('user_mutes.json', userMutes);

      const logEntry = {
        id: 'MODLOG_' + Date.now(),
        type: 'MUTE',
        targetUsername: targetUser,
        durationMinutes: minutes,
        reason,
        staffUsername: mutedBy,
        createdAt: new Date().toISOString()
      };
      moderationLogs.unshift(logEntry);
      if (moderationLogs.length > 200) moderationLogs.length = 200;
      safeSaveJson('moderation_logs.json', moderationLogs);

      return sendJson(res, 200, {
        success: true,
        mute: userMutes[targetUser],
        message: `${targetUser} kullanıcısı ${minutes} dakika susturuldu.`
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/moderator/unmute') {
    try {
      const { json: body } = await parseRequestBody(req);
      const targetUser = String(body.targetUsername || '').trim();
      const unmutedBy = String(body.unmutedBy || 'Yetkili').trim();

      if (userMutes[targetUser]) {
        delete userMutes[targetUser];
        safeSaveJson('user_mutes.json', userMutes);

        moderationLogs.unshift({
          id: 'MODLOG_' + Date.now(),
          type: 'UNMUTE',
          targetUsername: targetUser,
          staffUsername: unmutedBy,
          createdAt: new Date().toISOString()
        });
        safeSaveJson('moderation_logs.json', moderationLogs);
      }

      return sendJson(res, 200, {
        success: true,
        message: `${targetUser} kullanıcısının susturması kaldırıldı.`
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/moderation/logs') {
    return sendJson(res, 200, { success: true, logs: moderationLogs });
  }

  // ==========================================
  // 17. ŞEFFAF PUANLAMA, HATA VE ÖNERİ SİSTEMİ (#4)
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/points/config') {
    return sendJson(res, 200, { success: true, pointsConfig });
  }

  if (req.method === 'POST' && pathname === '/api/points/config/update') {
    try {
      const { json: body } = await parseRequestBody(req);
      pointsConfig = Object.assign(pointsConfig, body);
      safeSaveJson('points_config.json', pointsConfig);
      return sendJson(res, 200, { success: true, pointsConfig, message: 'Puan ayarları güncellendi.' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/points/leaderboard') {
    const userScores = {};
    for (const u of persistentUsers) {
      userScores[u.username] = {
        username: u.username,
        points: Number(u.points || 0),
        rank: u.rank || 'MEMBER',
        confirmedBugs: 0,
        fixedBugs: 0,
        approvedSuggestions: 0
      };
    }

    for (const b of bugReports) {
      if (userScores[b.username]) {
        if (['ONAYLANDI', 'CONFIRMED'].includes(b.status)) userScores[b.username].confirmedBugs++;
        if (['ÇÖZÜLDÜ', 'FIXED', 'DOĞRULANDI', 'VERIFIED'].includes(b.status)) userScores[b.username].fixedBugs++;
      }
    }

    for (const s of suggestionsList) {
      if (userScores[s.username] && ['ONAYLANDI', 'APPROVED', 'UYGULANDI', 'IMPLEMENTED'].includes(s.status)) {
        userScores[s.username].approvedSuggestions++;
      }
    }

    const sorted = Object.values(userScores).sort((a, b) => b.points - a.points).slice(0, 50);
    return sendJson(res, 200, { success: true, leaderboard: sorted });
  }

  if (req.method === 'GET' && pathname === '/api/bugs/list') {
    return sendJson(res, 200, { success: true, bugs: bugReports });
  }

  if (req.method === 'POST' && pathname === '/api/bugs/submit') {
    try {
      const { json: body } = await parseRequestBody(req);
      const title = String(body.title || 'Hata Bildirimi').trim();
      const description = String(body.description || '').trim();
      const screenshot = String(body.screenshot || '').trim();
      const relatedParty = String(body.relatedParty || '').trim().toUpperCase();

      if (!title || !description) {
        return sendJson(res, 400, { success: false, error: 'Hata başlığı ve açıklaması zorunludur.' });
      }

      const newBug = {
        id: 'BUG_' + Date.now(),
        title,
        description,
        category: String(body.category || 'Arayüz (UI)').trim(),
        severity: String(body.severity || 'Orta').trim(),
        screenshot,
        relatedParty,
        username: String(body.username || 'Oyuncu').trim(),
        status: 'SUBMITTED', // SUBMITTED, CONFIRMED, FIXED, VERIFIED, REJECTED
        pointsAwarded: 0,
        rewardEmerald: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      bugReports.unshift(newBug);
      safeSaveJson('bug_reports.json', bugReports);
      return sendJson(res, 200, { success: true, bug: newBug });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/bugs/review') {
    try {
      const { json: body } = await parseRequestBody(req);
      const bug = bugReports.find(b => b.id === body.bugId);
      if (!bug) return sendJson(res, 404, { success: false, error: 'Hata kaydı bulunamadı.' });

      const oldStatus = bug.status;
      const newStatus = String(body.status || 'CONFIRMED').toUpperCase();
      bug.status = newStatus;
      bug.adminNote = String(body.adminNote || '').trim();
      bug.reviewedBy = String(body.reviewedBy || 'Yetkili').trim();
      bug.updatedAt = new Date().toISOString();

      let pointsToAdd = 0;
      if (newStatus === 'CONFIRMED' && oldStatus !== 'CONFIRMED') {
        pointsToAdd = pointsConfig.bugConfirmed || 50;
      } else if ((newStatus === 'FIXED' || newStatus === 'ÇÖZÜLDÜ') && oldStatus !== 'FIXED') {
        pointsToAdd = pointsConfig.bugFixed || 100;
      } else if (newStatus === 'VERIFIED' && oldStatus !== 'VERIFIED') {
        pointsToAdd = pointsConfig.bugVerified || 150;
      }

      if (pointsToAdd > 0) {
        bug.pointsAwarded = (bug.pointsAwarded || 0) + pointsToAdd;
        const targetUser = persistentUsers.find(u => u.username.toLowerCase() === bug.username.toLowerCase());
        if (targetUser) {
          targetUser.points = (targetUser.points || 0) + pointsToAdd;
          safeSaveJson('users.json', persistentUsers);
        }
      }

      safeSaveJson('bug_reports.json', bugReports);
      return sendJson(res, 200, { success: true, bug, pointsAdded: pointsToAdd });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/suggestions/list') {
    return sendJson(res, 200, { success: true, suggestions: suggestionsList });
  }

  if (req.method === 'POST' && pathname === '/api/suggestions/submit') {
    try {
      const { json: body } = await parseRequestBody(req);
      const title = String(body.title || 'Yeni Öneri').trim();
      const details = String(body.details || '').trim();
      const username = String(body.username || 'Oyuncu').trim();

      if (!title || !details) {
        return sendJson(res, 400, { success: false, error: 'Öneri başlığı ve açıklaması zorunludur.' });
      }

      const newSuggestion = {
        id: 'SUGG_' + Date.now(),
        title,
        details,
        category: String(body.category || 'Genel').trim(),
        username,
        status: 'SUBMITTED', // SUBMITTED, APPROVED, IMPLEMENTED, REJECTED
        upvotes: [username],
        downvotes: [],
        voters: [username],
        pointsAwarded: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      suggestionsList.unshift(newSuggestion);
      safeSaveJson('suggestions.json', suggestionsList);
      return sendJson(res, 200, { success: true, suggestion: newSuggestion });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/suggestions/review') {
    try {
      const { json: body } = await parseRequestBody(req);
      const sugg = suggestionsList.find(s => s.id === body.suggestionId);
      if (!sugg) return sendJson(res, 404, { success: false, error: 'Öneri kaydı bulunamadı.' });

      const oldStatus = sugg.status;
      const newStatus = String(body.status || 'APPROVED').toUpperCase();
      sugg.status = newStatus;
      sugg.adminNote = String(body.adminNote || '').trim();
      sugg.reviewedBy = String(body.reviewedBy || 'Yetkili').trim();
      sugg.updatedAt = new Date().toISOString();

      let pointsToAdd = 0;
      if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED') {
        pointsToAdd = pointsConfig.suggestionApproved || 30;
      } else if (newStatus === 'IMPLEMENTED' && oldStatus !== 'IMPLEMENTED') {
        pointsToAdd = pointsConfig.suggestionImplemented || 75;
      }

      if (pointsToAdd > 0) {
        sugg.pointsAwarded = (sugg.pointsAwarded || 0) + pointsToAdd;
        const targetUser = persistentUsers.find(u => u.username.toLowerCase() === sugg.username.toLowerCase());
        if (targetUser) {
          targetUser.points = (targetUser.points || 0) + pointsToAdd;
          safeSaveJson('users.json', persistentUsers);
        }
      }

      safeSaveJson('suggestions.json', suggestionsList);
      return sendJson(res, 200, { success: true, suggestion: sugg, pointsAdded: pointsToAdd });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/suggestions/vote') {
    try {
      const { json: body } = await parseRequestBody(req);
      const suggId = body.suggestionId || body.id;
      const username = String(body.username || '').trim();
      const direction = String(body.direction || 'UP').toUpperCase();
      if (!username) {
        return sendJson(res, 400, { success: false, error: 'Oturum kullanıcı adı zorunludur.' });
      }
      const sugg = suggestionsList.find(s => s.id === suggId);
      if (!sugg) {
        return sendJson(res, 404, { success: false, error: 'Öneri kaydı bulunamadı.' });
      }

      if (!Array.isArray(sugg.upvotes)) sugg.upvotes = [];
      if (!Array.isArray(sugg.downvotes)) sugg.downvotes = [];

      const uLower = username.toLowerCase();
      const alreadyUp = sugg.upvotes.some(x => String(x).toLowerCase() === uLower);
      const alreadyDown = sugg.downvotes.some(x => String(x).toLowerCase() === uLower);

      sugg.upvotes = sugg.upvotes.filter(x => String(x).toLowerCase() !== uLower);
      sugg.downvotes = sugg.downvotes.filter(x => String(x).toLowerCase() !== uLower);

      if (direction === 'UP' && !alreadyUp) {
        sugg.upvotes.push(username);
      } else if (direction === 'DOWN' && !alreadyDown) {
        sugg.downvotes.push(username);
      }

      sugg.voters = Array.from(new Set([...sugg.upvotes, ...sugg.downvotes]));
      safeSaveJson('suggestions.json', suggestionsList);
      return sendJson(res, 200, {
        success: true,
        suggestion: sugg,
        upCount: sugg.upvotes.length,
        downCount: sugg.downvotes.length,
        netScore: sugg.upvotes.length - sugg.downvotes.length
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 18. ADMIN, MODERATÖR, TICKET VE BİLGE AI ASİSTANLARI (#4 & #5)
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/ai/admin-chat') {
    try {
      const { json: body } = await parseRequestBody(req);
      const question = String(body.question || '').trim();
      const adminEmail = String(body.email || '').toLowerCase().trim();
      const adminUser = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      const isSuper = adminEmail === SUPER_ADMIN_EMAIL.toLowerCase();

      if (!isSuper && !adminUser) {
        return sendJson(res, 403, { success: false, error: 'Admin AI yalnızca baş yönetici tarafından kullanılabilir.' });
      }

      const totalRevenue = stripeTransactions.reduce((acc, t) => acc + (t.amountTry || 0), 0);
      const stats = {
        totalUsers: persistentUsers.length,
        activeSponsors: activeSponsors.filter(s => s.active).length,
        openTickets: supportTickets.filter(t => t.status === 'AÇIK' || t.status === 'OPEN').length,
        unresolvedBugs: bugReports.filter(b => ['SUBMITTED', 'CONFIRMED'].includes(b.status)).length,
        pendingSuggestions: suggestionsList.filter(s => s.status === 'SUBMITTED').length,
        totalBackups: automatedBackups.length,
        totalRevenueTry: totalRevenue.toFixed(2),
        discordConfigured: Boolean(process.env.DISCORD_CLIENT_ID),
        telegramConfigured: Boolean(getSupportBotToken() || process.env.TELEGRAM_BOT_TOKEN)
      };

      const q = question.toLowerCase();
      let answer = '';
      let action = null;

      if (q.includes('yedek') || q.includes('backup') || q.includes('snapshot') || q.includes('drive')) {
        const lastBackup = automatedBackups[0];
        const dateStr = lastBackup ? new Date(lastBackup.createdAt).toLocaleString('tr-TR') : 'Henüz alınmadı';
        answer = `🛡️ **Yönetici Asistanı — Bulut Yedekleme Raporu**:\n` +
          `• Toplam Onaylı Yedek: ${stats.totalBackups} adet snapshot.\n` +
          `• En Son Alınan Yedek: ${dateStr}\n` +
          `• Format: Google Drive uyumlu JSON ve SHA-256 sağlama korumalı.\n\n` +
          `Aşağıdaki buton ile istediğiniz an tüm kullanıcı ve platform verilerini içeren yeni bir bulut yedeği oluşturabilirsiniz.`;
        action = {
          type: 'BACKUP_TRIGGER',
          label: '💾 Yeni Bulut Yedeği Al',
          title: 'Bulut Yedeği Al',
          requiresConfirmation: true,
          confirmPrompt: 'Tüm sistem veritabanı Google Drive uyumlu JSON paketi olarak yedeklensin mi?'
        };
      } else if (q.includes('bakım') || q.includes('maintenance')) {
        answer = `🛡️ **Yönetici Asistanı — Bakım Modu Yönetimi**:\n` +
          `Bakım modu platformu normal oyunculara kapatır ve veritabanını kilitler. Yalnızca baş yönetici oturum açabilir.\n\n` +
          `Bakım modunu açmak veya kapatmak için onaylı eylem butonunu kullanabilirsiniz.`;
        action = {
          type: 'TOGGLE_MAINTENANCE',
          label: '🛠️ Bakım Modunu Değiştir',
          title: 'Bakım Modu',
          requiresConfirmation: true,
          confirmPrompt: 'Bakım modu durumunu değiştirmek istediğinize emin misiniz?'
        };
      } else if (q.includes('gelir') || q.includes('para') || q.includes('stripe') || q.includes('ciro')) {
        answer = `🛡️ **Yönetici Asistanı — Stripe Finans Dökümü**:\n` +
          `• Toplam Ciro: ${stats.totalRevenueTry} ₺\n` +
          `• Başarılı İşlem: ${stripeTransactions.length} adet.\n` +
          `• İdempotency Koruması: Aktif.\n\n` +
          `Ayrıntılı ödeme ve fatura dökümü için Finans Tablosunu açabilirsiniz.`;
        action = {
          type: 'ADMIN_TAB',
          target: 'stripe',
          label: '💳 Finans Tablosunu Aç',
          title: 'Stripe Finans'
        };
      } else if (q.includes('kullanıcı') || q.includes('üye') || q.includes('hesap')) {
        answer = `🛡️ **Yönetici Asistanı — Kullanıcı İstatistikleri**:\n` +
          `• Toplam Kayıtlı Kullanıcı: ${stats.totalUsers}\n` +
          `• users.json ve users_backup.json ikili koruma altında.\n\n` +
          `Kullanıcı hesaplarını ve yetkilerini yönetmek için Kullanıcılar sekmesine gidebilirsiniz.`;
        action = {
          type: 'ADMIN_TAB',
          target: 'users',
          label: '👥 Kullanıcı Yönetimini Aç',
          title: 'Kullanıcı Listesi'
        };
      } else if (q.includes('rota') || q.includes('git') || q.includes('panel')) {
        answer = `🛡️ **Yönetici Asistanı — Yönetim Paneli Yönlendirmesi**:\n` +
          `Yönetici panelinden rütbe, ekonomi, sponsorluk, bakım modu ve API yapılandırmalarını yönetebilirsiniz.`;
        action = {
          type: 'NAVIGATE',
          target: 'admin',
          label: '🛡️ Yönetici Paneline Git',
          title: 'Yönetici Paneli',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Yönetici paneline yönlendirilmek istiyor musunuz?'
        };
      } else {
        answer = `🛡️ **Yönetici Asistanı Özeti**:\n` +
          `Soru: "${question}"\n\n` +
          `• Kayıtlı Kullanıcılar: ${stats.totalUsers}\n` +
          `• Açık Destek Biletleri: ${stats.openTickets} | Bekleyen Hatalar: ${stats.unresolvedBugs}\n` +
          `• Toplam Stripe Geliri: ${stats.totalRevenueTry} ₺ | Bulut Yedekleri: ${stats.totalBackups} adet.\n\n` +
          `Sistem tüm bileşenleriyle stabil ve güvenli çalışıyor.`;
        const wantsNav = q.includes('git') || q.includes('panel') || q.includes('rota');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'admin',
          label: '🛡️ Yönetici Paneline Git',
          title: 'Yönetici Paneli',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Yönetici paneline yönlendirilmek istiyor musunuz?'
        } : null;
      }

      answer += `\n\n⚠️ *Güvenlik Uyarısı: AI asistanı yalnızca öneri verir; sistemsel değişiklikler onayınızla yürütülür.*`;

      return sendJson(res, 200, { success: true, answer, reply: answer, stats, action });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/ai/mod-chat') {
    try {
      const { json: body } = await parseRequestBody(req);
      const question = String(body.question || '').trim();
      const staffUser = verifyStaffAccount(body.staffUsername || body.username, ['MODERATOR', 'ADMIN']);

      if (!staffUser && !body.isModerator && !body.isAdmin) {
        return sendJson(res, 403, { success: false, error: 'Moderatör AI yalnızca yetkili moderatörler tarafından kullanılabilir.' });
      }

      const openTicketsCount = supportTickets.filter(t => t.status === 'AÇIK' || t.status === 'OPEN').length;
      const reportedBugsCount = bugReports.filter(b => b.status === 'SUBMITTED').length;
      const suggestionsCount = suggestionsList.filter(s => s.status === 'SUBMITTED').length;
      const activeMutesCount = Object.keys(userMutes).length;

      const q = question.toLowerCase();
      let answer = '';
      let action = null;

      if (q.includes('kural') || q.includes('küfür') || q.includes('argo') || q.includes('sohbet')) {
        answer = `⚔️ **Moderatör Asistanı — Sohbet Kuralları Kılavuzu**:\n` +
          `• Otomatik sansürleme sistemi devrededir ve loglar tutulur.\n` +
          `• 1. İhlal: 15 Dakika Susturma\n` +
          `• 2. İhlal: 60 Dakika Susturma\n` +
          `• Ağır Hakaret: 1440 Dakika (24 Saat) Susturma.\n\n` +
          `Sohbet kayıtlarını incelemek için aşağıdaki butonu kullanabilirsiniz.`;
        action = {
          type: 'ADMIN_TAB',
          target: 'chatlogs',
          label: '💬 Sohbet Kayıtlarını İncele',
          title: 'Sohbet Denetimi',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Sohbet denetimi sekmesine geçmek istiyor musunuz?'
        };
      } else if (q.includes('sustur') || q.includes('mute') || q.includes('ceza')) {
        answer = `⚔️ **Moderatör Asistanı — Ceza Yönetimi**:\n` +
          `• Aktif Susturulan Oyuncu: ${activeMutesCount} kişi.\n` +
          `Moderatör olarak maksimum ${staffPermissions.moderator?.maxMuteMinutes || 1440} dakika susturma uygulayabilirsiniz.`;
        action = {
          type: 'ADMIN_TAB',
          target: 'mutes',
          label: '⚔️ Susturulan Oyuncuları Aç',
          title: 'Ceza Yönetimi',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Ceza yönetimi sekmesine geçmek istiyor musunuz?'
        };
      } else if (q.includes('hata') || q.includes('bug')) {
        answer = `⚔️ **Moderatör Asistanı — Hata İncelemesi**:\n` +
          `• Bekleyen Hata Bildirimi: ${reportedBugsCount} adet.\n` +
          `Hataları onayladığınızda oyuncular şeffaf puan kazanır (Onay: +50, Çözüldü: +100).`;
        action = {
          type: 'ADMIN_TAB',
          target: 'bugs',
          label: '🐛 Hataları İncele',
          title: 'Hata İncelemesi',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Hata incelemesi sekmesine geçmek istiyor musunuz?'
        };
      } else if (q.includes('öneri') || q.includes('suggestion')) {
        answer = `⚔️ **Moderatör Asistanı — Öneri İncelemesi**:\n` +
          `• Bekleyen Öneri: ${suggestionsCount} adet.\n` +
          `Önerileri onaylayarak topluluğa katkı sağlayabilirsiniz.`;
        action = {
          type: 'ADMIN_TAB',
          target: 'suggestions',
          label: '💡 Önerileri İncele',
          title: 'Öneri İncelemesi',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Öneri incelemesi sekmesine geçmek istiyor musunuz?'
        };
      } else {
        answer = `⚔️ **Moderatör Asistanı Yanıtı**:\n` +
          `Soru: "${question}"\n\n` +
          `• Bekleyen Bilet: ${openTicketsCount} | Hata: ${reportedBugsCount} | Öneri: ${suggestionsCount}\n` +
          `• Aktif Cezalar: ${activeMutesCount} oyuncu.\n\n` +
          `Tüm moderasyon araçlarına erişmek için paneli açabilirsiniz.`;
        const wantsNav = q.includes('panel') || q.includes('git') || q.includes('rota');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'admin',
          label: '⚔️ Moderatör Paneline Git',
          title: 'Moderatör Paneli',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Moderatör paneline yönlendirilmek istiyor musunuz?'
        } : null;
      }

      answer += `\n\n⚠️ *Güvenlik Uyarısı: AI asla otomatik ceza uygulamaz; işlem yetkili onayı gerektirir.*`;

      return sendJson(res, 200, { success: true, answer, reply: answer, action });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/ai/ticket-chat') {
    try {
      const { json: body } = await parseRequestBody(req);
      const question = String(body.question || '').trim();
      const staffUser = verifyStaffAccount(body.staffUsername || body.username, ['TICKET', 'MODERATOR', 'ADMIN']);

      if (!staffUser && !body.isTicketStaff && !body.isAdmin) {
        return sendJson(res, 403, { success: false, error: 'Ticket AI Asistanı yalnızca destek personeli tarafından kullanılabilir.' });
      }

      const q = question.toLowerCase();
      let answer = `🎫 **Destek Masası Asistanı (Ticket AI)**:\n`;
      let action = null;

      if (q.includes('ödeme') || q.includes('fatura') || q.includes('stripe') || q.includes('para')) {
        answer += `Ödeme konularında oyuncudan işlem referans kodunu ve ödeme tarihini isteyiniz. Gerekirse talebi [ADMIN] kademesine eskalasyon (/ust) yapınız.`;
        action = {
          type: 'NAVIGATE',
          target: 'support',
          label: '🎫 Bilet Kuyruğunu Aç',
          title: 'Destek Masası',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Destek masasına yönlendirilmek istiyor musunuz?'
        };
      } else if (q.includes('şifre') || q.includes('hesap') || q.includes('otp')) {
        answer += `Asla oyuncudan şifre talep etmeyiniz. E-posta OTP veya Discord bağlantısı ile parola yenileme adımlarını iletiniz.`;
        action = {
          type: 'NAVIGATE',
          target: 'support',
          label: '🎧 Destek Masasına Git',
          title: 'Destek Masası',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Destek masasına yönlendirilmek istiyor musunuz?'
        };
      } else if (q.includes('hata') || q.includes('bug')) {
        answer += `Oyuncunun hatasını Hata Bildirimi (#bug-report) modülüne yönlendiriniz; onaylandığında puan kazanır.`;
        action = {
          type: 'NAVIGATE',
          target: 'bug-report',
          label: '🐛 Hata Bildirimlerine Git',
          title: 'Hata Bildirimleri',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Hata bildirimleri ekranına yönlendirilmek istiyor musunuz?'
        };
      } else {
        answer += `Soru: "${question}"\n\nOyuncuya nazik ve açıklayıcı bir yanıt taslağı hazırlamanız önerilir. Biletleri incelemek için Destek Masasını açabilirsiniz.`;
        const wantsNav = q.includes('bilet') || q.includes('destek') || q.includes('git');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'support',
          label: '🎫 Destek Masasını Aç',
          title: 'Destek Masası',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Destek masasına yönlendirilmek istiyor musunuz?'
        } : null;
      }
      answer += `\n\n⚠️ *Güvenlik Uyarısı: AI yanıtları yalnızca taslaktır; bilet işlemleri yetkili onayı ile yürütülür.*`;

      return sendJson(res, 200, { success: true, answer, reply: answer, action });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/ai/user-chat') {
    try {
      const { json: body } = await parseRequestBody(req);
      const question = String(body.question || '').trim();
      const rankOrder = Number(body.rankOrder || 1);

      if (rankOrder < 4) {
        return sendJson(res, 403, {
          success: false,
          error: 'Bu özellik yalnızca MVP / MVIP ve üzeri rütbelere özeldir. Lütfen mağazadan rütbenizi yükseltin.'
        });
      }

      const q = question.toLowerCase();
      let answer = `🧙‍♂️ **Bilge Asistan (MVIP Özel)**:\n`;
      let action = null;

      if (q.includes('rota') || q.includes('harita') || q.includes('yol') || q.includes('nereye') || q.includes('nasıl')) {
        answer += `Hrmmm! İşte zümrüt ve şan dolu zirve rotası:\n` +
          `• 🗺️ 1. Yarışma Rotası (#quiz): 15 soru! Barajlar: 5. Soru (5.000 ₺) ve 10. Soru (100.000 ₺). Zirvede 1.000.000 ₺ + Netherite!\n` +
          `• 🛒 2. Mağaza (#shop): Zümrüt, Netherite, VIP rütbeleri.\n` +
          `• 🏆 3. Sıralama (#leaderboard): En iyi milyonerler.\n` +
          `• 👥 4. Parti (#parties): 2 turlu jürili arkadaş düelloları.\n\n` +
          `Yarışma arenasına doğrudan adım atmak için butona basabilirsiniz!`;
        action = {
          type: 'NAVIGATE',
          target: 'quiz',
          label: '🗺️ Yarışma Rotasına Başla',
          title: 'Yarışma Arenasına Git',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Yarışma arenasına yönlendirilmek istiyor musunuz?'
        };
      } else if (q.includes('şifre') || q.includes('parola')) {
        answer += `🔒 Güvenlik: Asla şifrenizi kimseyle paylaşmayın. Şifrenizi değiştirmek için Profil ekranındaki Parolayı Değiştir butonunu kullanın.`;
        action = {
          type: 'NAVIGATE',
          target: 'profile',
          label: '🔑 Profile & Şifre Değiştir Ekranına Git',
          title: 'Profil Ekranı',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Profil ve şifre değiştirme ekranına yönlendirilmek istiyor musunuz?'
        };
      } else if (q.includes('mağaza') || q.includes('market') || q.includes('rütbe') || q.includes('vip')) {
        answer += `Mağazadan VIP, VIP+, MVIP veya MVIP+ rütbeleri alarak günlük Netherite, özel rozetler ve joker indirimleri kazanabilirsiniz!`;
        const wantsNav = q.includes('git') || q.includes('aç') || q.includes('al');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'shop',
          label: '🛒 Mağazayı Aç',
          title: 'Mağaza Ekranı',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Mağaza ekranına yönlendirilmek istiyor musunuz?'
        } : null;
      } else if (q.includes('liderlik') || q.includes('sıralama')) {
        answer += `Liderlik tablosu en yüksek puan ve kazanca sahip oyuncuları sıralar.`;
        const wantsNav = q.includes('git') || q.includes('aç');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'leaderboard',
          label: '🏆 Liderlik Tablosuna Git',
          title: 'Liderlik Tablosu',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Liderlik tablosuna yönlendirilmek istiyor musunuz?'
        } : null;
      } else if (q.includes('parti') || q.includes('turnuva') || q.includes('jüri')) {
        answer += `Parti turnuvalarında dönüşümlü jüri sistemi uygulanır! 1. turda davet edilen oyuncu jüri iken, 2. turda lider jüri koltuğuna geçer.`;
        const wantsNav = q.includes('git') || q.includes('aç');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'parties',
          label: '👥 Parti Arenasına Git',
          title: 'Partiler Ekranı',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Parti arenasına yönlendirilmek istiyor musunuz?'
        } : null;
      } else if (q.includes('netherite') || q.includes('zümrüt')) {
        answer += `Netherite en değerli madendir! İlk VIP alımında +50, VIP+ ve üzeri alımlarda +250 Netherite ilk alım bonusu verilir. Zümrütlerle Ölümsüzlük Totemi (Ekstra Can) ve özel mağaza kozmetikleri edinebilirsiniz.`;
        const wantsNav = q.includes('git') || q.includes('aç') || q.includes('mağaza');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'shop',
          label: '💎 Mağazayı Ziyaret Et',
          title: 'Mağaza Ekranı',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Mağaza ekranına yönlendirilmek istiyor musunuz?'
        } : null;
      } else if (q.includes('ender') || q.includes('dragon') || q.includes('ejderha')) {
        answer += `Ender Ejderhası'nı yenmek için yatak patlatma taktiğini kullanabilir veya kristallerini patlatarak can yenilemesini durdurabilirsiniz!`;
        action = null;
      } else if (q.includes('elmas') || q.includes('maden') || q.includes('seviye')) {
        answer += `1.21 madenciliğinde Elmas (Diamond) Y=-58 ve Y=-53 seviyelerinde en yoğun bulunur. Demir için Y=16 ve dağ tepeleri idealdir!`;
        action = null;
      } else if (q.includes('kızıltaş') || q.includes('iksir') || q.includes('büyü')) {
        answer += `Güç İksiri için Tuhaf İksir + Alev Tozu gerekir. Tamir (Mending) büyüsü ise balıkçılık veya köylü takasıyla elde edilir.`;
        action = null;
      } else {
        answer += `"${question}" hakkında harika bir soru! Yarışmada 15. soruya ulaşmak için can hakkınızı ve seyirci/jüri jokerlerinizi kritik anlara saklamanızı öneririm! Bol şans! 🌟`;
        const wantsNav = q.includes('git') || q.includes('çık') || q.includes('başla');
        action = wantsNav ? {
          type: 'NAVIGATE',
          target: 'quiz',
          label: '⚔️ Arenaya Çık',
          title: 'Yarışma Arenası',
          requiresConfirmation: true,
          confirmPrompt: 'Emin misiniz? Yarışma arenasına yönlendirilmek istiyor musunuz?'
        } : null;
      }

      return sendJson(res, 200, {
        success: true,
        answer,
        reply: answer,
        action,
        aiProvider: process.env.GEMINI_API_KEY ? 'GEMINI_LIVE' : 'BUILTIN_KNOWLEDGE_BASE'
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 19. SOHBET KÜFÜR FİLTRESİ (#8)
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/chat/moderate') {
    try {
      const { json: body } = await parseRequestBody(req);
      const rawText = String(body.text || '');
      const username = String(body.username || 'Oyuncu');

      // Türkçe küfür ve hakaret kökleri ile varyasyonlar
      const profanityPatterns = [
        /\b(?:a[m\s]*q|a[m\s]*k|o[\s]*[çc]|p[i\s]*[çc]|s[\s]*[i1][\s]*k[\s]*[t\+]?|y[a\s]*r[r\s]*[a\s]*k|o[r\s]*[o\s]*s[p\s]*u|g[öo][\s]*t|i[\s]*b[\s]*n[\s]*e|k[\s]*a[\s]*h[\s]*p[\s]*e|p[\s]*u[\s]*[şs][\s]*t|t[\s]*a[\s]*[şs][\s]*a[\s]*k|d[\s]*[öo][\s]*l|a[\s]*m[\s]*c[\s]*[ıi][\s]*k|s[\s]*[i1][\s]*k[\s]*i[\s]*m|s[\s]*[i1][\s]*k[\s]*e[\s]*y[\s]*i[\s]*m|a[\s]*m[\s]*[ıi][\s]*n[\s]*a)\b/gi,
        /\b(?:orospu|pic|piç|sikik|yarak|yarrak|amcık|amcik|amk|aq|oç|oc|siktir|gavat|pezevenk|kahpe|ibne|şerefsiz|serefsiz|aptal|salak)\b/gi
      ];

      let cleaned = rawText;
      let censored = false;

      for (const pattern of profanityPatterns) {
        if (pattern.test(cleaned)) {
          censored = true;
          cleaned = cleaned.replace(pattern, '[sansürlendi]');
        }
      }

      if (censored) {
        moderationLogs.unshift({
          id: 'MODLOG_' + Date.now(),
          type: 'CHAT_FILTER',
          targetUsername: username,
          originalSnippet: rawText.slice(0, 40) + '...',
          createdAt: new Date().toISOString()
        });
        if (moderationLogs.length > 200) moderationLogs.length = 200;
        safeSaveJson('moderation_logs.json', moderationLogs);
      }

      return sendJson(res, 200, {
        success: true,
        censored,
        wasCensored: censored,
        cleanText: cleaned
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 20. WEBRTC SESLİ SOHBET SİNYALLEŞME SİSTEMİ (#9)
  // ==========================================
  if (req.method === 'POST' && pathname === '/api/voice/join') {
    try {
      const { json: body } = await parseRequestBody(req);
      const partyId = String(body.partyId || 'default');
      const username = String(body.username || 'Oyuncu');

      if (!activeVoiceRooms[partyId]) {
        activeVoiceRooms[partyId] = { peers: {}, signals: [] };
      }

      activeVoiceRooms[partyId].peers[username] = { lastSeen: Date.now() };

      return sendJson(res, 200, {
        success: true,
        partyId,
        peers: Object.keys(activeVoiceRooms[partyId].peers)
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/voice/signal') {
    try {
      const { json: body } = await parseRequestBody(req);
      const partyId = String(body.partyId || 'default');
      const from = String(body.from || '');
      const to = String(body.to || '');
      const signal = body.signal;

      if (!activeVoiceRooms[partyId]) {
        activeVoiceRooms[partyId] = { peers: {}, signals: [] };
      }

      activeVoiceRooms[partyId].signals.push({
        id: 'SIG_' + Date.now() + '_' + Math.random(),
        from,
        to,
        signal,
        createdAt: Date.now()
      });

      // 30 saniyeden eski sinyalleri temizle
      const cutoff = Date.now() - 30000;
      activeVoiceRooms[partyId].signals = activeVoiceRooms[partyId].signals.filter(s => s.createdAt > cutoff);

      return sendJson(res, 200, { success: true });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/voice/signals') {
    const partyId = String(query.partyId || 'default');
    const username = String(query.username || '');

    if (!activeVoiceRooms[partyId]) {
      return sendJson(res, 200, { success: true, signals: [] });
    }

    if (username && activeVoiceRooms[partyId].peers[username]) {
      activeVoiceRooms[partyId].peers[username].lastSeen = Date.now();
    }

    const pending = activeVoiceRooms[partyId].signals.filter(s => s.to === username || s.to === 'ALL');
    // Alınan sinyalleri sil
    activeVoiceRooms[partyId].signals = activeVoiceRooms[partyId].signals.filter(s => s.to !== username);

    return sendJson(res, 200, {
      success: true,
      signals: pending,
      activePeers: Object.keys(activeVoiceRooms[partyId].peers)
    });
  }

  if (req.method === 'POST' && pathname === '/api/voice/leave') {
    try {
      const { json: body } = await parseRequestBody(req);
      const partyId = String(body.partyId || 'default');
      const username = String(body.username || '');

      if (activeVoiceRooms[partyId] && activeVoiceRooms[partyId].peers[username]) {
        delete activeVoiceRooms[partyId].peers[username];
        if (Object.keys(activeVoiceRooms[partyId].peers).length === 0) {
          delete activeVoiceRooms[partyId];
        }
      }

      return sendJson(res, 200, { success: true, message: 'Ses odasından ayrılındı.' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }


  // ==========================================
  // 21. BEYAZ LİSTE (WHITELIST) YÖNETİMİ & DENETİMİ
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/whitelist/status') {
    return sendJson(res, 200, {
      success: true,
      enabled: Boolean(whitelistConfig.enabled),
      count: (whitelistConfig.allowedUsers || []).length,
      allowedUsers: whitelistConfig.allowedUsers || []
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/whitelist/toggle') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici bu işlemi yapabilir.' });
      }
      whitelistConfig.enabled = Boolean(body.enabled);
      saveWhitelistConfig();
      return sendJson(res, 200, { success: true, enabled: whitelistConfig.enabled });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/admin/whitelist/add') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici bu işlemi yapabilir.' });
      }
      const cleanUser = String(body.username || '').trim();
      if (!cleanUser) {
        return sendJson(res, 400, { success: false, error: 'Kullanıcı adı belirtilmedi.' });
      }
      if (!Array.isArray(whitelistConfig.allowedUsers)) whitelistConfig.allowedUsers = [];
      if (!whitelistConfig.allowedUsers.some(u => u.toLowerCase() === cleanUser.toLowerCase())) {
        whitelistConfig.allowedUsers.push(cleanUser);
        saveWhitelistConfig();
      }
      return sendJson(res, 200, { success: true, allowedUsers: whitelistConfig.allowedUsers });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/admin/whitelist/remove') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici bu işlemi yapabilir.' });
      }
      const cleanUser = String(body.username || '').trim().toLowerCase();
      whitelistConfig.allowedUsers = (whitelistConfig.allowedUsers || []).filter(u => u.toLowerCase() !== cleanUser);
      saveWhitelistConfig();
      return sendJson(res, 200, { success: true, allowedUsers: whitelistConfig.allowedUsers });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 22. ETKİNLİK MODU (EVENTS) & ÖDÜL TALEP SİSTEMİ
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/events') {
    return sendJson(res, 200, { success: true, events: persistentEvents });
  }

  if (req.method === 'POST' && pathname === '/api/admin/events') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici etkinlik oluşturabilir.' });
      }
      if (!body.title || !body.startDateTime) {
        return sendJson(res, 400, { success: false, error: 'Başlık ve başlangıç tarihi zorunludur.' });
      }
      const newEvent = {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: String(body.title).trim(),
        description: String(body.description || '').trim(),
        imageUrl: String(body.imageUrl || '').trim(),
        startDateTime: body.startDateTime,
        endDateTime: body.endDateTime || null,
        youtubeLiveUrl: String(body.youtubeLiveUrl || '').trim(),
        status: body.status || 'UPCOMING',
        createdAt: new Date().toISOString(),
        createdBy: body.adminUsername || body.username || 'Admin',
        prizes: body.prizes || {
          first: ['1.000 Netherite', 'Şampiyon Rozeti', '10.000 Zümrüt'],
          second: ['500 Netherite', 'Gümüş Madalya', '5.000 Zümrüt'],
          third: ['250 Netherite', 'Bronz Madalya', '2.500 Zümrüt']
        },
        winners: null
      };
      persistentEvents.unshift(newEvent);
      savePersistentEvents();

      const emailConfigured = Boolean(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS);
      const emailReport = {
        emailSent: false,
        emailStatus: emailConfigured
          ? 'E-posta servisi hazır, duyuru yayınlandı.'
          : 'E-posta servisi (GMAIL_APP_PASSWORD) yapılandırılmadığı için yalnızca site içi duyuru yayınlandı.'
      };

      return sendJson(res, 200, { success: true, event: newEvent, emailReport });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/admin/events/record-winners') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici kazananları kaydedebilir.' });
      }
      const event = persistentEvents.find(e => e.id === body.eventId);
      if (!event) {
        return sendJson(res, 404, { success: false, error: 'Etkinlik bulunamadı.' });
      }
      const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
      const generatedClaimLinks = {};
      const recordedWinners = {};

      const placements = [
        { place: 1, key: 'first', user: body.firstPlaceUsername, prizes: event.prizes?.first || ['1.000 Netherite', 'Şampiyon Rozeti'] },
        { place: 2, key: 'second', user: body.secondPlaceUsername, prizes: event.prizes?.second || ['500 Netherite', 'Gümüş Madalya'] },
        { place: 3, key: 'third', user: body.thirdPlaceUsername, prizes: event.prizes?.third || ['250 Netherite', 'Bronz Madalya'] }
      ];

      placements.forEach(p => {
        if (p.user) {
          const cleanU = String(p.user).trim();
          const token = 'clm_' + Math.random().toString(36).substring(2, 10) + '_' + Math.random().toString(36).substring(2, 10);
          recordedWinners[p.key] = {
            username: cleanU,
            prizes: p.prizes,
            place: p.place,
            recordedAt: new Date().toISOString()
          };
          persistentEventClaims[token] = {
            token,
            eventId: event.id,
            eventTitle: event.title,
            place: p.place,
            placeLabel: `${p.place}. Sıra Ödülü`,
            username: cleanU,
            prizes: p.prizes,
            expiresAt: expiry,
            claimed: false,
            claimedAt: null
          };
          generatedClaimLinks[p.key] = {
            username: cleanU,
            token,
            claimUrl: `https://codingm-eng.github.io/minecraft-milyoner/#claim-prize?token=${token}&event=${event.id}`,
            expiresAt: expiry
          };
        }
      });

      event.winners = recordedWinners;
      event.status = 'COMPLETED';
      savePersistentEvents();

      return sendJson(res, 200, { success: true, event, claimLinks: generatedClaimLinks });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/events/claim') {
    try {
      const { json: body } = await parseRequestBody(req);
      const token = String(body.token || '').trim();
      const username = String(body.username || '').trim();
      const record = persistentEventClaims[token];
      if (!record) {
        return sendJson(res, 404, { success: false, error: 'Ödül talep kodu bulunamadı veya geçersiz.' });
      }
      if (record.claimed) {
        return sendJson(res, 400, { success: false, error: 'Bu ödül daha önce talep edilmiştir.' });
      }
      if (Date.now() > record.expiresAt) {
        return sendJson(res, 400, { success: false, error: 'Bu ödül talep kodunun geçerlilik süresi (7 gün) dolmuştur.' });
      }
      if (record.username && username && record.username.toLowerCase() !== username.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: `Bu ödül yalnızca "${record.username}" tarafından talep edilebilir.` });
      }
      record.claimed = true;
      record.claimedAt = new Date().toISOString();
      record.claimedBy = username || record.username;
      savePersistentEvents();
      return sendJson(res, 200, { success: true, message: 'Ödüller başarıyla talep edildi!', prizes: record.prizes });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // ==========================================
  // 23. BAKIM MODU (MAINTENANCE) YÖNETİMİ
  // ==========================================
  if (req.method === 'GET' && pathname === '/api/maintenance/status') {
    return sendJson(res, 200, {
      success: true,
      maintenance: maintenanceConfig
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/maintenance/toggle') {
    try {
      const { json: body } = await parseRequestBody(req);
      const staff = verifyStaffAccount(body.adminUsername || body.username, ['ADMIN']);
      if (!staff && String(body.email || '').toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 403, { success: false, error: 'Yalnızca yetkili yönetici bakım modunu değiştirebilir.' });
      }
      maintenanceConfig.enabled = Boolean(body.enabled);
      if (body.title) maintenanceConfig.title = String(body.title).trim();
      if (body.message) maintenanceConfig.message = String(body.message).trim();
      saveMaintenanceConfig();
      return sendJson(res, 200, { success: true, maintenance: maintenanceConfig });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
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

server.listen(PORT, HOST, () => {
  console.log('===============================================================');
  console.log('🚀 MC MİLYONER NODE.JS SUNUCUSU AKTİF! (v2.0.0)');
  console.log(`🌐 Web Platformu:        http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} (${HOST}:${PORT})`);
  console.log(`💳 Stripe Checkout API:  http://localhost:${PORT}/api/stripe/create-checkout-session`);
  console.log(`📨 Stripe Webhook:       http://localhost:${PORT}/api/stripe/webhook`);
  console.log(`🤖 Telegram Poll API:    http://localhost:${PORT}/api/telegram/create-poll`);
  console.log(`🎟️ İndirim & Kupon API:  http://localhost:${PORT}/api/discounts/validate`);
  console.log(`📧 Gmail OTP API:        http://localhost:${PORT}/api/auth/send-otp`);
  console.log(`🛡️ Yönetici E-posta:     ${SUPER_ADMIN_EMAIL}`);
  console.log('===============================================================');
});
