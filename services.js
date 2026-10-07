/**
 * MINECRAFT MILYONER — TOURNAMENT & LICENSE PLATFORM SERVICES
 * Clean Data & Authorization Abstraction Layer:
 * - authGuard
 * - licenseService
 * - partyService
 * - playerService
 * - activityService
 *
 * Designed so storage adapters can be swapped with a remote REST/GraphQL backend
 * without changing any UI component code.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    LICENSES: 'mcm_platform_licenses_v2',
    PARTIES: 'mcm_platform_parties_v2',
    PLAYERS: 'mcm_platform_players_v2',
    ACTIVITY: 'mcm_platform_activity_v2',
    SESSION: 'mcm_platform_active_session_v2'
  };

  // Precomputed SHA-256 digest of the master admin license (salted) so plaintext never appears in source
  // Salt: "MCM_2026_SALT::" + code
  const MASTER_SALT = 'MCM_2026_SALT::';
  const MASTER_ADMIN_DIGEST = 'df8896b8447df2314b2a64f4ba6abb3992740163430da594d1b5cdc0686c24eb';
  const LEGACY_COMMUNITY_DIGEST = '32c69093739b5fac530d8dc5d90fcd8abd57ea1f4c805dc563af52f5bf23083e';

  // Pure JS SHA-256 implementation (works in both HTTPS and local file:// environments)
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
        const i2 = i + j;
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

  function computeSaltedDigest(rawCode) {
    const utf8 = unescape(encodeURIComponent(MASTER_SALT + String(rawCode).trim()));
    return sha256(utf8);
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
      if (logs.length > 250) logs.length = 250;
      storageAdapter.set(STORAGE_KEYS.ACTIVITY, logs);
      return entry;
    },

    clearAll(session) {
      authGuard.requireRole(session, ['ADMIN']);
      storageAdapter.set(STORAGE_KEYS.ACTIVITY, []);
      this.log('SYSTEM', session.username, `${session.username} cleared the activity log`);
    }
  };

  // ==========================================
  // 2. AUTHORIZATION GUARD
  // ==========================================
  const authGuard = {
    verifySession(session) {
      if (!session || !session.licenseId || !session.role || !session.signature) {
        throw new Error('Unauthorized: Geçersiz oturum. Lütfen tekrar lisans girişi yapın.');
      }
      const expectedSig = computeSaltedDigest(
        `${session.licenseId}:${session.role}:${session.username}`
      );
      if (session.signature !== expectedSig) {
        throw new Error('Security Violation: Oturum yetki imzası doğrulanamadı.');
      }

      // If not master admin or built-in community license, verify license is still active in store
      if (!session.isMasterAdmin && session.licenseId !== 'LIC-COMMUNITY-XXQ') {
        const lic = licenseService._findRawById(session.licenseId);
        if (!lic) {
          throw new Error('Lisans bulunamadı veya silindi.');
        }
        const effectiveStatus = licenseService.computeEffectiveStatus(lic);
        if (effectiveStatus !== 'ACTIVE') {
          throw new Error(`Lisans durumu geçersiz (${effectiveStatus}).`);
        }
      }
      return true;
    },

    requireRole(session, allowedRoles = []) {
      this.verifySession(session);
      if (!allowedRoles.includes(session.role)) {
        throw new Error(
          `Yetkisiz İşlem: Bu işlem için (${allowedRoles.join(' veya ')}) yetkisi gereklidir.`
        );
      }
      return true;
    }
  };

  // ==========================================
  // 3. LICENSE SERVICE
  // ==========================================
  const licenseService = {
    _ensureSeedData() {
      const existing = storageAdapter.get(STORAGE_KEYS.LICENSES, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'LIC-ORG-01',
          code: 'MCML-ORG1-7F4K',
          name: 'Turnuva Organizatör Lisansı #1',
          role: 'ORGANIZER',
          status: 'ACTIVE', // ACTIVE | DISABLED | REVOKED
          createdAt: now,
          expiresAt: null, // null = Never
          assignedUsername: 'OrganizerAlex',
          currentSessionUser: null,
          lastUsedAt: null
        },
        {
          id: 'LIC-PLY-01',
          code: 'MCML-PLYR-92QX',
          name: 'Oyuncu Lisansı — Steve',
          role: 'PLAYER',
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
          name: 'Oyuncu Lisansı — DiamondHunter',
          role: 'PLAYER',
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
          name: 'Eski Test Lisansı',
          role: 'PLAYER',
          status: 'REVOKED',
          createdAt: now,
          expiresAt: null,
          assignedUsername: 'Herobrine',
          currentSessionUser: null,
          lastUsedAt: null
        }
      ];

      storageAdapter.set(STORAGE_KEYS.LICENSES, seeded);
      activityService.log('LICENSE_SEED', 'System', 'Varsayılan turnuva lisansları hazırlandı.');
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
      const prefix = role === 'ADMIN' ? 'MCAD' : role === 'ORGANIZER' ? 'MCOR' : 'MCML';
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return `${prefix}-${seg()}-${seg()}`;
    },

    // Validate license login asynchronously (simulating production API latency for loading state)
    async validateAndLogin(rawCode, customUsername = '') {
      await new Promise(r => setTimeout(r, 420));

      const cleanCode = String(rawCode || '').trim();
      if (!cleanCode) {
        return { ok: false, error: 'Lütfen geçerli bir lisans kodu girin.' };
      }

      const digest = computeSaltedDigest(cleanCode);

      // 1. Check Master Admin License Digest
      if (digest === MASTER_ADMIN_DIGEST) {
        const username = customUsername.trim() || 'Mashallah';
        const session = this._buildSignedSession({
          licenseId: 'MASTER-ADMIN-ROOT',
          licenseName: 'Master Admin License',
          role: 'ADMIN',
          username,
          isMasterAdmin: true,
          codeMasked: 'MASTER-****-ADMIN'
        });
        this._saveSession(session);
        playerService.TouchPlayer(username, 'ADMIN', 'MASTER-ADMIN-ROOT');
        activityService.log('ADMIN_LOGIN', username, `${username} unlocked the Admin Panel`);
        return { ok: true, session };
      }

      // 2. Check Legacy Community Access Code ("xxqnetwork") as PLAYER role for backward compatibility
      if (digest === LEGACY_COMMUNITY_DIGEST) {
        const username = customUsername.trim() || 'Steve_' + Math.floor(100 + Math.random() * 899);
        const session = this._buildSignedSession({
          licenseId: 'LIC-COMMUNITY-XXQ',
          licenseName: 'XXQ Network Topluluk Lisansı',
          role: 'PLAYER',
          username,
          isMasterAdmin: false,
          codeMasked: 'XXQ-****-NET'
        });
        this._saveSession(session);
        playerService.TouchPlayer(username, 'PLAYER', 'LIC-COMMUNITY-XXQ');
        activityService.log('PLAYER_LOGIN', username, `Player ${username} logged in with community license`);
        return { ok: true, session };
      }

      // 3. Check Managed Licenses in Storage
      const all = this._getAllRaw();
      const found = all.find(l => l.code.toUpperCase() === cleanCode.toUpperCase());

      if (!found) {
        return {
          ok: false,
          error: 'Geçersiz lisans kodu! Lütfen kodunuzu kontrol edin.'
        };
      }

      const effStatus = this.computeEffectiveStatus(found);
      if (effStatus === 'REVOKED') {
        return {
          ok: false,
          error: 'Bu lisans iptal edilmiştir (REVOKED). Yönetici ile iletişime geçin.'
        };
      }
      if (effStatus === 'DISABLED') {
        return {
          ok: false,
          error: 'Bu lisans şu anda devre dışı bırakılmıştır (DISABLED).'
        };
      }
      if (effStatus === 'EXPIRED') {
        return {
          ok: false,
          error: 'Bu lisansın kullanım süresi dolmuştur (EXPIRED).'
        };
      }

      const username =
        customUsername.trim() ||
        found.assignedUsername ||
        (found.role === 'ORGANIZER' ? 'Organizer' : 'Player_' + found.code.slice(-4));

      found.currentSessionUser = username;
      found.lastUsedAt = new Date().toISOString();
      this._saveAllRaw(all);

      const session = this._buildSignedSession({
        licenseId: found.id,
        licenseName: found.name,
        role: found.role,
        username,
        isMasterAdmin: false,
        codeMasked: found.code.slice(0, 5) + '****' + found.code.slice(-4)
      });

      this._saveSession(session);
      playerService.TouchPlayer(username, found.role, found.id);
      activityService.log(
        'LICENSE_LOGIN',
        username,
        `${username} (${found.role}) logged in using license "${found.name}"`
      );

      return { ok: true, session };
    },

    _buildSignedSession({ licenseId, licenseName, role, username, isMasterAdmin, codeMasked }) {
      const signature = computeSaltedDigest(`${licenseId}:${role}:${username}`);
      return {
        licenseId,
        licenseName,
        role,
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

    getActiveSession() {
      try {
        const raw =
          sessionStorage.getItem(STORAGE_KEYS.SESSION) ||
          localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        authGuard.verifySession(parsed);
        return parsed;
      } catch (e) {
        this.logout();
        return null;
      }
    },

    logout() {
      const current = storageAdapter.get(STORAGE_KEYS.SESSION, null);
      if (current && current.licenseId && !current.isMasterAdmin) {
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
      } catch (e) {}
    },

    // ADMIN ONLY METHODS
    listLicensesForAdmin(session) {
      authGuard.requireRole(session, ['ADMIN']);
      return this._getAllRaw().map(l => ({
        ...l,
        effectiveStatus: this.computeEffectiveStatus(l)
      }));
    },

    createLicense(session, { name, code, role, expiresAt, assignedUsername }) {
      authGuard.requireRole(session, ['ADMIN']);
      const cleanRole = ['ADMIN', 'ORGANIZER', 'PLAYER'].includes(role) ? role : 'PLAYER';
      const finalCode = (code && code.trim().toUpperCase()) || this.generateRandomCode(cleanRole);
      const all = this._getAllRaw();

      if (all.some(l => l.code.toUpperCase() === finalCode)) {
        throw new Error('Bu lisans kodu zaten mevcut!');
      }

      const newLic = {
        id: 'LIC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
        code: finalCode,
        name: (name || '').trim() || `${cleanRole} License`,
        role: cleanRole,
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
      if (!allowed.includes(newStatus)) throw new Error('Geçersiz lisans durumu.');

      const all = this._getAllRaw();
      const target = all.find(l => l.id === licenseId);
      if (!target) throw new Error('Lisans bulunamadı.');

      target.status = newStatus;
      if (newStatus !== 'ACTIVE') {
        target.currentSessionUser = null;
      }
      this._saveAllRaw(all);

      const actionWord =
        newStatus === 'REVOKED'
          ? 'revoked'
          : newStatus === 'DISABLED'
          ? 'disabled'
          : 'activated';

      activityService.log(
        `LICENSE_${newStatus}`,
        session.username,
        `${session.username} ${actionWord} license "${target.name}" (${target.code})`
      );
      return target;
    },

    deleteLicense(session, licenseId) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const idx = all.findIndex(l => l.id === licenseId);
      if (idx === -1) throw new Error('Lisans bulunamadı.');

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
  // 4. PARTY & INVITATION SERVICE
  // ==========================================
  const PARTY_STATUSES = ['WAITING', 'READY', 'STARTING', 'ACTIVE', 'FINISHED', 'CANCELLED'];

  const partyService = {
    _ensureSeedParties() {
      const existing = storageAdapter.get(STORAGE_KEYS.PARTIES, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          id: 'PRT-1001',
          name: 'Minecraft Championship #1',
          organizer: 'Mashallah',
          organizerLicenseId: 'MASTER-ADMIN-ROOT',
          maxPlayers: 4,
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
      if (session.role === 'ADMIN') {
        return all;
      }
      if (session.role === 'ORGANIZER') {
        return all.filter(
          p =>
            p.organizer.toLowerCase() === session.username.toLowerCase() ||
            p.participants.some(pt => pt.username.toLowerCase() === session.username.toLowerCase())
        );
      }
      // PLAYER: only see parties they have joined or been invited to
      return all.filter(
        p =>
          p.participants.some(pt => pt.username.toLowerCase() === session.username.toLowerCase()) ||
          (p.invitedUsers || []).some(u => u.toLowerCase() === session.username.toLowerCase())
      );
    },

    getPartyById(session, partyId) {
      authGuard.verifySession(session);
      return this._getAllRaw().find(p => p.id === partyId) || null;
    },

    // ONLY ADMIN and ORGANIZER can create parties
    createParty(session, { name, maxPlayers = 4 }) {
      authGuard.requireRole(session, ['ADMIN', 'ORGANIZER']);

      const cleanName = String(name || '').trim();
      if (!cleanName) throw new Error('Lütfen bir parti adı girin.');

      const maxP = Math.max(2, Math.min(16, Number(maxPlayers) || 4));
      const all = this._getAllRaw();
      const now = new Date().toISOString();

      let inviteCode = this.generateInviteCode();
      while (all.some(p => p.inviteCode === inviteCode)) {
        inviteCode = this.generateInviteCode();
      }

      const newParty = {
        id: 'PRT-' + Math.floor(1000 + Math.random() * 9000),
        name: cleanName,
        organizer: session.username,
        organizerLicenseId: session.licenseId,
        maxPlayers: maxP,
        inviteCode,
        status: 'WAITING',
        createdAt: now,
        participants: [
          {
            username: session.username,
            role: session.role,
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
        `${session.username} created party "${newParty.name}" (${newParty.inviteCode})`,
        { partyId: newParty.id }
      );

      return newParty;
    },

    _assertPartyOwnerOrAdmin(session, party) {
      authGuard.verifySession(session);
      if (!party) throw new Error('Parti bulunamadı.');
      const isOwner = party.organizer.toLowerCase() === session.username.toLowerCase();
      if (session.role !== 'ADMIN' && !(session.role === 'ORGANIZER' && isOwner)) {
        throw new Error('Yetkisiz İşlem: Yalnızca parti sahibi veya Admin bu işlemi yapabilir.');
      }
    },

    invitePlayer(session, partyId, targetUsername = '') {
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      if (party.status === 'CANCELLED' || party.status === 'FINISHED') {
        throw new Error('Bu parti aktif değil.');
      }

      const cleanUser = String(targetUsername || '').trim();
      if (cleanUser) {
        if (!party.invitedUsers) party.invitedUsers = [];
        if (!party.invitedUsers.some(u => u.toLowerCase() === cleanUser.toLowerCase())) {
          party.invitedUsers.push(cleanUser);
        }
        // Also add as INVITED in participants list if not already present
        if (!party.participants.some(pt => pt.username.toLowerCase() === cleanUser.toLowerCase())) {
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
        invitationText: `Minecraft Milyoner Party Invitation\nParty: ${party.name}\nOrganizer: ${party.organizer}\nInvite Code: ${party.inviteCode}`
      };
    },

    joinPartyByInviteCode(session, inviteCodeInput) {
      authGuard.verifySession(session);
      const code = String(inviteCodeInput || '').trim().toUpperCase();
      if (!code) throw new Error('Lütfen geçerli bir davet kodu (Invite Code) girin.');

      const all = this._getAllRaw();
      const party = all.find(p => p.inviteCode.toUpperCase() === code);
      if (!party) {
        throw new Error('Bu davet koduna ait bir parti bulunamadı!');
      }

      if (party.status === 'CANCELLED' || party.status === 'FINISHED') {
        throw new Error(`Bu partiye katılamazsınız. Parti durumu: ${party.status}`);
      }

      const existingParticipant = party.participants.find(
        pt => pt.username.toLowerCase() === session.username.toLowerCase()
      );

      const joinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      if (!existingParticipant && joinedCount >= party.maxPlayers) {
        throw new Error('Bu parti maksimum oyuncu kapasitesine ulaşmış!');
      }

      const now = new Date().toISOString();
      if (existingParticipant) {
        existingParticipant.joinStatus = 'JOINED';
        existingParticipant.role = session.role;
        existingParticipant.joinedAt = now;
      } else {
        party.participants.push({
          username: session.username,
          role: session.role,
          joinStatus: 'JOINED',
          joinedAt: now
        });
      }

      // Auto-update status to READY if full
      const newJoinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      if (newJoinedCount >= party.maxPlayers && party.status === 'WAITING') {
        party.status = 'READY';
      }

      this._saveAllRaw(all);
      activityService.log(
        'PLAYER_JOINED',
        session.username,
        `Player ${session.username} joined the party "${party.name}"`,
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
      if (idx === -1) throw new Error('Oyuncu partide bulunamadı.');

      const removed = party.participants.splice(idx, 1)[0];
      if (party.status === 'READY' && party.participants.length < party.maxPlayers) {
        party.status = 'WAITING';
      }

      this._saveAllRaw(all);
      activityService.log(
        'PLAYER_REMOVED',
        session.username,
        `${session.username} removed ${removed.username} from "${party.name}"`,
        { partyId: party.id }
      );
      return party;
    },

    updatePartySettings(session, partyId, { name, maxPlayers, status }) {
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      if (name && name.trim()) {
        party.name = name.trim();
      }
      if (maxPlayers) {
        party.maxPlayers = Math.max(2, Math.min(16, Number(maxPlayers)));
      }
      if (status && PARTY_STATUSES.includes(status)) {
        party.status = status;
      }

      this._saveAllRaw(all);
      activityService.log(
        'PARTY_UPDATED',
        session.username,
        `${session.username} updated settings for party "${party.name}" (${party.status})`,
        { partyId: party.id }
      );
      return party;
    },

    setPartyStatus(session, partyId, newStatus) {
      if (!PARTY_STATUSES.includes(newStatus)) {
        throw new Error('Geçersiz parti durumu.');
      }
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      this._assertPartyOwnerOrAdmin(session, party);

      party.status = newStatus;
      this._saveAllRaw(all);

      const verbMap = {
        STARTING: 'is starting',
        ACTIVE: 'started',
        FINISHED: 'finished',
        CANCELLED: 'cancelled',
        READY: 'marked ready',
        WAITING: 'set to waiting'
      };
      activityService.log(
        `PARTY_${newStatus}`,
        session.username,
        `${session.username} ${verbMap[newStatus] || 'updated'} the party "${party.name}"`,
        { partyId: party.id }
      );
      return party;
    },

    transferOwnership(session, partyId, newOwnerUsername) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const party = all.find(p => p.id === partyId);
      if (!party) throw new Error('Parti bulunamadı.');

      const cleanOwner = String(newOwnerUsername || '').trim();
      if (!cleanOwner) throw new Error('Yeni sahip kullanıcı adı boş olamaz.');

      const oldOwner = party.organizer;
      party.organizer = cleanOwner;
      if (!party.participants.some(pt => pt.username.toLowerCase() === cleanOwner.toLowerCase())) {
        party.participants.push({
          username: cleanOwner,
          role: 'ORGANIZER',
          joinStatus: 'JOINED',
          joinedAt: new Date().toISOString()
        });
      }

      this._saveAllRaw(all);
      activityService.log(
        'PARTY_TRANSFER',
        session.username,
        `${session.username} transferred ownership of "${party.name}" from ${oldOwner} to ${cleanOwner}`,
        { partyId: party.id }
      );
      return party;
    },

    deleteParty(session, partyId) {
      authGuard.requireRole(session, ['ADMIN']);
      const all = this._getAllRaw();
      const idx = all.findIndex(p => p.id === partyId);
      if (idx === -1) throw new Error('Parti bulunamadı.');

      const removed = all.splice(idx, 1)[0];
      this._saveAllRaw(all);
      activityService.log(
        'PARTY_DELETED',
        session.username,
        `${session.username} deleted party "${removed.name}"`,
        { partyId: removed.id }
      );
      return removed;
    }
  };

  // ==========================================
  // 5. PLAYER SERVICE
  // ==========================================
  const playerService = {
    getAllPlayers() {
      const list = storageAdapter.get(STORAGE_KEYS.PLAYERS, null);
      if (list && Array.isArray(list) && list.length > 0) return list;

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
          username: 'OrganizerAlex',
          role: 'ORGANIZER',
          licenseId: 'LIC-ORG-01',
          lastSeenAt: now,
          status: 'OFFLINE'
        },
        {
          username: 'Steve',
          role: 'PLAYER',
          licenseId: 'LIC-PLY-01',
          lastSeenAt: now,
          status: 'ONLINE'
        },
        {
          username: 'DiamondHunter',
          role: 'PLAYER',
          licenseId: 'LIC-PLY-02',
          lastSeenAt: now,
          status: 'OFFLINE'
        }
      ];
      storageAdapter.set(STORAGE_KEYS.PLAYERS, initial);
      return initial;
    },

    TouchPlayer(username, role, licenseId) {
      const all = this.getAllPlayers();
      const now = new Date().toISOString();
      const existing = all.find(p => p.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        existing.role = role;
        existing.licenseId = licenseId;
        existing.lastSeenAt = now;
        existing.status = 'ONLINE';
      } else {
        all.unshift({
          username,
          role,
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
    licenseService,
    partyService,
    playerService,
    activityService,
    PARTY_STATUSES
  };
})();
