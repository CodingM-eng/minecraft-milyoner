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
    FIRST_PREMIUM_NETHERITE_GRANTED: 'mc_millionaire_tr_first_netherite_v6'
  };

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

  // ==========================================
  // ÖZEL MINECRAFT ZÜMRÜT, NETHERITE VE 3 ÇİZGİLİ MENÜ SVG SERVİSİ (#10, #12)
  // ==========================================
  const mcIconService = {
    getEmeraldSvg(size = 18) {
      return `<svg class="mc-currency-svg mc-emerald-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><path d="M5 1H11V2H12V4H13V12H12V14H11V15H5V14H4V12H3V4H4V2H5V1Z" fill="#064E20"/><path d="M6 2H10V3H11V5H12V11H11V13H10V14H6V13H5V11H4V5H5V3H6V2Z" fill="#17DD62"/><path d="M6 3H9V4H10V6H6V3Z" fill="#86FFAC"/><path d="M5 5H6V10H5V5Z" fill="#86FFAC"/><path d="M7 6H10V11H7V6Z" fill="#12B84F"/><path d="M6 11H10V13H6V11Z" fill="#0B8435"/></svg>`;
    },

    getNetheriteSvg(size = 18, stackCount = 1) {
      const badge =
        stackCount > 1 ? `<span class="netherite-stack-count">×${stackCount}</span>` : '';
      return `<span class="mc-netherite-icon-wrap" style="display:inline-flex;align-items:center;position:relative;vertical-align:middle;"><svg class="mc-currency-svg mc-netherite-svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true" style="display:inline-block;vertical-align:middle;image-rendering:pixelated;"><rect x="2" y="4" width="12" height="8" fill="#231D22"/><rect x="3" y="5" width="10" height="6" fill="#3B3339"/><rect x="2" y="6" width="12" height="4" fill="#4D434B"/><rect x="4" y="4" width="8" height="2" fill="#685D66"/><rect x="4" y="6" width="7" height="1" fill="#887A85"/><rect x="3" y="9" width="9" height="2" fill="#2B2429"/><rect x="5" y="7" width="5" height="2" fill="#5D515A"/><rect x="11" y="5" width="1" height="2" fill="#9E8F9B"/></svg>${badge}</span>`;
    },

    getHamburgerSvg() {
      return `<svg class="mc-hamburger-svg" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true"><rect class="hb-line hb-line-1" x="2" y="4" width="16" height="2.5" fill="currentColor"/><rect class="hb-line hb-line-2" x="2" y="9" width="16" height="2.5" fill="currentColor"/><rect class="hb-line hb-line-3" x="2" y="14" width="16" height="2.5" fill="currentColor"/></svg>`;
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
    return RANK_ALIASES[key] || 'MEMBER';
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
        if (rankId === 'MODERATOR') {
          const modPerms = this.getModeratorPermissions();
          return { ...basePerms, ...modPerms };
        }
        return basePerms;
      }
      const isRanked = rankId !== 'MEMBER';
      return {
        canCreateParty: isRanked,
        canInvitePlayers: isRanked,
        maxPartySize: rankId === 'ADMIN' ? 999 : isRanked ? 8 : 0,
        emeraldMultiplier: rankId === 'ADMIN' ? 3.0 : isRanked ? 1.5 : 1.0,
        dailyNetherite: ['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(rankId) ? 15 : 0
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
      return Array.isArray(list) ? list.filter(u => !u.isDemo) : [];
    },

    _saveAllUsers(users) {
      storage.set(STORAGE_KEYS.USERS, users);
    },

    getUserByUsername(username) {
      if (!username) return null;
      const clean = String(username).trim().toLowerCase();
      return this.getAllUsers().find(u => u.username.toLowerCase() === clean) || null;
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
        updatedAt: new Date().toISOString()
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

      const users = this.getAllUsers();
      const filtered = users.filter(u => u.username.toLowerCase() !== clean);
      this._saveAllUsers(filtered);

      activityService.log(
        'ADMIN_ACTION',
        session.username,
        `Yönetici ${session.username}, "${targetUsername}" hesabını sildi.`
      );
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

      return this.syncUserFields(user.username, {
        gamesPlayed: nextPlayed,
        gamesWon: nextWon,
        gamesLost: nextLost,
        points: nextPoints,
        bestScore: nextBest
      });
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
      return session;
    },

    async login({ username, password }) {
      const cleanUser = String(username || '').trim();
      const rawPass = String(password || '');

      if (!cleanUser || !rawPass) {
        throw new Error('Lütfen kullanıcı adınızı ve şifrenizi girin.');
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

    getActivePartyForUser(username) {
      if (!username) return null;
      const clean = String(username).trim().toLowerCase();
      return (
        this.getAllParties().find(
          p =>
            p.status !== 'CLOSED' &&
            Array.isArray(p.members) &&
            p.members.some(m => m.username.toLowerCase() === clean)
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
        if (inv.status === 'PENDING' && inv.expiresAt && new Date(inv.expiresAt).getTime() < now) {
          inv.status = 'EXPIRED';
          changed = true;
        }
      });
      if (changed) this._saveAllInvitations(invites);

      return invites.filter(
        inv => inv.recipientUsername.toLowerCase() === clean && inv.status === 'PENDING'
      );
    },

    createParty(session, partyName) {
      authGuard.verifySession(session);
      const perms = authGuard.getUserPermissions(session);
      if (!perms.canCreateParty && !session.isAdminSession) {
        throw new Error('Parti oluşturmak için en az VIP rütbesine sahip olmalısınız!');
      }

      const cleanName = String(partyName || '').trim();
      if (!cleanName || cleanName.length < 3) {
        throw new Error('Parti adı en az 3 karakter olmalıdır.');
      }

      const existing = this.getActivePartyForUser(session.username);
      if (existing) {
        throw new Error(`Zaten "${existing.partyName}" adlı bir partidesiniz!`);
      }

      const existingCodes = new Set(this.getAllParties().map(p => p.partyCode));
      let partyCode = '';
      do {
        partyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      } while (partyCode.length < 6 || existingCodes.has(partyCode));

      const newParty = {
        partyId: generateId('PRT'),
        partyCode,
        partyName: cleanName,
        leaderUsername: session.username,
        maxMembers: Number(perms.maxPartySize || 8),
        status: 'LOBBY',
        members: [
          {
            username: session.username,
            joinedAt: new Date().toISOString(),
            score: 0
          }
        ],
        createdAt: new Date().toISOString()
      };

      const parties = this.getAllParties();
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
      const cleanCode = String(partyCode || '')
        .trim()
        .toUpperCase();
      if (!cleanCode) {
        throw new Error('Geçersiz parti kodu.');
      }

      const parties = this.getAllParties();
      const matchingParties = parties.filter(p => p.partyCode === cleanCode);
      if (matchingParties.length === 0) {
        throw new Error('Geçersiz parti kodu.');
      }

      const activeParty = matchingParties.find(p => p.status !== 'CLOSED');
      if (!activeParty) {
        throw new Error('Bu parti artık aktif değil.');
      }

      const alreadyIn = activeParty.members.some(
        m => m.username.toLowerCase() === session.username.toLowerCase()
      );
      if (alreadyIn) return activeParty;

      if (activeParty.members.length >= (activeParty.maxMembers || 8)) {
        throw new Error('Bu parti dolu.');
      }

      // Kullanıcının başka aktif partisi varsa ondan çıkar
      parties.forEach(p => {
        if (p.partyId !== activeParty.partyId && p.status !== 'CLOSED') {
          p.members = p.members.filter(
            m => m.username.toLowerCase() !== session.username.toLowerCase()
          );
          if (p.members.length === 0) p.status = 'CLOSED';
        }
      });

      activeParty.members.push({
        username: session.username,
        joinedAt: new Date().toISOString(),
        score: 0
      });
      this._saveAllParties(parties);

      // Bu oyuncuya ait bekleyen davet varsa ACCEPTED işaretle
      const invites = this.getAllInvitations();
      invites.forEach(inv => {
        if (
          inv.partyId === activeParty.partyId &&
          inv.recipientUsername.toLowerCase() === session.username.toLowerCase() &&
          inv.status === 'PENDING'
        ) {
          inv.status = 'ACCEPTED';
        }
      });
      this._saveAllInvitations(invites);

      // Odadaki diğer üyelere bildirim gönder
      activeParty.members.forEach(m => {
        if (m.username.toLowerCase() !== session.username.toLowerCase()) {
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
     * Doğrulamalar:
     * - Kendini davet edemez
     * - Var olmayan oyuncuyu davet edemez
     * - Zaten partide olanı davet edemez
     * - Dolu partiye davet gönderemez
     * - Aynı oyuncuya mükerrer aktif davet gönderemez
     */
    invitePlayerToParty(session, partyId, targetUsername) {
      authGuard.verifySession(session);
      const cleanTarget = String(targetUsername || '').trim();
      if (!cleanTarget) {
        throw new Error('Lütfen davet edilecek oyuncunun adını girin.');
      }

      if (cleanTarget.toLowerCase() === session.username.toLowerCase()) {
        throw new Error('Kendinizi partiye davet edemezsiniz.');
      }

      const targetUser = userService.getUserByUsername(cleanTarget);
      if (!targetUser) {
        throw new Error(`"${cleanTarget}" adında kayıtlı bir oyuncu bulunamadı.`);
      }

      const party = this.getAllParties().find(p => p.partyId === partyId);
      if (!party || party.status === 'CLOSED') {
        throw new Error('Bu parti artık aktif değil.');
      }

      const isLeader = party.leaderUsername.toLowerCase() === session.username.toLowerCase();
      const perms = authGuard.getUserPermissions(session);
      if (!isLeader && !perms.canInvitePlayers && !session.isAdminSession) {
        throw new Error('Bu partiye oyuncu davet etme yetkiniz bulunmuyor.');
      }

      if (party.members.length >= (party.maxMembers || 8)) {
        throw new Error('Bu parti dolu.');
      }

      if (
        party.members.some(m => m.username.toLowerCase() === targetUser.username.toLowerCase())
      ) {
        throw new Error(`${targetUser.username} zaten bu partide yer alıyor.`);
      }

      const invites = this.getAllInvitations();
      const now = Date.now();
      const duplicate = invites.find(
        inv =>
          inv.partyId === party.partyId &&
          inv.recipientUsername.toLowerCase() === targetUser.username.toLowerCase() &&
          inv.status === 'PENDING' &&
          (!inv.expiresAt || new Date(inv.expiresAt).getTime() > now)
      );
      if (duplicate) {
        throw new Error(`${targetUser.username} oyuncusuna zaten aktif bir davet gönderildi.`);
      }

      const invitation = {
        id: generateId('INV'),
        partyId: party.partyId,
        partyCode: party.partyCode,
        partyName: party.partyName,
        inviterUsername: session.username,
        recipientUsername: targetUser.username,
        status: 'PENDING',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + this.INVITE_TTL_MS).toISOString()
      };

      invites.unshift(invitation);
      this._saveAllInvitations(invites);

      const notif = notificationService.notifyUser(targetUser.username, {
        type: 'PARTY_INVITE',
        title: 'Parti Daveti',
        message: `${session.username} sizi bir partiye davet etti.`,
        meta: {
          invitationId: invitation.id,
          partyId: party.partyId,
          partyCode: party.partyCode,
          partyName: party.partyName,
          fromUsername: session.username,
          invitationStatus: 'PENDING'
        }
      });

      invitation.notificationId = notif?.id || null;
      this._saveAllInvitations(invites);

      activityService.log(
        'PARTY_INVITE',
        session.username,
        `${session.username}, ${targetUser.username} oyuncusuna "${party.partyName}" (${party.partyCode}) parti daveti gönderdi.`
      );

      return invitation;
    },

    /**
     * #5: Parti Davetini Kabul Et ([ Kabul Et ])
     */
    acceptPartyInvitation(session, invitationId) {
      authGuard.verifySession(session);
      const invites = this.getAllInvitations();
      const inv = invites.find(i => i.id === invitationId);

      if (!inv) {
        throw new Error('Parti daveti bulunamadı.');
      }
      if (inv.recipientUsername.toLowerCase() !== session.username.toLowerCase()) {
        throw new Error('Bu parti daveti size ait değil.');
      }
      if (inv.status === 'ACCEPTED') {
        throw new Error('Bu parti davetini zaten kabul ettiniz.');
      }
      if (inv.status === 'REJECTED') {
        throw new Error('Reddedilmiş bir parti daveti kabul edilemez.');
      }
      if (
        inv.status === 'EXPIRED' ||
        (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())
      ) {
        inv.status = 'EXPIRED';
        this._saveAllInvitations(invites);
        throw new Error('Bu parti davetinin süresi dolmuş.');
      }

      const parties = this.getAllParties();
      const party = parties.find(p => p.partyId === inv.partyId);
      if (!party || party.status === 'CLOSED') {
        inv.status = 'EXPIRED';
        this._saveAllInvitations(invites);
        throw new Error('Bu parti artık aktif değil.');
      }

      if (
        !party.members.some(m => m.username.toLowerCase() === session.username.toLowerCase()) &&
        party.members.length >= (party.maxMembers || 8)
      ) {
        throw new Error('Bu parti dolu.');
      }

      // Kullanıcının başka aktif partisi varsa ondan çıkar
      parties.forEach(p => {
        if (p.partyId !== party.partyId && p.status !== 'CLOSED') {
          p.members = p.members.filter(
            m => m.username.toLowerCase() !== session.username.toLowerCase()
          );
          if (p.members.length === 0) p.status = 'CLOSED';
        }
      });

      if (!party.members.some(m => m.username.toLowerCase() === session.username.toLowerCase())) {
        party.members.push({
          username: session.username,
          joinedAt: new Date().toISOString(),
          score: 0
        });
      }
      this._saveAllParties(parties);

      inv.status = 'ACCEPTED';
      inv.respondedAt = new Date().toISOString();
      this._saveAllInvitations(invites);

      if (inv.notificationId) {
        notificationService.updateNotificationMeta(session.username, inv.notificationId, {
          invitationStatus: 'ACCEPTED'
        });
      }

      notificationService.notifyUser(inv.inviterUsername, {
        type: 'PARTY_UPDATE',
        title: '🎉 Parti Daveti Kabul Edildi',
        message: `${session.username} parti davetinizi kabul etti ve "${party.partyName}" odasına katıldı!`
      });

      activityService.log(
        'PARTY_INVITE_ACCEPT',
        session.username,
        `${session.username}, ${inv.inviterUsername} tarafından gönderilen "${party.partyName}" davetini kabul etti.`
      );

      return party;
    },

    /**
     * #5: Parti Davetini Reddet ([ Reddet ])
     */
    rejectPartyInvitation(session, invitationId) {
      authGuard.verifySession(session);
      const invites = this.getAllInvitations();
      const inv = invites.find(i => i.id === invitationId);

      if (!inv) {
        throw new Error('Parti daveti bulunamadı.');
      }
      if (inv.recipientUsername.toLowerCase() !== session.username.toLowerCase()) {
        throw new Error('Bu parti daveti size ait değil.');
      }
      if (inv.status !== 'PENDING') {
        throw new Error('Bu davet zaten yanıtlanmış.');
      }

      inv.status = 'REJECTED';
      inv.respondedAt = new Date().toISOString();
      this._saveAllInvitations(invites);

      if (inv.notificationId) {
        notificationService.updateNotificationMeta(session.username, inv.notificationId, {
          invitationStatus: 'REJECTED'
        });
      }

      notificationService.notifyUser(inv.inviterUsername, {
        type: 'PARTY_UPDATE',
        title: 'Parti Daveti Reddedildi',
        message: `${session.username}, "${inv.partyName}" parti davetinizi reddetti.`
      });

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
      const party = parties.find(p => p.partyId === partyId);
      if (!party || party.status === 'CLOSED') {
        throw new Error('Bu parti artık aktif değil.');
      }

      if (
        party.leaderUsername.toLowerCase() !== session.username.toLowerCase() &&
        !session.isAdminSession
      ) {
        throw new Error('Yalnızca parti lideri oyuncu çıkarabilir.');
      }

      party.members = party.members.filter(
        m => m.username.toLowerCase() !== String(targetUsername).trim().toLowerCase()
      );
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
      const party = parties.find(p => p.partyId === partyId);
      if (!party) return true;

      party.members = party.members.filter(
        m => m.username.toLowerCase() !== session.username.toLowerCase()
      );

      if (party.members.length === 0) {
        party.status = 'CLOSED';
      } else if (party.leaderUsername.toLowerCase() === session.username.toLowerCase()) {
        party.leaderUsername = party.members[0].username;
        notificationService.notifyUser(party.leaderUsername, {
          type: 'PARTY_UPDATE',
          title: '👑 Yeni Parti Liderisiniz',
          message: `"${party.partyName}" partisinde liderlik size devredildi.`
        });
      }

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
      const party = parties.find(p => p.partyId === partyId && p.status !== 'CLOSED');
      if (!party) throw new Error('Bu parti artık aktif değil.');

      if (
        party.leaderUsername.toLowerCase() !== session.username.toLowerCase() &&
        !session.isAdminSession
      ) {
        throw new Error('Yalnızca parti lideri maçı başlatabilir.');
      }

      party.status = 'IN_GAME';
      this._saveAllParties(parties);

      party.members.forEach(m => {
        if (m.username.toLowerCase() !== session.username.toLowerCase()) {
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

      parties.forEach(p => {
        if (p.status !== 'CLOSED') {
          const member = p.members.find(m => m.username.toLowerCase() === clean);
          if (member) {
            member.score = Math.max(Number(member.score || 0), Number(scoreEarned || 0));
            updated = true;
          }
        }
      });

      if (updated) this._saveAllParties(parties);
    },

    adminCloseParty(session, partyId) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const parties = this.getAllParties();
      const party = parties.find(p => p.partyId === partyId);
      if (!party) throw new Error('Parti bulunamadı.');
      party.status = 'CLOSED';
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
  // Alanlar: Başlık, Açıklama, Kategori, Screenshot, Related party
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

      const bugs = this.getAllBugs();
      const report = {
        id: generateId('BUG'),
        username: session.username,
        title: cleanTitle,
        category: String(category),
        severity: String(severity),
        description: cleanDesc,
        screenshot: String(screenshot || '').trim(),
        relatedParty: String(relatedParty || '').trim().toUpperCase(),
        status: 'OPEN',
        adminNote: '',
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

    adminUpdateBug(session, bugId, { status = 'ÇÖZÜLDÜ', adminNote = '' }) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const bugs = this.getAllBugs();
      const bug = bugs.find(b => b.id === bugId);
      if (!bug) throw new Error('Hata kaydı bulunamadı.');

      bug.status = status;
      if (adminNote !== undefined) bug.adminNote = String(adminNote).trim();
      storage.set(STORAGE_KEYS.BUG_REPORTS, bugs);

      notificationService.notifyUser(bug.username, {
        type: 'BUG_REPORT_REPLY',
        title: '🐞 Hata Bildiriminiz Güncellendi',
        message: `"${bug.title}" hata kaydınızın durumu [${bug.status}] olarak güncellendi.${
          bug.adminNote ? ` Yönetici Notu: ${bug.adminNote}` : ''
        }`
      });

      activityService.log(
        'BUG_RESOLVE',
        session.username,
        `Hata bildirimi güncellendi (#${bug.id} -> ${bug.status}).`
      );
      return bug;
    }
  };

  // ==========================================
  // ÖNERİ SERVİSİ (suggestionService — #18)
  // Alanlar: Başlık, Açıklama, Kategori
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

      const list = this.getAllSuggestions();
      const item = {
        id: generateId('SUG'),
        username: session.username,
        category: String(category),
        title: cleanTitle,
        details: cleanDetails,
        status: 'İNCELENİYOR',
        adminNote: '',
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
      item.upvotes = (item.upvotes || []).filter(x => x.toLowerCase() !== u.toLowerCase());
      item.downvotes = (item.downvotes || []).filter(x => x.toLowerCase() !== u.toLowerCase());

      if (direction === 'UP') item.upvotes.push(u);
      else item.downvotes.push(u);

      storage.set(STORAGE_KEYS.SUGGESTIONS, list);
      return item;
    },

    adminUpdateSuggestion(session, sugId, { status, adminNote }) {
      authGuard.requireRole(session, ['ADMIN', 'MODERATOR']);
      const list = this.getAllSuggestions();
      const item = list.find(s => s.id === sugId);
      if (!item) throw new Error('Öneri bulunamadı.');

      if (status) item.status = status;
      if (adminNote !== undefined) item.adminNote = String(adminNote).trim();
      storage.set(STORAGE_KEYS.SUGGESTIONS, list);

      notificationService.notifyUser(item.username, {
        type: 'SUGGESTION_STATUS_CHANGED',
        title: '💡 Öneri Durumunuz Güncellendi',
        message: `"${item.title}" başlıklı önerinizin durumu [${item.status}] olarak güncellendi.${
          item.adminNote ? ` Yönetici Notu: ${item.adminNote}` : ''
        }`
      });

      activityService.log(
        'SUGGESTION_UPDATE',
        session.username,
        `Öneri durumu güncellendi (#${item.id} -> ${item.status}).`
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
        announcementText: 'Yeni Sezon Başladı! Ücretsiz kayıt ol ve +250 Netherite kazan!'
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
    backupService
  });
})(window);
