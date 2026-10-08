/**
 * MC Milyoner Olmak İster - Çekirdek Servis Katmanı (v7.0 Production)
 *
 * Mimari Özellikler:
 * 1. Lisanssız Normal Kullanıcı Kayıt / Giriş / Çıkış ve Tam Hesap İzolasyonu (#1, #7)
 * 2. Ayrı Yönetici Girişi ("Yönetici Girişi") — Salted SHA-256 Hash Doğrulaması (#2, #8)
 * 3. 7 Rütbe Hiyerarşisi & Moderator Yetki Sistemi (#3, #13)
 * 4. İsteğe Bağlı Minecraft Oyuncu Adı & Kare Skin Yüzü Avatarı (#4, #9)
 * 5. Kişisel Bildirim Merkezi & Parti Daveti Kabul/Red Sistemi (#5, #11)
 * 6. Parti Sistemi: Oluşturma, Kodla Katılma, Davet Gönderme, Kabul/Reddetme (#4, #5, #6)
 * 7. Destek, Hata Bildirimi (Ekran Görüntüsü + İlgili Parti), Öneri, Yedekleme ve Aktivite Kayıtları (#18, #19)
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    USERS: 'mc_millionaire_tr_users_v6',
    ACTIVE_SESSION: 'mc_millionaire_tr_active_session_v6',
    PARTIES: 'mc_millionaire_tr_parties_v6',
    PARTY_INVITATIONS: 'mc_millionaire_tr_party_invites_v6',
    NOTIFICATIONS: 'mc_millionaire_tr_notifications_v6',
    SUPPORT_TICKETS: 'mc_millionaire_tr_support_v6',
    BUG_REPORTS: 'mc_millionaire_tr_bugs_v6',
    SUGGESTIONS: 'mc_millionaire_tr_suggestions_v6',
    STRIPE_CONFIG: 'mc_millionaire_tr_stripe_cfg_v6',
    STRIPE_SESSIONS: 'mc_millionaire_tr_stripe_sessions_v6',
    MOD_PERMISSIONS: 'mc_millionaire_tr_mod_perms_v6',
    BACKUPS: 'mc_millionaire_tr_backups_v6',
    PLATFORM_SETTINGS: 'mc_millionaire_tr_platform_settings_v6',
    ACTIVITY: 'mc_millionaire_tr_activity_v6',
    FIRST_PREMIUM_NETHERITE_GRANTED: 'mc_millionaire_tr_first_netherite_v6',
    AI_CONFIG: 'mc_millionaire_tr_ai_cfg_v6',
    AI_QUESTIONS: 'mc_millionaire_tr_ai_questions_v6',
    SEEN_QUESTIONS: 'mc_millionaire_tr_seen_questions_v6',
    CLOUD_SYNC_META: 'mc_millionaire_tr_cloud_sync_meta_v6',
    TOMBSTONES: 'mc_millionaire_tr_tombstones_v6'
  };

  let cloudSyncInternalWrite = false;
  const CLOUD_SYNCED_STORAGE_KEYS = new Set([
    STORAGE_KEYS.USERS,
    STORAGE_KEYS.PARTIES,
    STORAGE_KEYS.PARTY_INVITATIONS,
    STORAGE_KEYS.NOTIFICATIONS,
    STORAGE_KEYS.SUPPORT_TICKETS,
    STORAGE_KEYS.BUG_REPORTS,
    STORAGE_KEYS.SUGGESTIONS,
    STORAGE_KEYS.MOD_PERMISSIONS,
    STORAGE_KEYS.PLATFORM_SETTINGS,
    STORAGE_KEYS.AI_CONFIG,
    STORAGE_KEYS.AI_QUESTIONS,
    STORAGE_KEYS.TOMBSTONES
  ]);

  // ==========================================
  // KRİPTOGRAFİK YARDIMCILAR (Ayrı Admin Girişi #8)
  // Şifre asla düz metin olarak saklanmaz veya arayüzde gösterilmez.
  // ==========================================
  const AUTH_SALT = 'MCM_2026_SALT';
  const SESSION_SECRET = 'MCM_2026_SIG_KEY';
  const ADMIN_USER_HASH = '1608bd23ef77e2854bd4a14bb3bc0fd5e734d77bd851f6e37e795c7eb695a073';
  const ADMIN_PASS_HASH = 'df8896b8447df2314b2a64f4ba6abb3992740163430da594d1b5cdc0686c24eb';

  function sha256SyncAscii(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    let hash = (sha256SyncAscii.h = sha256SyncAscii.h || []);
    const k = (sha256SyncAscii.k = sha256SyncAscii.k || []);
    let primeCounter = k[lengthProperty];
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty]; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15],
          w2 = w[i - 2];
        const a = hash[0],
          e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function sha256(str) {
    const utf8 = unescape(encodeURIComponent(String(str ?? '')));
    return sha256SyncAscii(utf8);
  }

  async function sha256Async(str) {
    try {
      if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
        const buf = new TextEncoder().encode(String(str ?? ''));
        const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (err) {
      // Fallback to synchronous SHA-256
    }
    return sha256(str);
  }

  function computeTokenSignature(payload) {
    const raw = `${SESSION_SECRET}::${payload.userId || ''}::${payload.username}::${payload.role}::${
      payload.isAdminSession ? 'ADM' : 'USR'
    }`;
    return sha256(raw).slice(0, 28);
  }

  // ==========================================
  // STORAGE YARDIMCISI
  // ==========================================
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        if (!cloudSyncInternalWrite && CLOUD_SYNCED_STORAGE_KEYS.has(key)) {
          if (typeof cloudSyncService !== 'undefined' && cloudSyncService.schedulePush) {
            cloudSyncService.schedulePush(250);
          }
        }
        return true;
      } catch (err) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        return false;
      }
      return true;
    }
  };

  function generateId(prefix = 'ID') {
    const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}-${ts}${rnd}`;
  }

  function nextMonotonicIso(prevIso = null) {
    const now = Date.now();
    const prev = prevIso ? Date.parse(prevIso) : 0;
    const base = !Number.isNaN(prev) && prev >= now ? prev + 500 : now;
    return new Date(base).toISOString();
  }

  // ==========================================
  // ÖZEL MINECRAFT PİKSEL SVG İKON SERVİSİ (Zümrüt, Netherite, Elmas, Rütbe, Kozmetik ve UI İkonları)
  // ==========================================
  const mcIconService = {
    getEmeraldSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-emerald-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M5 1H11V2H12V4H13V12H12V14H11V15H5V14H4V12H3V4H4V2H5V1Z" fill="#064E20"/><path d="M6 2H10V3H11V5H12V11H11V13H10V14H6V13H5V11H4V5H5V3H6V2Z" fill="#17DD62"/><path d="M6 3H9V4H10V6H6V3Z" fill="#86FFAC"/><path d="M5 5H6V10H5V5Z" fill="#86FFAC"/><path d="M7 6H10V11H7V6Z" fill="#12B84F"/><path d="M6 11H10V13H6V11Z" fill="#0B8435"/></svg>`;
    },

    getNetheriteSvg(size = 18, stackCount = 1) {
      const badge =
        stackCount > 1 ? `<span class="netherite-stack-count">×${stackCount}</span>` : '';
      return `<span class="mc-netherite-icon-wrap" style="display:inline-flex;align-items:center;position:relative;vertical-align:middle;"><svg class="mc-currency-svg mc-netherite-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="1" y="4" width="14" height="8" fill="#1B161A"/><rect x="2" y="3" width="12" height="10" fill="#2A2227"/><rect x="3" y="4" width="10" height="3" fill="#736570"/><rect x="4" y="4" width="6" height="1" fill="#A899A5"/><rect x="2" y="7" width="12" height="3" fill="#4D424A"/><rect x="3" y="10" width="10" height="2" fill="#372E35"/><rect x="5" y="7" width="6" height="2" fill="#635660"/></svg>${badge}</span>`;
    },

    getDiamondSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-diamond-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M5 1H11V2H13V5H14V11H13V13H11V15H5V13H3V11H2V5H3V2H5V1Z" fill="#0C4A6E"/><path d="M5 2H11V4H13V11H11V14H5V11H3V4H5V2Z" fill="#38BDF8"/><path d="M6 3H10V5H11V7H5V5H6V3Z" fill="#BAE6FD"/><path d="M6 7H10V12H6V7Z" fill="#0284C7"/></svg>`;
    },

    getHeartSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-heart-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M2 3H6V4H7V5H9V4H10V3H14V4H15V9H14V11H12V13H10V14H9V15H7V14H6V13H4V11H2V9H1V4H2V3Z" fill="#450A0A"/><path d="M3 4H6V5H7V6H9V5H10V4H13V5H14V9H13V10H11V12H9V13H7V12H5V10H3V9H2V5H3V4Z" fill="#EF4444"/><rect x="3" y="5" width="2" height="2" fill="#FCA5A5"/><path d="M7 11H11V10H13V8H14V9H13V11H11V13H9V14H7V11Z" fill="#B91C1C"/></svg>`;
    },

    getHeartBundleSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-heart-bundle-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M1 3H5V4H6V3H10V4H11V8H9V10H7V12H5V10H3V8H1V3Z" fill="#991B1B"/><path d="M2 4H5V5H6V4H9V8H7V10H5V8H2V4Z" fill="#F43F5E"/><path d="M6 6H10V7H11V6H15V11H13V13H11V15H9V13H7V11H6V6Z" fill="#78350F"/><path d="M7 7H10V8H11V7H14V11H12V13H10V11H7V7Z" fill="#FBBF24"/><rect x="8" y="8" width="2" height="1" fill="#FEF08A"/></svg>`;
    },

    getCrownSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-crown-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M1 4H3V6H5V5H7V2H9V5H11V6H13V4H15V13H1V4Z" fill="#78350F"/><path d="M2 5H3V8H6V6H7V3H9V6H10V8H13V5H14V12H2V5Z" fill="#FBBF24"/><rect x="3" y="9" width="10" height="2" fill="#F59E0B"/><rect x="7" y="9" width="2" height="2" fill="#EF4444"/><rect x="4" y="9" width="1" height="2" fill="#38BDF8"/><rect x="11" y="9" width="1" height="2" fill="#17DD62"/></svg>`;
    },

    getFlameSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-flame-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M7 1H9V3H11V5H13V8H14V13H12V15H4V13H2V8H4V5H6V3H7V1Z" fill="#991B1B"/><path d="M7 3H9V5H11V8H12V13H4V8H6V5H7V3Z" fill="#F97316"/><path d="M7 6H9V8H10V13H6V8H7V6Z" fill="#FACC15"/><rect x="7" y="10" width="2" height="3" fill="#FEF08A"/></svg>`;
    },

    getStarSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-star-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M7 1H9V5H14V7H15V9H14V11H9V15H7V11H2V9H1V7H2V5H7V1Z" fill="#581C87"/><path d="M7 2H9V6H13V7H14V9H13V10H9V14H7V10H3V9H2V7H3V6H7V2Z" fill="#C084FC"/><rect x="6" y="6" width="4" height="4" fill="#F5D0FE"/><rect x="7" y="7" width="2" height="2" fill="#FFFFFF"/></svg>`;
    },

    getCreeperSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-creeper-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="1" y="1" width="14" height="14" fill="#14532D"/><rect x="2" y="2" width="12" height="12" fill="#22C55E"/><rect x="3" y="3" width="3" height="2" fill="#4ADE80"/><rect x="10" y="10" width="3" height="3" fill="#16A34A"/><rect x="3" y="4" width="3" height="3" fill="#090D16"/><rect x="10" y="4" width="3" height="3" fill="#090D16"/><rect x="6" y="7" width="4" height="3" fill="#090D16"/><rect x="5" y="9" width="6" height="3" fill="#090D16"/><rect x="5" y="12" width="2" height="2" fill="#090D16"/><rect x="9" y="12" width="2" height="2" fill="#090D16"/></svg>`;
    },

    getRedstoneSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-redstone-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M6 2H10V4H12V6H14V11H12V13H10V14H6V13H4V11H2V6H4V4H6V2Z" fill="#7F1D1D"/><path d="M6 4H10V6H12V11H10V13H6V11H4V6H6V4Z" fill="#EF4444"/><rect x="6" y="6" width="4" height="4" fill="#FCA5A5"/><rect x="7" y="7" width="2" height="2" fill="#FFFFFF"/></svg>`;
    },

    getEnderSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-ender-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="2" y="2" width="12" height="12" fill="#1E1B4B"/><rect x="3" y="3" width="10" height="10" fill="#7E22CE"/><rect x="4" y="6" width="8" height="4" fill="#C084FC"/><rect x="7" y="4" width="2" height="8" fill="#090D16"/><rect x="6" y="7" width="4" height="2" fill="#D8B4FE"/></svg>`;
    },

    getSwordSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-sword-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M11 2H14V5H13V7H11V9H9V11H7V9H5V7H7V5H9V3H11V2Z" fill="#0284C7"/><path d="M12 3H13V5H11V7H9V9H7V7H9V5H11V3H12Z" fill="#7DD3FC"/><rect x="3" y="9" width="6" height="2" fill="#10B981"/><rect x="2" y="12" width="3" height="2" fill="#78350F"/></svg>`;
    },

    getShieldSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-shield-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M2 2H14V9H13V11H11V13H9V15H7V13H5V11H3V9H2V2Z" fill="#831843"/><path d="M3 3H13V9H11V11H9V13H7V11H5V9H3V3Z" fill="#EC4899"/><rect x="7" y="4" width="2" height="7" fill="#FDE047"/><rect x="5" y="6" width="6" height="2" fill="#FDE047"/></svg>`;
    },

    getGrassSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-grass-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="2" y="2" width="12" height="12" fill="#451A03"/><rect x="3" y="6" width="10" height="7" fill="#78350F"/><rect x="2" y="2" width="12" height="4" fill="#15803D"/><rect x="3" y="3" width="10" height="2" fill="#22C55E"/><rect x="4" y="6" width="2" height="2" fill="#22C55E"/><rect x="9" y="6" width="2" height="1" fill="#22C55E"/></svg>`;
    },

    getPickaxeSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-pickaxe-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M7 2H13V4H14V8H12V6H10V4H7V2Z" fill="#38BDF8"/><rect x="8" y="3" width="4" height="1" fill="#BAE6FD"/><path d="M10 5H11V6H9V8H7V10H5V12H3V14H2V12H4V10H6V8H8V6H10V5Z" fill="#92400E"/></svg>`;
    },

    getTrophySvg(size = 18) {
      return `<svg class="mc-currency-svg mc-trophy-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M3 2H13V4H15V8H13V9H10V12H12V14H4V12H6V9H3V8H1V4H3V2Z" fill="#92400E"/><path d="M4 3H12V8H9V12H11V13H5V12H7V8H4V3Z" fill="#FBBF24"/><rect x="5" y="4" width="2" height="3" fill="#FEF08A"/></svg>`;
    },

    getChestSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-chest-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="2" y="3" width="12" height="10" fill="#451A03"/><rect x="3" y="4" width="10" height="3" fill="#B45309"/><rect x="3" y="8" width="10" height="4" fill="#92400E"/><rect x="2" y="7" width="12" height="1" fill="#1C1917"/><rect x="7" y="6" width="2" height="3" fill="#FBBF24"/></svg>`;
    },

    getRocketSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-rocket-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M7 1H9V3H11V5H5V3H7V1Z" fill="#EF4444"/><rect x="6" y="5" width="4" height="6" fill="#F8FAFC"/><rect x="6" y="6" width="4" height="2" fill="#EF4444"/><rect x="6" y="9" width="4" height="1" fill="#EF4444"/><rect x="7" y="11" width="2" height="3" fill="#92400E"/><rect x="5" y="13" width="2" height="2" fill="#FBBF24"/><rect x="9" y="13" width="2" height="2" fill="#F97316"/></svg>`;
    },

    getHamburgerSvg() {
      return `<svg class="mc-hamburger-svg" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true"><rect class="hb-line hb-line-1" x="2" y="4" width="16" height="2.5" fill="currentColor"/><rect class="hb-line hb-line-2" x="2" y="9" width="16" height="2.5" fill="currentColor"/><rect class="hb-line hb-line-3" x="2" y="14" width="16" height="2.5" fill="currentColor"/></svg>`;
    },

    getIconSvg(iconOrKey, size = 18) {
      const key = String(iconOrKey || '').trim();
      if (!key) return this.getEmeraldSvg(size);
      const upper = key.toUpperCase();

      // Orijinal Minecraft eşyaları / blokları / varlıkları -> Minecraft Piksel SVG
      if (
        key === '🟢' ||
        upper === 'EMERALD' ||
        upper === 'FRAME_EMERALD' ||
        upper === 'EFFECT_EMERALD_GLOW' ||
        upper === 'NAME_COLOR_EMERALD' ||
        upper === 'ITEM_VILLAGER_TREASURE' ||
        upper === 'EMERALD_COLLECTOR' ||
        upper.startsWith('EMERALD_PACK_') ||
        upper.startsWith('PACK_EMERALD_') ||
        upper.startsWith('STRIPE_EMERALD_')
      ) {
        return this.getEmeraldSvg(size);
      }
      if (
        key === '⬛' ||
        upper === 'NETHERITE' ||
        upper.startsWith('STRIPE_NETHERITE_') ||
        upper.startsWith('NETHERITE_PACK_')
      ) {
        return this.getNetheriteSvg(size);
      }
      if (
        key === '💎' ||
        key === '💠' ||
        upper === 'DIAMOND' ||
        upper === 'VIP' ||
        upper === 'FRAME_DIAMOND' ||
        upper === 'NAME_COLOR_DIAMOND'
      ) {
        return this.getDiamondSvg(size);
      }
      if (key === '❤️' || upper === 'HEART' || upper === 'ITEM_EXTRA_LIFE') {
        return this.getHeartSvg(size);
      }
      if (
        key === '💖' ||
        upper === 'HEART_BUNDLE' ||
        upper === 'ITEM_EXTRA_LIFE_BUNDLE_3' ||
        upper === 'ITEM_EXTRA_LIFE_BUNDLE_5'
      ) {
        return this.getHeartBundleSvg(size);
      }
      if (
        key === '🔥' ||
        upper === 'FLAME' ||
        upper === 'MVIP' ||
        upper === 'FRAME_NETHERITE_FLAME' ||
        upper === 'EFFECT_NETHER_STORM' ||
        upper === 'NAME_COLOR_CRIMSON' ||
        upper === 'STREAK_10'
      ) {
        return this.getFlameSvg(size);
      }
      if (key === '🧨' || upper === 'CREEPER' || upper === 'BADGE_CREEPER_HUNTER') {
        return this.getCreeperSvg(size);
      }
      if (
        key === '⚡' ||
        upper === 'REDSTONE' ||
        upper === 'BADGE_REDSTONE_MASTER' ||
        upper === 'FRAME_REDSTONE_PULSE'
      ) {
        return this.getRedstoneSvg(size);
      }
      if (
        key === '🐉' ||
        upper === 'ENDER' ||
        upper === 'EFFECT_ENDER_AURA' ||
        upper === 'ITEM_DRAGON_EGG_RELIC'
      ) {
        return this.getEnderSvg(size);
      }
      if (
        key === '⚔️' ||
        upper === 'SWORD' ||
        upper === 'MODERATOR' ||
        upper === 'BADGE_WITHER_SLAYER'
      ) {
        return this.getSwordSvg(size);
      }
      if (
        key === '🛡️' ||
        upper === 'SHIELD' ||
        upper === 'ADMIN' ||
        upper === 'BADGE_WARDEN_CONQUEROR'
      ) {
        return this.getShieldSvg(size);
      }
      if (key === '🌱' || upper === 'GRASS' || upper === 'MEMBER') {
        return this.getGrassSvg(size);
      }
      if (key === '⛏️' || upper === 'PICKAXE' || upper === 'FIRST_GAME') {
        return this.getPickaxeSvg(size);
      }
      if (upper === 'CHEST') {
        return this.getChestSvg(size);
      }

      // Minecraft'ta doğrudan eşya karşılığı olmayan genel kavramlar -> Temiz standart ikon
      if (
        upper === 'CROWN' ||
        upper === 'MVIP_PLUS' ||
        upper === 'FRAME_GOLD_ROYAL' ||
        upper === 'BADGE_MILLIONAIRE_KING'
      ) {
        return '👑';
      }
      if (upper === 'NAME_COLOR_GOLD') return '✨';
      if (upper === 'NAME_COLOR_RGB') return '🌈';
      if (upper === 'STAR' || upper === 'VIP_PLUS' || upper === 'ITEM_NETHER_STAR_PACK') return '🌟';
      if (upper === 'TROPHY' || upper === 'FIRST_WIN') return '🏆';
      if (upper === 'ROCKET' || upper === 'ITEM_TOURNAMENT_BOOST') return '🚀';
      if (upper === 'PARTY_CHAMPION') return '🎉';

      // Eğer bilinmeyen bir teknik ID (örn: ITEM_123) geldiyse asla düz metin olarak basma
      if (/^[A-Z0-9_-]{3,}$/i.test(key)) {
        return this.getEmeraldSvg(size);
      }

      return `<span>${key}</span>`;
    },

    replaceEmojisInHtml(str, size = 16) {
      if (!str) return '';
      return String(str)
        .replace(/🟢/g, this.getEmeraldSvg(size))
        .replace(/⬛/g, this.getNetheriteSvg(size))
        .replace(/💠/g, this.getDiamondSvg(size))
        .replace(/💎/g, this.getDiamondSvg(size))
        .replace(/❤️/g, this.getHeartSvg(size))
        .replace(/💖/g, this.getHeartBundleSvg(size))
        .replace(/🧨/g, this.getCreeperSvg(size))
        .replace(/⚡/g, this.getRedstoneSvg(size))
        .replace(/🐉/g, this.getEnderSvg(size))
        .replace(/🔥/g, this.getFlameSvg(size))
        .replace(/⚔️/g, this.getSwordSvg(size))
        .replace(/🛡️/g, this.getShieldSvg(size))
        .replace(/🌱/g, this.getGrassSvg(size))
        .replace(/⛏️/g, this.getPickaxeSvg(size));
    }
  };

  // ==========================================
  // AKTİVİTE GÜNLÜĞÜ SERVİSİ (activityService)
  // ==========================================
  const activityService = {
    getAllLogs() {
      return storage.get(STORAGE_KEYS.ACTIVITY, []);
    },

    getAll() {
      return this.getAllLogs();
    },

    log(type, username, message, meta = {}) {
      const logs = this.getAllLogs();
      const entry = {
        id: generateId('ACT'),
        type: String(type || 'INFO'),
        username: String(username || 'Sistem'),
        message: String(message || ''),
        meta,
        timestamp: new Date().toISOString()
      };
      logs.unshift(entry);
      if (logs.length > 400) logs.length = 400;
      storage.set(STORAGE_KEYS.ACTIVITY, logs);
      return entry;
    },

    clearAll(session) {
      authGuard.requireRole(session, ['ADMIN']);
      storage.set(STORAGE_KEYS.ACTIVITY, []);
      this.log(
        'SYSTEM_LOGS_CLEARED',
        session.username,
        `Yönetici ${session.username} aktivite kayıtlarını temizledi.`
      );
      return true;
    }
  };

  // ==========================================
  // 7 RÜTBE HİYERARŞİSİ & YETKİ KONTROLCÜSÜ (#13)
  // Üye -> VIP -> VIP+ -> MVIP -> MVIP+ -> Moderator -> ADMIN
  // ==========================================
  const RANK_ALIASES = {
    PLAYER: 'MEMBER',
    UYE: 'MEMBER',
    ÜYE: 'MEMBER',
    MEMBER: 'MEMBER',
    VIP: 'VIP',
    'VIP+': 'VIP_PLUS',
    VIP_PLUS: 'VIP_PLUS',
    MVP: 'MVIP',
    'MVP+': 'MVIP_PLUS',
    MVIP: 'MVIP',
    'MVIP+': 'MVIP_PLUS',
    MVIP_PLUS: 'MVIP_PLUS',
    MODERATOR: 'MODERATOR',
    MOD: 'MODERATOR',
    ADMIN: 'ADMIN'
  };

  function normalizeRankId(rawRank) {
    const key = String(rawRank || 'MEMBER')
      .trim()
      .toUpperCase();
    if (!key) return 'MEMBER';
    if (RANK_ALIASES[key]) return RANK_ALIASES[key];
    return key.replace(/\s+/g, '_');
  }

  const DEFAULT_MOD_PERMS = {
    canCreateParty: true,
    canInvitePlayers: true,
    canModerateParties: true,
    canReviewTickets: true,
    canReviewBugs: true,
    canReviewSuggestions: true
  };

  const authGuard = {
    getModeratorPermissions() {
      const saved = storage.get(STORAGE_KEYS.MOD_PERMISSIONS, null);
      return { ...DEFAULT_MOD_PERMS, ...(saved || {}) };
    },

    updateModeratorPermissions(session, updates = {}) {
      this.requireRole(session, ['ADMIN']);
      const current = this.getModeratorPermissions();
      const next = {
        ...current,
        canCreateParty:
          updates.canCreateParty !== undefined
            ? Boolean(updates.canCreateParty)
            : current.canCreateParty,
        canInvitePlayers:
          updates.canInvitePlayers !== undefined
            ? Boolean(updates.canInvitePlayers)
            : current.canInvitePlayers,
        canModerateParties:
          updates.canModerateParties !== undefined
            ? Boolean(updates.canModerateParties)
            : current.canModerateParties,
        canReviewTickets:
          updates.canReviewTickets !== undefined
            ? Boolean(updates.canReviewTickets)
            : current.canReviewTickets,
        canReviewBugs:
          updates.canReviewBugs !== undefined
            ? Boolean(updates.canReviewBugs)
            : current.canReviewBugs,
        canReviewSuggestions:
          updates.canReviewSuggestions !== undefined
            ? Boolean(updates.canReviewSuggestions)
            : current.canReviewSuggestions
      };
      storage.set(STORAGE_KEYS.MOD_PERMISSIONS, next);
      activityService.log(
        'MOD_PERMS_UPDATED',
        session.username,
        `Yönetici ${session.username} Moderatör yetkilerini güncelledi.`
      );
      return next;
    },

    verifySession(session) {
      if (!session || !session.username) {
        throw new Error('Yetkisiz işlem: Lütfen önce hesabınıza giriş yapın.');
      }
      const expectedSig = computeTokenSignature(session);
      if (session.signature && session.signature !== expectedSig) {
        throw new Error('Güvenlik Hatası: Oturum imzası geçersiz.');
      }
      const user = userService.getUserByUsername(session.username);
      if (user && user.status === 'SUSPENDED' && !session.isAdminSession) {
        throw new Error('Hesabınız yönetici tarafından askıya alınmıştır.');
      }
      return true;
    },

    getEffectiveRankId(session) {
      if (!session) return 'MEMBER';
      if (session.isAdminSession) return 'ADMIN';
      // Always read authoritative rank from stored user record (#20, #25)
      const user = userService.getUserByUsername(session.username);
      if (user) {
        if (user.role === 'ADMIN' || user.rank === 'ADMIN') return 'ADMIN';
        if (user.isModerator || user.role === 'MODERATOR' || user.rank === 'MODERATOR') {
          return 'MODERATOR';
        }
        return normalizeRankId(user.rank || user.role || 'MEMBER');
      }
      return 'MEMBER';
    },

    getEffectiveRole(session) {
      if (!session) return 'MEMBER';
      if (session.isAdminSession) return 'ADMIN';
      const rankId = this.getEffectiveRankId(session);
      if (rankId === 'ADMIN') return 'ADMIN';
      if (rankId === 'MODERATOR') return 'MODERATOR';
      if (['VIP', 'VIP_PLUS', 'MVIP', 'MVIP_PLUS'].includes(rankId)) return 'VIP';
      return 'MEMBER';
    },

    getUserPermissions(session) {
      if (!session) {
        return {
          canCreateParty: false,
          canInvitePlayers: false,
          maxPartySize: 0,
          emeraldMultiplier: 1.0,
          dailyNetherite: 0
        };
      }
      const rankId = this.getEffectiveRankId(session);
      const rankSvc = window.MCMServices?.rankService;
      if (rankSvc && typeof rankSvc.getPermissionsForRank === 'function') {
        const basePerms = rankSvc.getPermissionsForRank(rankId);
        const mergedPerms = {
          ...basePerms,
          canCreateParty: true,
          canInvitePlayers: true,
          maxPartySize: Math.max(4, Number(basePerms.maxPartySize || 4))
        };
        if (rankId === 'MODERATOR') {
          const modPerms = this.getModeratorPermissions();
          return { ...mergedPerms, ...modPerms, canCreateParty: true, canInvitePlayers: true };
        }
        return mergedPerms;
      }
      const isRanked = rankId !== 'MEMBER';
      return {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: rankId === 'ADMIN' ? 999 : isRanked ? 8 : 4,
        emeraldMultiplier: rankId === 'ADMIN' ? 3.0 : isRanked ? 1.5 : 1.0,
        dailyEmerald: rankId === 'ADMIN' ? 1000 : isRanked ? 100 : 50,
        dailyNetherite: ['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(rankId) ? 25 : 0
      };
    },

    isVipOrAdmin(session) {
      return this.getEffectiveRankId(session) !== 'MEMBER';
    },

    canClaimDailyNetherite(session) {
      const rankId = this.getEffectiveRankId(session);
      return ['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(rankId);
    },

    requireRole(session, allowedRoles = []) {
      this.verifySession(session);
      const effectiveRole = this.getEffectiveRole(session);
      const effectiveRank = this.getEffectiveRankId(session);

      if (allowedRoles.includes('ADMIN') && allowedRoles.length === 1) {
        if (!session.isAdminSession && effectiveRole !== 'ADMIN' && effectiveRank !== 'ADMIN') {
          throw new Error(
            'Erişim Reddedildi: Bu işlem yalnızca doğrulanmış Yönetici (Admin) oturumu ile yapılabilir.'
          );
        }
        return effectiveRole;
      }

      const normalizedAllowed = allowedRoles.map(r => (r === 'PLAYER' ? 'MEMBER' : r));
      if (
        !normalizedAllowed.includes(effectiveRole) &&
        !normalizedAllowed.includes(effectiveRank) &&
        effectiveRole !== 'ADMIN'
      ) {
        throw new Error(
          `Erişim Reddedildi: Bu işlem için [${allowedRoles.join(' / ')}] yetkisi gereklidir.`
        );
      }
      return effectiveRole;
    }
  };

  // ==========================================
  // AVATAR SERVİSİ (#9: İsteğe Bağlı Minecraft Oyuncu Adı -> Skin Yüzü veya Piksel SVG)
  // ==========================================
  const avatarService = {
    MAX_FILE_BYTES: 2 * 1024 * 1024,
    ALLOWED_MIMES: ['image/png', 'image/jpeg', 'image/webp'],

    generatePixelAvatarDataUrl(username = 'Steve') {
      const clean = String(username || 'Steve').trim();
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = clean.charCodeAt(i) + ((hash << 5) - hash);
      }
      const abs = Math.abs(hash);

      const skinTones = ['#d2996c', '#b87d52', '#e0ab82', '#8d5524', '#c68642', '#9c6644'];
      const hairColors = ['#2c1b10', '#4a2e16', '#171717', '#6b21a8', '#0f766e', '#991b1b', '#ca8a04'];
      const eyeColors = ['#17dd62', '#38bdf8', '#a855f7', '#fbbf24', '#ef4444', '#2563eb'];
      const shirtColors = ['#0ea5e9', '#16a34a', '#7c3aed', '#dc2626', '#d97706', '#374151'];

      const skin = skinTones[abs % skinTones.length];
      const hair = hairColors[(abs >> 3) % hairColors.length];
      const eye = eyeColors[(abs >> 6) % eyeColors.length];
      const shirt = shirtColors[(abs >> 9) % shirtColors.length];

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="${skin}"/><rect x="0" y="0" width="8" height="2" fill="${hair}"/><rect x="0" y="2" width="1" height="2" fill="${hair}"/><rect x="7" y="2" width="1" height="2" fill="${hair}"/><rect x="1" y="4" width="1" height="1" fill="#ffffff"/><rect x="2" y="4" width="1" height="1" fill="${eye}"/><rect x="5" y="4" width="1" height="1" fill="${eye}"/><rect x="6" y="4" width="1" height="1" fill="#ffffff"/><rect x="3" y="5" width="2" height="1" fill="#7c4a2d"/><rect x="2" y="6" width="4" height="1" fill="#432312"/><rect x="0" y="7" width="8" height="1" fill="${shirt}"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    },

    getMinecraftSkinFaceUrl(mcPlayerName, size = 160) {
      const clean = String(mcPlayerName || '').trim();
      if (!clean || !/^[a-zA-Z0-9_]{2,16}$/.test(clean)) return '';
      return `https://mc-heads.net/avatar/${encodeURIComponent(clean)}/${size}`;
    },

    getAvatarForUser(userObj) {
      if (!userObj) return this.generatePixelAvatarDataUrl('Steve');
      if (userObj.avatarUrl && String(userObj.avatarUrl).trim()) {
        return userObj.avatarUrl;
      }
      if (userObj.minecraftPlayerName && String(userObj.minecraftPlayerName).trim()) {
        const skinUrl = this.getMinecraftSkinFaceUrl(userObj.minecraftPlayerName, 160);
        if (skinUrl) return skinUrl;
      }
      return this.generatePixelAvatarDataUrl(userObj.username || 'Steve');
    },

    processUploadedFile(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('Lütfen bir görsel dosyası seçin.'));
          return;
        }
        if (!this.ALLOWED_MIMES.includes(file.type)) {
          reject(new Error('Yalnızca PNG, JPG veya WEBP formatında görsel yükleyebilirsiniz.'));
          return;
        }
        if (file.size > this.MAX_FILE_BYTES) {
          reject(new Error('Görsel boyutu en fazla 2 MB olabilir.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 160, 160);
            resolve(canvas.toDataURL('image/webp', 0.88));
          };
          img.onerror = () => reject(new Error('Görsel işlenirken bir hata oluştu.'));
          img.src = ev.target.result;
        };
        reader.onerror = () => reject(new Error('Dosya okunamadı.'));
        reader.readAsDataURL(file);
      });
    }
  };

  // ==========================================
  // BİLDİRİM SİSTEMİ (#11 — notificationService)
  // ==========================================
  const NOTIFICATION_TYPE_META = {
    PARTY_INVITE: { label: 'Parti Daveti', icon: '🎉' },
    PARTY_JOIN_REQUEST: { label: 'Partiye katılma bildirimi', icon: '🤝' },
    PARTY_UPDATE: { label: 'Parti güncellemesi', icon: '🎉' },
    NEW_UPDATE: { label: 'Yeni güncelleme', icon: '🚀' },
    RANK_UPGRADED: { label: 'Rank yükseltildi', icon: '👑' },
    RANK_GIFTED: { label: 'Rank hediye edildi', icon: '🎁' },
    SHOP_PURCHASE: { label: 'Mağaza satın alımı', icon: '🛍️' },
    EMERALD_EARNED: { label: 'Emerald kazanıldı', icon: '🟢' },
    NETHERITE_DAILY_REWARD: { label: 'Netherite günlük ödülü', icon: '⬛' },
    ADMIN_ANNOUNCEMENT: { label: 'Admin duyurusu', icon: '📣' },
    SUPPORT_REPLY: { label: 'Destek cevabı', icon: '🎧' },
    BUG_REPORT_REPLY: { label: 'Hata bildirimi cevabı', icon: '🐞' },
    SUGGESTION_STATUS_CHANGED: { label: 'Öneri durumu değişti', icon: '💡' },
    SYSTEM_NOTIFICATION: { label: 'Sistem bildirimi', icon: '🔔' }
  };

  const notificationService = {
    _getAllMap() {
      return storage.get(STORAGE_KEYS.NOTIFICATIONS, {});
    },

    _saveAllMap(map) {
      storage.set(STORAGE_KEYS.NOTIFICATIONS, map);
    },

    _resolveUserKey(usernameOrSession) {
      if (!usernameOrSession) return '';
      if (typeof usernameOrSession === 'object' && usernameOrSession.username) {
        return String(usernameOrSession.username).trim().toLowerCase();
      }
      return String(usernameOrSession).trim().toLowerCase();
    },

    notifyUser(targetUsername, { type = 'SYSTEM_NOTIFICATION', title, message, description, meta = {} }) {
      const key = this._resolveUserKey(targetUsername);
      if (!key) return null;

      const typeInfo = NOTIFICATION_TYPE_META[type] || NOTIFICATION_TYPE_META.SYSTEM_NOTIFICATION;
      const map = this._getAllMap();
      const list = Array.isArray(map[key]) ? map[key] : [];

      const notif = {
        id: generateId('NTF'),
        recipient: String(targetUsername).trim(),
        type,
        typeLabel: typeInfo.label,
        icon: typeInfo.icon,
        title: String(title || typeInfo.label).trim(),
        message: String(message || description || '').trim(),
        meta: meta || {},
        read: false,
        createdAt: new Date().toISOString()
      };

      list.unshift(notif);
      if (list.length > 150) list.length = 150;
      map[key] = list;
      this._saveAllMap(map);
      return notif;
    },

    broadcastNotification(session, { type = 'ADMIN_ANNOUNCEMENT', title, message, meta = {} }) {
      authGuard.requireRole(session, ['ADMIN']);
      const users = userService.getAllUsers();
      let sentCount = 0;
      users.forEach(u => {
        this.notifyUser(u.username, { type, title, message, meta });
        sentCount++;
      });
      activityService.log(
        'BROADCAST_NOTIF',
        session.username,
        `Yönetici ${session.username} tüm oyunculara (${sentCount}) bildirim gönderdi: ${title}`
      );
      return { sentCount };
    },

    getUserNotifications(usernameOrSession) {
      const key = this._resolveUserKey(usernameOrSession);
      if (!key) return [];
      const map = this._getAllMap();
      return Array.isArray(map[key]) ? [...map[key]] : [];
    },

    getUnreadCount(usernameOrSession) {
      const list = this.getUserNotifications(usernameOrSession);
      return list.filter(n => !n.read).length;
    },

    markAsRead(usernameOrSession, notifId) {
      const key = this._resolveUserKey(usernameOrSession);
      if (!key) return null;
      const map = this._getAllMap();
      const list = Array.isArray(map[key]) ? map[key] : [];
      const target = list.find(n => n.id === notifId);
      if (target) {
        target.read = true;
        map[key] = list;
        this._saveAllMap(map);
      }
      return target;
    },

    updateNotificationMeta(usernameOrSession, notifId, metaUpdates = {}) {
      const key = this._resolveUserKey(usernameOrSession);
      if (!key) return null;
      const map = this._getAllMap();
      const list = Array.isArray(map[key]) ? map[key] : [];
      const target = list.find(n => n.id === notifId);
      if (target) {
        target.meta = { ...(target.meta || {}), ...metaUpdates };
        target.read = true;
        map[key] = list;
        this._saveAllMap(map);
      }
      return target;
    },

    markAllAsRead(usernameOrSession) {
      const key = this._resolveUserKey(usernameOrSession);
      if (!key) return [];
      const map = this._getAllMap();
      const list = Array.isArray(map[key]) ? map[key] : [];
      list.forEach(n => {
        n.read = true;
      });
      map[key] = list;
      this._saveAllMap(map);
      return list;
    }
  };

  // ==========================================
  // OYUNCU HESAP SERVİSİ (userService — #7, #9, #13, #14)
  // ==========================================
  const userService = {
    getAllUsers() {
      const list = storage.get(STORAGE_KEYS.USERS, []);
      if (!Array.isArray(list)) return [];
      const cleanList = list.filter(u => !u.isDemo);
      let mutated = false;
      cleanList.forEach(u => {
        if (!u.vipPlusBonusRuleMigrated) {
          const rId = normalizeRankId(u.rank || u.role || 'MEMBER');
          if (!['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(rId) && u.initialNetheriteBonusClaimed) {
            u.netheriteBalance = Math.max(0, Number(u.netheriteBalance || 0) - 250);
            u.initialNetheriteBonusClaimed = false;
          }
          u.vipPlusBonusRuleMigrated = true;
          mutated = true;
        }
      });
      if (mutated) {
        storage.set(STORAGE_KEYS.USERS, cleanList);
      }
      return cleanList;
    },

    _saveAllUsers(users) {
      storage.set(STORAGE_KEYS.USERS, users);
    },

    getUserByUsername(username) {
      if (!username) return null;
      const clean = String(username).trim().toLowerCase();
      return this.getAllUsers().find(u => u && u.username && u.username.toLowerCase() === clean) || null;
    },

    ensureSessionUser(session) {
      if (!session || !session.username) return null;
      const existing = this.getUserByUsername(session.username);
      if (existing) return existing;
      const nowIso = new Date().toISOString();
      const reconstructed = {
        userId: session.userId || generateId('USR'),
        username: String(session.username).trim(),
        minecraftPlayerName: session.minecraftPlayerName || '',
        passwordHash: '',
        rank: session.isAdminSession ? 'ADMIN' : normalizeRankId(session.rank || 'MEMBER'),
        role: session.isAdminSession ? 'ADMIN' : session.role || 'MEMBER',
        isModerator: Boolean(session.isModerator || session.isAdminSession),
        status: 'ACTIVE',
        emeraldBalance: Number(session.emeraldBalance || 0),
        emeraldsEarnedTotal: Number(session.emeraldBalance || 0),
        emeraldsSpentTotal: 0,
        netheriteBalance: Number(session.netheriteBalance || 0),
        initialNetheriteBonusClaimed: Boolean(session.isAdminSession),
        lastNetheriteClaimAt: null,
        lastDailyEmeraldClaimAt: null,
        extraLives: Number(session.extraLives || 0),
        points: Number(session.points || 0),
        bestScore: Number(session.points || 0),
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        ownedCosmetics: [],
        equippedCosmetics: {},
        achievements: [],
        settings: { sound: true, particles: true },
        createdAt: session.loginAt || nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };
      const users = this.getAllUsers();
      users.push(reconstructed);
      this._saveAllUsers(users);
      return reconstructed;
    },

    getUserById(userId) {
      if (!userId) return null;
      return this.getAllUsers().find(u => u.userId === userId) || null;
    },

    syncUserFields(username, updates = {}) {
      const users = this.getAllUsers();
      const clean = String(username || '').trim().toLowerCase();
      const idx = users.findIndex(u => u.username.toLowerCase() === clean);
      if (idx === -1) return null;

      // Immutable userId preserved (#7)
      const immutableId = users[idx].userId || generateId('USR');
      users[idx] = {
        ...users[idx],
        ...updates,
        userId: immutableId,
        updatedAt: nextMonotonicIso(users[idx].updatedAt || users[idx].createdAt)
      };
      this._saveAllUsers(users);

      // Eğer aktif oturum bu kullanıcıya aitse oturumu da güncel tut (asla sıfırlama)
      const active = storage.get(STORAGE_KEYS.ACTIVE_SESSION, null);
      if (active && active.username && active.username.toLowerCase() === clean) {
        const updatedSession = {
          ...active,
          userId: immutableId,
          rank: active.isAdminSession ? 'ADMIN' : users[idx].rank,
          role: active.isAdminSession ? 'ADMIN' : users[idx].role,
          isModerator: Boolean(users[idx].isModerator),
          minecraftPlayerName: users[idx].minecraftPlayerName || '',
          avatarUrl: users[idx].avatarUrl || '',
          emeraldBalance: Number(users[idx].emeraldBalance || 0),
          netheriteBalance: Number(users[idx].netheriteBalance || 0),
          extraLives: Number(users[idx].extraLives || 0),
          points: Number(users[idx].points || 0)
        };
        updatedSession.signature = computeTokenSignature(updatedSession);
        storage.set(STORAGE_KEYS.ACTIVE_SESSION, updatedSession);
      }

      return users[idx];
    },

    updateMinecraftPlayerName(session, minecraftPlayerName) {
      authGuard.verifySession(session);
      const cleanMc = String(minecraftPlayerName || '').trim();
      if (cleanMc && !/^[a-zA-Z0-9_]{2,16}$/.test(cleanMc)) {
        throw new Error(
          'Minecraft oyuncu adı 2-16 karakter uzunluğunda olmalı ve yalnızca harf, rakam veya alt çizgi (_) içermelidir.'
        );
      }
      return this.syncUserFields(session.username, {
        minecraftPlayerName: cleanMc
      });
    },

    updateAvatar(session, avatarUrl) {
      authGuard.verifySession(session);
      return this.syncUserFields(session.username, {
        avatarUrl: String(avatarUrl || '')
      });
    },

    adminToggleModerator(session, targetUsername, makeModerator = true) {
      authGuard.requireRole(session, ['ADMIN']);
      const user = this.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const isMod = Boolean(makeModerator);
      const nextRank = isMod ? 'MODERATOR' : 'MEMBER';
      const nextRole = isMod ? 'MODERATOR' : 'MEMBER';

      const updated = this.syncUserFields(user.username, {
        isModerator: isMod,
        rank: nextRank,
        role: nextRole
      });

      notificationService.notifyUser(user.username, {
        type: 'RANK_UPGRADED',
        title: isMod ? '⚔️ Moderatör Yetkisi Verildi!' : 'Moderatör Yetkisi Kaldırıldı',
        message: isMod
          ? 'Yönetici tarafından hesabınıza resmi Moderator rütbesi ve yetkileri tanımlandı.'
          : 'Hesabınızdaki Moderator yetkisi yönetici tarafından kaldırıldı.'
      });

      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `${user.username} oyuncusunun Moderator durumu güncellendi: ${isMod}`
      );
      return updated;
    },

    adminToggleSuspendUser(session, targetUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const user = this.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');
      if (user.username.toLowerCase() === session.username.toLowerCase()) {
        throw new Error('Kendi yönetici hesabınızı askıya alamazsınız.');
      }
      const nextStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      const updated = this.syncUserFields(user.username, { status: nextStatus });
      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `${user.username} hesap durumu ${nextStatus} olarak değiştirildi.`
      );
      return updated;
    },

    adminDeleteUser(session, targetUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const clean = String(targetUsername || '').trim().toLowerCase();
      if (!clean) throw new Error('Kullanıcı adı belirtilmedi.');
      if (clean === session.username.toLowerCase()) {
        throw new Error('Kendi yönetici hesabınızı silemezsiniz!');
      }

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.recordTombstone) {
        cloudSyncService.recordTombstone('deletedUsers', clean);
      }

      const users = this.getAllUsers();
      const filtered = users.filter(u => u.username.toLowerCase() !== clean);
      this._saveAllUsers(filtered);

      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `Yönetici ${session.username}, "${targetUsername}" hesabını sildi.`
      );
      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        cloudSyncService.pushNow().catch(() => {});
      }
      return true;
    },

    recordGameResult(username, { scoreEarned = 0, didWin = false } = {}) {
      const user = this.getUserByUsername(username);
      if (!user) return null;

      const earned = Math.max(0, Number(scoreEarned || 0));
      const nextPlayed = Number(user.gamesPlayed || 0) + 1;
      const nextWon = Number(user.gamesWon || 0) + (didWin ? 1 : 0);
      const nextLost = Number(user.gamesLost || 0) + (didWin ? 0 : 1);
      const nextPoints = Number(user.points || 0) + earned;
      const nextBest = Math.max(Number(user.bestScore || 0), earned);

      const updated = this.syncUserFields(user.username, {
        gamesPlayed: nextPlayed,
        gamesWon: nextWon,
        gamesLost: nextLost,
        points: nextPoints,
        bestScore: nextBest
      });
      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.schedulePush) {
        cloudSyncService.schedulePush(150);
      }
      return updated;
    }
  };

  // ==========================================
  // KİMLİK DOĞRULAMA SERVİSİ (authService — #7 Lisanssız Akış & #8 Ayrı Admin Girişi)
  // ==========================================
  function buildSessionPayload(user, isAdminSession = false) {
    const payload = {
      userId: user.userId || generateId('USR'),
      username: user.username,
      minecraftPlayerName: user.minecraftPlayerName || '',
      avatarUrl: user.avatarUrl || '',
      rank: isAdminSession ? 'ADMIN' : normalizeRankId(user.rank || 'MEMBER'),
      role: isAdminSession ? 'ADMIN' : user.role || 'MEMBER',
      isModerator: Boolean(user.isModerator),
      isAdminSession: Boolean(isAdminSession),
      emeraldBalance: Number(user.emeraldBalance || 0),
      netheriteBalance: Number(user.netheriteBalance ?? 0),
      extraLives: Number(user.extraLives || 0),
      points: Number(user.points || 0),
      loginAt: new Date().toISOString()
    };
    payload.signature = computeTokenSignature(payload);
    return payload;
  }

  const authService = {
    getActiveSession() {
      return storage.get(STORAGE_KEYS.ACTIVE_SESSION, null);
    },

    async registerAccount({ username, password, passwordConfirm, minecraftPlayerName = '' }) {
      const cleanUser = String(username || '').trim();
      const cleanMc = String(minecraftPlayerName || '').trim();
      const rawPass = String(password || '');
      const rawConfirm = String(passwordConfirm ?? rawPass);

      if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 20) {
        throw new Error('Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.');
      }
      if (!/^[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]+$/.test(cleanUser)) {
        throw new Error('Kullanıcı adı yalnızca harf, rakam ve alt çizgi (_) içerebilir.');
      }

      const userCheckHash = await sha256Async(
        `${AUTH_SALT}::ADMIN_USER::${cleanUser.toLowerCase()}`
      );
      if (userCheckHash === ADMIN_USER_HASH) {
        throw new Error('Bu kullanıcı adı sistem yöneticisi için ayrılmıştır.');
      }

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.syncNow) {
        await cloudSyncService.syncNow().catch(() => {});
      }

      if (userService.getUserByUsername(cleanUser)) {
        throw new Error('Bu kullanıcı adı zaten alınmış. Lütfen başka bir ad seçin.');
      }

      if (cleanMc && !/^[a-zA-Z0-9_]{2,16}$/.test(cleanMc)) {
        throw new Error(
          'İsteğe bağlı Minecraft oyuncu adı 2-16 karakter olmalı ve yalnızca harf, rakam veya alt çizgi içermelidir.'
        );
      }

      if (rawPass.length < 4) {
        throw new Error('Şifreniz en az 4 karakter uzunluğunda olmalıdır.');
      }
      if (rawPass !== rawConfirm) {
        throw new Error('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      }

      const passwordHash = await sha256Async(
        `${AUTH_SALT}::PWD::${cleanUser.toLowerCase()}::${rawPass}`
      );
      const nowIso = new Date().toISOString();

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.clearTombstone) {
        cloudSyncService.clearTombstone('deletedUsers', cleanUser.toLowerCase());
      }

      const newUser = {
        userId: generateId('USR'),
        username: cleanUser,
        minecraftPlayerName: cleanMc,
        passwordHash,
        rank: 'MEMBER',
        role: 'MEMBER',
        isModerator: false,
        status: 'ACTIVE',
        emeraldBalance: 0,
        emeraldsEarnedTotal: 0,
        emeraldsSpentTotal: 0,
        netheriteBalance: 0, // İlk kez en az VIP+ rütbesi alındığında tek seferlik +250 Netherite verilir
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
        equippedCosmetics: {
          avatarFrame: null,
          nameColor: null,
          badge: null,
          profileEffect: null
        },
        achievements: [],
        settings: {
          sound: true,
          particles: true
        },
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };

      const users = userService.getAllUsers();
      users.push(newUser);
      userService._saveAllUsers(users);

      notificationService.notifyUser(newUser.username, {
        type: 'SYSTEM_NOTIFICATION',
        title: '🎉 MC Milyoner Olmak İster Platformuna Hoş Geldin!',
        message:
          'Hesabın başarıyla oluşturuldu! Her gün ücretsiz Günlük Zümrüt ödülünü alabilir, ilk VIP+ ve üzeri rütbe alımında anında +250 Netherite kazanabilirsin!'
      });

      activityService.log(
        'USER_REGISTER',
        newUser.username,
        `${newUser.username} platforma kayıt oldu.`
      );

      const session = buildSessionPayload(newUser, false);
      storage.set(STORAGE_KEYS.ACTIVE_SESSION, session);

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        await cloudSyncService.pushNow().catch(() => {});
      }

      return session;
    },

    async login({ username, password }) {
      const cleanUser = String(username || '').trim();
      const rawPass = String(password || '');

      if (!cleanUser || !rawPass) {
        throw new Error('Lütfen kullanıcı adınızı ve şifrenizi girin.');
      }

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.syncNow) {
        await cloudSyncService.syncNow().catch(() => {});
      }

      const user = userService.getUserByUsername(cleanUser);
      if (!user) {
        throw new Error('Kullanıcı adı veya şifre hatalı.');
      }

      if (user.status === 'SUSPENDED') {
        throw new Error('Hesabınız yönetici tarafından askıya alınmıştır.');
      }

      const expectedHash = await sha256Async(
        `${AUTH_SALT}::PWD::${user.username.toLowerCase()}::${rawPass}`
      );
      if (user.passwordHash !== expectedHash) {
        throw new Error('Kullanıcı adı veya şifre hatalı.');
      }

      const updatedUser = userService.syncUserFields(user.username, {
        lastLoginAt: new Date().toISOString()
      });

      if (window.MCMServices?.netheriteService) {
        window.MCMServices.netheriteService.ensureInitialBonusOnce(updatedUser.username);
      }

      const finalUser = userService.getUserByUsername(user.username) || updatedUser;
      const session = buildSessionPayload(finalUser, false);
      storage.set(STORAGE_KEYS.ACTIVE_SESSION, session);

      activityService.log('USER_LOGIN', finalUser.username, `${finalUser.username} giriş yaptı.`);

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        cloudSyncService.pushNow().catch(() => {});
      }

      return session;
    },

    async adminLogin({ username, password }) {
      const cleanUser = String(username || '').trim();
      const rawPass = String(password || '');

      if (!cleanUser || !rawPass) {
        throw new Error('Lütfen yönetici kullanıcı adını ve şifresini girin.');
      }

      const uHash = await sha256Async(`${AUTH_SALT}::ADMIN_USER::${cleanUser.toLowerCase()}`);
      const pHash = await sha256Async(`${AUTH_SALT}::${rawPass}`);

      if (uHash !== ADMIN_USER_HASH || pHash !== ADMIN_PASS_HASH) {
        throw new Error('Yönetici kullanıcı adı veya şifresi geçersiz!');
      }

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.syncNow) {
        await cloudSyncService.syncNow().catch(() => {});
      }

      let adminUser = userService.getUserByUsername(cleanUser);
      const nowIso = new Date().toISOString();

      if (!adminUser) {
        adminUser = {
          userId: 'USR-ADMIN-ROOT',
          username: cleanUser,
          minecraftPlayerName: cleanUser,
          passwordHash: pHash,
          rank: 'ADMIN',
          role: 'ADMIN',
          isModerator: true,
          status: 'ACTIVE',
          emeraldBalance: 0,
          emeraldsEarnedTotal: 0,
          emeraldsSpentTotal: 0,
          netheriteBalance: 250,
          initialNetheriteBonusClaimed: true,
          lastNetheriteClaimAt: null,
          extraLives: 0,
          points: 0,
          bestScore: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          ownedCosmetics: [],
          equippedCosmetics: {},
          achievements: [],
          settings: { sound: true, particles: true },
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: nowIso
        };
        const users = userService.getAllUsers();
        users.push(adminUser);
        userService._saveAllUsers(users);
      } else {
        adminUser = userService.syncUserFields(adminUser.username, {
          rank: 'ADMIN',
          role: 'ADMIN',
          lastLoginAt: nowIso
        });
      }

      const session = buildSessionPayload(adminUser, true);
      storage.set(STORAGE_KEYS.ACTIVE_SESSION, session);

      activityService.log(
        'ADMIN_LOGIN',
        adminUser.username,
        `Yönetici ${adminUser.username} Yönetici Paneline giriş yaptı.`
      );

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        cloudSyncService.pushNow().catch(() => {});
      }

      return session;
    },

    async resetForgottenPassword({ username, minecraftPlayerName = '', newPassword }) {
      const cleanUser = String(username || '').trim();
      const cleanMc = String(minecraftPlayerName || '').trim();
      const rawNew = String(newPassword || '');

      if (!cleanUser || !rawNew) {
        throw new Error('Lütfen kullanıcı adınızı ve yeni şifrenizi girin.');
      }
      if (rawNew.length < 4) {
        throw new Error('Yeni şifreniz en az 4 karakter olmalıdır.');
      }

      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.syncNow) {
        await cloudSyncService.syncNow().catch(() => {});
      }

      const user = userService.getUserByUsername(cleanUser);
      if (!user) {
        throw new Error('Bu kullanıcı adına sahip bir hesap bulunamadı.');
      }

      if (
        user.minecraftPlayerName &&
        cleanMc &&
        user.minecraftPlayerName.toLowerCase() !== cleanMc.toLowerCase()
      ) {
        throw new Error('Girdiğiniz Minecraft oyuncu adı hesap bilgileriyle eşleşmiyor.');
      }

      const newHash = await sha256Async(
        `${AUTH_SALT}::PWD::${user.username.toLowerCase()}::${rawNew}`
      );
      userService.syncUserFields(user.username, { passwordHash: newHash });
      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        cloudSyncService.pushNow().catch(() => {});
      }
      return true;
    },

    async changePassword(session, currentPassword, newPassword) {
      authGuard.verifySession(session);
      const user = userService.getUserByUsername(session.username);
      if (!user) throw new Error('Hesap bulunamadı.');

      const currHash = await sha256Async(
        `${AUTH_SALT}::PWD::${user.username.toLowerCase()}::${String(currentPassword || '')}`
      );
      if (user.passwordHash !== currHash && !session.isAdminSession) {
        throw new Error('Mevcut şifrenizi hatalı girdiniz.');
      }

      if (!newPassword || String(newPassword).length < 4) {
        throw new Error('Yeni şifreniz en az 4 karakter olmalıdır.');
      }

      const nextHash = await sha256Async(
        `${AUTH_SALT}::PWD::${user.username.toLowerCase()}::${String(newPassword)}`
      );
      userService.syncUserFields(user.username, { passwordHash: nextHash });
      if (typeof cloudSyncService !== 'undefined' && cloudSyncService.pushNow) {
        cloudSyncService.pushNow().catch(() => {});
      }
      return true;
    },

    logout() {
      const active = this.getActiveSession();
      if (active) {
        activityService.log('USER_LOGOUT', active.username, `${active.username} çıkış yaptı.`);
      }
      storage.remove(STORAGE_KEYS.ACTIVE_SESSION);
      return true;
    }
  };

  // ==========================================
  // PARTİ SİSTEMİ & DAVET YÖNETİMİ (partyService — #4, #5, #6)
  // Partiye katılmak/ayrılmak hesap, rütbe veya bakiyeyi ASLA sıfırlamaz.
  // ==========================================
  const partyService = {
    INVITE_TTL_MS: 24 * 60 * 60 * 1000, // 24 saat geçerli davet

    getAllParties() {
      return storage.get(STORAGE_KEYS.PARTIES, []);
    },

    _saveAllParties(parties) {
      storage.set(STORAGE_KEYS.PARTIES, parties);
    },

    getAllInvitations() {
      return storage.get(STORAGE_KEYS.PARTY_INVITATIONS, []);
    },

    _saveAllInvitations(list) {
      storage.set(STORAGE_KEYS.PARTY_INVITATIONS, list);
    },

    getInvitationById(invitationId) {
      if (!invitationId) return null;
      const cleanId = String(invitationId).trim();
      return this.getAllInvitations().find(inv => inv && inv.id === cleanId) || null;
    },

    getActivePartyForUser(username) {
      if (!username) return null;
      const clean = String(username).trim().toLowerCase();
      return (
        this.getAllParties().find(
          p =>
            p &&
            p.status !== 'CLOSED' &&
            Array.isArray(p.members) &&
            p.members.some(m => m && m.username && m.username.toLowerCase() === clean)
        ) || null
      );
    },

    getPendingInvitationsForUser(username) {
      if (!username) return [];
      const clean = String(username).trim().toLowerCase();
      const now = Date.now();
      const invites = this.getAllInvitations();
      let changed = false;

      invites.forEach(inv => {
        if (!inv) return;
        if (!inv.fromUsername && inv.inviterUsername) {
          inv.fromUsername = inv.inviterUsername;
          changed = true;
        }
        if (inv.status === 'PENDING' && inv.expiresAt && new Date(inv.expiresAt).getTime() < now) {
          inv.status = 'EXPIRED';
          inv.updatedAt = new Date(now).toISOString();
          changed = true;
        }
      });
      if (changed) this._saveAllInvitations(invites);

      return invites.filter(
        inv =>
          inv &&
          inv.recipientUsername &&
          inv.recipientUsername.toLowerCase() === clean &&
          inv.status === 'PENDING'
      );
    },

    createParty(session, partyName) {
      authGuard.verifySession(session);
      userService.ensureSessionUser(session);
      const perms = authGuard.getUserPermissions(session);

      let cleanName = String(partyName || '').trim();
      if (!cleanName) {
        cleanName = `${session.username} Partisi`;
      } else if (cleanName.length < 2) {
        cleanName = `${cleanName} Partisi`;
      }

      const nowIso = new Date().toISOString();
      const parties = this.getAllParties();

      // Eğer kullanıcı zaten başka bir aktif partideyse eski partiden otomatik çıkar
      parties.forEach(p => {
        if (p && p.status !== 'CLOSED' && Array.isArray(p.members)) {
          const hadUser = p.members.some(
            m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
          );
          if (hadUser) {
            p.members = p.members.filter(
              m => m && m.username && m.username.toLowerCase() !== session.username.toLowerCase()
            );
            if (p.members.length === 0) {
              p.status = 'CLOSED';
            } else if (
              p.leaderUsername &&
              p.leaderUsername.toLowerCase() === session.username.toLowerCase()
            ) {
              p.leaderUsername = p.members[0].username;
            }
            p.updatedAt = nowIso;
          }
        }
      });

      const existingCodes = new Set(parties.map(p => p?.partyCode));
      let partyCode = '';
      do {
        partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      } while (partyCode.length < 6 || existingCodes.has(partyCode));

      const newParty = {
        partyId: generateId('PRT'),
        partyCode,
        partyName: cleanName,
        leaderUsername: session.username,
        maxMembers: Math.max(4, Number(perms.maxPartySize || 8)),
        status: 'LOBBY',
        members: [
          {
            username: session.username,
            joinedAt: nowIso,
            score: 0
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      };

      parties.unshift(newParty);
      this._saveAllParties(parties);

      activityService.log(
        'PARTY_CREATE',
        session.username,
        `${session.username} "${cleanName}" (${partyCode}) partisini oluşturdu.`
      );
      return newParty;
    },

    /**
     * #4: Parti Kodu İle Katılma
     * Geçersiz kod -> "Geçersiz parti kodu."
     * Kapalı parti -> "Bu parti artık aktif değil."
     * Dolu parti -> "Bu parti dolu."
     */
    joinPartyByCode(session, partyCode) {
      authGuard.verifySession(session);
      userService.ensureSessionUser(session);
      const cleanCode = String(partyCode || '')
        .replace(/[#\s-]/g, '')
        .trim()
        .toUpperCase();
      if (!cleanCode) {
        throw new Error('Lütfen geçerli bir parti kodu girin.');
      }

      const parties = this.getAllParties();
      const matchingParties = parties.filter(
        p => p && String(p.partyCode || '').toUpperCase() === cleanCode
      );
      if (matchingParties.length === 0) {
        throw new Error('Geçersiz parti kodu. Kodu kontrol edip tekrar deneyin.');
      }

      const activeParty = matchingParties.find(p => p.status !== 'CLOSED');
      if (!activeParty) {
        throw new Error('Bu parti artık aktif değil.');
      }

      if (!Array.isArray(activeParty.members)) {
        activeParty.members = [];
      }

      const alreadyIn = activeParty.members.some(
        m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
      );
      if (alreadyIn) return activeParty;

      if (activeParty.members.length >= (activeParty.maxMembers || 8)) {
        throw new Error('Bu parti dolu.');
      }

      const nowIso = nextMonotonicIso(activeParty.updatedAt || activeParty.createdAt);

      // Kullanıcının başka aktif partisi varsa ondan çıkar
      parties.forEach(p => {
        if (p && p.partyId !== activeParty.partyId && p.status !== 'CLOSED' && Array.isArray(p.members)) {
          const hadMember = p.members.some(
            m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
          );
          if (hadMember) {
            p.members = p.members.filter(
              m => m && m.username && m.username.toLowerCase() !== session.username.toLowerCase()
            );
            p.removedMembers = Array.from(
              new Set([...(p.removedMembers || []), session.username.toLowerCase()])
            );
            if (p.members.length === 0) p.status = 'CLOSED';
            else if (
              p.leaderUsername &&
              p.leaderUsername.toLowerCase() === session.username.toLowerCase()
            ) {
              p.leaderUsername = p.members[0].username;
            }
            p.updatedAt = nextMonotonicIso(p.updatedAt || p.createdAt);
          }
        }
      });

      activeParty.removedMembers = (activeParty.removedMembers || []).filter(
        u => String(u).toLowerCase() !== session.username.toLowerCase()
      );
      activeParty.members.push({
        username: session.username,
        joinedAt: nowIso,
        score: 0
      });
      activeParty.updatedAt = nowIso;
      this._saveAllParties(parties);

      // Bu oyuncuya ait bekleyen davet varsa ACCEPTED işaretle
      const invites = this.getAllInvitations();
      invites.forEach(inv => {
        if (
          inv &&
          (inv.partyId === activeParty.partyId || inv.partyCode === activeParty.partyCode) &&
          inv.recipientUsername &&
          inv.recipientUsername.toLowerCase() === session.username.toLowerCase() &&
          inv.status === 'PENDING'
        ) {
          inv.status = 'ACCEPTED';
          inv.respondedAt = nowIso;
          inv.updatedAt = nextMonotonicIso(inv.updatedAt || inv.createdAt);
          if (inv.notificationId) {
            notificationService.updateNotificationMeta(session.username, inv.notificationId, {
              invitationStatus: 'ACCEPTED',
              inviteStatus: 'ACCEPTED'
            });
          }
        }
      });
      this._saveAllInvitations(invites);

      // Odadaki diğer üyelere bildirim gönder
      activeParty.members.forEach(m => {
        if (m && m.username && m.username.toLowerCase() !== session.username.toLowerCase()) {
          notificationService.notifyUser(m.username, {
            type: 'PARTY_JOIN_REQUEST',
            title: '🎉 Partiye Yeni Oyuncu Katıldı',
            message: `${session.username}, "${activeParty.partyName}" partisine katıldı!`
          });
        }
      });

      activityService.log(
        'PARTY_JOIN',
        session.username,
        `${session.username}, "${activeParty.partyName}" (${activeParty.partyCode}) partisine katıldı.`
      );
      return activeParty;
    },

    /**
     * #5: Oyuncu Davet Et
     */
    invitePlayerToParty(session, partyId, targetUsername) {
      authGuard.verifySession(session);
      userService.ensureSessionUser(session);
      const cleanTarget = String(targetUsername || '').trim();
      if (!cleanTarget) {
        throw new Error('Lütfen davet edilecek oyuncunun adını girin.');
      }

      if (cleanTarget.toLowerCase() === session.username.toLowerCase()) {
        throw new Error('Kendinizi partiye davet edemezsiniz.');
      }

      const targetUser = userService.getUserByUsername(cleanTarget);
      const resolvedTargetName = targetUser ? targetUser.username : cleanTarget;

      const party =
        this.getAllParties().find(p => p && p.partyId === partyId && p.status !== 'CLOSED') ||
        this.getActivePartyForUser(session.username);
      if (!party || party.status === 'CLOSED') {
        throw new Error('Bu parti artık aktif değil.');
      }

      if (party.members.length >= (party.maxMembers || 8)) {
        throw new Error('Bu parti dolu.');
      }

      if (
        party.members.some(
          m => m && m.username && m.username.toLowerCase() === resolvedTargetName.toLowerCase()
        )
      ) {
        throw new Error(`${resolvedTargetName} zaten bu partide yer alıyor.`);
      }

      const invites = this.getAllInvitations();
      const now = Date.now();
      const nowIso = nextMonotonicIso(party.updatedAt || party.createdAt);
      const existingInvite = invites.find(
        inv =>
          inv &&
          inv.partyId === party.partyId &&
          inv.recipientUsername &&
          inv.recipientUsername.toLowerCase() === resolvedTargetName.toLowerCase() &&
          inv.status === 'PENDING'
      );

      let invitation = existingInvite;
      if (invitation) {
        invitation.inviterUsername = session.username;
        invitation.fromUsername = session.username;
        invitation.updatedAt = nextMonotonicIso(invitation.updatedAt || invitation.createdAt);
        invitation.expiresAt = new Date(now + this.INVITE_TTL_MS).toISOString();
      } else {
        invitation = {
          id: generateId('INV'),
          partyId: party.partyId,
          partyCode: party.partyCode,
          partyName: party.partyName,
          inviterUsername: session.username,
          fromUsername: session.username,
          recipientUsername: resolvedTargetName,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso,
          expiresAt: new Date(now + this.INVITE_TTL_MS).toISOString()
        };
        invites.unshift(invitation);
      }

      this._saveAllInvitations(invites);

      const notif = notificationService.notifyUser(resolvedTargetName, {
        type: 'PARTY_INVITE',
        title: 'Parti Daveti',
        message: `${session.username} sizi "${party.partyName}" (Kod: ${party.partyCode}) partisine davet etti.`,
        meta: {
          invitationId: invitation.id,
          partyId: party.partyId,
          partyCode: party.partyCode,
          partyName: party.partyName,
          fromUsername: session.username,
          inviterUsername: session.username,
          invitationStatus: 'PENDING',
          inviteStatus: 'PENDING'
        }
      });

      invitation.notificationId = notif?.id || invitation.notificationId || null;
      this._saveAllInvitations(invites);

      activityService.log(
        'PARTY_INVITE',
        session.username,
        `${session.username}, ${resolvedTargetName} oyuncusuna "${party.partyName}" (${party.partyCode}) parti daveti gönderdi.`
      );

      return invitation;
    },

    /**
     * #5: Parti Davetini Kabul Et ([ Kabul Et ])
     */
    acceptPartyInvitation(session, invitationId) {
      authGuard.verifySession(session);
      userService.ensureSessionUser(session);
      const invites = this.getAllInvitations();
      let inv = invites.find(i => i && i.id === invitationId);

      // Eğer davet kaydı yerel listede yoksa bildirim meta verisinden kurtar
      if (!inv) {
        const userNotifs = notificationService.getUserNotifications(session.username);
        const matchedNotif = userNotifs.find(
          n => n && n.meta && n.meta.invitationId === invitationId && n.meta.partyCode
        );
        if (matchedNotif) {
          const joined = this.joinPartyByCode(session, matchedNotif.meta.partyCode);
          notificationService.updateNotificationMeta(session.username, matchedNotif.id, {
            invitationStatus: 'ACCEPTED',
            inviteStatus: 'ACCEPTED'
          });
          return joined;
        }
        throw new Error('Parti daveti bulunamadı.');
      }

      if (inv.recipientUsername.toLowerCase() !== session.username.toLowerCase()) {
        throw new Error('Bu parti daveti size ait değil.');
      }

      const parties = this.getAllParties();
      const party = parties.find(
        p => p && (p.partyId === inv.partyId || p.partyCode === inv.partyCode) && p.status !== 'CLOSED'
      );

      if (inv.status === 'ACCEPTED' && party) {
        return party;
      }
      if (inv.status === 'REJECTED') {
        throw new Error('Reddedilmiş bir parti daveti kabul edilemez.');
      }

      const nowIso = nextMonotonicIso(party?.updatedAt || inv.updatedAt || inv.createdAt);
      if (
        inv.status === 'EXPIRED' ||
        (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())
      ) {
        inv.status = 'EXPIRED';
        inv.updatedAt = nowIso;
        this._saveAllInvitations(invites);
        throw new Error('Bu parti davetinin süresi dolmuş.');
      }

      if (!party || party.status === 'CLOSED') {
        inv.status = 'EXPIRED';
        inv.updatedAt = nowIso;
        this._saveAllInvitations(invites);
        throw new Error('Bu parti artık aktif değil.');
      }

      if (!Array.isArray(party.members)) party.members = [];

      if (
        !party.members.some(
          m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
        ) &&
        party.members.length >= (party.maxMembers || 8)
      ) {
        throw new Error('Bu parti dolu.');
      }

      // Kullanıcının başka aktif partisi varsa ondan çıkar
      parties.forEach(p => {
        if (p && p.partyId !== party.partyId && p.status !== 'CLOSED' && Array.isArray(p.members)) {
          const hadMember = p.members.some(
            m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
          );
          if (hadMember) {
            p.members = p.members.filter(
              m => m && m.username && m.username.toLowerCase() !== session.username.toLowerCase()
            );
            p.removedMembers = Array.from(
              new Set([...(p.removedMembers || []), session.username.toLowerCase()])
            );
            if (p.members.length === 0) p.status = 'CLOSED';
            else if (
              p.leaderUsername &&
              p.leaderUsername.toLowerCase() === session.username.toLowerCase()
            ) {
              p.leaderUsername = p.members[0].username;
            }
            p.updatedAt = nextMonotonicIso(p.updatedAt || p.createdAt);
          }
        }
      });

      party.removedMembers = (party.removedMembers || []).filter(
        u => String(u).toLowerCase() !== session.username.toLowerCase()
      );

      if (
        !party.members.some(
          m => m && m.username && m.username.toLowerCase() === session.username.toLowerCase()
        )
      ) {
        party.members.push({
          username: session.username,
          joinedAt: nowIso,
          score: 0
        });
      }
      party.updatedAt = nowIso;
      this._saveAllParties(parties);

      inv.status = 'ACCEPTED';
      inv.respondedAt = nowIso;
      inv.updatedAt = nowIso;
      this._saveAllInvitations(invites);

      if (inv.notificationId) {
        notificationService.updateNotificationMeta(session.username, inv.notificationId, {
          invitationStatus: 'ACCEPTED',
          inviteStatus: 'ACCEPTED'
        });
      }

      const inviterName = inv.inviterUsername || inv.fromUsername || party.leaderUsername;
      if (inviterName) {
        notificationService.notifyUser(inviterName, {
          type: 'PARTY_UPDATE',
          title: '🎉 Parti Daveti Kabul Edildi',
          message: `${session.username} parti davetinizi kabul etti ve "${party.partyName}" odasına katıldı!`
        });
      }

      activityService.log(
        'PARTY_INVITE_ACCEPT',
        session.username,
        `${session.username}, ${inviterName} tarafından gönderilen "${party.partyName}" davetini kabul etti.`
      );

      return party;
    },

    /**
     * #5: Parti Davetini Reddet ([ Reddet ])
     */
    rejectPartyInvitation(session, invitationId) {
      authGuard.verifySession(session);
      const invites = this.getAllInvitations();
      const inv = invites.find(i => i && i.id === invitationId);

      if (!inv) {
        const userNotifs = notificationService.getUserNotifications(session.username);
        const matchedNotif = userNotifs.find(
          n => n && n.meta && n.meta.invitationId === invitationId
        );
        if (matchedNotif) {
          notificationService.updateNotificationMeta(session.username, matchedNotif.id, {
            invitationStatus: 'REJECTED',
            inviteStatus: 'REJECTED'
          });
          return { id: invitationId, status: 'REJECTED' };
        }
        throw new Error('Parti daveti bulunamadı.');
      }
      if (inv.recipientUsername.toLowerCase() !== session.username.toLowerCase()) {
        throw new Error('Bu parti daveti size ait değil.');
      }
      if (inv.status !== 'PENDING') {
        return inv;
      }

      const nowIso = nextMonotonicIso(inv.updatedAt || inv.createdAt);
      inv.status = 'REJECTED';
      inv.respondedAt = nowIso;
      inv.updatedAt = nowIso;
      this._saveAllInvitations(invites);

      if (inv.notificationId) {
        notificationService.updateNotificationMeta(session.username, inv.notificationId, {
          invitationStatus: 'REJECTED',
          inviteStatus: 'REJECTED'
        });
      }

      const inviterName = inv.inviterUsername || inv.fromUsername;
      if (inviterName) {
        notificationService.notifyUser(inviterName, {
          type: 'PARTY_UPDATE',
          title: 'Parti Daveti Reddedildi',
          message: `${session.username}, "${inv.partyName}" parti davetinizi reddetti.`
        });
      }

      activityService.log(
        'PARTY_INVITE_REJECT',
        session.username,
        `${session.username}, "${inv.partyName}" parti davetini reddetti.`
      );

      return inv;
    },

    kickPartyMember(session, partyId, targetUsername) {
      authGuard.verifySession(session);
      const parties = this.getAllParties();
      const party = parties.find(p => p && p.partyId === partyId);
      if (!party || party.status === 'CLOSED') {
        throw new Error('Bu parti artık aktif değil.');
      }

      if (
        party.leaderUsername.toLowerCase() !== session.username.toLowerCase() &&
        !session.isAdminSession
      ) {
        throw new Error('Yalnızca parti lideri oyuncu çıkarabilir.');
      }

      const targetClean = String(targetUsername).trim().toLowerCase();
      party.members = (party.members || []).filter(
        m => m && m.username && m.username.toLowerCase() !== targetClean
      );
      party.removedMembers = Array.from(new Set([...(party.removedMembers || []), targetClean]));
      party.updatedAt = nextMonotonicIso(party.updatedAt || party.createdAt);
      this._saveAllParties(parties);

      notificationService.notifyUser(targetUsername, {
        type: 'PARTY_UPDATE',
        title: 'Partiden Çıkarıldınız',
        message: `"${party.partyName}" partisinden lider tarafından çıkarıldınız.`
      });

      return party;
    },

    leaveParty(session, partyId) {
      authGuard.verifySession(session);
      const parties = this.getAllParties();
      const party = parties.find(p => p && p.partyId === partyId);
      if (!party) return true;

      const selfClean = session.username.toLowerCase();
      party.members = (party.members || []).filter(
        m => m && m.username && m.username.toLowerCase() !== selfClean
      );
      party.removedMembers = Array.from(new Set([...(party.removedMembers || []), selfClean]));

      if (party.members.length === 0) {
        party.status = 'CLOSED';
      } else if (party.leaderUsername.toLowerCase() === selfClean) {
        party.leaderUsername = party.members[0].username;
        notificationService.notifyUser(party.leaderUsername, {
          type: 'PARTY_UPDATE',
          title: '👑 Yeni Parti Liderisiniz',
          message: `"${party.partyName}" partisinde liderlik size devredildi.`
        });
      }

      party.updatedAt = nextMonotonicIso(party.updatedAt || party.createdAt);
      this._saveAllParties(parties);
      activityService.log(
        'PARTY_LEAVE',
        session.username,
        `${session.username}, "${party.partyName}" partisinden ayrıldı.`
      );
      return true;
    },

    startPartyMatch(session, partyId) {
      authGuard.verifySession(session);
      const parties = this.getAllParties();
      const party = parties.find(p => p && p.partyId === partyId && p.status !== 'CLOSED');
      if (!party) throw new Error('Bu parti artık aktif değil.');

      if (
        party.leaderUsername.toLowerCase() !== session.username.toLowerCase() &&
        !session.isAdminSession
      ) {
        throw new Error('Yalnızca parti lideri maçı başlatabilir.');
      }

      party.status = 'IN_GAME';
      party.updatedAt = nextMonotonicIso(party.updatedAt || party.createdAt);
      this._saveAllParties(parties);

      (party.members || []).forEach(m => {
        if (m && m.username && m.username.toLowerCase() !== session.username.toLowerCase()) {
          notificationService.notifyUser(m.username, {
            type: 'PARTY_UPDATE',
            title: '⚔️ Parti Maçı Başladı!',
            message: `"${party.partyName}" partisinde turnuva maçı lider tarafından başlatıldı!`
          });
        }
      });

      return party;
    },

    updateMemberScore(username, scoreEarned) {
      const parties = this.getAllParties();
      const clean = String(username || '').trim().toLowerCase();
      let updated = false;
      const nowIso = new Date().toISOString();

      parties.forEach(p => {
        if (p && p.status !== 'CLOSED' && Array.isArray(p.members)) {
          const member = p.members.find(m => m && m.username && m.username.toLowerCase() === clean);
          if (member) {
            member.score = Math.max(Number(member.score || 0), Number(scoreEarned || 0));
            p.updatedAt = nowIso;
            updated = true;
          }
        }
      });

      if (updated) this._saveAllParties(parties);
    },

    adminCloseParty(session, partyId) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const parties = this.getAllParties();
      const party = parties.find(p => p && p.partyId === partyId);
      if (!party) throw new Error('Parti bulunamadı.');
      party.status = 'CLOSED';
      party.updatedAt = new Date().toISOString();
      this._saveAllParties(parties);
      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `Parti kapatıldı: ${party.partyName} (${party.partyCode})`
      );
      return party;
    }
  };

  // ==========================================
  // DESTEK SİSTEMİ (supportService — #18)
  // Kategoriler: Teknik, Hesap, Parti, Ödeme, Mağaza, Diğer
  // ==========================================
  const supportService = {
    getAllTickets() {
      return storage.get(STORAGE_KEYS.SUPPORT_TICKETS, []);
    },

    getUserTickets(username) {
      const clean = String(username || '').trim().toLowerCase();
      return this.getAllTickets().filter(t => t.username.toLowerCase() === clean);
    },

    createTicket(session, { category = 'Teknik', subject, message }) {
      authGuard.verifySession(session);
      const cleanSub = String(subject || '').trim();
      const cleanMsg = String(message || '').trim();
      if (!cleanSub || !cleanMsg) {
        throw new Error('Lütfen konu başlığını ve mesajınızı eksiksiz yazın.');
      }

      const perms = authGuard.getUserPermissions(session);
      const tickets = this.getAllTickets();
      const ticket = {
        id: generateId('SUP'),
        username: session.username,
        category: String(category || 'Teknik'),
        subject: cleanSub,
        priority: perms.supportPriority || 'NORMAL',
        status: 'OPEN',
        messages: [
          {
            sender: session.username,
            senderRole: 'USER',
            text: cleanMsg,
            createdAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString()
      };

      tickets.unshift(ticket);
      storage.set(STORAGE_KEYS.SUPPORT_TICKETS, tickets);
      activityService.log(
        'SUPPORT_CREATE',
        session.username,
        `${session.username} yeni bir destek talebi oluşturdu: "${cleanSub}"`
      );
      return ticket;
    },

    replyToTicket(session, ticketId, replyText) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const cleanReply = String(replyText || '').trim();
      if (!cleanReply) throw new Error('Yanıt metni boş olamaz.');

      const tickets = this.getAllTickets();
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) throw new Error('Destek talebi bulunamadı.');

      ticket.messages.push({
        sender: session.username,
        senderRole: 'ADMIN',
        text: cleanReply,
        createdAt: new Date().toISOString()
      });
      ticket.status = 'ANSWERED';
      storage.set(STORAGE_KEYS.SUPPORT_TICKETS, tickets);

      notificationService.notifyUser(ticket.username, {
        type: 'SUPPORT_REPLY',
        title: '🎧 Destek Talebinize Yanıt Geldi',
        message: `"${ticket.subject}" başlıklı destek talebiniz yanıtlandı: "${cleanReply}"`
      });

      activityService.log(
        'SUPPORT_REPLY',
        session.username,
        `Destek talebi yanıtlandı (#${ticket.id} - ${ticket.username}).`
      );
      return ticket;
    }
  };

  // ==========================================
  // HATA BİLDİRİM SERVİSİ (bugService — #18)
  // Alanlar: Başlık, Açıklama, Kategori, Screenshot, Related party, Priority, Reward
  // ==========================================
  const bugService = {
    getAllBugs() {
      return storage.get(STORAGE_KEYS.BUG_REPORTS, []);
    },

    getUserBugs(username) {
      const clean = String(username || '').trim().toLowerCase();
      return this.getAllBugs().filter(b => b.username.toLowerCase() === clean);
    },

    createBugReport(
      session,
      {
        title,
        category = 'Arayüz (UI)',
        severity = 'Orta',
        description,
        screenshot = '',
        relatedParty = ''
      }
    ) {
      authGuard.verifySession(session);
      const cleanTitle = String(title || '').trim();
      const cleanDesc = String(description || '').trim();
      if (!cleanTitle || !cleanDesc) {
        throw new Error('Lütfen hata başlığını ve açıklamasını girin.');
      }

      const perms = authGuard.getUserPermissions(session);
      const bugs = this.getAllBugs();
      const report = {
        id: generateId('BUG'),
        username: session.username,
        title: cleanTitle,
        category: String(category),
        severity: String(severity),
        priority: perms.bugPriority || 'NORMAL',
        description: cleanDesc,
        screenshot: String(screenshot || '').trim(),
        relatedParty: String(relatedParty || '').trim().toUpperCase(),
        status: 'İNCELENİYOR',
        adminNote: '',
        rewardEmerald: 0,
        createdAt: new Date().toISOString()
      };

      bugs.unshift(report);
      storage.set(STORAGE_KEYS.BUG_REPORTS, bugs);
      activityService.log(
        'BUG_REPORT',
        session.username,
        `${session.username} hata bildiriminde bulundu: "${cleanTitle}"`
      );
      return report;
    },

    adminUpdateBug(session, bugId, { status = 'ÇÖZÜLDÜ', adminNote = '', rewardEmerald = 0 }) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const bugs = this.getAllBugs();
      const bug = bugs.find(b => b.id === bugId);
      if (!bug) throw new Error('Hata kaydı bulunamadı.');

      if (status) bug.status = status;
      if (adminNote !== undefined) bug.adminNote = String(adminNote).trim();

      let rewardGranted = 0;
      const numReward = Math.max(0, Number(rewardEmerald || 0));
      if (numReward > 0 && !bug.rewarded && window.MCMServices?.economyService) {
        window.MCMServices.economyService.addEmeralds(
          bug.username,
          numReward,
          `Hata Bildirimi Ödülü (#${bug.id})`,
          false,
          true
        );
        bug.rewarded = true;
        bug.rewardEmerald = numReward;
        rewardGranted = numReward;
      }

      storage.set(STORAGE_KEYS.BUG_REPORTS, bugs);

      notificationService.notifyUser(bug.username, {
        type: 'BUG_REPORT_REPLY',
        title: '🐞 Hata Bildiriminiz Güncellendi',
        message: `"${bug.title}" hata kaydınızın durumu [${bug.status}] olarak güncellendi.${
          bug.adminNote ? ` Yönetici Notu: ${bug.adminNote}` : ''
        }${rewardGranted > 0 ? ` (+${rewardGranted} Zümrüt Hata Ödülü hesabınıza eklendi!)` : ''}`
      });

      activityService.log(
        'BUG_RESOLVE',
        session.username,
        `Hata bildirimi güncellendi (#${bug.id} -> ${bug.status}${
          rewardGranted > 0 ? `, +${rewardGranted} Zümrüt ödül` : ''
        }).`
      );
      return bug;
    }
  };

  // ==========================================
  // ÖNERİ SERVİSİ (suggestionService — #18)
  // Alanlar: Başlık, Açıklama, Kategori, Oylar, Yönetici Notu, Ödül
  // ==========================================
  const suggestionService = {
    getAllSuggestions() {
      return storage.get(STORAGE_KEYS.SUGGESTIONS, []);
    },

    createSuggestion(session, { category = 'Yeni Özellik', title, details }) {
      authGuard.verifySession(session);
      const cleanTitle = String(title || '').trim();
      const cleanDetails = String(details || '').trim();
      if (!cleanTitle || !cleanDetails) {
        throw new Error('Lütfen öneri başlığını ve açıklamasını yazın.');
      }

      const perms = authGuard.getUserPermissions(session);
      const list = this.getAllSuggestions();
      const item = {
        id: generateId('SUG'),
        username: session.username,
        category: String(category),
        priority: perms.suggestionPriority || 'NORMAL',
        title: cleanTitle,
        details: cleanDetails,
        status: 'İNCELENİYOR',
        adminNote: '',
        rewardEmerald: 0,
        upvotes: [session.username],
        downvotes: [],
        createdAt: new Date().toISOString()
      };

      list.unshift(item);
      storage.set(STORAGE_KEYS.SUGGESTIONS, list);
      activityService.log(
        'SUGGESTION_CREATE',
        session.username,
        `${session.username} yeni bir öneri gönderdi: "${cleanTitle}"`
      );
      return item;
    },

    voteSuggestion(session, sugId, direction = 'UP') {
      authGuard.verifySession(session);
      const list = this.getAllSuggestions();
      const item = list.find(s => s.id === sugId);
      if (!item) throw new Error('Öneri bulunamadı.');

      const u = session.username;
      const alreadyUp = (item.upvotes || []).some(x => x.toLowerCase() === u.toLowerCase());
      const alreadyDown = (item.downvotes || []).some(x => x.toLowerCase() === u.toLowerCase());

      item.upvotes = (item.upvotes || []).filter(x => x.toLowerCase() !== u.toLowerCase());
      item.downvotes = (item.downvotes || []).filter(x => x.toLowerCase() !== u.toLowerCase());

      if (direction === 'UP' && !alreadyUp) {
        item.upvotes.push(u);
      } else if (direction === 'DOWN' && !alreadyDown) {
        item.downvotes.push(u);
      }

      storage.set(STORAGE_KEYS.SUGGESTIONS, list);
      return item;
    },

    adminUpdateSuggestion(session, sugId, { status, adminNote, rewardEmerald = 0 }) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const list = this.getAllSuggestions();
      const item = list.find(s => s.id === sugId);
      if (!item) throw new Error('Öneri bulunamadı.');

      if (status) item.status = status;
      if (adminNote !== undefined) item.adminNote = String(adminNote).trim();

      let rewardGranted = 0;
      const numReward = Math.max(0, Number(rewardEmerald || 0));
      if (numReward > 0 && !item.rewarded && window.MCMServices?.economyService) {
        window.MCMServices.economyService.addEmeralds(
          item.username,
          numReward,
          `Öneri Katkı Ödülü (#${item.id})`,
          false,
          true
        );
        item.rewarded = true;
        item.rewardEmerald = numReward;
        rewardGranted = numReward;
      }

      storage.set(STORAGE_KEYS.SUGGESTIONS, list);

      notificationService.notifyUser(item.username, {
        type: 'SUGGESTION_STATUS_CHANGED',
        title: '💡 Öneri Durumunuz Güncellendi',
        message: `"${item.title}" başlıklı önerinizin durumu [${item.status}] olarak güncellendi.${
          item.adminNote ? ` Yönetici Notu: ${item.adminNote}` : ''
        }${rewardGranted > 0 ? ` (+${rewardGranted} Zümrüt Öneri Ödülü hesabınıza eklendi!)` : ''}`
      });

      activityService.log(
        'SUGGESTION_UPDATE',
        session.username,
        `Öneri durumu güncellendi (#${item.id} -> ${item.status}${
          rewardGranted > 0 ? `, +${rewardGranted} Zümrüt ödül` : ''
        }).`
      );
      return item;
    }
  };

  // ==========================================
  // STRIPE ÖDEME HAZIRLIK SERVİSİ (paymentService — #15)
  // Asla sahte ödeme yapmaz; "Ödeme sistemi yakında aktif olacaktır (Stripe entegrasyonu hazırlanıyor)" mesajı döner.
  // ==========================================
  const DEFAULT_STRIPE_CONFIG = {
    publishableKey: '',
    webhookEndpoint: '/api/stripe/webhook',
    currency: 'TRY',
    mode: 'PREPARATION',
    enabled: false,
    statusMessage: 'Ödeme sistemi yakında aktif olacaktır (Stripe entegrasyonu hazırlanıyor)'
  };

  const paymentService = {
    getStripeConfig() {
      return {
        ...DEFAULT_STRIPE_CONFIG,
        ...storage.get(STORAGE_KEYS.STRIPE_CONFIG, DEFAULT_STRIPE_CONFIG)
      };
    },

    updateStripeConfig(session, updates = {}) {
      authGuard.requireRole(session, ['ADMIN']);
      const next = {
        ...this.getStripeConfig(),
        ...updates,
        updatedAt: new Date().toISOString()
      };
      storage.set(STORAGE_KEYS.STRIPE_CONFIG, next);
      activityService.log(
        'ADMIN_ACTION',
        session.username,
        'Stripe ödeme hazırlık yapılandırması güncellendi.'
      );
      return next;
    },

    getCheckoutSessions(username = null) {
      const all = storage.get(STORAGE_KEYS.STRIPE_SESSIONS, []);
      if (!username) return all;
      const clean = String(username).trim().toLowerCase();
      return all.filter(s => s.username.toLowerCase() === clean);
    },

    createPreparedStripeSession(
      session,
      {
        productType = 'RANK_UPGRADE',
        productId,
        productName,
        recipientUsername = null,
        amountTry = 0,
        currency = 'TRY'
      }
    ) {
      authGuard.verifySession(session);
      const cfg = this.getStripeConfig();

      const sessionRecord = {
        id: generateId('CS_PREP'),
        username: session.username,
        recipientUsername: recipientUsername || session.username,
        productType,
        productId,
        productName,
        amountTry: Number(amountTry || 0),
        currency: currency || cfg.currency || 'TRY',
        status: 'PREPARED_PENDING_STRIPE',
        createdAt: new Date().toISOString()
      };

      const list = this.getCheckoutSessions();
      list.unshift(sessionRecord);
      if (list.length > 250) list.length = 250;
      storage.set(STORAGE_KEYS.STRIPE_SESSIONS, list);

      return {
        stripePrepared: true,
        userNotice: cfg.statusMessage,
        sessionRecord
      };
    }
  };

  // ==========================================
  // YEDEKLEME VE PLATFORM AYARLARI SERVİSİ (backupService)
  // ==========================================
  const backupService = {
    getPlatformSettings() {
      return storage.get(STORAGE_KEYS.PLATFORM_SETTINGS, {
        siteTitle: 'MC Milyoner Olmak İster',
        announcementText: 'Yeni Sezon Başladı! Her gün ücretsiz Günlük Zümrüt al, ilk VIP+ ve üzeri alımda +250 Netherite kazan!'
      });
    },

    updatePlatformSettings(session, updates = {}) {
      authGuard.requireRole(session, ['ADMIN']);
      const next = {
        ...this.getPlatformSettings(),
        ...updates
      };
      storage.set(STORAGE_KEYS.PLATFORM_SETTINGS, next);
      activityService.log('ADMIN_ACTION', session.username, 'Platform genel ayarları güncellendi.');
      return next;
    },

    getSnapshots() {
      return storage.get(STORAGE_KEYS.BACKUPS, []);
    },

    createManualSnapshot(session, label = 'Yönetici Yedeği') {
      authGuard.requireRole(session, ['ADMIN']);
      const snapshots = this.getSnapshots();
      const snap = {
        id: generateId('SNAP'),
        label: String(label || 'Yönetici Yedeği'),
        createdBy: session.username,
        createdAt: new Date().toISOString(),
        data: {
          users: storage.get(STORAGE_KEYS.USERS, []),
          parties: storage.get(STORAGE_KEYS.PARTIES, []),
          partyInvitations: storage.get(STORAGE_KEYS.PARTY_INVITATIONS, []),
          notifications: storage.get(STORAGE_KEYS.NOTIFICATIONS, {}),
          support: storage.get(STORAGE_KEYS.SUPPORT_TICKETS, []),
          bugs: storage.get(STORAGE_KEYS.BUG_REPORTS, []),
          suggestions: storage.get(STORAGE_KEYS.SUGGESTIONS, [])
        }
      };
      snapshots.unshift(snap);
      if (snapshots.length > 15) snapshots.length = 15;
      storage.set(STORAGE_KEYS.BACKUPS, snapshots);
      activityService.log(
        'BACKUP_CREATE',
        session.username,
        `Yeni sistem yedeği oluşturuldu: ${snap.label}`
      );
      return snap;
    },

    restoreSnapshot(session, snapshotId) {
      authGuard.requireRole(session, ['ADMIN']);
      const snap = this.getSnapshots().find(s => s.id === snapshotId);
      if (!snap || !snap.data) throw new Error('Yedek bulunamadı.');

      if (snap.data.users) storage.set(STORAGE_KEYS.USERS, snap.data.users);
      if (snap.data.parties) storage.set(STORAGE_KEYS.PARTIES, snap.data.parties);
      if (snap.data.partyInvitations) {
        storage.set(STORAGE_KEYS.PARTY_INVITATIONS, snap.data.partyInvitations);
      }
      if (snap.data.notifications) storage.set(STORAGE_KEYS.NOTIFICATIONS, snap.data.notifications);
      if (snap.data.support) storage.set(STORAGE_KEYS.SUPPORT_TICKETS, snap.data.support);
      if (snap.data.bugs) storage.set(STORAGE_KEYS.BUG_REPORTS, snap.data.bugs);
      if (snap.data.suggestions) storage.set(STORAGE_KEYS.SUGGESTIONS, snap.data.suggestions);
      activityService.log(
        'BACKUP_RESTORE',
        session.username,
        `Sistem yedeği geri yüklendi: ${snap.label}`
      );
      return true;
    },

    exportPlatformData(session) {
      authGuard.requireRole(session, ['ADMIN']);
      return {
        exportedAt: new Date().toISOString(),
        users: storage.get(STORAGE_KEYS.USERS, []),
        parties: storage.get(STORAGE_KEYS.PARTIES, []),
        partyInvitations: storage.get(STORAGE_KEYS.PARTY_INVITATIONS, []),
        support: storage.get(STORAGE_KEYS.SUPPORT_TICKETS, []),
        bugs: storage.get(STORAGE_KEYS.BUG_REPORTS, []),
        suggestions: storage.get(STORAGE_KEYS.SUGGESTIONS, [])
      };
    }
  };

  // ==========================================
  // ÇOKLU BİLGİSAYAR / BULUT SENKRONİZASYON SERVİSİ (cloudSyncService)
  // Farklı bilgisayarlardan veya tarayıcılardan açılan hesapları, liderlik tablosunu,
  // rütbeleri, partileri ve Gemini AI soru havuzunu gerçek zamanlı senkronize eder.
  // ==========================================
  const DEFAULT_CLOUD_ENDPOINT =
    'https://kvdb.io/VbaQ2SwvGVXLqWRhnvv6sM/mcm_cloud_db_v9';
  const FALLBACK_CLOUD_ENDPOINT =
    'https://api.restful-api.dev/objects/ff808181a09d98f701a11d54a62f2531';
  const ECONOMY_STORAGE_KEYS = {
    RANKS: 'mc_millionaire_tr_ranks_v9',
    SHOP_ITEMS: 'mc_millionaire_tr_shop_items_v9',
    LEADERBOARD_META: 'mc_millionaire_tr_leaderboard_meta_v6'
  };

  const cloudSyncService = {
    _pushTimer: null,
    _isSyncing: false,
    _pollInterval: null,
    _lastSyncAt: null,
    _lastError: null,

    getMeta() {
      const meta = storage.get(STORAGE_KEYS.CLOUD_SYNC_META, {
        endpoint: DEFAULT_CLOUD_ENDPOINT,
        enabled: true,
        lastSyncAt: null
      });
      if (
        !meta ||
        !meta.endpoint ||
        String(meta.endpoint).includes('ff808181a09d98f701a11d14ce6a249f')
      ) {
        const upgraded = {
          ...(meta || {}),
          endpoint: DEFAULT_CLOUD_ENDPOINT,
          enabled: meta?.enabled !== false
        };
        cloudSyncInternalWrite = true;
        try {
          storage.set(STORAGE_KEYS.CLOUD_SYNC_META, upgraded);
        } finally {
          cloudSyncInternalWrite = false;
        }
        return upgraded;
      }
      return meta;
    },

    getEndpoint() {
      const meta = this.getMeta();
      const raw = String(meta?.endpoint || DEFAULT_CLOUD_ENDPOINT).trim();
      if (!raw || raw.includes('ff808181a09d98f701a11d14ce6a249f')) {
        return DEFAULT_CLOUD_ENDPOINT;
      }
      return raw;
    },

    updateEndpoint(session, newEndpoint, enabled = true) {
      authGuard.requireRole(session, ['ADMIN']);
      const cleanUrl = String(newEndpoint || '').trim() || DEFAULT_CLOUD_ENDPOINT;
      const next = {
        ...this.getMeta(),
        endpoint: cleanUrl,
        enabled: Boolean(enabled),
        updatedAt: new Date().toISOString()
      };
      storage.set(STORAGE_KEYS.CLOUD_SYNC_META, next);
      this.pushNow().catch(() => {});
      return next;
    },

    getTombstones() {
      const raw = storage.get(STORAGE_KEYS.TOMBSTONES, null);
      return {
        deletedUsers: Array.isArray(raw?.deletedUsers) ? raw.deletedUsers : [],
        deletedRanks: Array.isArray(raw?.deletedRanks) ? raw.deletedRanks : [],
        deletedItems: Array.isArray(raw?.deletedItems) ? raw.deletedItems : [],
        deletedParties: Array.isArray(raw?.deletedParties) ? raw.deletedParties : []
      };
    },

    recordTombstone(category, id) {
      const cleanId = String(id || '').trim().toLowerCase();
      if (!cleanId) return;
      const tombs = this.getTombstones();
      if (!Array.isArray(tombs[category])) tombs[category] = [];
      if (!tombs[category].includes(cleanId)) {
        tombs[category].push(cleanId);
        storage.set(STORAGE_KEYS.TOMBSTONES, tombs);
      }
    },

    clearTombstone(category, id) {
      const cleanId = String(id || '').trim().toLowerCase();
      if (!cleanId) return;
      const tombs = this.getTombstones();
      if (!Array.isArray(tombs[category])) return;
      const next = tombs[category].filter(x => x !== cleanId);
      if (next.length !== tombs[category].length) {
        tombs[category] = next;
        storage.set(STORAGE_KEYS.TOMBSTONES, tombs);
      }
    },

    _sanitizeUsersForCloud(users) {
      if (!Array.isArray(users)) return [];
      return users.map(u => {
        const copy = { ...u };
        // Eğer avatar büyük bir data:image base64 ise bulut boyutunu şişirmemek için kısalt
        if (typeof copy.avatarUrl === 'string' && copy.avatarUrl.startsWith('data:') && copy.avatarUrl.length > 4096) {
          copy.avatarUrl = '';
        }
        return copy;
      });
    },

    _sanitizeBugsForCloud(bugs) {
      if (!Array.isArray(bugs)) return [];
      return bugs.slice(0, 60).map(b => {
        const copy = { ...b };
        if (typeof copy.screenshotData === 'string' && copy.screenshotData.length > 8192) {
          copy.screenshotData = '';
        }
        return copy;
      });
    },

    _buildLocalPayload() {
      return {
        schemaVersion: '8.5',
        updatedAt: new Date().toISOString(),
        tombstones: this.getTombstones(),
        users: this._sanitizeUsersForCloud(storage.get(STORAGE_KEYS.USERS, [])),
        ranks: storage.get(ECONOMY_STORAGE_KEYS.RANKS, []),
        shopItems: storage.get(ECONOMY_STORAGE_KEYS.SHOP_ITEMS, []),
        leaderboardMeta: storage.get(ECONOMY_STORAGE_KEYS.LEADERBOARD_META, null),
        parties: storage.get(STORAGE_KEYS.PARTIES, []).slice(0, 80),
        partyInvitations: storage.get(STORAGE_KEYS.PARTY_INVITATIONS, []).slice(0, 120),
        notifications: storage.get(STORAGE_KEYS.NOTIFICATIONS, {}),
        support: storage.get(STORAGE_KEYS.SUPPORT_TICKETS, []).slice(0, 80),
        bugs: this._sanitizeBugsForCloud(storage.get(STORAGE_KEYS.BUG_REPORTS, [])),
        suggestions: storage.get(STORAGE_KEYS.SUGGESTIONS, []).slice(0, 80),
        modPermissions: storage.get(STORAGE_KEYS.MOD_PERMISSIONS, null),
        platformSettings: storage.get(STORAGE_KEYS.PLATFORM_SETTINGS, null),
        aiConfig: storage.get(STORAGE_KEYS.AI_CONFIG, null),
        aiQuestions: storage.get(STORAGE_KEYS.AI_QUESTIONS, []).slice(0, 250)
      };
    },

    _parseTime(isoStr) {
      if (!isoStr) return 0;
      const t = Date.parse(isoStr);
      return Number.isNaN(t) ? 0 : t;
    },

    _mergePartyMembers(localMembers, remoteMembers, removedSet = new Set()) {
      const mMap = new Map();
      (Array.isArray(localMembers) ? localMembers : []).forEach(m => {
        if (m && m.username) {
          const k = m.username.toLowerCase();
          if (!removedSet.has(k)) {
            mMap.set(k, { ...m });
          }
        }
      });
      (Array.isArray(remoteMembers) ? remoteMembers : []).forEach(rm => {
        if (!rm || !rm.username) return;
        const k = rm.username.toLowerCase();
        if (removedSet.has(k)) return;
        const existing = mMap.get(k);
        if (!existing) {
          mMap.set(k, { ...rm });
        } else {
          mMap.set(k, {
            ...existing,
            ...rm,
            score: Math.max(Number(existing.score || 0), Number(rm.score || 0))
          });
        }
      });
      return Array.from(mMap.values());
    },

    _mergeArraysById(localArr, remoteArr, idField, deletedSet = new Set(), normalizeIdFn = null) {
      const map = new Map();
      let changedLocal = false;
      let localHasUnpushed = false;

      const norm = val => {
        const s = String(val || '').trim();
        return normalizeIdFn ? normalizeIdFn(s) : s.toLowerCase();
      };

      const safeLocal = Array.isArray(localArr) ? localArr : [];
      const safeRemote = Array.isArray(remoteArr) ? remoteArr : [];

      safeLocal.forEach(item => {
        if (!item || !item[idField]) return;
        const key = norm(item[idField]);
        if (deletedSet.has(key)) {
          changedLocal = true;
          return;
        }
        map.set(key, item);
      });

      const remoteKeys = new Set();
      safeRemote.forEach(rItem => {
        if (!rItem || !rItem[idField]) return;
        const key = norm(rItem[idField]);
        remoteKeys.add(key);
        if (deletedSet.has(key)) return;

        const lItem = map.get(key);
        if (!lItem) {
          map.set(key, rItem);
          changedLocal = true;
        } else {
          const rTime = this._parseTime(
            rItem.updatedAt || rItem.respondedAt || rItem.lastLoginAt || rItem.createdAt
          );
          const lTime = this._parseTime(
            lItem.updatedAt || lItem.respondedAt || lItem.lastLoginAt || lItem.createdAt
          );
          if (idField === 'partyId') {
            const mergedRemoved = Array.from(
              new Set([...(lItem.removedMembers || []), ...(rItem.removedMembers || [])])
            );
            const removedSet = new Set(mergedRemoved.map(x => String(x).toLowerCase()));
            const isClosed = lItem.status === 'CLOSED' || rItem.status === 'CLOSED';
            const mergedMembers = isClosed
              ? rTime >= lTime
                ? rItem.members || []
                : lItem.members || []
              : this._mergePartyMembers(lItem.members, rItem.members, removedSet);

            const baseParty = rTime >= lTime ? { ...lItem, ...rItem } : { ...rItem, ...lItem };
            if (isClosed) baseParty.status = 'CLOSED';
            baseParty.members = mergedMembers;
            baseParty.removedMembers = mergedRemoved;

            const lMemberNames = (lItem.members || []).map(m => m.username.toLowerCase()).sort().join(',');
            const rMemberNames = (rItem.members || []).map(m => m.username.toLowerCase()).sort().join(',');
            const mMemberNames = mergedMembers.map(m => m.username.toLowerCase()).sort().join(',');

            if (rTime > lTime || mMemberNames !== lMemberNames) {
              map.set(key, baseParty);
              changedLocal = true;
            }
            if (lTime > rTime || mMemberNames !== rMemberNames) {
              map.set(key, baseParty);
              localHasUnpushed = true;
            }
          } else if (rTime > lTime) {
            const merged = { ...lItem, ...rItem };
            if (!merged.avatarUrl && lItem.avatarUrl) merged.avatarUrl = lItem.avatarUrl;
            map.set(key, merged);
            changedLocal = true;
          } else if (lTime > rTime) {
            localHasUnpushed = true;
          } else if (idField === 'username') {
            const rGames = Number(rItem.gamesPlayed || 0);
            const lGames = Number(lItem.gamesPlayed || 0);
            const rPoints = Number(rItem.points || 0);
            const lPoints = Number(lItem.points || 0);
            if (rGames > lGames || rPoints > lPoints) {
              map.set(key, { ...lItem, ...rItem });
              changedLocal = true;
            } else if (lGames > rGames || lPoints > rPoints) {
              localHasUnpushed = true;
            }
          }
        }
      });

      map.forEach((_, key) => {
        if (!remoteKeys.has(key)) {
          localHasUnpushed = true;
        }
      });

      return {
        merged: Array.from(map.values()),
        changedLocal,
        localHasUnpushed
      };
    },

    _mergeAndSave(remoteData) {
      if (!remoteData || typeof remoteData !== 'object') {
        return { changedLocal: false, needsPush: true };
      }

      let anyLocalChanged = false;
      let anyNeedsPush = false;

      cloudSyncInternalWrite = true;
      try {
        // 1. Tombstones birleştir
        const lTombs = this.getTombstones();
        const rTombs = remoteData.tombstones || {};
        const mergedTombs = {
          deletedUsers: Array.from(new Set([...(lTombs.deletedUsers || []), ...(rTombs.deletedUsers || [])])),
          deletedRanks: Array.from(new Set([...(lTombs.deletedRanks || []), ...(rTombs.deletedRanks || [])])),
          deletedItems: Array.from(new Set([...(lTombs.deletedItems || []), ...(rTombs.deletedItems || [])])),
          deletedParties: Array.from(new Set([...(lTombs.deletedParties || []), ...(rTombs.deletedParties || [])]))
        };
        storage.set(STORAGE_KEYS.TOMBSTONES, mergedTombs);

        const delUsersSet = new Set(mergedTombs.deletedUsers.map(x => String(x).toLowerCase()));
        const delRanksSet = new Set(mergedTombs.deletedRanks.map(x => String(x).toLowerCase()));
        const delItemsSet = new Set(mergedTombs.deletedItems.map(x => String(x).toLowerCase()));
        const delPartiesSet = new Set(mergedTombs.deletedParties.map(x => String(x).toLowerCase()));

        // 2. Kullanıcıları birleştir
        const userMerge = this._mergeArraysById(
          storage.get(STORAGE_KEYS.USERS, []),
          remoteData.users,
          'username',
          delUsersSet
        );
        if (userMerge.changedLocal) {
          storage.set(STORAGE_KEYS.USERS, userMerge.merged);
          anyLocalChanged = true;
        }
        if (userMerge.localHasUnpushed) anyNeedsPush = true;

        // Aktif oturum varsa güncel kullanıcı verisiyle senkronize et
        const activeSession = storage.get(STORAGE_KEYS.ACTIVE_SESSION, null);
        if (activeSession && activeSession.username) {
          const activeClean = activeSession.username.toLowerCase();
          const matchedUser = userMerge.merged.find(
            u => u && u.username && u.username.toLowerCase() === activeClean
          );
          if (matchedUser) {
            const nextSession = {
              ...activeSession,
              userId: matchedUser.userId || activeSession.userId,
              rank: activeSession.isAdminSession ? 'ADMIN' : normalizeRankId(matchedUser.rank || 'MEMBER'),
              role: activeSession.isAdminSession ? 'ADMIN' : matchedUser.role || 'MEMBER',
              isModerator: Boolean(matchedUser.isModerator),
              minecraftPlayerName: matchedUser.minecraftPlayerName || '',
              avatarUrl: matchedUser.avatarUrl || activeSession.avatarUrl || '',
              emeraldBalance: Number(matchedUser.emeraldBalance || 0),
              netheriteBalance: Number(matchedUser.netheriteBalance || 0),
              extraLives: Number(matchedUser.extraLives || 0),
              points: Number(matchedUser.points || 0)
            };
            nextSession.signature = computeTokenSignature(nextSession);
            storage.set(STORAGE_KEYS.ACTIVE_SESSION, nextSession);
          }
        }

        // 3. Rütbeleri birleştir
        if (Array.isArray(remoteData.ranks) && remoteData.ranks.length > 0) {
          const rankMerge = this._mergeArraysById(
            storage.get(ECONOMY_STORAGE_KEYS.RANKS, []),
            remoteData.ranks,
            'id',
            delRanksSet
          );
          rankMerge.merged.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
          if (rankMerge.changedLocal) {
            storage.set(ECONOMY_STORAGE_KEYS.RANKS, rankMerge.merged);
            anyLocalChanged = true;
          }
          if (rankMerge.localHasUnpushed) anyNeedsPush = true;
        }

        // 4. Mağaza ürünlerini birleştir
        if (Array.isArray(remoteData.shopItems) && remoteData.shopItems.length > 0) {
          const itemMerge = this._mergeArraysById(
            storage.get(ECONOMY_STORAGE_KEYS.SHOP_ITEMS, []),
            remoteData.shopItems,
            'id',
            delItemsSet
          );
          if (itemMerge.changedLocal) {
            storage.set(ECONOMY_STORAGE_KEYS.SHOP_ITEMS, itemMerge.merged);
            anyLocalChanged = true;
          }
          if (itemMerge.localHasUnpushed) anyNeedsPush = true;
        }

        // 4b. Leaderboard Meta birleştir
        if (remoteData.leaderboardMeta && typeof remoteData.leaderboardMeta === 'object') {
          const localLbMeta = storage.get(ECONOMY_STORAGE_KEYS.LEADERBOARD_META, null);
          const rLbTime = this._parseTime(remoteData.leaderboardMeta.lastResetAt);
          const lLbTime = this._parseTime(localLbMeta?.lastResetAt);
          if (rLbTime > lLbTime) {
            storage.set(ECONOMY_STORAGE_KEYS.LEADERBOARD_META, remoteData.leaderboardMeta);
            anyLocalChanged = true;
          } else if (lLbTime > rLbTime) {
            anyNeedsPush = true;
          }
        }

        // 5. Partileri ve Davetleri birleştir
        if (Array.isArray(remoteData.parties)) {
          const partyMerge = this._mergeArraysById(
            storage.get(STORAGE_KEYS.PARTIES, []),
            remoteData.parties,
            'partyId',
            delPartiesSet
          );
          if (partyMerge.changedLocal) {
            storage.set(STORAGE_KEYS.PARTIES, partyMerge.merged);
            anyLocalChanged = true;
          }
          if (partyMerge.localHasUnpushed) anyNeedsPush = true;
        }

        if (Array.isArray(remoteData.partyInvitations)) {
          const invMerge = this._mergeArraysById(
            storage.get(STORAGE_KEYS.PARTY_INVITATIONS, []),
            remoteData.partyInvitations,
            'id'
          );
          if (invMerge.changedLocal) {
            storage.set(STORAGE_KEYS.PARTY_INVITATIONS, invMerge.merged);
            anyLocalChanged = true;
          }
          if (invMerge.localHasUnpushed) anyNeedsPush = true;
        }

        // 6. Bildirimleri birleştir
        if (remoteData.notifications && typeof remoteData.notifications === 'object') {
          const localNotifs = storage.get(STORAGE_KEYS.NOTIFICATIONS, {});
          let notifChanged = false;
          const allUserKeys = new Set([
            ...Object.keys(localNotifs || {}),
            ...Object.keys(remoteData.notifications || {})
          ]);
          const mergedNotifs = {};
          allUserKeys.forEach(uKey => {
            const lList = Array.isArray(localNotifs[uKey]) ? localNotifs[uKey] : [];
            const rList = Array.isArray(remoteData.notifications[uKey]) ? remoteData.notifications[uKey] : [];
            const byId = new Map();
            const rIds = new Set();
            lList.forEach(n => {
              if (n && n.id) byId.set(n.id, n);
            });
            rList.forEach(rn => {
              if (!rn || !rn.id) return;
              rIds.add(rn.id);
              const ln = byId.get(rn.id);
              if (!ln) {
                byId.set(rn.id, rn);
                notifChanged = true;
              } else if (rn.read && !ln.read) {
                byId.set(rn.id, { ...ln, read: true, meta: { ...(ln.meta || {}), ...(rn.meta || {}) } });
                notifChanged = true;
              } else if (
                rn.meta?.invitationStatus &&
                rn.meta.invitationStatus !== ln.meta?.invitationStatus
              ) {
                byId.set(rn.id, { ...ln, meta: { ...(ln.meta || {}), ...(rn.meta || {}) } });
                notifChanged = true;
              }
            });
            lList.forEach(ln => {
              if (ln && ln.id && !rIds.has(ln.id)) {
                anyNeedsPush = true;
              }
            });
            mergedNotifs[uKey] = Array.from(byId.values())
              .sort((a, b) => this._parseTime(b.createdAt) - this._parseTime(a.createdAt))
              .slice(0, 60);
          });
          if (notifChanged) {
            storage.set(STORAGE_KEYS.NOTIFICATIONS, mergedNotifs);
            anyLocalChanged = true;
          }
        }

        // 7. Destek, Hata ve Önerileri birleştir
        ['support', 'bugs', 'suggestions'].forEach(col => {
          const storageKey =
            col === 'support'
              ? STORAGE_KEYS.SUPPORT_TICKETS
              : col === 'bugs'
              ? STORAGE_KEYS.BUG_REPORTS
              : STORAGE_KEYS.SUGGESTIONS;
          if (Array.isArray(remoteData[col])) {
            const colMerge = this._mergeArraysById(
              storage.get(storageKey, []),
              remoteData[col],
              'id'
            );
            if (colMerge.changedLocal) {
              storage.set(storageKey, colMerge.merged);
              anyLocalChanged = true;
            }
            if (colMerge.localHasUnpushed) anyNeedsPush = true;
          }
        });

        // 7b. Platform Ayarları ve Moderatör İzinlerini birleştir
        if (remoteData.platformSettings && typeof remoteData.platformSettings === 'object') {
          const localPs = storage.get(STORAGE_KEYS.PLATFORM_SETTINGS, null);
          if (!localPs) {
            storage.set(STORAGE_KEYS.PLATFORM_SETTINGS, remoteData.platformSettings);
            anyLocalChanged = true;
          }
        }
        if (remoteData.modPermissions && typeof remoteData.modPermissions === 'object') {
          const localMp = storage.get(STORAGE_KEYS.MOD_PERMISSIONS, null);
          if (!localMp) {
            storage.set(STORAGE_KEYS.MOD_PERMISSIONS, remoteData.modPermissions);
            anyLocalChanged = true;
          }
        }

        // 8. Gemini AI Config birleştir
        if (remoteData.aiConfig && typeof remoteData.aiConfig === 'object') {
          const localAi = storage.get(STORAGE_KEYS.AI_CONFIG, null);
          const rAiTime = this._parseTime(remoteData.aiConfig.updatedAt);
          const lAiTime = this._parseTime(localAi?.updatedAt);
          if (
            !localAi ||
            rAiTime > lAiTime ||
            (remoteData.aiConfig.encryptedApiKey && !localAi.encryptedApiKey)
          ) {
            storage.set(STORAGE_KEYS.AI_CONFIG, remoteData.aiConfig);
            anyLocalChanged = true;
          } else if (lAiTime > rAiTime) {
            anyNeedsPush = true;
          }
        } else if (storage.get(STORAGE_KEYS.AI_CONFIG, null)?.encryptedApiKey) {
          anyNeedsPush = true;
        }

        // 9. Gemini AI Soru Havuzunu birleştir
        if (Array.isArray(remoteData.aiQuestions)) {
          const localQs = storage.get(STORAGE_KEYS.AI_QUESTIONS, []);
          const qMap = new Map();
          let qChanged = false;
          localQs.forEach(q => {
            if (q && q.q) qMap.set(String(q.q).trim().toLowerCase(), q);
          });
          remoteData.aiQuestions.forEach(rq => {
            if (!rq || !rq.q) return;
            const key = String(rq.q).trim().toLowerCase();
            if (!qMap.has(key)) {
              qMap.set(key, rq);
              qChanged = true;
            }
          });
          if (qChanged) {
            const mergedQs = Array.from(qMap.values()).slice(0, 250);
            storage.set(STORAGE_KEYS.AI_QUESTIONS, mergedQs);
            anyLocalChanged = true;
          }
          if (qMap.size > remoteData.aiQuestions.length) {
            anyNeedsPush = true;
          }
        }
      } finally {
        cloudSyncInternalWrite = false;
      }

      return { changedLocal: anyLocalChanged, needsPush: anyNeedsPush };
    },

    async _fetchJsonFromUrl(url) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json && typeof json === 'object' && json.data && typeof json.data === 'object') {
          return json.data;
        }
        return json;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      }
    },

    async pullFromCloud() {
      const meta = this.getMeta();
      if (meta && meta.enabled === false) return null;
      const endpoint = this.getEndpoint();

      try {
        return await this._fetchJsonFromUrl(endpoint);
      } catch (err) {
        this._lastError = err.message;
        if (endpoint !== FALLBACK_CLOUD_ENDPOINT) {
          try {
            return await this._fetchJsonFromUrl(FALLBACK_CLOUD_ENDPOINT);
          } catch (err2) {
            return null;
          }
        }
        return null;
      }
    },

    async _putJsonToUrl(url, payload) {
      const isRestfulApiDev = url.includes('restful-api.dev/objects/');
      const bodyObj = isRestfulApiDev
        ? { name: 'MCM_CLOUD_DB_V9', data: payload }
        : payload;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(bodyObj),
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      }
    },

    async pushToCloud(payloadOverride = null) {
      const meta = this.getMeta();
      if (meta && meta.enabled === false) return false;
      const endpoint = this.getEndpoint();
      const payload = payloadOverride || this._buildLocalPayload();

      try {
        await this._putJsonToUrl(endpoint, payload);
        this._lastSyncAt = new Date().toISOString();
        this._lastError = null;
        return true;
      } catch (err) {
        this._lastError = err.message;
        if (endpoint !== FALLBACK_CLOUD_ENDPOINT) {
          try {
            await this._putJsonToUrl(FALLBACK_CLOUD_ENDPOINT, payload);
            this._lastSyncAt = new Date().toISOString();
            this._lastError = null;
            return true;
          } catch (err2) {
            return false;
          }
        }
        return false;
      }
    },

    async syncNow() {
      if (this._syncPromise) {
        return await this._syncPromise;
      }
      this._isSyncing = true;
      this._syncPromise = (async () => {
        try {
          const remoteData = await this.pullFromCloud();
          if (remoteData) {
            const { changedLocal, needsPush } = this._mergeAndSave(remoteData);
            this._lastSyncAt = new Date().toISOString();
            if (needsPush) {
              await this.pushToCloud();
            }
            if (changedLocal && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('mcm:cloud-synced', {
                  detail: { syncedAt: this._lastSyncAt }
                })
              );
            }
            return true;
          } else {
            // Uzak sunucu henüz boşsa yerel veriyi gönder
            await this.pushToCloud();
            return true;
          }
        } finally {
          this._isSyncing = false;
          this._syncPromise = null;
        }
      })();
      return await this._syncPromise;
    },

    async pullAndMerge(force = false) {
      return await this.syncNow();
    },

    async pushNow() {
      if (this._pushTimer) {
        clearTimeout(this._pushTimer);
        this._pushTimer = null;
      }
      if (this._syncPromise) {
        try {
          await this._syncPromise;
        } catch (e) {
          // ignore prior sync error and proceed with push
        }
      }
      this._isSyncing = true;
      this._syncPromise = (async () => {
        try {
          const remoteData = await this.pullFromCloud();
          if (remoteData) {
            const { changedLocal } = this._mergeAndSave(remoteData);
            if (changedLocal && typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('mcm:cloud-synced', {
                  detail: { syncedAt: new Date().toISOString() }
                })
              );
            }
          }
          return await this.pushToCloud();
        } finally {
          this._isSyncing = false;
          this._syncPromise = null;
        }
      })();
      return await this._syncPromise;
    },

    schedulePush(delayMs = 300) {
      if (this._pushTimer) clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(() => {
        this._pushTimer = null;
        this.pushNow().catch(() => {});
      }, delayMs);
    },

    getStatus() {
      const meta = this.getMeta();
      return {
        enabled: meta?.enabled !== false,
        endpoint: this.getEndpoint(),
        lastSyncAt: this._lastSyncAt || meta?.lastSyncAt || null,
        lastError: this._lastError,
        isSyncing: this._isSyncing
      };
    },

    init() {
      if (typeof window === 'undefined') return;
      // Başlangıçta hemen buluttan çek ve eşitle
      setTimeout(() => {
        this.syncNow().catch(() => {});
      }, 60);

      // Her 10 saniyede bir arka planda senkronize et
      if (!this._pollInterval) {
        this._pollInterval = setInterval(() => {
          this.syncNow().catch(() => {});
        }, 10000);
      }

      // Sekmeye geri dönüldüğünde anında senkronize et
      window.addEventListener('focus', () => {
        this.syncNow().catch(() => {});
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncNow().catch(() => {});
        }
      });
    }
  };

  // ==========================================
  // GEMINI YAPAY ZEKA SORU ÜRETİCİ SERVİSİ (aiQuestionService)
  // Yalnızca Yönetici Panelinden girilen Gemini API anahtarını kullanır.
  // Normal oyuncuların API anahtarı girmesine gerek yoktur; üretilen sorular
  // bulut havuzuna kaydedilir ve tüm oyunculara farklı sorular sunulur.
  // ==========================================
  const DEFAULT_AI_CONFIG = {
    encryptedApiKey: '',
    model: 'gemini-3.8-flash',
    batchSize: 15,
    enabled: true,
    autoGenerateOnGameStart: true,
    autoGenerateBeforeMatch: true,
    lastGeneratedAt: null,
    updatedAt: null
  };

  function encodeObfuscatedKey(plainKey) {
    const raw = String(plainKey || '').trim();
    if (!raw) return '';
    const salt = `${AUTH_SALT}_GEMINI_KEY_SHIELD`;
    const bytes = [];
    for (let i = 0; i < raw.length; i++) {
      bytes.push(raw.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    try {
      return btoa(String.fromCharCode(...bytes));
    } catch (e) {
      return '';
    }
  }

  function decodeObfuscatedKey(encodedKey) {
    const raw = String(encodedKey || '').trim();
    if (!raw) return '';
    const salt = `${AUTH_SALT}_GEMINI_KEY_SHIELD`;
    try {
      const bin = atob(raw);
      let out = '';
      for (let i = 0; i < bin.length; i++) {
        out += String.fromCharCode(bin.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
      }
      return out;
    } catch (e) {
      return '';
    }
  }

  function normalizeQuestionKey(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü]/gi, '');
  }

  const aiQuestionService = {
    _isGenerating: false,

    getConfig() {
      const saved = storage.get(STORAGE_KEYS.AI_CONFIG, null);
      return {
        ...DEFAULT_AI_CONFIG,
        ...(saved || {})
      };
    },

    _getDecryptedApiKey() {
      const cfg = this.getConfig();
      return decodeObfuscatedKey(cfg.encryptedApiKey);
    },

    isConfigured() {
      const key = this._getDecryptedApiKey();
      return Boolean(key && key.length >= 16);
    },

    hasConfiguredApiKey() {
      return this.isConfigured();
    },

    getPublicStatus() {
      const cfg = this.getConfig();
      const key = this._getDecryptedApiKey();
      const hasKey = Boolean(key && key.length >= 16);
      const maskedKey = hasKey
        ? `${key.slice(0, 6)}••••••••••••••••••••${key.slice(-4)}`
        : '';
      const pool = this.getAllAiQuestions();
      return {
        configured: hasKey,
        hasKey,
        maskedKey,
        model: cfg.model || 'gemini-3.8-flash',
        batchSize: Number(cfg.batchSize || 15),
        enabled: cfg.enabled !== false,
        autoGenerateOnGameStart: cfg.autoGenerateOnGameStart !== false,
        autoGenerateBeforeMatch:
          cfg.autoGenerateBeforeMatch !== undefined
            ? cfg.autoGenerateBeforeMatch !== false
            : cfg.autoGenerateOnGameStart !== false,
        lastGeneratedAt: cfg.lastGeneratedAt || null,
        updatedAt: cfg.updatedAt || null,
        totalPoolCount: pool.length,
        poolCount: pool.length,
        easyCount: pool.filter(q => q.difficulty === 'easy').length,
        mediumCount: pool.filter(q => q.difficulty === 'medium').length,
        hardCount: pool.filter(q => q.difficulty === 'hard').length,
        isGenerating: this._isGenerating
      };
    },

    getAdminViewConfig(session) {
      const status = this.getPublicStatus();
      const isAdmin = Boolean(session && (session.role === 'ADMIN' || session.rank === 'ADMIN'));
      return {
        ...status,
        apiKey: isAdmin ? this._getDecryptedApiKey() : status.maskedKey
      };
    },

    updateConfig(
      session,
      { apiKey, model, batchSize, enabled, autoGenerateOnGameStart, autoGenerateBeforeMatch } = {}
    ) {
      authGuard.requireRole(session, ['ADMIN']);
      const current = this.getConfig();
      let nextEncryptedKey = current.encryptedApiKey;

      if (apiKey === '__CLEAR__') {
        nextEncryptedKey = '';
      } else if (typeof apiKey === 'string' && apiKey.trim() && !apiKey.includes('•')) {
        nextEncryptedKey = encodeObfuscatedKey(apiKey.trim());
      }

      const resolvedAutoGen =
        autoGenerateBeforeMatch !== undefined
          ? Boolean(autoGenerateBeforeMatch)
          : autoGenerateOnGameStart !== undefined
          ? Boolean(autoGenerateOnGameStart)
          : current.autoGenerateOnGameStart !== false;

      const next = {
        ...current,
        encryptedApiKey: nextEncryptedKey,
        model: String(model || current.model || 'gemini-3.8-flash').trim(),
        batchSize: Math.max(3, Math.min(30, Number(batchSize || current.batchSize || 15))),
        enabled: enabled !== undefined ? Boolean(enabled) : current.enabled !== false,
        autoGenerateOnGameStart: resolvedAutoGen,
        autoGenerateBeforeMatch: resolvedAutoGen,
        updatedAt: nextMonotonicIso(current.updatedAt)
      };

      storage.set(STORAGE_KEYS.AI_CONFIG, next);
      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `Yönetici ${session.username} Gemini AI Soru Üretici yapılandırmasını güncelledi.`
      );
      cloudSyncService.pushNow().catch(() => {});
      return this.getPublicStatus();
    },

    getAllAiQuestions() {
      const list = storage.get(STORAGE_KEYS.AI_QUESTIONS, []);
      return Array.isArray(list) ? list : [];
    },

    getAiQuestionPool() {
      return this.getAllAiQuestions();
    },

    getQuestionsByDifficulty(difficulty) {
      return this.getAllAiQuestions().filter(q => q && q.difficulty === difficulty);
    },

    getAiQuestionsByDifficulty(difficulty) {
      return this.getQuestionsByDifficulty(difficulty);
    },

    getSeenQuestions() {
      const list = storage.get(STORAGE_KEYS.SEEN_QUESTIONS, []);
      return new Set(Array.isArray(list) ? list : []);
    },

    getSeenQuestionKeys() {
      const list = storage.get(STORAGE_KEYS.SEEN_QUESTIONS, []);
      const arr = Array.isArray(list) ? list : [];
      return new Set(arr.map(x => normalizeQuestionKey(x)));
    },

    markQuestionsSeen(questions = []) {
      if (!Array.isArray(questions) || questions.length === 0) return;
      const seenList = storage.get(STORAGE_KEYS.SEEN_QUESTIONS, []);
      const safeList = Array.isArray(seenList) ? [...seenList] : [];
      questions.forEach(q => {
        const text = String(q?.q || q?.question || q || '').trim();
        if (text && !safeList.includes(text)) {
          safeList.push(text);
        }
      });
      // Son 180 görülen soruyu tut, taşarsa eskileri sil ki döngü tazelensin
      while (safeList.length > 180) {
        safeList.shift();
      }
      storage.set(STORAGE_KEYS.SEEN_QUESTIONS, safeList);
    },

    clearAiQuestionPool(session) {
      authGuard.requireRole(session, ['ADMIN']);
      storage.set(STORAGE_KEYS.AI_QUESTIONS, []);
      cloudSyncService.pushNow().catch(() => {});
      return true;
    },

    clearAiQuestions(session) {
      return this.clearAiQuestionPool(session);
    },

    async _callGeminiRaw(apiKey, preferredModel, promptText) {
      const modelsToTry = Array.from(
        new Set([
          preferredModel || 'gemini-3.8-flash',
          'gemini-3.8-flash',
          'gemini-2.5-flash',
          'gemini-2.0-flash'
        ])
      );

      let lastErr = null;

      // 1. Önce Interactions API uç noktasını dene (gemini-3.8-flash için önerilen)
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            model: modelsToTry[0],
            input: promptText,
            generation_config: {
              temperature: 0.85
            }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
          const textOut = outputs.find(o => o.type === 'text' && o.text)?.text;
          if (textOut) return textOut;
        }
      } catch (e) {
        lastErr = e;
      }

      // 2. Standart generateContent REST uç noktası (tüm Google AI Studio anahtarlarıyla %100 uyumlu)
      for (const mdl of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            mdl
          )}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.9,
                responseMimeType: 'application/json'
              }
            })
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            lastErr = new Error(
              errJson?.error?.message || `Gemini API Hatası (${mdl}: HTTP ${res.status})`
            );
            continue;
          }
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        } catch (err) {
          lastErr = err;
        }
      }

      throw lastErr || new Error('Gemini API yanıt vermedi. Lütfen API anahtarınızı kontrol edin.');
    },

    _parseQuestionsJson(rawText) {
      const cleaned = String(rawText || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsed = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];

      const valid = [];
      arr.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const diff = ['easy', 'medium', 'hard'].includes(String(item.difficulty || '').toLowerCase())
          ? String(item.difficulty).toLowerCase()
          : 'medium';
        const q = String(item.q || item.question || '').trim();
        const options = Array.isArray(item.options)
          ? item.options.map(o => String(o || '').trim()).filter(Boolean)
          : [];
        const answer = Number(item.answer ?? item.correct);
        const explanation = String(item.explanation || '').trim();

        if (
          q.length >= 10 &&
          options.length === 4 &&
          Number.isInteger(answer) &&
          answer >= 0 &&
          answer <= 3
        ) {
          valid.push({
            id: generateId('AIQ'),
            difficulty: diff,
            q,
            options,
            answer,
            explanation: explanation || 'Minecraft bilgi yarışması özel sorusu.',
            createdAt: new Date().toISOString()
          });
        }
      });

      return valid;
    },

    async generateQuestionsBatch({ count = 9, excludeQuestions = [] } = {}) {
      const cfg = this.getConfig();
      const apiKey = this._getDecryptedApiKey();
      if (!apiKey || apiKey.length < 16) {
        throw new Error('Yönetici Panelinde kayıtlı geçerli bir Gemini API anahtarı bulunamadı.');
      }
      if (this._isGenerating) {
        const currentPool = this.getAllAiQuestions();
        const emptyArr = [];
        emptyArr.addedCount = 0;
        emptyArr.totalPool = currentPool.length;
        return emptyArr;
      }

      this._isGenerating = true;
      try {
        const existingPool = this.getAllAiQuestions();
        const recentSample = [
          ...excludeQuestions.slice(0, 15),
          ...existingPool.slice(0, 20).map(x => x.q)
        ].filter(Boolean);

        const perTier = Math.max(1, Math.floor((count || cfg.batchSize || 9) / 3));
        const prompt = `Sen profesyonel bir "Minecraft Kim Milyoner Olmak İster" yarışması soru yazarısın.
Bana tamamen Türkçe, özgün, doğru ve daha önce sorulmamış ${perTier * 3} adet Minecraft bilgi yarışması sorusu üret:
- ${perTier} adet "easy" (kolay: temel bloklar, yaratıklar, çalışma masası, madenler, hayatta kalma)
- ${perTier} adet "medium" (orta: iksirler, büyüler, Nether, End, köylü meslekleri, yapılar, biyomlar)
- ${perTier} adet "hard" (zor: teknik mekanikler, Redstone, nadir olasılıklar, güncelleme detayları, hız koşusu ve derin oyun mekanikleri)

Şu sorulardan tamamen FARKLI konular seç:
${recentSample.map(s => `- ${s}`).join('\n')}

Yanıtını SADECE geçerli bir JSON dizisi (Array) olarak döndür. Her eleman şu şemada olmalı:
[
  {
    "difficulty": "easy" | "medium" | "hard",
    "q": "Soru metni?",
    "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"],
    "answer": 0,
    "explanation": "Kısa ve net Türkçe açıklama"
  }
]`;

        const rawResponse = await this._callGeminiRaw(apiKey, cfg.model, prompt);
        const generated = this._parseQuestionsJson(rawResponse);
        if (generated.length === 0) {
          throw new Error('Gemini API yanıtından geçerli soru ayrıştırılamadı.');
        }

        const currentPool = this.getAllAiQuestions();
        const existingSet = new Set(currentPool.map(item => String(item.q).trim().toLowerCase()));
        const added = [];

        generated.forEach(item => {
          const key = item.q.toLowerCase();
          if (!existingSet.has(key)) {
            existingSet.add(key);
            currentPool.unshift(item);
            added.push(item);
          }
        });

        if (currentPool.length > 250) currentPool.length = 250;
        storage.set(STORAGE_KEYS.AI_QUESTIONS, currentPool);

        const prevCfg = this.getConfig();
        const nextCfg = {
          ...prevCfg,
          lastGeneratedAt: new Date().toISOString(),
          updatedAt: nextMonotonicIso(prevCfg.updatedAt)
        };
        storage.set(STORAGE_KEYS.AI_CONFIG, nextCfg);

        cloudSyncService.schedulePush(200);
        added.addedCount = added.length;
        added.totalPool = currentPool.length;
        return added;
      } finally {
        this._isGenerating = false;
      }
    },

    async ensureFreshQuestionsForMatch(gameState) {
      const cfg = this.getConfig();
      if (!cfg.enabled || !cfg.autoGenerateOnGameStart || !this.isConfigured()) {
        return;
      }
      try {
        const currentQs = Array.isArray(gameState?.questions)
          ? gameState.questions.map(q => q.q)
          : [];
        const newQuestions = await this.generateQuestionsBatch({
          count: 6,
          excludeQuestions: currentQs
        });
        if (!gameState || !gameState.active || !Array.isArray(gameState.questions)) return;

        // Henüz oyuncuya gösterilmemiş ileriki sorulara yeni üretilen Gemini sorularını canlı enjekte et
        newQuestions.forEach(nq => {
          const tierStart =
            nq.difficulty === 'easy' ? 0 : nq.difficulty === 'medium' ? 5 : 10;
          const tierEnd = tierStart + 4;
          for (let idx = tierEnd; idx >= tierStart; idx--) {
            if (idx > gameState.currentIndex + 1 && gameState.questions[idx] && !gameState.questions[idx]._liveInjected) {
              // Şıkları karıştırarak yerleştir
              const indexed = nq.options.map((text, i) => ({
                text,
                correct: i === nq.answer
              }));
              for (let i = indexed.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
              }
              gameState.questions[idx] = {
                ...nq,
                options: indexed.map(m => m.text),
                answer: indexed.findIndex(m => m.correct),
                _liveInjected: true
              };
              break;
            }
          }
        });
      } catch (err) {
        // Arka plan üretim hatası oyunu kesintiye uğratmaz
      }
    }
  };

  // Bulut senkronizasyonunu başlat
  cloudSyncService.init();

  window.MCMServices = Object.assign(window.MCMServices || {}, {
    mcIconService,
    activityService,
    authGuard,
    avatarService,
    notificationService,
    userService,
    authService,
    partyService,
    supportService,
    bugService,
    suggestionService,
    paymentService,
    backupService,
    cloudSyncService,
    aiQuestionService
  });
})(window);

