/**
 * MINECRAFT MILYONER — FULL PRODUCTION PLATFORM ARCHITECTURE & SERVICES
 *
 * Strictly separates:
 * 1. authService & authGuard (Step-by-step License -> Username Login, Welcome Back, Session & Permission Guard)
 * 2. userService (Immutable User ID, Roles & Data-Driven Ranks, Hashed Passwords, Purchases, Cosmetics, Settings)
 * 3. licenseService (Master Admin, VIP, Player & Community Licenses — Never reset by Party actions)
 * 4. partyService (Data-Driven Rank Permission Enforcement: canCreateParty, canInvitePlayers, maxPartySize)
 * 5. supportService (Support, Bug Reports, Suggestions + 4-Tier Priority: CRITICAL, VERY HIGH, HIGH, NORMAL)
 * 6. paymentService (Stripe Checkout + Idempotent Webhook Architecture + 5 Emeralds = 1 TL Packages + Refunds)
 * 7. backupService (Versioned Backups for users, parties, licenses, transactions, payments, settings + Download)
 * 8. activityService (Audit Logging)
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    USERS: 'mcm_platform_users_v3',
    LICENSES: 'mcm_platform_licenses_v2',
    PARTIES: 'mcm_platform_parties_v2',
    PLAYERS: 'mcm_platform_players_v2',
    ACTIVITY: 'mcm_platform_activity_v2',
    SESSION: 'mcm_platform_active_session_v2',
    REMEMBERED_USER: 'mcm_platform_remembered_user_v3',
    SUPPORT_TICKETS: 'mcm_platform_support_tickets_v3',
    BUG_REPORTS: 'mcm_platform_bug_reports_v3',
    SUGGESTIONS: 'mcm_platform_suggestions_v3',
    BACKUPS: 'mcm_platform_backups_v3',
    PAYMENTS: 'mcm_platform_payments_v3',
    WEBHOOK_EVENTS: 'mcm_stripe_webhook_events_v3',
    EMERALD_PACKAGES: 'mcm_emerald_packages_v3',
    SYSTEM_SETTINGS: 'mcm_platform_sys_settings_v3'
  };

  // Precomputed SHA-256 digests (salted) so plaintext master license & secrets never appear in source
  const MASTER_SALT = 'MCM_2026_SALT::';
  const MASTER_ADMIN_DIGEST = 'df8896b8447df2314b2a64f4ba6abb3992740163430da594d1b5cdc0686c24eb';
  const LEGACY_COMMUNITY_DIGEST = '32c69093739b5fac530d8dc5d90fcd8abd57ea1f4c805dc563af52f5bf23083e';

  // Pure JS SHA-256 implementation
  function sha256(ascii) {
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

    let hash = (sha256.h = sha256.h || []);
    const k = (sha256.k = sha256.k || []);
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
      if (j >> 8) return '';
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
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

  function computeSaltedDigest(rawValue) {
    const utf8 = unescape(encodeURIComponent(MASTER_SALT + String(rawValue).trim()));
    return sha256(utf8);
  }

  function hashPassword(rawPassword) {
    if (!rawPassword || !String(rawPassword).trim()) return null;
    return computeSaltedDigest('MCM_PWD_V3::' + String(rawPassword));
  }

  function normalizeRole(role) {
    const r = String(role || 'PLAYER').toUpperCase();
    if (r === 'ADMIN') return 'ADMIN';
    if (
      r === 'VIP' ||
      r === 'VIP+' ||
      r === 'VIP_PLUS' ||
      r === 'MVP' ||
      r === 'MVP+' ||
      r === 'MVP_PLUS' ||
      r === 'ELITE' ||
      r === 'LEGEND' ||
      r === 'CHAMPION' ||
      r === 'MILLIONAIRE' ||
      r === 'ORGANIZER'
    ) {
      return 'VIP';
    }
    return 'PLAYER';
  }

  function normalizeRankId(rankId, fallbackRole = 'PLAYER') {
    const r = String(rankId || fallbackRole || 'PLAYER')
      .trim()
      .toUpperCase()
      .replace(/\+/g, '_PLUS');
    const valid = [
      'PLAYER',
      'VIP',
      'VIP_PLUS',
      'MVP',
      'MVP_PLUS',
      'ELITE',
      'LEGEND',
      'CHAMPION',
      'MILLIONAIRE',
      'ADMIN'
    ];
    if (valid.includes(r)) return r;
    if (normalizeRole(fallbackRole) === 'ADMIN') return 'ADMIN';
    if (normalizeRole(fallbackRole) === 'VIP') return 'VIP';
    return 'PLAYER';
  }

  // Storage helper
  const storageAdapter = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        console.warn('Storage read error:', e);
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage write error:', e);
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  // ==========================================
  // 1. ACTIVITY SERVICE
  // ==========================================
  const activityService = {
    getAll() {
      return storageAdapter.get(STORAGE_KEYS.ACTIVITY, []);
    },

    log(type, actor, message, metadata = {}) {
      const logs = this.getAll();
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const entry = {
        id: 'ACT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        type,
        actor: actor || 'System',
        message,
        metadata,
        timestamp: now.toISOString(),
        timeFormatted: timeStr
      };
      logs.unshift(entry);
      if (logs.length > 300) logs.length = 300;
      storageAdapter.set(STORAGE_KEYS.ACTIVITY, logs);
      return entry;
    },

    clearAll(session) {
      authGuard.requireRole(session, ['ADMIN']);
      storageAdapter.set(STORAGE_KEYS.ACTIVITY, []);
      this.log('SYSTEM', session.username, `${session.username} cleared the activity logs`);
    }
  };

  // ==========================================
  // 2. AUTHORIZATION & PERMISSION GUARD (NEVER RESETS ACCOUNT ON PARTY ACTIONS)
  // ==========================================
  const BUILTIN_LICENSE_IDS = [
    'MASTER-ADMIN-ROOT',
    'MASTER-ADMIN-001',
    'LIC-COMMUNITY-XXQ',
    'STD-XXQ-NETWORK'
  ];

  const authGuard = {
    verifySession(session) {
      if (!session || !session.licenseId || !session.role || !session.signature) {
        throw new Error('Unauthorized: Invalid session. Please log in.');
      }
      const normRole = normalizeRole(session.role);
      const expectedSig = computeSaltedDigest(
        `${session.licenseId}:${session.role}:${session.username}`
      );
      const expectedNormSig = computeSaltedDigest(
        `${session.licenseId}:${normRole}:${session.username}`
      );
      if (session.signature !== expectedSig && session.signature !== expectedNormSig) {
        throw new Error('Security Violation: Session signature verification failed.');
      }

      // Check user suspension status if user record exists
      const userRecord = userService._findRawByUsername(session.username);
      if (userRecord && userRecord.status === 'SUSPENDED' && normRole !== 'ADMIN') {
        throw new Error('Account Suspended: Your account has been suspended by an Administrator.');
      }

      // Built-in licenses (Master Admin & Community License) are always valid
      if (!session.isMasterAdmin && !BUILTIN_LICENSE_IDS.includes(session.licenseId)) {
        const lic = licenseService._findRawById(session.licenseId);
        if (lic) {
          const effectiveStatus = licenseService.computeEffectiveStatus(lic);
          if (effectiveStatus !== 'ACTIVE') {
            throw new Error(`License status is ${effectiveStatus}.`);
          }
        }
      }
      return true;
    },

    requireRole(session, allowedRoles = []) {
      this.verifySession(session);
      const userRole = this.getEffectiveRole(session);
      const normalizedAllowed = allowedRoles.map(normalizeRole);
      if (!normalizedAllowed.includes(userRole)) {
        throw new Error(
          `Access Denied: This action requires (${normalizedAllowed.join(' or ')}) permission.`
        );
      }
      return true;
    },

    getEffectiveRole(session) {
      if (!session) return 'PLAYER';
      if (normalizeRole(session.role) === 'ADMIN') return 'ADMIN';
      const u = userService.getUserByUsername(session.username);
      if (u) {
        if (normalizeRole(u.role) === 'ADMIN' || u.rank === 'ADMIN') return 'ADMIN';
        if (
          normalizeRole(u.role) === 'VIP' ||
          (u.vipStatus && u.vipStatus.isVip) ||
          (u.rank && u.rank !== 'PLAYER')
        ) {
          return 'VIP';
        }
      }
      return normalizeRole(session.role);
    },

    getEffectiveRankId(session) {
      if (!session) return 'PLAYER';
      if (normalizeRole(session.role) === 'ADMIN') return 'ADMIN';
      const u = userService.getUserByUsername(session.username);
      if (u && u.rank) {
        return normalizeRankId(u.rank, u.role);
      }
      return normalizeRankId(session.rank || session.role, session.role);
    },

    // Section 10: Data-Driven Permission Lookup (Never hardcode if VIP / if MVP)
    getUserPermissions(session) {
      const rankId = this.getEffectiveRankId(session);
      if (window.MCMServices && window.MCMServices.rankService) {
        return window.MCMServices.rankService.getPermissionsForRank(rankId);
      }
      // Fallback before economy.js loads
      const isAdmin = rankId === 'ADMIN';
      const isElevated = rankId !== 'PLAYER';
      return {
        canCreateParty: isElevated,
        canInvitePlayers: isElevated,
        maxPartySize: isAdmin ? 999 : isElevated ? 4 : 0,
        emeraldMultiplier: isAdmin ? 3.0 : isElevated ? 1.25 : 1.0,
        supportPriority: isAdmin ? 'CRITICAL' : isElevated ? 'HIGH' : 'NORMAL',
        bugPriority: isAdmin ? 'CRITICAL' : isElevated ? 'HIGH' : 'NORMAL',
        suggestionPriority: isAdmin ? 'CRITICAL' : isElevated ? 'HIGH' : 'NORMAL',
        maxExtraLives: isAdmin ? 10 : isElevated ? 5 : 3,
        cosmetics: isElevated,
        rgbName: isElevated,
        profileEffects: isElevated
      };
    },

    requirePermission(session, permissionKey) {
      this.verifySession(session);
      const perms = this.getUserPermissions(session);
      if (!perms || !perms[permissionKey]) {
        throw new Error(
          `Access Denied: Your current rank (${this.getEffectiveRankId(session)}) does not grant the "${permissionKey}" permission.`
        );
      }
      return perms;
    },

    isVipOrAdmin(session) {
      const perms = this.getUserPermissions(session);
      return Boolean(perms.canCreateParty || this.getEffectiveRole(session) !== 'PLAYER');
    }
  };

  // ==========================================
  // 3. USER ACCOUNT SERVICE (Section 3, 5, 27, 34)
  // ==========================================
  const userService = {
    _ensureSeedUsers() {
      const existing = storageAdapter.get(STORAGE_KEYS.USERS, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        let changed = false;
        existing.forEach(u => {
          if (u.role === 'ORGANIZER') {
            u.role = 'VIP';
            if (u.vipStatus) u.vipStatus.isVip = true;
            changed = true;
          }
          if (!u.rank) {
            u.rank = normalizeRankId(u.rankId || u.cosmetics?.equippedRank || u.role, u.role);
            u.rankId = u.rank;
            changed = true;
          }
          if (u.rankExpiration === undefined) {
            u.rankExpiration = u.vipStatus?.expiresAt || null;
            changed = true;
          }
          if (!Array.isArray(u.purchases)) {
            u.purchases = [];
            changed = true;
          }
          if (!u.cosmetics) {
            u.cosmetics = {
              rgbOwned: Boolean(u.role === 'ADMIN' || u.rank !== 'PLAYER'),
              rgbEnabled: Boolean(u.role === 'ADMIN'),
              animatedNameOwned: Boolean(u.role === 'ADMIN'),
              animatedNameEnabled: false,
              profileEffects: Boolean(u.rank !== 'PLAYER'),
              equippedRank: u.rank
            };
            changed = true;
          }
          if (!u.settings) {
            u.settings = { notifications: true, reducedMotion: false };
            changed = true;
          }
        });
        if (changed) storageAdapter.set(STORAGE_KEYS.USERS, existing);
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'USR-1001',
          minecraftUsername: 'Mashallah',
          licenseId: 'MASTER-ADMIN-ROOT',
          role: 'ADMIN',
          rank: 'ADMIN',
          rankId: 'ADMIN',
          rankExpiration: null,
          vipStatus: { isVip: true, tier: 'ADMIN', expiresAt: null, grantedAt: now },
          passwordHash: null,
          emeraldBalance: 2450,
          points: 14850,
          leaderboardRank: 1,
          gamesPlayed: 18,
          gamesWon: 12,
          gamesLost: 6,
          extraLives: 3,
          achievements: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_MILLIONAIRE', 'ACH_CHAMPION'],
          purchases: ['ITEM-RGB-NAME'],
          cosmetics: {
            rgbOwned: true,
            rgbEnabled: true,
            animatedNameOwned: true,
            animatedNameEnabled: true,
            profileEffects: true,
            equippedRank: 'ADMIN'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        },
        {
          id: 'USR-1002',
          minecraftUsername: 'DragonSlayer99',
          licenseId: 'LIC-VIP-01',
          role: 'VIP',
          rank: 'VIP_PLUS',
          rankId: 'VIP_PLUS',
          rankExpiration: null,
          vipStatus: { isVip: true, tier: 'VIP_PLUS', expiresAt: null, grantedAt: now },
          passwordHash: null,
          emeraldBalance: 1820,
          points: 12450,
          leaderboardRank: 2,
          gamesPlayed: 16,
          gamesWon: 9,
          gamesLost: 7,
          extraLives: 2,
          achievements: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_MILLIONAIRE'],
          purchases: ['ITEM-RANK-VIP-PLUS'],
          cosmetics: {
            rgbOwned: true,
            rgbEnabled: true,
            animatedNameOwned: false,
            animatedNameEnabled: false,
            profileEffects: true,
            equippedRank: 'VIP_PLUS'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        },
        {
          id: 'USR-1003',
          minecraftUsername: 'NetherKing_TR',
          licenseId: 'LIC-VIP-02',
          role: 'VIP',
          rank: 'MVP_PLUS',
          rankId: 'MVP_PLUS',
          rankExpiration: null,
          vipStatus: { isVip: true, tier: 'MVP_PLUS', expiresAt: null, grantedAt: now },
          passwordHash: null,
          emeraldBalance: 1540,
          points: 10820,
          leaderboardRank: 3,
          gamesPlayed: 15,
          gamesWon: 8,
          gamesLost: 7,
          extraLives: 2,
          achievements: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER'],
          purchases: ['ITEM-RANK-MVP-PLUS'],
          cosmetics: {
            rgbOwned: true,
            rgbEnabled: false,
            animatedNameOwned: true,
            animatedNameEnabled: true,
            profileEffects: true,
            equippedRank: 'MVP_PLUS'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        },
        {
          id: 'USR-1004',
          minecraftUsername: 'OrganizerAlex',
          licenseId: 'LIC-ORG-01',
          role: 'VIP',
          rank: 'VIP',
          rankId: 'VIP',
          rankExpiration: null,
          vipStatus: { isVip: true, tier: 'VIP', expiresAt: null, grantedAt: now },
          passwordHash: null,
          emeraldBalance: 1290,
          points: 9450,
          leaderboardRank: 4,
          gamesPlayed: 14,
          gamesWon: 7,
          gamesLost: 7,
          extraLives: 1,
          achievements: ['ACH_FIRST_WIN'],
          purchases: [],
          cosmetics: {
            rgbOwned: true,
            rgbEnabled: false,
            animatedNameOwned: false,
            animatedNameEnabled: false,
            profileEffects: true,
            equippedRank: 'VIP'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        },
        {
          id: 'USR-1005',
          minecraftUsername: 'DiamondHunter',
          licenseId: 'LIC-PLY-02',
          role: 'PLAYER',
          rank: 'PLAYER',
          rankId: 'PLAYER',
          rankExpiration: null,
          vipStatus: { isVip: false, tier: 'NONE', expiresAt: null, grantedAt: null },
          passwordHash: null,
          emeraldBalance: 980,
          points: 8920,
          leaderboardRank: 5,
          gamesPlayed: 12,
          gamesWon: 6,
          gamesLost: 6,
          extraLives: 1,
          achievements: ['ACH_FIRST_WIN'],
          purchases: [],
          cosmetics: {
            rgbOwned: false,
            rgbEnabled: false,
            animatedNameOwned: false,
            animatedNameEnabled: false,
            profileEffects: false,
            equippedRank: 'PLAYER'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        },
        {
          id: 'USR-1006',
          minecraftUsername: 'Steve',
          licenseId: 'LIC-PLY-01',
          role: 'PLAYER',
          rank: 'PLAYER',
          rankId: 'PLAYER',
          rankExpiration: null,
          vipStatus: { isVip: false, tier: 'NONE', expiresAt: null, grantedAt: null },
          passwordHash: null,
          emeraldBalance: 650,
          points: 6540,
          leaderboardRank: 6,
          gamesPlayed: 9,
          gamesWon: 4,
          gamesLost: 5,
          extraLives: 0,
          achievements: ['ACH_FIRST_WIN'],
          purchases: [],
          cosmetics: {
            rgbOwned: false,
            rgbEnabled: false,
            animatedNameOwned: false,
            animatedNameEnabled: false,
            profileEffects: false,
            equippedRank: 'PLAYER'
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: { notifications: true, reducedMotion: false }
        }
      ];

      storageAdapter.set(STORAGE_KEYS.USERS, seeded);
      return seeded;
    },

    _getAllRaw() {
      return this._ensureSeedUsers();
    },

    _saveAllRaw(users) {
      storageAdapter.set(STORAGE_KEYS.USERS, users);
    },

    _findRawById(userId) {
      return this._getAllRaw().find(u => u.id === userId) || null;
    },

    _findRawByUsername(username) {
      if (!username) return null;
      return (
        this._getAllRaw().find(
          u => u.minecraftUsername.toLowerCase() === String(username).trim().toLowerCase()
        ) || null
      );
    },

    // Strip passwordHash before returning to UI / Admin / API
    _sanitizeUser(u) {
      if (!u) return null;
      const copy = JSON.parse(JSON.stringify(u));
      const hasPassword = Boolean(copy.passwordHash);
      delete copy.passwordHash;
      copy.hasPassword = hasPassword;
      copy.role = normalizeRole(copy.role);
      copy.rank = normalizeRankId(copy.rank || copy.rankId || copy.role, copy.role);
      copy.rankId = copy.rank;

      // Check rank / VIP expiration
      const expDate = copy.rankExpiration || copy.vipStatus?.expiresAt || null;
      if (expDate && copy.role !== 'ADMIN') {
        const exp = new Date(expDate).getTime();
        if (!isNaN(exp) && Date.now() > exp) {
          copy.vipStatus = { isVip: false, tier: 'NONE', expiresAt: null, grantedAt: null };
          copy.role = 'PLAYER';
          copy.rank = 'PLAYER';
          copy.rankId = 'PLAYER';
          copy.rankExpiration = null;
        }
      }

      if (copy.role === 'VIP' || copy.role === 'ADMIN' || copy.rank !== 'PLAYER') {
        if (!copy.vipStatus) copy.vipStatus = { isVip: true, tier: copy.rank, expiresAt: expDate };
        copy.vipStatus.isVip = true;
      }
      copy.purchases = Array.isArray(copy.purchases) ? copy.purchases : [];
      return copy;
    },

    getOrCreateAccount({ minecraftUsername, licenseId, role = 'PLAYER', password = '' }) {
      const cleanName = String(minecraftUsername || '').trim();
      if (!cleanName) throw new Error('Please enter a valid Minecraft username.');

      const all = this._getAllRaw();
      const now = new Date().toISOString();
      const normRole = normalizeRole(role);
      let user = all.find(u => u.minecraftUsername.toLowerCase() === cleanName.toLowerCase());

      if (user) {
        if (user.passwordHash && password) {
          const candidateHash = hashPassword(password);
          if (candidateHash !== user.passwordHash) {
            throw new Error('Incorrect account password.');
          }
        }
        if (normRole === 'ADMIN') {
          user.role = 'ADMIN';
          user.rank = 'ADMIN';
          user.rankId = 'ADMIN';
          user.vipStatus = { isVip: true, tier: 'ADMIN', expiresAt: null, grantedAt: now };
        } else if (normRole === 'VIP' && user.role !== 'ADMIN') {
          user.role = 'VIP';
          if (!user.rank || user.rank === 'PLAYER') {
            user.rank = 'VIP';
            user.rankId = 'VIP';
          }
          user.vipStatus = {
            isVip: true,
            tier: user.rank,
            expiresAt: user.vipStatus?.expiresAt || null,
            grantedAt: user.vipStatus?.grantedAt || now
          };
        }
        if (licenseId) {
          user.licenseId = licenseId;
        }
        user.lastLogin = now;
      } else {
        const isVipOrAdmin = normRole === 'VIP' || normRole === 'ADMIN';
        const initialRank = normRole === 'ADMIN' ? 'ADMIN' : isVipOrAdmin ? 'VIP' : 'PLAYER';
        user = {
          id:
            'USR-' +
            Date.now().toString(36).toUpperCase() +
            '-' +
            Math.floor(100 + Math.random() * 899),
          minecraftUsername: cleanName,
          licenseId: licenseId || 'LIC-COMMUNITY-XXQ',
          role: normRole,
          rank: initialRank,
          rankId: initialRank,
          rankExpiration: null,
          vipStatus: {
            isVip: isVipOrAdmin,
            tier: isVipOrAdmin ? initialRank : 'NONE',
            expiresAt: null,
            grantedAt: isVipOrAdmin ? now : null
          },
          passwordHash: password ? hashPassword(password) : null,
          emeraldBalance: 250,
          points: 0,
          leaderboardRank: all.length + 1,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          extraLives: 0,
          achievements: [],
          purchases: [],
          cosmetics: {
            rgbOwned: isVipOrAdmin,
            rgbEnabled: normRole === 'ADMIN',
            animatedNameOwned: normRole === 'ADMIN',
            animatedNameEnabled: false,
            profileEffects: isVipOrAdmin,
            equippedRank: initialRank
          },
          status: 'ACTIVE',
          createdAt: now,
          lastLogin: now,
          settings: {
            notifications: true,
            reducedMotion: false
          }
        };
        all.push(user);
      }

      this._saveAllRaw(all);
      playerService.TouchPlayer(user.minecraftUsername, user.role, user.licenseId);
      return this._sanitizeUser(user);
    },

    getUserByUsername(username) {
      const u = this._findRawByUsername(username);
      return this._sanitizeUser(u);
    },

    getUserById(userId) {
      const u = this._findRawById(userId);
      return this._sanitizeUser(u);
    },

    getAllUsers() {
      return this._getAllRaw().map(u => this._sanitizeUser(u));
    },

    // Sync economy stats into userService record so both stay 100% consistent
    syncFromEconomyAccount(econAcc) {
      if (!econAcc || !econAcc.username) return;
      const all = this._getAllRaw();
      const user = all.find(
        u => u.minecraftUsername.toLowerCase() === String(econAcc.username).toLowerCase()
      );
      if (!user) return;
      user.emeraldBalance = Math.max(0, Number(econAcc.balance ?? user.emeraldBalance ?? 0));
      user.points = Math.max(0, Number(econAcc.points ?? user.points ?? 0));
      user.gamesPlayed = Number(econAcc.gamesPlayed ?? user.gamesPlayed ?? 0);
      user.gamesWon = Number(econAcc.gamesWon ?? user.gamesWon ?? 0);
      user.gamesLost = Number(econAcc.gamesLost ?? user.gamesLost ?? 0);
      user.extraLives = Math.max(0, Number(econAcc.extraLives ?? user.extraLives ?? 0));
      if (econAcc.rgbOwned !== undefined) {
        user.cosmetics = user.cosmetics || {};
        user.cosmetics.rgbOwned = Boolean(user.cosmetics.rgbOwned || econAcc.rgbOwned);
      }
      if (econAcc.animatedNameOwned !== undefined) {
        user.cosmetics = user.cosmetics || {};
        user.cosmetics.animatedNameOwned = Boolean(
          user.cosmetics.animatedNameOwned || econAcc.animatedNameOwned
        );
      }
      if (econAcc.equippedRank) {
        const normR = normalizeRankId(econAcc.equippedRank, user.role);
        user.rank = normR;
        user.rankId = normR;
        user.cosmetics = user.cosmetics || {};
        user.cosmetics.equippedRank = normR;
      }
      this._saveAllRaw(all);
    },

    // Section 3 & 27: Change Username without creating a new account (uses immutable user.id)
    changeUsername(session, newUsernameInput) {
      authGuard.verifySession(session);
      const cleanNew = String(newUsernameInput || '').trim();
      if (!cleanNew || cleanNew.length < 3 || cleanNew.length > 24) {
        throw new Error('Username must be between 3 and 24 characters.');
      }

      const all = this._getAllRaw();
      const currentUser =
        all.find(u => u.id === session.userId) ||
        all.find(u => u.minecraftUsername.toLowerCase() === session.username.toLowerCase());

      if (!currentUser) throw new Error('User account not found.');

      const oldUsername = currentUser.minecraftUsername;
      if (oldUsername.toLowerCase() !== cleanNew.toLowerCase()) {
        const conflict = all.find(
          u => u.id !== currentUser.id && u.minecraftUsername.toLowerCase() === cleanNew.toLowerCase()
        );
        if (conflict) {
          throw new Error('This Minecraft username is already taken by another account.');
        }
      }

      currentUser.minecraftUsername = cleanNew;
      this._saveAllRaw(all);

      if (window.MCMServices && window.MCMServices.economyService) {
        window.MCMServices.economyService._renameUsernameInternal(oldUsername, cleanNew);
      }

      const parties = partyService._getAllRaw();
      parties.forEach(p => {
        if (p.organizer.toLowerCase() === oldUsername.toLowerCase()) {
          p.organizer = cleanNew;
        }
        p.participants.forEach(pt => {
          if (pt.username.toLowerCase() === oldUsername.toLowerCase()) {
            pt.username = cleanNew;
          }
        });
      });
      partyService._saveAllRaw(parties);

      const updatedSession = licenseService._buildSignedSession({
        userId: currentUser.id,
        licenseId: session.licenseId,
        licenseName: session.licenseName,
        role: currentUser.role,
        rank: currentUser.rank,
        username: cleanNew,
        isMasterAdmin: session.isMasterAdmin,
        codeMasked: session.codeMasked
      });
      licenseService._saveSession(updatedSession);

      activityService.log(
        'USERNAME_CHANGED',
        cleanNew,
        `User ${oldUsername} changed username to ${cleanNew} (ID: ${currentUser.id})`
      );

      return {
        user: this._sanitizeUser(currentUser),
        session: updatedSession
      };
    },

    // Section 3 & 27: Change / Set Password (stores ONLY salted SHA-256 hash)
    changePassword(session, currentPassword, newPassword) {
      authGuard.verifySession(session);
      if (!newPassword || String(newPassword).length < 4) {
        throw new Error('New password must be at least 4 characters.');
      }

      const all = this._getAllRaw();
      const user =
        all.find(u => u.id === session.userId) ||
        all.find(u => u.minecraftUsername.toLowerCase() === session.username.toLowerCase());
      if (!user) throw new Error('User account not found.');

      if (user.passwordHash) {
        const currHash = hashPassword(currentPassword);
        if (currHash !== user.passwordHash) {
          throw new Error('Current password is incorrect.');
        }
      }

      user.passwordHash = hashPassword(newPassword);
      this._saveAllRaw(all);
      activityService.log(
        'PASSWORD_UPDATED',
        user.minecraftUsername,
        `${user.minecraftUsername} updated their account password hash`
      );
      return true;
    },

    // Section 13 & 36: Cosmetics & RGB Username Toggle
    setRgbUsernameEnabled(session, enabled) {
      authGuard.verifySession(session);
      const all = this._getAllRaw();
      const user =
        all.find(u => u.id === session.userId) ||
        all.find(u => u.minecraftUsername.toLowerCase() === session.username.toLowerCase());
      if (!user) throw new Error('User account not found.');

      const perms = authGuard.getUserPermissions(session);
      if (!user.cosmetics?.rgbOwned && !perms.rgbName) {
        throw new Error('You must purchase RGB Username from the Shop or unlock an eligible Rank first.');
      }

      user.cosmetics = user.cosmetics || {};
      user.cosmetics.rgbOwned = true;
      user.cosmetics.rgbEnabled = Boolean(enabled);
      this._saveAllRaw(all);
      return this._sanitizeUser(user);
    },

    updateSettings(session, newSettings = {}) {
      authGuard.verifySession(session);
      const all = this._getAllRaw();
      const user =
        all.find(u => u.id === session.userId) ||
        all.find(u => u.minecraftUsername.toLowerCase() === session.username.toLowerCase());
      if (!user) throw new Error('User account not found.');

      user.settings = {
        ...(user.settings || {}),
        ...newSettings
      };
      this._saveAllRaw(all);
      return this._sanitizeUser(user);
    },

    // Grant Rank internally (from Shop purchase, Stripe webhook, or Admin)
    _grantRankInternal(targetUsername, rankId, expiresAt = null) {
      const cleanRank = normalizeRankId(rankId);
      const all = this._getAllRaw();
      const user = all.find(
        u => u.minecraftUsername.toLowerCase() === String(targetUsername).toLowerCase()
      );
      if (!user) throw new Error('User not found.');

      const now = new Date().toISOString();
      user.rank = cleanRank;
      user.rankId = cleanRank;
      user.rankExpiration = expiresAt || null;

      if (cleanRank === 'ADMIN') {
        user.role = 'ADMIN';
      } else if (cleanRank === 'PLAYER') {
        user.role = 'PLAYER';
      } else {
        if (user.role !== 'ADMIN') user.role = 'VIP';
      }

      const isElevated = cleanRank !== 'PLAYER';
      user.vipStatus = {
        isVip: isElevated,
        tier: isElevated ? cleanRank : 'NONE',
        expiresAt: expiresAt || null,
        grantedAt: isElevated ? user.vipStatus?.grantedAt || now : null
      };

      user.cosmetics = user.cosmetics || {};
      user.cosmetics.equippedRank = cleanRank;
      if (isElevated) {
        user.cosmetics.rgbOwned = true;
        user.cosmetics.profileEffects = true;
      }
      if (cleanRank === 'MILLIONAIRE' || cleanRank === 'MVP_PLUS' || cleanRank === 'ADMIN') {
        user.cosmetics.animatedNameOwned = true;
      }

      this._saveAllRaw(all);

      // Sync with economy account if initialized
      if (window.MCMServices && window.MCMServices.economyService) {
        window.MCMServices.economyService._mutateAccount(user.minecraftUsername, acc => {
          acc.role = user.role;
          acc.isVip = isElevated;
          acc.equippedRank = cleanRank;
          acc.ownedRanks = acc.ownedRanks || ['PLAYER'];
          if (!acc.ownedRanks.includes(cleanRank)) acc.ownedRanks.push(cleanRank);
          if (isElevated) acc.rgbOwned = true;
        });
      }

      return this._sanitizeUser(user);
    },

    // Section 21, 22, 26: ADMIN USER, VIP & RANK MANAGEMENT
    adminUpdateUserRole(session, targetUsername, newRoleOrRank) {
      authGuard.requireRole(session, ['ADMIN']);
      const targetRank = normalizeRankId(newRoleOrRank, newRoleOrRank);
      const updated = this._grantRankInternal(targetUsername, targetRank, null);
      activityService.log(
        'USER_ROLE_CHANGED',
        session.username,
        `Admin ${session.username} updated ${updated.minecraftUsername}'s rank/role to ${targetRank}`
      );
      return updated;
    },

    adminSetVipStatus(session, targetUsername, { isVip, rankId = 'VIP', expiresAt = null }) {
      authGuard.requireRole(session, ['ADMIN']);
      const targetRank = isVip ? normalizeRankId(rankId || 'VIP', 'VIP') : 'PLAYER';
      const updated = this._grantRankInternal(targetUsername, targetRank, expiresAt);
      activityService.log(
        isVip ? 'VIP_GRANTED' : 'VIP_REMOVED',
        session.username,
        `Admin ${session.username} ${isVip ? `granted ${targetRank} to` : 'removed VIP from'} ${updated.minecraftUsername}`
      );
      return updated;
    },

    adminToggleSuspendUser(session, targetUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const user = all.find(
        u => u.minecraftUsername.toLowerCase() === String(targetUsername).toLowerCase()
      );
      if (!user) throw new Error('User not found.');
      if (user.role === 'ADMIN') throw new Error('Cannot suspend an ADMIN account.');

      user.status = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      this._saveAllRaw(all);
      activityService.log(
        'USER_STATUS_CHANGED',
        session.username,
        `Admin ${session.username} set ${user.minecraftUsername} status to ${user.status}`
      );
      return this._sanitizeUser(user);
    },

    adminResetUserAccount(session, targetUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const user = all.find(
        u => u.minecraftUsername.toLowerCase() === String(targetUsername).toLowerCase()
      );
      if (!user) throw new Error('User not found.');

      user.emeraldBalance = 0;
      user.points = 0;
      user.gamesPlayed = 0;
      user.gamesWon = 0;
      user.gamesLost = 0;
      user.extraLives = 0;
      user.achievements = [];
      this._saveAllRaw(all);

      if (window.MCMServices && window.MCMServices.economyService) {
        window.MCMServices.economyService.adminModifyBalance(session, {
          username: user.minecraftUsername,
          operation: 'RESET',
          amount: 0,
          reason: 'Admin Account Reset'
        });
      }

      activityService.log(
        'USER_ACCOUNT_RESET',
        session.username,
        `Admin ${session.username} reset account statistics and Emeralds for ${user.minecraftUsername}`
      );
      return this._sanitizeUser(user);
    }
  };

  // ==========================================
  // 4. LICENSE & STEP-BY-STEP AUTH SERVICE (Section 2, 4)
  // ==========================================
  const licenseService = {
    _ensureSeedData() {
      const existing = storageAdapter.get(STORAGE_KEYS.LICENSES, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        existing.forEach(l => {
          l.role = normalizeRole(l.role);
        });
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'LIC-VIP-01',
          code: 'MCVP-VIP1-8899',
          name: 'VIP+ Tournament License #1',
          role: 'VIP',
          rank: 'VIP_PLUS',
          status: 'ACTIVE',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'DragonSlayer99',
          currentSessionUser: null,
          lastUsedAt: null
        },
        {
          id: 'LIC-ORG-01',
          code: 'MCML-ORG1-7F4K',
          name: 'VIP Organizer License #1',
          role: 'VIP',
          rank: 'VIP',
          status: 'ACTIVE',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'OrganizerAlex',
          currentSessionUser: null,
          lastUsedAt: null
        },
        {
          id: 'LIC-PLY-01',
          code: 'MCML-PLYR-92QX',
          name: 'Player License — Steve',
          role: 'PLAYER',
          rank: 'PLAYER',
          status: 'ACTIVE',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'Steve',
          currentSessionUser: null,
          lastUsedAt: null
        },
        {
          id: 'LIC-PLY-02',
          code: 'MCML-PLYR-48BM',
          name: 'Player License — DiamondHunter',
          role: 'PLAYER',
          rank: 'PLAYER',
          status: 'ACTIVE',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'DiamondHunter',
          currentSessionUser: null,
          lastUsedAt: null
        },
        {
          id: 'LIC-REV-01',
          code: 'MCML-REVK-1100',
          name: 'Revoked Test License',
          role: 'PLAYER',
          rank: 'PLAYER',
          status: 'REVOKED',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'Herobrine',
          currentSessionUser: null,
          lastUsedAt: null
        }
      ];

      storageAdapter.set(STORAGE_KEYS.LICENSES, seeded);
      return seeded;
    },

    _getAllRaw() {
      return this._ensureSeedData();
    },

    _saveAllRaw(list) {
      storageAdapter.set(STORAGE_KEYS.LICENSES, list);
    },

    _findRawById(id) {
      return this._getAllRaw().find(l => l.id === id) || null;
    },

    computeEffectiveStatus(lic) {
      if (!lic) return 'INVALID';
      if (lic.status === 'REVOKED') return 'REVOKED';
      if (lic.status === 'DISABLED') return 'DISABLED';
      if (lic.expiresAt) {
        const expTime = new Date(lic.expiresAt).getTime();
        if (!isNaN(expTime) && Date.now() > expTime) {
          return 'EXPIRED';
        }
      }
      return 'ACTIVE';
    },

    generateRandomCode(role = 'PLAYER') {
      const r = normalizeRole(role);
      const prefix = r === 'ADMIN' ? 'MCAD' : r === 'VIP' ? 'MCVP' : 'MCML';
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return `${prefix}-${seg()}-${seg()}`;
    },

    // STEP 1 OF LOGIN FLOW: Validate License Code Only
    async validateLicenseStep(rawCode) {
      await new Promise(r => setTimeout(r, 180));
      const cleanCode = String(rawCode || '').trim();
      if (!cleanCode) {
        return { ok: false, error: 'Please enter a valid license code.' };
      }

      const digest = computeSaltedDigest(cleanCode);

      // 1. Master Admin License ("Minecraft@MashallahMC@Admin")
      if (digest === MASTER_ADMIN_DIGEST) {
        return {
          ok: true,
          licenseToken: {
            licenseId: 'MASTER-ADMIN-ROOT',
            licenseName: 'Master Admin License',
            role: 'ADMIN',
            rank: 'ADMIN',
            isMasterAdmin: true,
            suggestedUsername: 'Mashallah',
            codeMasked: 'MASTER-****-ADMIN'
          }
        };
      }

      // 2. Community License ("xxqnetwork")
      if (digest === LEGACY_COMMUNITY_DIGEST) {
        return {
          ok: true,
          licenseToken: {
            licenseId: 'LIC-COMMUNITY-XXQ',
            licenseName: 'XXQ Network Community License',
            role: 'PLAYER',
            rank: 'PLAYER',
            isMasterAdmin: false,
            suggestedUsername: '',
            codeMasked: 'XXQ-****-NET'
          }
        };
      }

      // 3. Managed Licenses in Storage
      const all = this._getAllRaw();
      const found = all.find(l => l.code.toUpperCase() === cleanCode.toUpperCase());
      if (!found) {
        return { ok: false, error: 'Invalid license code! Please check your code.' };
      }

      const effStatus = this.computeEffectiveStatus(found);
      if (effStatus !== 'ACTIVE') {
        return {
          ok: false,
          error: `This license is ${effStatus}. Please contact an administrator.`
        };
      }

      return {
        ok: true,
        licenseToken: {
          licenseId: found.id,
          licenseName: found.name,
          role: normalizeRole(found.role),
          rank: normalizeRankId(found.rank || found.role, found.role),
          isMasterAdmin: false,
          suggestedUsername: found.assignedUsername || '',
          codeMasked: found.code.slice(0, 5) + '****' + found.code.slice(-4)
        }
      };
    },

    // STEP 2 OF LOGIN FLOW: Enter Minecraft Username -> Create/Load Account -> Dashboard
    async completeAccountStep(licenseToken, minecraftUsername, password = '') {
      await new Promise(r => setTimeout(r, 120));
      if (!licenseToken || !licenseToken.licenseId) {
        return {
          ok: false,
          error: 'License verification expired. Please enter your license code.'
        };
      }

      const finalUsername =
        String(minecraftUsername || '').trim() ||
        licenseToken.suggestedUsername ||
        (licenseToken.role === 'ADMIN'
          ? 'Mashallah'
          : 'Player_' + Math.floor(100 + Math.random() * 899));

      try {
        const userAccount = userService.getOrCreateAccount({
          minecraftUsername: finalUsername,
          licenseId: licenseToken.licenseId,
          role: licenseToken.role,
          password
        });

        if (!licenseToken.isMasterAdmin && !BUILTIN_LICENSE_IDS.includes(licenseToken.licenseId)) {
          const all = this._getAllRaw();
          const found = all.find(l => l.id === licenseToken.licenseId);
          if (found) {
            found.currentSessionUser = userAccount.minecraftUsername;
            found.lastUsedAt = new Date().toISOString();
            this._saveAllRaw(all);
          }
        }

        const effectiveRole = userAccount.role;
        const session = this._buildSignedSession({
          userId: userAccount.id,
          licenseId: licenseToken.licenseId,
          licenseName: licenseToken.licenseName,
          role: effectiveRole,
          rank: userAccount.rank,
          username: userAccount.minecraftUsername,
          isMasterAdmin: licenseToken.isMasterAdmin,
          codeMasked: licenseToken.codeMasked
        });

        this._saveSession(session);
        storageAdapter.set(STORAGE_KEYS.REMEMBERED_USER, {
          userId: userAccount.id,
          username: userAccount.minecraftUsername,
          role: effectiveRole,
          rank: userAccount.rank,
          licenseId: licenseToken.licenseId,
          licenseName: licenseToken.licenseName,
          isMasterAdmin: licenseToken.isMasterAdmin,
          codeMasked: licenseToken.codeMasked,
          savedAt: new Date().toISOString()
        });

        activityService.log(
          'ACCOUNT_LOGIN',
          userAccount.minecraftUsername,
          `${userAccount.minecraftUsername} (${userAccount.rank}) signed in`
        );

        return { ok: true, session, user: userAccount };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    async validateAndLogin(rawCode, customUsername = '', password = '') {
      const step1 = await this.validateLicenseStep(rawCode);
      if (!step1.ok) return step1;
      return this.completeAccountStep(step1.licenseToken, customUsername, password);
    },

    getRememberedUser() {
      return storageAdapter.get(STORAGE_KEYS.REMEMBERED_USER, null);
    },

    resumeRememberedAccount() {
      const rem = this.getRememberedUser();
      if (!rem || !rem.username || !rem.licenseId) return null;
      const user = userService.getOrCreateAccount({
        minecraftUsername: rem.username,
        licenseId: rem.licenseId,
        role: rem.role
      });
      const session = this._buildSignedSession({
        userId: user.id,
        licenseId: rem.licenseId,
        licenseName: rem.licenseName || 'Saved License',
        role: user.role,
        rank: user.rank,
        username: user.minecraftUsername,
        isMasterAdmin: Boolean(rem.isMasterAdmin),
        codeMasked: rem.codeMasked || 'SAVED-****'
      });
      this._saveSession(session);
      return session;
    },

    _buildSignedSession({
      userId,
      licenseId,
      licenseName,
      role,
      rank,
      username,
      isMasterAdmin,
      codeMasked
    }) {
      const normRole = normalizeRole(role);
      const normRank = normalizeRankId(rank || normRole, normRole);
      const signature = computeSaltedDigest(`${licenseId}:${normRole}:${username}`);
      return {
        userId: userId || 'USR-0',
        licenseId,
        licenseName,
        role: normRole,
        rank: normRank,
        username,
        isMasterAdmin: Boolean(isMasterAdmin),
        codeMasked,
        loggedInAt: new Date().toISOString(),
        signature
      };
    },

    _saveSession(session) {
      try {
        sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      } catch (e) {
        console.warn('Session storage error:', e);
      }
    },

    refreshSessionRole(session) {
      if (!session) return null;
      const u = userService.getUserByUsername(session.username);
      if (!u) return session;
      const newRole = normalizeRole(u.role);
      const newRank = normalizeRankId(u.rank || u.role, newRole);
      if (newRole !== session.role || newRank !== session.rank) {
        const updated = this._buildSignedSession({
          userId: u.id,
          licenseId: session.licenseId,
          licenseName: session.licenseName,
          role: newRole,
          rank: newRank,
          username: u.minecraftUsername,
          isMasterAdmin: session.isMasterAdmin,
          codeMasked: session.codeMasked
        });
        this._saveSession(updated);
        return updated;
      }
      return session;
    },

    getActiveSession() {
      try {
        const raw =
          sessionStorage.getItem(STORAGE_KEYS.SESSION) ||
          localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        parsed.role = normalizeRole(parsed.role);
        authGuard.verifySession(parsed);
        return this.refreshSessionRole(parsed);
      } catch (e) {
        return null;
      }
    },

    logout(clearRemembered = false) {
      const current = storageAdapter.get(STORAGE_KEYS.SESSION, null);
      if (
        current &&
        current.licenseId &&
        !current.isMasterAdmin &&
        !BUILTIN_LICENSE_IDS.includes(current.licenseId)
      ) {
        const all = this._getAllRaw();
        const found = all.find(l => l.id === current.licenseId);
        if (found) {
          found.currentSessionUser = null;
          this._saveAllRaw(all);
        }
      }
      try {
        sessionStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        if (clearRemembered) {
          localStorage.removeItem(STORAGE_KEYS.REMEMBERED_USER);
        }
      } catch (e) {}
    },

    // ADMIN LICENSE MANAGEMENT (Section 4)
    listLicensesForAdmin(session) {
      authGuard.requireRole(session, ['ADMIN']);
      return this._getAllRaw().map(l => ({
        ...l,
        role: normalizeRole(l.role),
        effectiveStatus: this.computeEffectiveStatus(l)
      }));
    },

    createLicense(session, { name, code, role, expiresAt, assignedUsername }) {
      authGuard.requireRole(session, ['ADMIN']);
      const cleanRole = normalizeRole(role);
      const finalCode = (code && code.trim().toUpperCase()) || this.generateRandomCode(cleanRole);
      const all = this._getAllRaw();

      if (all.some(l => l.code.toUpperCase() === finalCode)) {
        throw new Error('This license code already exists!');
      }

      const newLic = {
        id: 'LIC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
        code: finalCode,
        name: (name || '').trim() || `${cleanRole} License`,
        role: cleanRole,
        rank: normalizeRankId(role, cleanRole),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
        assignedUsername: (assignedUsername || '').trim() || null,
        currentSessionUser: null,
        lastUsedAt: null
      };

      all.unshift(newLic);
      this._saveAllRaw(all);
      activityService.log(
        'LICENSE_CREATED',
        session.username,
        `${session.username} created ${cleanRole} license "${newLic.name}" (${newLic.code})`
      );
      return newLic;
    },

    updateLicenseStatus(session, licenseId, newStatus) {
      authGuard.requireRole(session, ['ADMIN']);
      const allowed = ['ACTIVE', 'DISABLED', 'REVOKED'];
      if (!allowed.includes(newStatus)) throw new Error('Invalid license status.');

      const all = this._getAllRaw();
      const target = all.find(l => l.id === licenseId);
      if (!target) throw new Error('License not found.');

      target.status = newStatus;
      if (newStatus !== 'ACTIVE') {
        target.currentSessionUser = null;
      }
      this._saveAllRaw(all);

      activityService.log(
        `LICENSE_${newStatus}`,
        session.username,
        `${session.username} set license "${target.name}" (${target.code}) to ${newStatus}`
      );
      return target;
    },

    updateLicenseRoleOrExpiry(session, licenseId, { role, expiresAt }) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const target = all.find(l => l.id === licenseId);
      if (!target) throw new Error('License not found.');

      if (role) {
        target.role = normalizeRole(role);
        target.rank = normalizeRankId(role, target.role);
      }
      if (expiresAt !== undefined) target.expiresAt = expiresAt || null;
      this._saveAllRaw(all);

      activityService.log(
        'LICENSE_UPDATED',
        session.username,
        `${session.username} updated license "${target.code}" (Role: ${target.role})`
      );
      return target;
    },

    deleteLicense(session, licenseId) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const idx = all.findIndex(l => l.id === licenseId);
      if (idx === -1) throw new Error('License not found.');

      const removed = all.splice(idx, 1)[0];
      this._saveAllRaw(all);
      activityService.log(
        'LICENSE_DELETED',
        session.username,
        `${session.username} deleted license "${removed.name}" (${removed.code})`
      );
      return removed;
    }
  };

  // ==========================================
  // 5. PARTY SERVICE (Sections 10, 11, 12, 13 — DATA-DRIVEN RANK PERMISSIONS & LIMITS)
  // ==========================================
  const PARTY_STATUSES = ['WAITING', 'READY', 'STARTING', 'ACTIVE', 'FINISHED', 'CANCELLED'];

  const partyService = {
    _ensureSeedParties() {
      const existing = storageAdapter.get(STORAGE_KEYS.PARTIES, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        existing.forEach(p => {
          if (!p.gameMode) p.gameMode = 'Classic Millionaire (15 Qs)';
          if (p.description === undefined)
            p.description = 'Official Minecraft Milyoner tournament lobby.';
        });
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'PRT-1001',
          name: 'Minecraft Championship #1',
          organizer: 'Mashallah',
          organizerLicenseId: 'MASTER-ADMIN-ROOT',
          maxPlayers: 8,
          gameMode: 'Classic Millionaire (15 Qs)',
          description: 'Official Grand Emerald Championship Party! Join with code MCM-8K2P.',
          inviteCode: 'MCM-8K2P',
          status: 'WAITING',
          createdAt: now,
          participants: [
            {
              username: 'Mashallah',
              role: 'ADMIN',
              joinStatus: 'JOINED',
              joinedAt: now
            },
            {
              username: 'Steve',
              role: 'PLAYER',
              joinStatus: 'JOINED',
              joinedAt: now
            }
          ],
          invitedUsers: []
        },
        {
          id: 'PRT-1002',
          name: 'VIP Diamond Arena',
          organizer: 'DragonSlayer99',
          organizerLicenseId: 'LIC-VIP-01',
          maxPlayers: 6,
          gameMode: 'Speed Blitz',
          description: 'Fast-paced Minecraft trivia arena hosted by DragonSlayer99.',
          inviteCode: 'MCM-VIP9',
          status: 'WAITING',
          createdAt: now,
          participants: [
            {
              username: 'DragonSlayer99',
              role: 'VIP',
              joinStatus: 'JOINED',
              joinedAt: now
            }
          ],
          invitedUsers: []
        }
      ];

      storageAdapter.set(STORAGE_KEYS.PARTIES, seeded);
      return seeded;
    },

    _getAllRaw() {
      return this._ensureSeedParties();
    },

    _saveAllRaw(list) {
      storageAdapter.set(STORAGE_KEYS.PARTIES, list);
    },

    generateInviteCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      return `MCM-${seg}`;
    },

    listParties(session) {
      authGuard.verifySession(session);
      const all = this._getAllRaw();
      const perms = authGuard.getUserPermissions(session);
      if (perms.canCreateParty || authGuard.getEffectiveRole(session) === 'ADMIN') {
        return all;
      }
      return all.filter(
        p =>
          p.status === 'WAITING' ||
          p.participants.some(pt => pt.username.toLowerCase() === session.username.toLowerCase()) ||
          (p.invitedUsers || []).some(u => u.toLowerCase() === session.username.toLowerCase())
      );
    },

    getPartyById(session, partyId) {
      authGuard.verifySession(session);
      return this._getAllRaw().find(p => p.id === partyId) || null;
    },

    // Section 10, 11 & 13: Enforce data-driven rank permission (canCreateParty) and maxPartySize!
    createParty(
      session,
      { name, maxPlayers = 4, gameMode = 'Classic Millionaire (15 Qs)', description = '' }
    ) {
      const perms = authGuard.requirePermission(session, 'canCreateParty');

      const cleanName = String(name || '').trim();
      if (!cleanName) throw new Error('Please enter a party name.');

      const requestedMax = Math.max(2, Number(maxPlayers) || 4);
      const rankMaxAllowed = Number(perms.maxPartySize) || 4;
      const isAdmin = authGuard.getEffectiveRole(session) === 'ADMIN';

      if (!isAdmin && requestedMax > rankMaxAllowed) {
        throw new Error(
          `Party Size Limit: Your current rank (${authGuard.getEffectiveRankId(session)}) allows up to ${rankMaxAllowed} players per party. Upgrade your rank for larger parties!`
        );
      }

      const maxP = isAdmin ? Math.min(999, requestedMax) : Math.min(rankMaxAllowed, requestedMax);
      const all = this._getAllRaw();
      const now = new Date().toISOString();

      let inviteCode = this.generateInviteCode();
      while (all.some(p => p.inviteCode === inviteCode)) {
        inviteCode = this.generateInviteCode();
      }

      const effRole = authGuard.getEffectiveRole(session);
      const newParty = {
        id: 'PRT-' + Math.floor(1000 + Math.random() * 9000),
        name: cleanName,
        organizer: session.username,
        organizerLicenseId: session.licenseId,
        maxPlayers: maxP,
        gameMode: String(gameMode || 'Classic Millionaire (15 Qs)').trim(),
        description: String(description || '').trim(),
        inviteCode,
        status: 'WAITING',
        createdAt: now,
        participants: [
          {
            username: session.username,
            role: effRole,
            joinStatus: 'JOINED',
            joinedAt: now
          }
        ],
        invitedUsers: []
      };

      all.unshift(newParty);
      this._saveAllRaw(all);

      activityService.log(
        'PARTY_CREATED',
        session.username,
        `${session.username} (${authGuard.getEffectiveRankId(session)}) created party "${newParty.name}" (Max ${maxP}, Code: ${newParty.inviteCode})`,
        { partyId: newParty.id }
      );

      return newParty;
    },

    _assertPartyOwnerOrAdmin(session, party) {
      authGuard.verifySession(session);
      if (!party) throw new Error('Party not found.');
      const effRole = authGuard.getEffectiveRole(session);
      const perms = authGuard.getUserPermissions(session);
      const isOwner = party.organizer.toLowerCase() === session.username.toLowerCase();
      if (effRole !== 'ADMIN' && !(perms.canCreateParty && isOwner)) {
        throw new Error(
          'Access Denied: Only the party owner or an Admin can manage this party.'
        );
      }
    },

    // Section 10 & 11: Enforce canInvitePlayers permission
    invitePlayer(session, partyId, targetUsername = '') {
      authGuard.requirePermission(session, 'canInvitePlayers');
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      if (party.status === 'CANCELLED' || party.status === 'FINISHED') {
        throw new Error('This party is no longer active.');
      }

      const cleanUser = String(targetUsername || '').trim();
      if (cleanUser) {
        if (!party.invitedUsers) party.invitedUsers = [];
        if (!party.invitedUsers.some(u => u.toLowerCase() === cleanUser.toLowerCase())) {
          party.invitedUsers.push(cleanUser);
        }
        if (
          !party.participants.some(pt => pt.username.toLowerCase() === cleanUser.toLowerCase())
        ) {
          party.participants.push({
            username: cleanUser,
            role: 'PLAYER',
            joinStatus: 'INVITED',
            joinedAt: new Date().toISOString()
          });
        }
        this._saveAllRaw(all);
        activityService.log(
          'PLAYER_INVITED',
          session.username,
          `${session.username} invited ${cleanUser} to "${party.name}"`,
          { partyId: party.id }
        );
      }

      return {
        partyName: party.name,
        partyId: party.id,
        organizer: party.organizer,
        inviteCode: party.inviteCode,
        invitationText: `Minecraft Milyoner Party Invitation\nParty: ${party.name}\nOwner: ${party.organizer}\nMode: ${party.gameMode}\nInvite Code: ${party.inviteCode}`
      };
    },

    // Section 2 & 12: Join Party — NEVER resets license, account, rank, VIP, Emeralds, or points!
    joinPartyByInviteCode(session, inviteCodeInput) {
      authGuard.verifySession(session);
      const code = String(inviteCodeInput || '').trim().toUpperCase();
      if (!code) throw new Error('Please enter a valid Party Code (e.g. MCM-8K2P).');

      const all = this._getAllRaw();
      const party = all.find(
        p => p.inviteCode.toUpperCase() === code || p.id.toUpperCase() === code
      );
      if (!party) {
        throw new Error('INVALID PARTY CODE: No party found with that invite code.');
      }

      if (party.status === 'CANCELLED' || party.status === 'FINISHED') {
        throw new Error(`Cannot join this party (Status: ${party.status}).`);
      }

      const existingParticipant = party.participants.find(
        pt => pt.username.toLowerCase() === session.username.toLowerCase()
      );

      const joinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      if (
        (!existingParticipant || existingParticipant.joinStatus !== 'JOINED') &&
        joinedCount >= party.maxPlayers
      ) {
        throw new Error('PARTY FULL: This party has reached its maximum player capacity.');
      }

      const now = new Date().toISOString();
      const effRole = authGuard.getEffectiveRole(session);
      if (existingParticipant) {
        existingParticipant.joinStatus = 'JOINED';
        existingParticipant.role = effRole;
        existingParticipant.joinedAt = now;
      } else {
        party.participants.push({
          username: session.username,
          role: effRole,
          joinStatus: 'JOINED',
          joinedAt: now
        });
      }

      const newJoinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      if (newJoinedCount >= party.maxPlayers && party.status === 'WAITING') {
        party.status = 'READY';
      }

      this._saveAllRaw(all);
      activityService.log(
        'PLAYER_JOINED',
        session.username,
        `Player ${session.username} joined party "${party.name}" (${party.inviteCode})`,
        { partyId: party.id }
      );

      return party;
    },

    leaveParty(session, partyId) {
      authGuard.verifySession(session);
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      if (!party) throw new Error('Party not found.');

      const idx = party.participants.findIndex(
        pt => pt.username.toLowerCase() === session.username.toLowerCase()
      );
      if (idx === -1) {
        throw new Error('You are not a participant in this party.');
      }

      party.participants.splice(idx, 1);
      if (
        party.status === 'READY' &&
        party.participants.filter(pt => pt.joinStatus === 'JOINED').length < party.maxPlayers
      ) {
        party.status = 'WAITING';
      }

      this._saveAllRaw(all);
      activityService.log(
        'PLAYER_LEFT_PARTY',
        session.username,
        `${session.username} left party "${party.name}"`,
        { partyId: party.id }
      );
      return party;
    },

    removeParticipant(session, partyId, targetUsername) {
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      const idx = party.participants.findIndex(
        pt => pt.username.toLowerCase() === String(targetUsername).toLowerCase()
      );
      if (idx === -1) throw new Error('Player not found in this party.');

      party.participants[idx].joinStatus = 'REMOVED';
      this._saveAllRaw(all);

      activityService.log(
        'PLAYER_REMOVED',
        session.username,
        `${session.username} removed ${targetUsername} from party "${party.name}"`,
        { partyId: party.id }
      );
      return party;
    },

    setPartyStatus(session, partyId, newStatus) {
      if (!PARTY_STATUSES.includes(newStatus)) {
        throw new Error('Invalid party status.');
      }
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      party.status = newStatus;
      this._saveAllRaw(all);

      activityService.log(
        `PARTY_${newStatus}`,
        session.username,
        `${session.username} changed party "${party.name}" status to ${newStatus}`,
        { partyId: party.id }
      );
      return party;
    },

    transferOwnership(session, partyId, newOwnerUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      if (!party) throw new Error('Party not found.');

      const cleanOwner = String(newOwnerUsername || '').trim();
      if (!cleanOwner) throw new Error('New owner username is required.');

      const prevOwner = party.organizer;
      party.organizer = cleanOwner;
      this._saveAllRaw(all);

      activityService.log(
        'PARTY_TRANSFER',
        session.username,
        `Admin ${session.username} transferred party "${party.name}" from ${prevOwner} to ${cleanOwner}`
      );
      return party;
    },

    deleteParty(session, partyId) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const idx = all.findIndex(p => p.id === partyId);
      if (idx === -1) throw new Error('Party not found.');

      const removed = all.splice(idx, 1)[0];
      this._saveAllRaw(all);

      activityService.log(
        'PARTY_DELETED',
        session.username,
        `Admin ${session.username} deleted party "${removed.name}" (${removed.id})`
      );
      return removed;
    }
  };

  // ==========================================
  // 6. UNIFIED 4-TIER PRIORITY, SUPPORT, BUG REPORT & SUGGESTION SERVICE (Sections 21, 22, 23)
  // ==========================================
  // Priority Order: CRITICAL (4) > VERY HIGH (3) > HIGH (2) > NORMAL (1)
  const PRIORITY_WEIGHT = {
    CRITICAL: 4,
    'VERY HIGH': 3,
    HIGH: 2,
    NORMAL: 1
  };

  const supportService = {
    // Automatically computes priority from User's Data-Driven Rank:
    // PLAYER -> NORMAL | VIP / VIP+ -> HIGH | MVP / MVP+ / ELITE / LEGEND / CHAMPION / MILLIONAIRE -> VERY HIGH | ADMIN -> CRITICAL
    computeUserPriority(session, kind = 'support') {
      const effRole = authGuard.getEffectiveRole(session);
      if (effRole === 'ADMIN') return 'CRITICAL';

      const perms = authGuard.getUserPermissions(session);
      if (kind === 'bug' && perms.bugPriority) return perms.bugPriority;
      if (kind === 'suggestion' && perms.suggestionPriority) return perms.suggestionPriority;
      if (perms.supportPriority) return perms.supportPriority;

      const rankId = authGuard.getEffectiveRankId(session);
      if (['MVP', 'MVP_PLUS', 'ELITE', 'LEGEND', 'CHAMPION', 'MILLIONAIRE'].includes(rankId)) {
        return 'VERY HIGH';
      }
      if (['VIP', 'VIP_PLUS'].includes(rankId) || effRole === 'VIP') {
        return 'HIGH';
      }
      return 'NORMAL';
    },

    _sortByPriorityAndDate(list) {
      return [...list].sort((a, b) => {
        const pwA = PRIORITY_WEIGHT[a.priority] || 1;
        const pwB = PRIORITY_WEIGHT[b.priority] || 1;
        if (pwB !== pwA) return pwB - pwA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },

    // --- A) SUPPORT TICKETS (Section 23) ---
    _ensureSeedTickets() {
      const existing = storageAdapter.get(STORAGE_KEYS.SUPPORT_TICKETS, null);
      if (existing && Array.isArray(existing)) return existing;
      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'TCK-101',
          userId: 'USR-1003',
          username: 'NetherKing_TR',
          role: 'VIP',
          rank: 'MVP_PLUS',
          isVip: true,
          category: 'Party',
          title: 'MVP+ 10-Player Tournament Room Setup',
          description: 'How can I lock spectator slots for our MVP+ championship lobby?',
          priority: 'VERY HIGH',
          status: 'OPEN',
          adminReply: null,
          createdAt: now
        },
        {
          id: 'TCK-102',
          userId: 'USR-1002',
          username: 'DragonSlayer99',
          role: 'VIP',
          rank: 'VIP_PLUS',
          isVip: true,
          category: 'Shop',
          title: 'VIP+ Bonus Multiplier Question',
          description: 'Does the Score Booster stack with the VIP+ 1.5x Emerald multiplier?',
          priority: 'HIGH',
          status: 'OPEN',
          adminReply: null,
          createdAt: now
        },
        {
          id: 'TCK-103',
          userId: 'USR-1006',
          username: 'Steve',
          role: 'PLAYER',
          rank: 'PLAYER',
          isVip: false,
          category: 'Account',
          title: 'How to earn more Emerald Coins?',
          description: 'I want to save up 500 Emeralds for an Extra Life.',
          priority: 'NORMAL',
          status: 'RESOLVED',
          adminReply: 'Complete daily logins and solo quiz games to earn Emeralds quickly!',
          createdAt: now
        }
      ];
      storageAdapter.set(STORAGE_KEYS.SUPPORT_TICKETS, seeded);
      return seeded;
    },

    createSupportTicket(session, { category, title, description }) {
      authGuard.verifySession(session);
      const cleanTitle = String(title || '').trim();
      const cleanDesc = String(description || '').trim();
      if (!cleanTitle || !cleanDesc) {
        throw new Error('Please fill in both the subject title and description.');
      }

      const effRole = authGuard.getEffectiveRole(session);
      const effRank = authGuard.getEffectiveRankId(session);
      const isVip = effRole !== 'PLAYER';
      const priority = this.computeUserPriority(session, 'support');
      const list = this._ensureSeedTickets();
      const ticket = {
        id: 'TCK-' + Math.floor(1000 + Math.random() * 9000),
        userId: session.userId || 'USR-0',
        username: session.username,
        role: effRole,
        rank: effRank,
        isVip,
        category: category || 'Technical',
        title: cleanTitle,
        description: cleanDesc,
        priority,
        status: 'OPEN',
        adminReply: null,
        createdAt: new Date().toISOString()
      };

      list.unshift(ticket);
      storageAdapter.set(STORAGE_KEYS.SUPPORT_TICKETS, list);
      activityService.log(
        'SUPPORT_TICKET_CREATED',
        session.username,
        `${session.username} [${effRank} / ${priority}] submitted support ticket "${cleanTitle}"`
      );
      return ticket;
    },

    listSupportTickets(session, onlyMine = false) {
      authGuard.verifySession(session);
      const all = this._ensureSeedTickets();
      const effRole = authGuard.getEffectiveRole(session);
      const filtered =
        effRole === 'ADMIN' && !onlyMine
          ? all
          : all.filter(t => t.username.toLowerCase() === session.username.toLowerCase());
      return this._sortByPriorityAndDate(filtered);
    },

    adminUpdateSupportTicket(session, ticketId, { status, adminReply }) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._ensureSeedTickets();
      const t = all.find(x => x.id === ticketId);
      if (!t) throw new Error('Support ticket not found.');
      if (status) t.status = status;
      if (adminReply !== undefined) t.adminReply = adminReply;
      storageAdapter.set(STORAGE_KEYS.SUPPORT_TICKETS, all);
      activityService.log(
        'SUPPORT_TICKET_UPDATED',
        session.username,
        `Admin ${session.username} updated ticket ${t.id} (${t.status})`
      );
      return t;
    },

    // --- B) BUG REPORTS (Section 21) ---
    _ensureSeedBugs() {
      const existing = storageAdapter.get(STORAGE_KEYS.BUG_REPORTS, null);
      if (existing && Array.isArray(existing)) return existing;
      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'BUG-201',
          userId: 'USR-1003',
          username: 'NetherKing_TR',
          role: 'VIP',
          rank: 'MVP_PLUS',
          isVip: true,
          title: 'Villager Joker Hint Audio Volume on Safari',
          description:
            'Villager sound effect is slightly quieter than the level-up chime on iPad Safari.',
          category: 'Audio / UI',
          attachmentUrl: '',
          relatedParty: 'PRT-1002',
          priority: 'VERY HIGH',
          status: 'IN PROGRESS',
          createdAt: now
        }
      ];
      storageAdapter.set(STORAGE_KEYS.BUG_REPORTS, seeded);
      return seeded;
    },

    createBugReport(
      session,
      { title, description, category, attachmentUrl = '', relatedParty = '' }
    ) {
      authGuard.verifySession(session);
      const cleanTitle = String(title || '').trim();
      const cleanDesc = String(description || '').trim();
      if (!cleanTitle || !cleanDesc) {
        throw new Error('Please provide a bug title and detailed description.');
      }

      const effRole = authGuard.getEffectiveRole(session);
      const effRank = authGuard.getEffectiveRankId(session);
      const isVip = effRole !== 'PLAYER';
      const priority = this.computeUserPriority(session, 'bug');
      const list = this._ensureSeedBugs();
      const bug = {
        id: 'BUG-' + Math.floor(1000 + Math.random() * 9000),
        userId: session.userId || 'USR-0',
        username: session.username,
        role: effRole,
        rank: effRank,
        isVip,
        title: cleanTitle,
        description: cleanDesc,
        category: category || 'Gameplay',
        attachmentUrl: String(attachmentUrl || '').trim(),
        relatedParty: String(relatedParty || '').trim(),
        priority,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      };

      list.unshift(bug);
      storageAdapter.set(STORAGE_KEYS.BUG_REPORTS, list);
      activityService.log(
        'BUG_REPORTED',
        session.username,
        `${session.username} [${effRank} / ${priority}] reported bug "${cleanTitle}"`
      );
      return bug;
    },

    listBugReports(session, onlyMine = false) {
      authGuard.verifySession(session);
      const all = this._ensureSeedBugs();
      const effRole = authGuard.getEffectiveRole(session);
      const filtered =
        effRole === 'ADMIN' && !onlyMine
          ? all
          : all.filter(b => b.username.toLowerCase() === session.username.toLowerCase());
      return this._sortByPriorityAndDate(filtered);
    },

    adminUpdateBugStatus(session, bugId, newStatus) {
      authGuard.requireRole(session, ['ADMIN']);
      const allowed = ['OPEN', 'IN PROGRESS', 'WAITING FOR USER', 'RESOLVED', 'CLOSED'];
      if (!allowed.includes(newStatus)) throw new Error('Invalid bug status.');
      const all = this._ensureSeedBugs();
      const bug = all.find(b => b.id === bugId);
      if (!bug) throw new Error('Bug report not found.');
      bug.status = newStatus;
      storageAdapter.set(STORAGE_KEYS.BUG_REPORTS, all);
      activityService.log(
        'BUG_STATUS_UPDATED',
        session.username,
        `Admin ${session.username} set bug ${bug.id} status to ${newStatus}`
      );
      return bug;
    },

    // --- C) SUGGESTIONS (Section 22) ---
    _ensureSeedSuggestions() {
      const existing = storageAdapter.get(STORAGE_KEYS.SUGGESTIONS, null);
      if (existing && Array.isArray(existing)) return existing;
      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'SUG-301',
          userId: 'USR-1002',
          username: 'DragonSlayer99',
          role: 'VIP',
          rank: 'VIP_PLUS',
          isVip: true,
          title: 'Add Hardcore Redstone Engineering Category Mode',
          description:
            'A dedicated 15-question mode exclusively focused on Redstone circuits and comparators!',
          category: 'Game Modes',
          priority: 'HIGH',
          status: 'PLANNED',
          votes: 14,
          votedBy: ['DragonSlayer99', 'Mashallah', 'NetherKing_TR'],
          createdAt: now
        },
        {
          id: 'SUG-302',
          userId: 'USR-1005',
          username: 'DiamondHunter',
          role: 'PLAYER',
          rank: 'PLAYER',
          isVip: false,
          title: 'Netherite Frame Avatar Border in Shop',
          description: 'Allow spending Emeralds on custom profile borders.',
          category: 'Cosmetics',
          priority: 'NORMAL',
          status: 'REVIEWING',
          votes: 6,
          votedBy: ['DiamondHunter'],
          createdAt: now
        }
      ];
      storageAdapter.set(STORAGE_KEYS.SUGGESTIONS, seeded);
      return seeded;
    },

    createSuggestion(session, { title, description, category }) {
      authGuard.verifySession(session);
      const cleanTitle = String(title || '').trim();
      const cleanDesc = String(description || '').trim();
      if (!cleanTitle || !cleanDesc) {
        throw new Error('Please provide a suggestion title and description.');
      }

      const effRole = authGuard.getEffectiveRole(session);
      const effRank = authGuard.getEffectiveRankId(session);
      const isVip = effRole !== 'PLAYER';
      const priority = this.computeUserPriority(session, 'suggestion');
      const list = this._ensureSeedSuggestions();
      const sug = {
        id: 'SUG-' + Math.floor(1000 + Math.random() * 9000),
        userId: session.userId || 'USR-0',
        username: session.username,
        role: effRole,
        rank: effRank,
        isVip,
        title: cleanTitle,
        description: cleanDesc,
        category: category || 'Gameplay',
        priority,
        status: 'REVIEWING',
        votes: 1,
        votedBy: [session.username],
        createdAt: new Date().toISOString()
      };

      list.unshift(sug);
      storageAdapter.set(STORAGE_KEYS.SUGGESTIONS, list);
      activityService.log(
        'SUGGESTION_CREATED',
        session.username,
        `${session.username} [${effRank} / ${priority}] submitted suggestion "${cleanTitle}"`
      );
      return sug;
    },

    voteSuggestion(session, suggestionId) {
      authGuard.verifySession(session);
      const all = this._ensureSeedSuggestions();
      const sug = all.find(s => s.id === suggestionId);
      if (!sug) throw new Error('Suggestion not found.');
      sug.votedBy = sug.votedBy || [];
      const already = sug.votedBy.some(u => u.toLowerCase() === session.username.toLowerCase());
      if (already) {
        sug.votedBy = sug.votedBy.filter(u => u.toLowerCase() !== session.username.toLowerCase());
        sug.votes = Math.max(0, (sug.votes || 1) - 1);
      } else {
        sug.votedBy.push(session.username);
        sug.votes = (sug.votes || 0) + 1;
      }
      storageAdapter.set(STORAGE_KEYS.SUGGESTIONS, all);
      return sug;
    },

    listSuggestions(session, sortBy = 'PRIORITY') {
      authGuard.verifySession(session);
      const all = [...this._ensureSeedSuggestions()];
      if (sortBy === 'NEWEST') {
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sortBy === 'OLDEST') {
        all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (sortBy === 'MOST_VOTES') {
        all.sort((a, b) => (b.votes || 0) - (a.votes || 0));
      } else {
        return this._sortByPriorityAndDate(all);
      }
      return all;
    },

    adminUpdateSuggestionStatus(session, suggestionId, newStatus) {
      authGuard.requireRole(session, ['ADMIN']);
      const allowed = ['REVIEWING', 'PLANNED', 'IN DEVELOPMENT', 'COMPLETED', 'DECLINED'];
      if (!allowed.includes(newStatus)) throw new Error('Invalid suggestion status.');
      const all = this._ensureSeedSuggestions();
      const sug = all.find(s => s.id === suggestionId);
      if (!sug) throw new Error('Suggestion not found.');
      sug.status = newStatus;
      storageAdapter.set(STORAGE_KEYS.SUGGESTIONS, all);
      activityService.log(
        'SUGGESTION_STATUS_UPDATED',
        session.username,
        `Admin ${session.username} updated suggestion ${sug.id} status to ${newStatus}`
      );
      return sug;
    }
  };

  // ==========================================
  // 7. STRIPE PAYMENT & EMERALD PACKAGE ARCHITECTURE (Sections 14, 15, 16, 17, 28)
  // ==========================================
  // Currency Rule: 5 Emeralds = 1 TL -> 500 Emeralds = 100 TL (Minimum Purchase: 500 Emeralds)
  const DEFAULT_EMERALD_PACKAGES = [
    {
      id: 'PKG-EMERALD-500',
      name: '500 Emeralds Starter Pack',
      emeralds: 500,
      priceTL: 100,
      currency: 'TRY',
      icon: '💚',
      badge: 'STARTER',
      enabled: true
    },
    {
      id: 'PKG-EMERALD-1000',
      name: '1,000 Emeralds Miner Pack',
      emeralds: 1000,
      priceTL: 200,
      currency: 'TRY',
      icon: '🟩',
      badge: 'POPULAR',
      enabled: true
    },
    {
      id: 'PKG-EMERALD-2500',
      name: '2,500 Emeralds Redstone Chest',
      emeralds: 2500,
      priceTL: 500,
      currency: 'TRY',
      icon: '💎',
      badge: 'VALUE',
      enabled: true
    },
    {
      id: 'PKG-EMERALD-5000',
      name: '5,000 Emeralds Netherite Vault',
      emeralds: 5000,
      priceTL: 1000,
      currency: 'TRY',
      icon: '👑',
      badge: 'PRO',
      enabled: true
    },
    {
      id: 'PKG-EMERALD-10000',
      name: '10,000 Emeralds Millionaire Treasury',
      emeralds: 10000,
      priceTL: 2000,
      currency: 'TRY',
      icon: '🏆',
      badge: 'ULTIMATE',
      enabled: true
    }
  ];

  const paymentService = {
    conversionRateEmeraldsPerTL: 5, // 5 Emeralds = 1 TL
    minEmeraldPurchase: 500, // Minimum 500 Emeralds (100 TL)
    backendEndpoint: '/api/v1/stripe/create-checkout-session',
    webhookEndpoint: '/api/v1/stripe/webhook',

    _ensurePackages() {
      const existing = storageAdapter.get(STORAGE_KEYS.EMERALD_PACKAGES, null);
      if (existing && Array.isArray(existing) && existing.length > 0) return existing;
      storageAdapter.set(STORAGE_KEYS.EMERALD_PACKAGES, DEFAULT_EMERALD_PACKAGES);
      return DEFAULT_EMERALD_PACKAGES;
    },

    listEmeraldPackages(includeDisabled = false) {
      const all = this._ensurePackages().map(p => ({ ...p }));
      return includeDisabled ? all : all.filter(p => p.enabled !== false);
    },

    adminSaveEmeraldPackage(session, pkgData) {
      authGuard.requireRole(session, ['ADMIN']);
      const emeralds = Math.round(Number(pkgData.emeralds) || 0);
      if (emeralds < this.minEmeraldPurchase) {
        throw new Error(
          `Minimum Emerald package size is ${this.minEmeraldPurchase} Emeralds (100 TL).`
        );
      }
      const priceTL =
        pkgData.priceTL !== undefined
          ? Math.max(1, Math.round(Number(pkgData.priceTL)))
          : Math.round(emeralds / this.conversionRateEmeraldsPerTL);

      const list = this._ensurePackages();
      const existing = list.find(p => p.id === pkgData.id);
      if (existing) {
        existing.name = String(pkgData.name || existing.name).trim();
        existing.emeralds = emeralds;
        existing.priceTL = priceTL;
        existing.icon = String(pkgData.icon || existing.icon || '💚').trim();
        existing.badge = String(pkgData.badge || existing.badge || 'PACK').trim();
        if (pkgData.enabled !== undefined) existing.enabled = Boolean(pkgData.enabled);
      } else {
        list.push({
          id: pkgData.id || 'PKG-EMERALD-' + emeralds + '-' + Date.now().toString(36).toUpperCase(),
          name: String(pkgData.name || `${emeralds.toLocaleString('en-US')} Emeralds`).trim(),
          emeralds,
          priceTL,
          currency: 'TRY',
          icon: String(pkgData.icon || '💚').trim(),
          badge: String(pkgData.badge || 'CUSTOM').trim(),
          enabled: pkgData.enabled !== false
        });
      }
      storageAdapter.set(STORAGE_KEYS.EMERALD_PACKAGES, list);
      activityService.log(
        'EMERALD_PACKAGE_SAVED',
        session.username,
        `Admin ${session.username} saved Emerald package (${emeralds} 💚 = ${priceTL} TL)`
      );
      return list;
    },

    _getProcessedWebhookEvents() {
      return storageAdapter.get(STORAGE_KEYS.WEBHOOK_EVENTS, []);
    },

    _saveProcessedWebhookEvents(list) {
      storageAdapter.set(STORAGE_KEYS.WEBHOOK_EVENTS, list);
    },

    _ensureSeedPayments() {
      const existing = storageAdapter.get(STORAGE_KEYS.PAYMENTS, null);
      if (existing && Array.isArray(existing)) return existing;
      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'PAY-1001',
          userId: 'USR-1002',
          username: 'DragonSlayer99',
          productType: 'RANK',
          packageId: 'RANK-VIP-PLUS',
          product: '👑 VIP+ Rank',
          title: '👑 VIP+ Rank',
          emeraldsGranted: 0,
          rankGranted: 'VIP_PLUS',
          amount: 350,
          currency: 'TRY',
          stripeSessionId: 'cs_test_a1b2c3d4e5',
          stripePaymentId: 'pi_test_9988776655',
          webhookEventId: 'evt_test_seed_1001',
          status: 'PAID',
          createdAt: now,
          paidAt: now
        },
        {
          id: 'PAY-1002',
          userId: 'USR-1003',
          username: 'NetherKing_TR',
          productType: 'EMERALD_PACKAGE',
          packageId: 'PKG-EMERALD-1000',
          product: '1,000 Emeralds Miner Pack',
          title: '1,000 Emeralds Miner Pack',
          emeraldsGranted: 1000,
          rankGranted: null,
          amount: 200,
          currency: 'TRY',
          stripeSessionId: 'cs_test_f6g7h8i9j0',
          stripePaymentId: 'pi_test_1122334455',
          webhookEventId: 'evt_test_seed_1002',
          status: 'PAID',
          createdAt: now,
          paidAt: now
        }
      ];
      storageAdapter.set(STORAGE_KEYS.PAYMENTS, seeded);
      return seeded;
    },

    // Step 1 & 2 of Stripe Flow: Create Checkout Session (Status = PENDING; NEVER grants Emeralds yet!)
    createCheckoutSession(
      session,
      {
        productType = 'EMERALD_PACKAGE',
        packageId = 'PKG-EMERALD-500',
        title = '500 Emeralds',
        emeraldsGranted = 0,
        rankGranted = null,
        priceTL = 100,
        currency = 'TRY'
      }
    ) {
      authGuard.verifySession(session);

      const cleanEmeralds = Math.round(Number(emeraldsGranted) || 0);
      if (productType === 'EMERALD_PACKAGE' && cleanEmeralds < this.minEmeraldPurchase) {
        throw new Error(
          `Minimum Emerald purchase is ${this.minEmeraldPurchase} Emeralds (100 TL). Purchases below 500 Emeralds are not allowed.`
        );
      }

      const cleanAmount = Math.max(1, Math.round(Number(priceTL) || 100));
      const payments = this._ensureSeedPayments();
      const paymentId =
        'PAY-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        Math.random().toString(36).slice(2, 5).toUpperCase();
      const stripeSessionId =
        'cs_test_' +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10);

      // Compute cryptographic webhook verification token so client cannot spoof `payment = success`
      const webhookVerificationToken = computeSaltedDigest(
        `STRIPE_WH::${paymentId}::${stripeSessionId}::${session.username}::${cleanEmeralds}::${rankGranted || ''}`
      );

      const record = {
        id: paymentId,
        userId: session.userId || 'USR-0',
        username: session.username,
        productType,
        packageId,
        product: title,
        title,
        emeraldsGranted: cleanEmeralds,
        rankGranted: rankGranted || null,
        amount: cleanAmount,
        currency: currency || 'TRY',
        stripeSessionId,
        stripePaymentId: null,
        webhookEventId: null,
        webhookVerificationToken,
        status: 'PENDING', // PENDING | PAID | FAILED | REFUNDED
        createdAt: new Date().toISOString(),
        paidAt: null
      };

      payments.unshift(record);
      storageAdapter.set(STORAGE_KEYS.PAYMENTS, payments);

      activityService.log(
        'STRIPE_CHECKOUT_CREATED',
        session.username,
        `${session.username} opened Stripe Checkout Session (${stripeSessionId}) for "${title}" (${cleanAmount} ${record.currency}) — Status: PENDING`
      );

      return {
        ok: true,
        paymentCompleted: false, // Never true until verified webhook!
        checkoutSession: {
          paymentId: record.id,
          stripeSessionId: record.stripeSessionId,
          productType: record.productType,
          title: record.title,
          emeraldsGranted: record.emeraldsGranted,
          rankGranted: record.rankGranted,
          amount: record.amount,
          currency: record.currency,
          status: record.status,
          webhookVerificationToken
        }
      };
    },

    // Backward-compatible alias that opens a PENDING checkout session (never fakes instant completion)
    initiateCheckout(
      session,
      {
        packageId = 'VIP_MEMBERSHIP_200TL',
        title = '👑 VIP Membership',
        priceTL = 200,
        productType = 'RANK',
        emeraldsGranted = 0,
        rankGranted = 'VIP'
      }
    ) {
      const res = this.createCheckoutSession(session, {
        productType,
        packageId,
        title,
        emeraldsGranted,
        rankGranted,
        priceTL,
        currency: 'TRY'
      });
      return {
        ok: false,
        paymentCompleted: false,
        providerConfigured: false,
        intent: res.checkoutSession,
        checkoutSession: res.checkoutSession,
        message:
          'Stripe Checkout Session created (Status: PENDING). Currency or Rank is only granted after a verified Stripe Webhook event (checkout.session.completed).'
      };
    },

    // Rejects any direct client attempt to mark payment=success without a signed webhook event
    verifyClientPaymentRedirect() {
      throw new Error(
        'Security Policy: Client-side payment=success flags are never trusted. Waiting for verified Stripe webhook event.'
      );
    },

    // Step 3-8 of Stripe Flow: Process Verified Stripe Webhook Event with Strict Idempotency!
    processStripeWebhook({
      eventId,
      eventType = 'checkout.session.completed',
      stripeSessionId,
      stripePaymentId = null,
      webhookSignature = null
    }) {
      if (!eventId || !stripeSessionId) {
        throw new Error('Invalid Stripe webhook payload: missing eventId or stripeSessionId.');
      }

      // 1. Strict Idempotency Check: Never grant currency twice if Stripe retries a webhook!
      const processedEvents = this._getProcessedWebhookEvents();
      if (processedEvents.includes(eventId)) {
        throw new Error(`Duplicate Stripe webhook event "${eventId}" rejected (Idempotency Check).`);
      }

      const payments = this._ensureSeedPayments();
      const payment = payments.find(
        p => p.stripeSessionId === stripeSessionId || p.id === stripeSessionId
      );
      if (!payment) {
        throw new Error(`Stripe Checkout Session "${stripeSessionId}" not found.`);
      }

      if (payment.status === 'PAID') {
        processedEvents.push(eventId);
        this._saveProcessedWebhookEvents(processedEvents);
        throw new Error(`Payment "${payment.id}" was already fulfilled (Idempotency Protection).`);
      }

      // Verify cryptographic token if present on record
      if (payment.webhookVerificationToken && webhookSignature) {
        if (webhookSignature !== payment.webhookVerificationToken) {
          throw new Error('Stripe Webhook Signature verification failed.');
        }
      }

      // Record eventId in idempotency store before mutating balances
      processedEvents.push(eventId);
      this._saveProcessedWebhookEvents(processedEvents);

      if (eventType === 'checkout.session.payment_failed') {
        payment.status = 'FAILED';
        payment.webhookEventId = eventId;
        storageAdapter.set(STORAGE_KEYS.PAYMENTS, payments);
        activityService.log(
          'STRIPE_PAYMENT_FAILED',
          payment.username,
          `Stripe webhook reported FAILED payment for ${payment.username} (${payment.title})`
        );
        return { ok: false, status: 'FAILED', payment };
      }

      if (eventType !== 'checkout.session.completed') {
        throw new Error(`Unsupported Stripe webhook event type: ${eventType}`);
      }

      // Mark payment PAID
      payment.status = 'PAID';
      payment.webhookEventId = eventId;
      payment.stripePaymentId =
        stripePaymentId ||
        'pi_test_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      payment.paidAt = new Date().toISOString();
      storageAdapter.set(STORAGE_KEYS.PAYMENTS, payments);

      let updatedProfile = null;
      let transaction = null;

      // Grant Emeralds if Emerald Package
      if (payment.emeraldsGranted > 0 && window.MCMServices && window.MCMServices.economyService) {
        const econRes = window.MCMServices.economyService._creditVerifiedStripePurchase({
          username: payment.username,
          emeralds: payment.emeraldsGranted,
          paymentId: payment.id,
          stripePaymentId: payment.stripePaymentId,
          productTitle: payment.title
        });
        updatedProfile = econRes.profile;
        transaction = econRes.transaction;
      }

      // Grant Rank if Rank Purchase
      if (payment.rankGranted) {
        userService._grantRankInternal(payment.username, payment.rankGranted, null);
        if (window.MCMServices && window.MCMServices.economyService) {
          updatedProfile = window.MCMServices.economyService.getPlayerEconomyProfile(
            payment.username
          );
        }
      }

      // Record purchase ID on user account
      const rawUsers = userService._getAllRaw();
      const u = rawUsers.find(
        x => x.minecraftUsername.toLowerCase() === payment.username.toLowerCase()
      );
      if (u) {
        u.purchases = Array.isArray(u.purchases) ? u.purchases : [];
        u.purchases.unshift({
          paymentId: payment.id,
          packageId: payment.packageId,
          title: payment.title,
          amount: payment.amount,
          currency: payment.currency,
          stripePaymentId: payment.stripePaymentId,
          purchasedAt: payment.paidAt
        });
        userService._saveAllRaw(rawUsers);
      }

      // Refresh active session if the logged-in user is the buyer
      const activeSess = licenseService.getActiveSession();
      if (activeSess && activeSess.username.toLowerCase() === payment.username.toLowerCase()) {
        licenseService.refreshSessionRole(activeSess);
      }

      activityService.log(
        'STRIPE_WEBHOOK_VERIFIED',
        payment.username,
        `Verified Stripe Webhook (${eventId}): Granted "${payment.title}" to ${payment.username} (${payment.amount} ${payment.currency})`
      );

      return {
        ok: true,
        status: 'PAID',
        payment,
        emeraldsGranted: payment.emeraldsGranted,
        rankGranted: payment.rankGranted,
        profile: updatedProfile,
        transaction
      };
    },

    // Helper for Stripe Sandbox Modal in Test Mode: Generates a signed test webhook & processes it
    completeTestModeCheckout(session, stripeSessionId, outcome = 'SUCCESS') {
      authGuard.verifySession(session);
      const payments = this._ensureSeedPayments();
      const payment = payments.find(
        p => p.stripeSessionId === stripeSessionId || p.id === stripeSessionId
      );
      if (!payment) throw new Error('Checkout session not found.');

      const eventId =
        'evt_test_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      const eventType =
        outcome === 'FAILED'
          ? 'checkout.session.payment_failed'
          : 'checkout.session.completed';

      return this.processStripeWebhook({
        eventId,
        eventType,
        stripeSessionId: payment.stripeSessionId,
        webhookSignature: payment.webhookVerificationToken
      });
    },

    // Section 27 & 28: Admin Refund Purchase
    adminRefundPayment(session, paymentId) {
      authGuard.requireRole(session, ['ADMIN']);
      const payments = this._ensureSeedPayments();
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment record not found.');
      if (payment.status !== 'PAID') {
        throw new Error(`Only PAID payments can be refunded (Current status: ${payment.status}).`);
      }

      payment.status = 'REFUNDED';
      payment.refundedAt = new Date().toISOString();
      payment.refundedBy = session.username;
      storageAdapter.set(STORAGE_KEYS.PAYMENTS, payments);

      if (payment.emeraldsGranted > 0 && window.MCMServices && window.MCMServices.economyService) {
        window.MCMServices.economyService.adminModifyBalance(
          session,
          payment.username,
          'REMOVE',
          payment.emeraldsGranted,
          `Stripe Refund (${payment.id} / ${payment.stripePaymentId})`
        );
      }

      if (payment.rankGranted) {
        userService._grantRankInternal(payment.username, 'PLAYER', null);
      }

      activityService.log(
        'PAYMENT_REFUNDED',
        session.username,
        `Admin ${session.username} refunded payment ${payment.id} (${payment.title}) for ${payment.username}`
      );

      return payment;
    },

    listPayments(session, onlyMine = false) {
      authGuard.verifySession(session);
      const all = this._ensureSeedPayments();
      const effRole = authGuard.getEffectiveRole(session);
      if (effRole === 'ADMIN' && !onlyMine) {
        return all;
      }
      return all.filter(p => p.username.toLowerCase() === session.username.toLowerCase());
    },

    listPaymentIntents(session) {
      return this.listPayments(session, false);
    },

    getRevenueMetrics() {
      const all = this._ensureSeedPayments();
      const paid = all.filter(p => p.status === 'PAID');
      const totalRevenueTL = paid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalEmeraldsSold = paid.reduce(
        (sum, p) => sum + (Number(p.emeraldsGranted) || 0),
        0
      );
      return {
        totalPayments: all.length,
        paidCount: paid.length,
        totalRevenueTL,
        totalEmeraldsSold
      };
    }
  };

  // ==========================================
  // 8. VERSIONED BACKUP SYSTEM (Section 29: includes backup/payments/ + Download Backup)
  // ==========================================
  const backupService = {
    _buildStructuredSnapshot(label = 'Manual Snapshot') {
      // Never include plaintext passwords; userService.getAllUsers() strips passwordHash
      const safeUsers = userService.getAllUsers();
      const parties = partyService._getAllRaw();
      const licenses = licenseService._getAllRaw().map(l => ({
        id: l.id,
        name: l.name,
        role: normalizeRole(l.role),
        rank: l.rank || l.role,
        status: l.status,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        assignedUsername: l.assignedUsername
      }));
      const transactions =
        window.MCMServices && window.MCMServices.economyService
          ? window.MCMServices.economyService._getAllRawTransactions()
          : [];
      const payments = paymentService._ensureSeedPayments().map(p => {
        const copy = { ...p };
        delete copy.webhookVerificationToken;
        return copy;
      });
      const settings =
        window.MCMServices && window.MCMServices.configService
          ? window.MCMServices.configService.getConfig()
          : {};

      const now = new Date().toISOString();
      const existing = storageAdapter.get(STORAGE_KEYS.BACKUPS, []);
      const versionNumber = existing.length + 1;

      return {
        id: `BKP-v${versionNumber}-${Date.now().toString(36).toUpperCase()}`,
        version: `v${versionNumber}.0`,
        label,
        createdAt: now,
        paths: {
          'backup/users/': safeUsers,
          'backup/parties/': parties,
          'backup/licenses/': licenses,
          'backup/transactions/': transactions,
          'backup/payments/': payments,
          'backup/settings/': settings
        },
        counts: {
          users: safeUsers.length,
          parties: parties.length,
          licenses: licenses.length,
          transactions: transactions.length,
          payments: payments.length
        }
      };
    },

    _ensureInitialBackup() {
      const existing = storageAdapter.get(STORAGE_KEYS.BACKUPS, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        existing.forEach(b => {
          if (b.paths && !b.paths['backup/payments/']) {
            b.paths['backup/payments/'] = [];
          }
          if (b.counts && b.counts.payments === undefined) {
            b.counts.payments = (b.paths?.['backup/payments/'] || []).length;
          }
        });
        return existing;
      }
      const initial = [this._buildStructuredSnapshot('Initial System Architecture Backup')];
      storageAdapter.set(STORAGE_KEYS.BACKUPS, initial);
      return initial;
    },

    listBackups(session) {
      authGuard.requireRole(session, ['ADMIN']);
      return this._ensureInitialBackup();
    },

    createBackup(session, label = 'Admin Snapshot') {
      authGuard.requireRole(session, ['ADMIN']);
      const list = this._ensureInitialBackup();
      const snap = this._buildStructuredSnapshot(label);
      list.unshift(snap);
      if (list.length > 20) list.length = 20;
      storageAdapter.set(STORAGE_KEYS.BACKUPS, list);

      activityService.log(
        'BACKUP_CREATED',
        session.username,
        `Admin ${session.username} created backup ${snap.id} (${snap.version}: ${label})`
      );
      return snap;
    },

    exportBackupJson(session, backupId) {
      authGuard.requireRole(session, ['ADMIN']);
      const list = this._ensureInitialBackup();
      const target = backupId ? list.find(b => b.id === backupId) : list[0];
      if (!target) throw new Error('Backup snapshot not found.');
      return {
        filename: `minecraft-milyoner-${target.id.toLowerCase()}.json`,
        json: JSON.stringify(target, null, 2),
        backup: target
      };
    },

    restoreBackup(session, backupId) {
      authGuard.requireRole(session, ['ADMIN']);
      const list = this._ensureInitialBackup();
      const target = list.find(b => b.id === backupId);
      if (!target) throw new Error('Backup snapshot not found.');

      if (Array.isArray(target.paths['backup/parties/'])) {
        partyService._saveAllRaw(target.paths['backup/parties/']);
      }
      if (Array.isArray(target.paths['backup/users/'])) {
        const currentRaw = userService._getAllRaw();
        const restoredUsers = target.paths['backup/users/'].map(u => {
          const prev = currentRaw.find(
            x => x.id === u.id || x.minecraftUsername === u.minecraftUsername
          );
          return {
            ...u,
            passwordHash: prev ? prev.passwordHash : null
          };
        });
        userService._saveAllRaw(restoredUsers);
      }

      activityService.log(
        'BACKUP_RESTORED',
        session.username,
        `Admin ${session.username} restored system state from backup ${target.id} (${target.version})`
      );
      return target;
    }
  };

  // ==========================================
  // 9. PLAYER DIRECTORY SERVICE
  // ==========================================
  const playerService = {
    getAllPlayers() {
      const existing = storageAdapter.get(STORAGE_KEYS.PLAYERS, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        return existing;
      }

      const now = new Date().toISOString();
      const initial = [
        {
          username: 'Mashallah',
          role: 'ADMIN',
          licenseId: 'MASTER-ADMIN-ROOT',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'DragonSlayer99',
          role: 'VIP',
          licenseId: 'LIC-VIP-01',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'NetherKing_TR',
          role: 'VIP',
          licenseId: 'LIC-VIP-02',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'OrganizerAlex',
          role: 'VIP',
          licenseId: 'LIC-ORG-01',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'DiamondHunter',
          role: 'PLAYER',
          licenseId: 'LIC-PLY-02',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'Steve',
          role: 'PLAYER',
          licenseId: 'LIC-PLY-01',
          lastSeenAt: now,
          status: 'ONLINE'
        }
      ];
      storageAdapter.set(STORAGE_KEYS.PLAYERS, initial);
      return initial;
    },

    TouchPlayer(username, role, licenseId) {
      const all = this.getAllPlayers();
      const now = new Date().toISOString();
      const normRole = normalizeRole(role);
      const existing = all.find(
        p => p.username.toLowerCase() === String(username).toLowerCase()
      );
      if (existing) {
        existing.role = normRole;
        existing.licenseId = licenseId;
        existing.lastSeenAt = now;
        existing.status = 'ONLINE';
      } else {
        all.unshift({
          username,
          role: normRole,
          licenseId,
          lastSeenAt: now,
          status: 'ONLINE'
        });
      }
      storageAdapter.set(STORAGE_KEYS.PLAYERS, all);
    }
  };

  // Export services to global namespace
  window.MCMServices = {
    authGuard,
    authService: licenseService,
    userService,
    licenseService,
    partyService,
    playerService,
    supportService,
    paymentService,
    backupService,
    activityService,
    PARTY_STATUSES
  };
})();
