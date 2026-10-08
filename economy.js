/**
 * MINECRAFT MILYONER — FULL PRODUCTION ECONOMY, RANKS, SHOP, LEADERBOARD & EXTRA LIFE SERVICES
 *
 * Modular Services:
 * - configService (Normal & VIP Rewards, 5 Emeralds = 1 TL Conversion, Extra Life Config)
 * - rankService (Data-Driven Ranks: PLAYER, VIP, VIP+, MVP, MVP+, ELITE, LEGEND, CHAMPION, MILLIONAIRE, ADMIN)
 * - economyService (Persistent Emerald Balances, Rank Multiplier, Stripe Webhook Credit, Admin Controls, Ledger)
 * - shopService (Categories: Emeralds, Gameplay, Ranks, Cosmetics, Special + Eligibility Checks)
 * - extraLifeService (Atomic Extra Life Consumption & Anti-Duplicate Protection)
 * - dailyRewardService (Rank Multiplier Daily Reward & Streak)
 * - achievementService (Automatic Milestone Unlocking)
 * - leaderboardService (Sort by Points, Wins, Emeralds, Games Played + Top 3 Podium + Win Rate)
 */

(function () {
  'use strict';

  const { authGuard, activityService, userService, paymentService } = window.MCMServices;

  const ECON_KEYS = {
    CONFIG: 'mcm_econ_config_v5_clean',
    ACCOUNTS: 'mcm_econ_accounts_v5_clean',
    TRANSACTIONS: 'mcm_econ_transactions_v5_clean',
    SHOP_ITEMS: 'mcm_econ_shop_items_v5_clean',
    RANKS: 'mcm_econ_ranks_v5_clean',
    PURCHASES: 'mcm_econ_purchases_v5_clean',
    EXTRA_LIVES: 'mcm_econ_extralives_v5_clean',
    ACHIEVEMENTS: 'mcm_econ_achievements_v5_clean'
  };

  // Purge legacy demo economy storage keys on startup
  try {
    [
      'mcm_econ_accounts_v2',
      'mcm_econ_transactions_v2',
      'mcm_econ_shop_items_v4',
      'mcm_econ_ranks_v4',
      'mcm_econ_purchases_v2',
      'mcm_econ_extralives_v2',
      'mcm_econ_achievements_v2'
    ].forEach(k => localStorage.removeItem(k));
  } catch (e) {}

  // In-memory transaction locks to prevent double-click / race conditions
  const activeLocks = new Set();
  const consumedEliminationKeys = new Set();

  function acquireLock(lockKey) {
    if (activeLocks.has(lockKey)) {
      throw new Error('Transaction in progress, please wait.');
    }
    activeLocks.add(lockKey);
  }

  function releaseLock(lockKey) {
    activeLocks.delete(lockKey);
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    }
  };

  // ==========================================
  // 1. CONFIGURABLE REWARD & EXTRA LIFE SETTINGS (Sections 10, 14, 19, 27)
  // ==========================================
  const DEFAULT_CONFIG = {
    emeraldsPerTL: 5, // 5 Emeralds = 1 TL (500 Emeralds = 100 TL)
    minEmeraldPurchase: 500,
    gameCompletedReward: 25,
    vipGameCompletedReward: 40,
    gameWonReward: 100,
    vipGameWonReward: 150,
    top3FinishReward: 150,
    tournamentWinnerReward: 500,
    dailyLoginBaseReward: 25,
    vipDailyLoginReward: 50,
    dailyStreakRewards: [25, 30, 40, 50, 65, 80, 100],
    vipDailyStreakRewards: [50, 60, 75, 90, 110, 130, 160],
    extraLifeEnabled: true,
    extraLifePrice: 500,
    extraLifeMaxPerGame: 1,
    extraLifeMaxPerPlayer: 5,
    dailyCooldownHours: 24,
    pointsPerCorrectAnswer: 150,
    pointsPerGameWin: 1500
  };

  const configService = {
    getRawConfig() {
      const saved = store.get(ECON_KEYS.CONFIG, null);
      return { ...DEFAULT_CONFIG, ...(saved || {}) };
    },

    getConfig() {
      const raw = this.getRawConfig();
      return {
        ...raw,
        rewards: {
          gameCompleted: raw.gameCompletedReward,
          vipGameCompleted: raw.vipGameCompletedReward,
          gameWon: raw.gameWonReward,
          vipGameWon: raw.vipGameWonReward,
          top3Finish: raw.top3FinishReward,
          tournamentWinner: raw.tournamentWinnerReward,
          dailyLogin: raw.dailyLoginBaseReward,
          vipDailyLogin: raw.vipDailyLoginReward
        },
        extraLife: {
          price: raw.extraLifePrice,
          maxPerGame: raw.extraLifeMaxPerGame || 1,
          maxPerPlayer: raw.extraLifeMaxPerPlayer || 5,
          enabled: Boolean(raw.extraLifeEnabled)
        }
      };
    },

    updateConfig(session, newValues = {}) {
      authGuard.requireRole(session, ['ADMIN']);
      const current = this.getRawConfig();
      const flat = { ...newValues };

      if (newValues.rewards) {
        if (newValues.rewards.gameCompleted !== undefined)
          flat.gameCompletedReward = Number(newValues.rewards.gameCompleted);
        if (newValues.rewards.vipGameCompleted !== undefined)
          flat.vipGameCompletedReward = Number(newValues.rewards.vipGameCompleted);
        if (newValues.rewards.gameWon !== undefined)
          flat.gameWonReward = Number(newValues.rewards.gameWon);
        if (newValues.rewards.vipGameWon !== undefined)
          flat.vipGameWonReward = Number(newValues.rewards.vipGameWon);
        if (newValues.rewards.top3Finish !== undefined)
          flat.top3FinishReward = Number(newValues.rewards.top3Finish);
        if (newValues.rewards.tournamentWinner !== undefined)
          flat.tournamentWinnerReward = Number(newValues.rewards.tournamentWinner);
        if (newValues.rewards.dailyLogin !== undefined)
          flat.dailyLoginBaseReward = Number(newValues.rewards.dailyLogin);
        if (newValues.rewards.vipDailyLogin !== undefined)
          flat.vipDailyLoginReward = Number(newValues.rewards.vipDailyLogin);
      }

      if (newValues.extraLife) {
        if (newValues.extraLife.price !== undefined)
          flat.extraLifePrice = Number(newValues.extraLife.price);
        if (newValues.extraLife.maxPerGame !== undefined)
          flat.extraLifeMaxPerGame = Math.max(1, Number(newValues.extraLife.maxPerGame));
        if (newValues.extraLife.enabled !== undefined)
          flat.extraLifeEnabled = Boolean(newValues.extraLife.enabled);
      }

      const numericKeys = [
        'gameCompletedReward',
        'vipGameCompletedReward',
        'gameWonReward',
        'vipGameWonReward',
        'top3FinishReward',
        'tournamentWinnerReward',
        'dailyLoginBaseReward',
        'vipDailyLoginReward',
        'extraLifePrice',
        'extraLifeMaxPerGame',
        'extraLifeMaxPerPlayer',
        'pointsPerCorrectAnswer',
        'pointsPerGameWin'
      ];

      numericKeys.forEach(k => {
        if (flat[k] !== undefined) {
          current[k] = Math.max(0, Math.round(Number(flat[k]) || 0));
        }
      });

      if (typeof flat.extraLifeEnabled === 'boolean') {
        current.extraLifeEnabled = flat.extraLifeEnabled;
      }

      store.set(ECON_KEYS.CONFIG, current);

      // Sync Extra Life price with shop item
      const items = shopService._ensureShopItems();
      const extraLifeItem = items.find(i => i.id === 'ITEM-EXTRA-LIFE');
      if (extraLifeItem) {
        extraLifeItem.price = current.extraLifePrice;
        extraLifeItem.purchaseLimit = current.extraLifeMaxPerPlayer;
        shopService._saveShopItems(items);
      }

      activityService.log(
        'CONFIG_UPDATED',
        session.username,
        `Admin ${session.username} updated Economy, VIP Bonus & Extra Life settings`
      );
      return this.getConfig();
    }
  };

  // ==========================================
  // 2. DATA-DRIVEN RANK & PERMISSIONS SYSTEM (Sections 5, 6, 7, 8, 9, 10, 13, 26)
  // ==========================================
  // Ranks: PLAYER, VIP, VIP+, MVP, MVP+, MVIP, MVIP+, ELITE, LEGEND, CHAMPION, MILLIONAIRE (+ ADMIN)
  const DEFAULT_RANKS = [
    {
      id: 'PLAYER',
      name: 'OYUNCU',
      displayName: 'Oyuncu',
      badge: '⛏️ OYUNCU',
      prefix: '[OYUNCU]',
      color: '#a6b4d0',
      gradient: 'linear-gradient(90deg, #94a3b8, #cbd5e1)',
      permissions: {
        canCreateParty: false,
        canInvitePlayers: false,
        maxPartySize: 0,
        emeraldMultiplier: 1.0,
        supportPriority: 'NORMAL',
        bugPriority: 'NORMAL',
        suggestionPriority: 'NORMAL',
        maxExtraLives: 3,
        cosmetics: false,
        rgbName: false,
        profileEffects: false
      },
      benefits: ['Partilere Katılma', 'Zümrüt Mağazası Erişimi', 'Standart Liderlik Tablosu'],
      emeraldBonus: 1.0,
      priorityLevel: 'NORMAL',
      price: 0,
      emeraldPrice: 0,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: false,
      enabled: true
    },
    {
      id: 'VIP',
      name: 'VIP',
      displayName: 'VIP',
      badge: '👑 VIP',
      prefix: '[VIP]',
      color: '#ffbe2e',
      gradient: 'linear-gradient(90deg, #f59e0b, #fde047)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 4,
        emeraldMultiplier: 1.25,
        supportPriority: 'HIGH',
        bugPriority: 'HIGH',
        suggestionPriority: 'HIGH',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'Parti Oluşturma (4 Oyuncuya Kadar)',
        'Oyuncu Davet Etme',
        '1.25x Zümrüt Çarpanı',
        'Yüksek Öncelikli Destek, Hata & Öneri',
        'RGB Kullanıcı Adı & VIP Rozeti'
      ],
      emeraldBonus: 1.25,
      priorityLevel: 'HIGH',
      price: 200,
      emeraldPrice: 1000,
      currency: 'TRY',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'VIP_PLUS',
      name: 'VIP+',
      displayName: 'VIP+',
      badge: '👑 VIP+',
      prefix: '[VIP+]',
      color: '#ff9f1c',
      gradient: 'linear-gradient(90deg, #fb923c, #facc15)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 6,
        emeraldMultiplier: 1.5,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 6,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'VIP paketindeki tüm avantajlar',
        'Parti Oluşturma (6 Oyuncuya Kadar)',
        '1.50x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Destek, Hata & Öneri',
        '6 Ekstra Can Kapasitesi & VIP+ Altın Rozet'
      ],
      emeraldBonus: 1.5,
      priorityLevel: 'VERY HIGH',
      price: 350,
      emeraldPrice: 1750,
      currency: 'TRY',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'MVP',
      name: 'MVP',
      displayName: 'MVP',
      badge: '⚔️ MVP',
      prefix: '[MVP]',
      color: '#36e2ec',
      gradient: 'linear-gradient(90deg, #06b6d4, #67e8f9)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 8,
        emeraldMultiplier: 1.75,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 7,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'VIP+ paketindeki tüm avantajlar',
        'Parti Oluşturma (8 Oyuncuya Kadar)',
        '1.75x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Destek, Hata & Öneri',
        'Özel MVP Ön Eki & Elmas Çerçeve'
      ],
      emeraldBonus: 1.75,
      priorityLevel: 'VERY HIGH',
      price: 500,
      emeraldPrice: 2500,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'MVP_PLUS',
      name: 'MVP+',
      displayName: 'MVP+',
      badge: '🌟 MVP+',
      prefix: '[MVP+]',
      color: '#00f5d4',
      gradient: 'linear-gradient(90deg, #00f5d4, #38bdf8)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 10,
        emeraldMultiplier: 2.0,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 8,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'MVP paketindeki tüm avantajlar',
        'Parti Oluşturma (10 Oyuncuya Kadar)',
        '2.00x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Kuyruk',
        'Animasyonlu Profil Efektleri & 🌟 MVP+ Rozeti'
      ],
      emeraldBonus: 2.0,
      priorityLevel: 'VERY HIGH',
      price: 750,
      emeraldPrice: 3750,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'MVIP',
      name: 'MVIP',
      displayName: 'MVIP',
      badge: '💎 MVIP',
      prefix: '[MVIP]',
      color: '#17dd62',
      gradient: 'linear-gradient(90deg, #17dd62, #00f5d4)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 12,
        emeraldMultiplier: 2.25,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 9,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'MVP+ paketindeki tüm avantajlar',
        'Parti Oluşturma (12 Oyuncuya Kadar)',
        '2.25x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Destek, Hata & Öneri',
        'Zümrüt Yeşili 💎 MVIP Rozeti & Kozmetikler'
      ],
      emeraldBonus: 2.25,
      priorityLevel: 'VERY HIGH',
      price: 900,
      emeraldPrice: 4500,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'MVIP_PLUS',
      name: 'MVIP+',
      displayName: 'MVIP+',
      badge: '🔥 MVIP+',
      prefix: '[MVIP+]',
      color: '#f97316',
      gradient: 'linear-gradient(90deg, #17dd62, #ffbe2e, #f97316)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 16,
        emeraldMultiplier: 2.5,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 10,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'MVIP paketindeki tüm avantajlar',
        'Parti Oluşturma (16 Oyuncuya Kadar)',
        '2.50x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli VIP+ Destek Hattı',
        'Efsanevi 🔥 MVIP+ Rozeti & RGB İsim'
      ],
      emeraldBonus: 2.5,
      priorityLevel: 'VERY HIGH',
      price: 1100,
      emeraldPrice: 5500,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'ELITE',
      name: 'ELITE',
      displayName: 'ELITE',
      badge: '⚡ ELITE',
      prefix: '[ELITE]',
      color: '#a855f7',
      gradient: 'linear-gradient(90deg, #a855f7, #ec4899)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 12,
        emeraldMultiplier: 2.25,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 8,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'Parti Oluşturma (12 Oyuncuya Kadar)',
        '2.25x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Kuyruk',
        'Ametist ⚡ ELITE Rozeti & RGB Kozmetikler'
      ],
      emeraldBonus: 2.25,
      priorityLevel: 'VERY HIGH',
      price: 900,
      emeraldPrice: 4500,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'LEGEND',
      name: 'LEGEND',
      displayName: 'LEGEND',
      badge: '🔱 LEGEND',
      prefix: '[LEGEND]',
      color: '#ff6b6b',
      gradient: 'linear-gradient(90deg, #ef4444, #f97316)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 14,
        emeraldMultiplier: 2.5,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 9,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'Parti Oluşturma (14 Oyuncuya Kadar)',
        '2.50x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Kuyruk',
        'Kızıl 🔱 LEGEND Rozeti'
      ],
      emeraldBonus: 2.5,
      priorityLevel: 'VERY HIGH',
      price: 1200,
      emeraldPrice: 3000,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'CHAMPION',
      name: 'CHAMPION',
      displayName: 'CHAMPION',
      badge: '🏆 CHAMPION',
      prefix: '[CHAMPION]',
      color: '#ffd700',
      gradient: 'linear-gradient(90deg, #facc15, #f59e0b)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 16,
        emeraldMultiplier: 2.75,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 10,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'Parti Oluşturma (16 Oyuncuya Kadar)',
        '2.75x Zümrüt Çarpanı',
        'Çok Yüksek Öncelikli Kuyruk',
        'Altın 🏆 CHAMPION Turnuva Rozeti'
      ],
      emeraldBonus: 2.75,
      priorityLevel: 'VERY HIGH',
      price: 1600,
      emeraldPrice: 4000,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'MILLIONAIRE',
      name: 'MILLIONAIRE',
      displayName: 'MILLIONAIRE',
      badge: '💎 MILLIONAIRE',
      prefix: '[MILLIONAIRE]',
      color: '#23d160',
      gradient: 'linear-gradient(90deg, #17dd62, #36e2ec, #ffbe2e)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 20,
        emeraldMultiplier: 3.0,
        supportPriority: 'VERY HIGH',
        bugPriority: 'VERY HIGH',
        suggestionPriority: 'VERY HIGH',
        maxExtraLives: 10,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: [
        'Parti Oluşturma (20 Oyuncuya Kadar)',
        '3.00x Zümrüt Çarpanı',
        'Otomatik RGB & Animasyonlu Kullanıcı Adı',
        'Efsanevi 💎 MILLIONAIRE Tacı'
      ],
      emeraldBonus: 3.0,
      priorityLevel: 'VERY HIGH',
      price: 2000,
      emeraldPrice: 5000,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    },
    {
      id: 'ADMIN',
      name: 'ADMIN',
      displayName: 'ADMIN',
      badge: '🛡️ ADMIN',
      prefix: '[ADMIN]',
      color: '#ff5252',
      gradient: 'linear-gradient(90deg, #ff5252, #ffbe2e)',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 999,
        emeraldMultiplier: 3.0,
        supportPriority: 'CRITICAL',
        bugPriority: 'CRITICAL',
        suggestionPriority: 'CRITICAL',
        maxExtraLives: 10,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      benefits: ['Tam Platform Yönetimi', 'Sınırsız Parti Kapasitesi', 'KRİTİK Öncelik'],
      emeraldBonus: 3.0,
      priorityLevel: 'CRITICAL',
      price: 0,
      emeraldPrice: 0,
      currency: 'EMERALD',
      duration: 'LIFETIME',
      grantsVip: true,
      enabled: true
    }
  ];

  const rankService = {
    getRanks(includeDisabled = true) {
      let saved = store.get(ECON_KEYS.RANKS, null);
      if (!saved || !Array.isArray(saved) || saved.length < 11) {
        store.set(ECON_KEYS.RANKS, DEFAULT_RANKS);
        saved = DEFAULT_RANKS;
      }
      return includeDisabled ? saved : saved.filter(r => r.enabled !== false);
    },

    _saveRanks(ranks) {
      store.set(ECON_KEYS.RANKS, ranks);
    },

    getRankById(rankId) {
      const cleanId = String(rankId || 'PLAYER')
        .trim()
        .toUpperCase()
        .replace(/\+/g, '_PLUS');
      const all = this.getRanks(true);
      return all.find(r => r.id.toUpperCase() === cleanId || r.name.toUpperCase() === cleanId) || all[0];
    },

    getPermissionsForRank(rankId) {
      const rank = this.getRankById(rankId);
      if (rank && rank.permissions && typeof rank.permissions === 'object' && !Array.isArray(rank.permissions)) {
        return { ...rank.permissions };
      }
      return { ...DEFAULT_RANKS[0].permissions };
    },

    // Section 26: Admin Create / Edit / Delete Rank
    adminSaveRank(session, rankData) {
      authGuard.requireRole(session, ['ADMIN']);
      const rawId = String(rankData.id || rankData.name || '')
        .trim()
        .toUpperCase()
        .replace(/\+/g, '_PLUS')
        .replace(/[^A-Z0-9_]/g, '_');
      if (!rawId) throw new Error('Rank ID / Name is required.');

      const all = this.getRanks(true);
      const existing = all.find(r => r.id === rawId);

      const pIn = rankData.permissions || {};
      const priority =
        rankData.priorityLevel ||
        rankData.supportPriority ||
        pIn.supportPriority ||
        'HIGH';
      const mult = Math.max(
        1,
        Number(rankData.emeraldMultiplier || rankData.emeraldBonus || pIn.emeraldMultiplier) || 1.25
      );
      const maxParty = Math.max(
        0,
        Math.round(Number(rankData.maxPartySize ?? pIn.maxPartySize ?? 4))
      );
      const maxLives = Math.max(
        1,
        Math.round(Number(rankData.maxExtraLives || pIn.maxExtraLives) || 5)
      );
      const priceTL = Math.max(0, Math.round(Number(rankData.price ?? rankData.tlPrice) || 0));
      const emeraldPrice = Math.max(
        0,
        Math.round(Number(rankData.emeraldPrice) || priceTL * 5 || 1000)
      );

      const permissions = {
        canCreateParty:
          rankData.canCreateParty !== undefined
            ? Boolean(rankData.canCreateParty)
            : pIn.canCreateParty !== undefined
              ? Boolean(pIn.canCreateParty)
              : maxParty > 0,
        canInvitePlayers:
          rankData.canInvitePlayers !== undefined
            ? Boolean(rankData.canInvitePlayers)
            : pIn.canInvitePlayers !== undefined
              ? Boolean(pIn.canInvitePlayers)
              : maxParty > 0,
        maxPartySize: maxParty,
        emeraldMultiplier: mult,
        supportPriority: priority,
        bugPriority: priority,
        suggestionPriority: priority,
        maxExtraLives: maxLives,
        cosmetics: (rankData.cosmetics ?? pIn.cosmetics) !== false,
        rgbName: (rankData.rgbName ?? pIn.rgbName) !== false,
        profileEffects: (rankData.profileEffects ?? pIn.profileEffects) !== false
      };

      const displayName = String(rankData.displayName || rankData.name || rawId).trim();
      const badge = String(rankData.badge || `👑 ${displayName}`).trim();

      if (existing) {
        existing.name = String(rankData.name || existing.name).trim();
        existing.displayName = displayName;
        existing.badge = badge;
        existing.prefix = String(rankData.prefix || `[${displayName}]`).trim();
        existing.color = rankData.color || existing.color || '#ffbe2e';
        existing.permissions = permissions;
        existing.emeraldBonus = mult;
        existing.priorityLevel = priority;
        existing.price = priceTL;
        existing.emeraldPrice = emeraldPrice;
        if (rankData.currency) existing.currency = rankData.currency;
        if (rankData.enabled !== undefined) existing.enabled = Boolean(rankData.enabled);
        existing.grantsVip = permissions.canCreateParty;
      } else {
        all.push({
          id: rawId,
          name: displayName,
          displayName,
          badge,
          prefix: `[${displayName}]`,
          color: rankData.color || '#ffbe2e',
          gradient: 'linear-gradient(90deg, #f59e0b, #fde047)',
          permissions,
          benefits: rankData.benefits || [
            `Create Parties (Up to ${maxParty} Players)`,
            `${mult}x Emerald Bonus Multiplier`,
            `${priority} Priority Queue`
          ],
          emeraldBonus: mult,
          priorityLevel: priority,
          price: priceTL,
          emeraldPrice,
          currency: rankData.currency || 'EMERALD',
          duration: rankData.duration || 'LIFETIME',
          grantsVip: permissions.canCreateParty,
          enabled: rankData.enabled !== false
        });
      }

      this._saveRanks(all);
      activityService.log(
        'RANK_SAVED',
        session.username,
        `Admin ${session.username} saved rank "${displayName}" (Multiplier: ${mult}x, Party Size: ${maxParty}, Priority: ${priority})`
      );
      return this.getRankById(rawId);
    },

    adminDeleteRank(session, rankId) {
      authGuard.requireRole(session, ['ADMIN']);
      const protectedIds = ['PLAYER', 'VIP', 'ADMIN'];
      const cleanId = String(rankId || '').toUpperCase();
      if (protectedIds.includes(cleanId)) {
        throw new Error(`Cannot delete core system rank (${cleanId}).`);
      }
      const all = this.getRanks(true);
      const idx = all.findIndex(r => r.id === cleanId);
      if (idx === -1) throw new Error('Rank not found.');
      const removed = all.splice(idx, 1)[0];
      this._saveRanks(all);
      activityService.log(
        'RANK_DELETED',
        session.username,
        `Admin ${session.username} deleted rank "${removed.displayName}"`
      );
      return removed;
    }
  };

  // ==========================================
  // 3. NORMALIZE ACCOUNT HELPER
  // ==========================================
  function normalizeAccount(acc) {
    if (!acc) return null;
    const u = userService ? userService.getUserByUsername(acc.username) : null;
    const balance = Math.max(0, Number(acc.balance ?? acc.emeraldCoins ?? u?.emeraldBalance ?? 0));
    const points = Math.max(0, Number(acc.points ?? acc.totalPoints ?? u?.points ?? 0));
    const gamesPlayed = Number(acc.gamesPlayed || u?.gamesPlayed || 0);
    const gamesWon = Number(acc.gamesWon || u?.gamesWon || 0);
    const gamesLost = Number(acc.gamesLost || u?.gamesLost || 0);
    const extraLives = Math.max(
      0,
      Number(acc.extraLives ?? acc.inventory?.extraLives ?? u?.extraLives ?? 0)
    );
    const secondChanceOwned = Number(acc.secondChanceOwned ?? acc.inventory?.secondChance ?? 0);
    const scoreBoosterOwned = Number(acc.scoreBoosterOwned ?? acc.inventory?.scoreBooster ?? 0);
    const emeraldBoosterOwned = Number(
      acc.emeraldBoosterOwned ?? acc.inventory?.emeraldBooster ?? 0
    );
    const tournamentTickets = Number(
      acc.tournamentTickets ?? acc.inventory?.tournamentTickets ?? 0
    );
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const averageScore = gamesPlayed > 0 ? Math.round(points / gamesPlayed) : 0;

    const effectiveRole = u ? u.role : acc.role || 'PLAYER';
    const rankId = u?.rank || u?.rankId || acc.equippedRank || effectiveRole;
    const rankObj = rankService.getRankById(rankId);
    const perms = rankService.getPermissionsForRank(rankId);
    const isVip = Boolean(
      effectiveRole === 'VIP' ||
        effectiveRole === 'ADMIN' ||
        u?.vipStatus?.isVip ||
        acc.isVip ||
        perms.canCreateParty
    );
    const rgbOwned = Boolean(
      acc.rgbOwned || u?.cosmetics?.rgbOwned || perms.rgbName || effectiveRole === 'ADMIN'
    );
    const rgbEnabled = Boolean(
      u?.cosmetics?.rgbEnabled !== undefined ? u.cosmetics.rgbEnabled : acc.rgbEnabled
    );
    const animatedNameOwned = Boolean(
      acc.animatedNameOwned || u?.cosmetics?.animatedNameOwned || effectiveRole === 'ADMIN'
    );

    return {
      ...acc,
      userId: u?.id || acc.playerId,
      role: effectiveRole,
      isVip,
      vipStatus: u?.vipStatus || { isVip, tier: isVip ? rankObj.id : 'NONE', expiresAt: null },
      rank: rankObj.id,
      rankId: rankObj.id,
      rankDisplayName: rankObj.displayName,
      rankBadge: rankObj.badge,
      rankColor: rankObj.color,
      rankPermissions: perms,
      rgbOwned,
      rgbEnabled,
      animatedNameOwned,
      ownedRanks: acc.ownedRanks || [rankObj.id],
      balance,
      emeraldBalance: balance,
      emeraldCoins: balance,
      points,
      totalPoints: points,
      gamesPlayed,
      gamesWon,
      gamesLost,
      winRate,
      averageScore,
      bestScore: Number(acc.bestScore || 0),
      totalEmeraldsEarned: Number(acc.totalEarned || balance),
      totalEmeraldsSpent: Number(acc.totalSpent || 0),
      extraLives,
      extraLivesUsed: Number(acc.extraLivesUsed || 0),
      inventory: {
        extraLives,
        extra_life: extraLives,
        secondChance: secondChanceOwned,
        scoreBooster: scoreBoosterOwned,
        emeraldBooster: emeraldBoosterOwned,
        tournamentTickets
      }
    };
  }

  // ==========================================
  // 4. EMERALD ECONOMY SERVICE (Sections 10, 14, 15, 16, 17, 27)
  // ==========================================
  const economyService = {
    _ensureAccounts() {
      const existing = store.get(ECON_KEYS.ACCOUNTS, null);
      if (existing && Array.isArray(existing)) {
        return existing;
      }
      store.set(ECON_KEYS.ACCOUNTS, []);
      return [];
    },

    _saveAccounts(accounts) {
      store.set(ECON_KEYS.ACCOUNTS, accounts);
    },

    _renameUsernameInternal(oldUsername, newUsername) {
      const accounts = this._ensureAccounts();
      accounts.forEach(a => {
        if (a.username.toLowerCase() === String(oldUsername).toLowerCase()) {
          a.username = newUsername;
        }
      });
      this._saveAccounts(accounts);

      const txs = store.get(ECON_KEYS.TRANSACTIONS, []);
      txs.forEach(t => {
        if (t.username.toLowerCase() === String(oldUsername).toLowerCase()) {
          t.username = newUsername;
        }
      });
      store.set(ECON_KEYS.TRANSACTIONS, txs);
    },

    getOrCreateAccount(username, role = 'PLAYER') {
      const cleanName = String(username || '').trim();
      if (!cleanName) return null;
      const accounts = this._ensureAccounts();
      let acc = accounts.find(a => a.username.toLowerCase() === cleanName.toLowerCase());

      if (!acc) {
        const now = new Date().toISOString();
        const u = userService ? userService.getUserByUsername(cleanName) : null;
        const initRank = u?.rank || u?.rankId || role;
        const startBal = Math.max(0, Number(u?.emeraldBalance || 0));
        acc = {
          playerId: u?.id || 'USR-' + Date.now().toString(36).toUpperCase(),
          username: cleanName,
          role: u?.role || role,
          isVip: Boolean(u?.vipStatus?.isVip || role === 'VIP' || role === 'ADMIN'),
          equippedRank: initRank,
          ownedRanks: [initRank],
          rgbOwned: Boolean(u?.cosmetics?.rgbOwned || role === 'ADMIN'),
          rgbEnabled: Boolean(u?.cosmetics?.rgbEnabled || role === 'ADMIN'),
          animatedNameOwned: Boolean(u?.cosmetics?.animatedNameOwned || role === 'ADMIN'),
          balance: startBal,
          points: Math.max(0, Number(u?.points || 0)),
          gamesPlayed: Math.max(0, Number(u?.gamesPlayed || 0)),
          gamesWon: Math.max(0, Number(u?.gamesWon || 0)),
          gamesLost: Math.max(0, Number(u?.gamesLost || 0)),
          extraLives: Math.max(0, Number(u?.extraLives || 0)),
          extraLivesUsed: 0,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 0,
          totalEarned: startBal,
          totalSpent: 0,
          bestScore: 0,
          lastDailyClaimAt: null,
          dailyStreak: 0,
          updatedAt: now
        };
        accounts.push(acc);
        this._saveAccounts(accounts);
      }

      if (userService) {
        userService.syncFromEconomyAccount(acc);
      }

      return { ...acc };
    },

    getAllAccounts() {
      return this._ensureAccounts().map(a => ({ ...a }));
    },

    getPlayerEconomyProfile(username) {
      return normalizeAccount(this.getOrCreateAccount(username));
    },

    getAllProfiles() {
      return this.getAllAccounts().map(normalizeAccount);
    },

    _getAllRawTransactions() {
      return store.get(ECON_KEYS.TRANSACTIONS, []);
    },

    _recordTransaction({
      playerId,
      username,
      amount,
      type,
      reason,
      previousBalance,
      newBalance,
      gameId = null,
      partyId = null,
      source = 'System'
    }) {
      const list = store.get(ECON_KEYS.TRANSACTIONS, []);
      const tx = {
        id: 'TX-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        playerId,
        userId: playerId,
        username,
        amount: Number(amount),
        type,
        reason,
        previousBalance: Math.max(0, Number(previousBalance)),
        newBalance: Math.max(0, Number(newBalance)),
        gameId,
        partyId,
        source,
        timestamp: new Date().toISOString()
      };
      list.unshift(tx);
      if (list.length > 500) list.length = 500;
      store.set(ECON_KEYS.TRANSACTIONS, list);
      return tx;
    },

    getTransactions(session, filterUsername = null) {
      authGuard.verifySession(session);
      const all = store.get(ECON_KEYS.TRANSACTIONS, []);
      const effRole = authGuard.getEffectiveRole(session);
      if (effRole === 'ADMIN' && !filterUsername) {
        return all;
      }
      const targetUser = filterUsername || session.username;
      return all.filter(t => t.username.toLowerCase() === targetUser.toLowerCase());
    },

    getTransactionHistory(session, filterUsername = null) {
      const list = this.getTransactions(session, filterUsername);
      return list.map(tx => ({
        ...tx,
        source: tx.source || (String(tx.type || '').startsWith('ADMIN') ? 'Admin' : 'System'),
        balanceAfter: Number(tx.newBalance ?? tx.balanceAfter ?? 0),
        dateFormatted: new Date(tx.timestamp).toLocaleString('en-US')
      }));
    },

    _mutateAccount(username, mutatorFn) {
      const accounts = this._ensureAccounts();
      const idx = accounts.findIndex(
        a => a.username.toLowerCase() === String(username).toLowerCase()
      );
      if (idx === -1) {
        this.getOrCreateAccount(username);
        return this._mutateAccount(username, mutatorFn);
      }
      const acc = accounts[idx];
      mutatorFn(acc);
      acc.balance = Math.max(0, Math.round(acc.balance));
      acc.updatedAt = new Date().toISOString();
      this._saveAccounts(accounts);
      if (userService) {
        userService.syncFromEconomyAccount(acc);
      }
      return { ...acc };
    },

    // Section 16 & 17: Internal method called ONLY by verified Stripe Webhook handler
    _creditVerifiedStripePurchase({
      username,
      emeralds,
      paymentId,
      stripePaymentId,
      productTitle
    }) {
      const amount = Math.max(0, Math.round(Number(emeralds) || 0));
      if (amount < 500) {
        throw new Error('Minimum Stripe Emerald credit is 500 Emeralds.');
      }

      let prevBal = 0;
      let newBal = 0;
      const updated = this._mutateAccount(username, acc => {
        prevBal = acc.balance;
        acc.balance += amount;
        acc.totalEarned += amount;
        newBal = acc.balance;
      });

      const tx = this._recordTransaction({
        playerId: updated.playerId,
        username: updated.username,
        amount,
        type: 'STRIPE_PURCHASE',
        reason: `Stripe Verified: ${productTitle} (${stripePaymentId || paymentId})`,
        previousBalance: prevBal,
        newBalance: newBal,
        source: 'Stripe Webhook'
      });

      achievementService.checkAndUnlock(username);

      return {
        account: updated,
        profile: normalizeAccount(updated),
        transaction: tx
      };
    },

    // Section 10: Gameplay Completion Reward (with Data-Driven Rank Emerald Multiplier!)
    recordGameOutcome(session, outcome = {}) {
      authGuard.verifySession(session);
      const won = Boolean(outcome.won);
      const questionsAnswered = Number(
        outcome.questionsAnswered ?? outcome.correctAnswers ?? outcome.finalLevel ?? 0
      );
      const emeraldScoreReached = Number(
        outcome.emeraldScoreReached ?? outcome.earnedPrize ?? outcome.prizeEarned ?? 0
      );
      const gameId = outcome.gameId || 'GAME-' + Date.now();
      const cfg = configService.getConfig();
      const isVip = authGuard.isVipOrAdmin(session);
      const perms = authGuard.getUserPermissions(session);
      const rankId = authGuard.getEffectiveRankId(session);
      const lockKey = `game_outcome_${session.username}_${gameId}`;
      acquireLock(lockKey);

      try {
        let earnedEmeralds = isVip ? cfg.vipGameCompletedReward : cfg.gameCompletedReward;
        let earnedPoints = questionsAnswered * cfg.pointsPerCorrectAnswer;
        let reasonParts = [isVip ? `${rankId} Game Completed` : 'Game Completed'];

        if (won) {
          earnedEmeralds += isVip ? cfg.vipGameWonReward : cfg.gameWonReward;
          earnedPoints += cfg.pointsPerGameWin;
          reasonParts = [isVip ? `👑 ${rankId} Game Victory Bonus` : 'Game Victory'];
        } else if (questionsAnswered >= 10) {
          earnedEmeralds += Math.round(cfg.top3FinishReward * 0.5);
          reasonParts = ['High Stage Reached (10+)'];
        }

        // Apply higher rank multiplier if rank multiplier > 1.25 (e.g., VIP+ 1.5x, MVP 1.75x, MVP+ 2.0x)
        if (perms.emeraldMultiplier && perms.emeraldMultiplier > 1.25) {
          earnedEmeralds = Math.round(earnedEmeralds * (perms.emeraldMultiplier / 1.25));
        }

        let prevBal = 0;
        let newBal = 0;
        let usedScoreBooster = false;
        let usedEmeraldBooster = false;

        const updatedAcc = this._mutateAccount(session.username, acc => {
          if (acc.scoreBoosterOwned > 0) {
            earnedPoints = Math.round(earnedPoints * 1.5);
            acc.scoreBoosterOwned--;
            usedScoreBooster = true;
          }
          if (acc.emeraldBoosterOwned > 0) {
            earnedEmeralds = Math.round(earnedEmeralds * 1.5);
            acc.emeraldBoosterOwned--;
            usedEmeraldBooster = true;
          }

          prevBal = acc.balance;
          acc.balance += earnedEmeralds;
          newBal = acc.balance;
          acc.totalEarned += earnedEmeralds;

          acc.points += earnedPoints;
          acc.gamesPlayed += 1;
          if (won) acc.gamesWon += 1;
          else acc.gamesLost += 1;

          if (emeraldScoreReached > acc.bestScore) {
            acc.bestScore = emeraldScoreReached;
          }
        });

        const boostNotes = [
          usedScoreBooster ? '⭐ Score Booster' : '',
          usedEmeraldBooster ? '💎 Emerald Booster' : ''
        ]
          .filter(Boolean)
          .join(', ');

        this._recordTransaction({
          playerId: updatedAcc.playerId,
          username: updatedAcc.username,
          amount: earnedEmeralds,
          type: won ? 'GAME_WIN' : 'GAME_COMPLETED',
          reason: reasonParts.join(' + ') + (boostNotes ? ` (${boostNotes})` : ''),
          previousBalance: prevBal,
          newBalance: newBal,
          gameId,
          source: isVip ? `System (${rankId} Bonus)` : 'System'
        });

        const unlocked = achievementService.checkAndUnlock(session.username);

        return {
          earnedEmeralds,
          emeraldReward: earnedEmeralds,
          earnedPoints,
          pointsEarned: earnedPoints,
          usedBooster: usedScoreBooster || usedEmeraldBooster,
          account: updatedAcc,
          profile: normalizeAccount(updatedAcc),
          unlockedAchievements: unlocked,
          newlyUnlocked: unlocked
        };
      } finally {
        releaseLock(lockKey);
      }
    },

    // Section 27: ADMIN ECONOMY CONTROLS (Never allows negative balances!)
    adminModifyBalance(session, arg1, mode, amountValue, customReason = '') {
      authGuard.requireRole(session, ['ADMIN']);
      let targetUsername = arg1;
      if (arg1 && typeof arg1 === 'object') {
        targetUsername = arg1.username;
        mode = arg1.operation || arg1.mode;
        amountValue = arg1.amount;
        customReason = arg1.reason || '';
      }

      const val = Math.max(0, Math.round(Number(amountValue) || 0));
      let prevBal = 0;
      let nextBal = 0;
      let delta = 0;
      let playerId = '';

      const updated = this._mutateAccount(targetUsername, acc => {
        playerId = acc.playerId;
        prevBal = acc.balance;
        if (mode === 'GIVE' || mode === 'ADD') {
          acc.balance += val;
          acc.totalEarned += val;
        } else if (mode === 'REMOVE') {
          acc.balance = Math.max(0, acc.balance - val);
        } else if (mode === 'SET') {
          acc.balance = Math.max(0, val);
        } else if (mode === 'RESET') {
          acc.balance = 0;
        }
        nextBal = acc.balance;
        delta = nextBal - prevBal;
      });

      const reasonMap = {
        GIVE: customReason || `Admin Reward by ${session.username}`,
        ADD: customReason || `Admin Reward by ${session.username}`,
        REMOVE: customReason || `Admin Deduction by ${session.username}`,
        SET: customReason || `Admin Balance Set by ${session.username}`,
        RESET: `Admin Balance Reset by ${session.username}`
      };

      this._recordTransaction({
        playerId,
        username: updated.username,
        amount: delta,
        type: `ADMIN_${mode}`,
        reason: reasonMap[mode] || 'Admin Economy Adjustment',
        previousBalance: prevBal,
        newBalance: nextBal,
        source: `Admin (${session.username})`
      });

      activityService.log(
        `ECONOMY_${mode}`,
        session.username,
        `Admin ${session.username} (${mode}) Emerald balance for ${updated.username}: ${prevBal} → ${nextBal} 💚`
      );

      achievementService.checkAndUnlock(updated.username);
      return normalizeAccount(updated);
    },

    adminModifyEmeralds(session, targetUsername, amount, mode = 'GIVE', reason = '') {
      return this.adminModifyBalance(session, targetUsername, mode, amount, reason);
    }
  };

  // ==========================================
  // 5. EMERALD SHOP, RANK SHOP & COSMETICS SERVICE (Sections 15, 18, 19)
  // ==========================================
  // Categories: Emeralds, Gameplay, Ranks, Cosmetics, Special (+ VIP)
  const shopService = {
    _ensureShopItems() {
      let items = store.get(ECON_KEYS.SHOP_ITEMS, null);
      const cfg = configService.getConfig();
      const now = new Date().toISOString();

      if (items && Array.isArray(items) && items.length > 0) {
        if (!items.some(i => i.id === 'ITEM-BORDER-EMERALD')) {
          items.push({
            id: 'ITEM-BORDER-EMERALD',
            name: 'Zümrüt Profil Çerçevesi',
            icon: '🖼️',
            price: 750,
            currency: 'EMERALD',
            category: 'Cosmetics',
            requiredRole: 'ANY',
            description: 'Profil avatarınız için parlayan Zümrüt çerçeve kozmetiği açar!',
            enabled: true,
            purchaseLimit: 1,
            effect: 'PROFILE_BORDER_EMERALD',
            createdAt: now
          });
        }
        if (!items.some(i => i.id === 'ITEM-BG-NETHER')) {
          items.push({
            id: 'ITEM-BG-NETHER',
            name: 'Nether Profil Arka Planı',
            icon: '🌌',
            price: 850,
            currency: 'EMERALD',
            category: 'Cosmetics',
            requiredRole: 'ANY',
            description: 'Profil kartınız için özel Nether Kalesi arka plan temasını açar!',
            enabled: true,
            purchaseLimit: 1,
            effect: 'PROFILE_BG_NETHER',
            createdAt: now
          });
        }
        store.set(ECON_KEYS.SHOP_ITEMS, items);
        return items;
      }

      items = [
        // ❤️ GAMEPLAY CATEGORY
        {
          id: 'ITEM-EXTRA-LIFE',
          name: 'Ekstra Can (Extra Life)',
          icon: '❤️',
          price: cfg.extraLifePrice,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'Yanlış cevap verdiğinizde elenmek yerine oyuna kaldığınız yerden devam edin (500 💚).',
          enabled: true,
          purchaseLimit: cfg.extraLifeMaxPerPlayer,
          effect: 'EXTRA_LIFE',
          createdAt: now
        },
        {
          id: 'ITEM-SCORE-BOOSTER',
          name: 'Puan Çarpanı (Score Booster)',
          icon: '⭐',
          price: 750,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'Bir sonraki tamamlanan oyunda Liderlik Tablosu puan ödülünüzü +%50 artırır.',
          enabled: true,
          purchaseLimit: 5,
          effect: 'SCORE_BOOSTER',
          createdAt: now
        },
        {
          id: 'ITEM-SECOND-CHANCE',
          name: 'İkinci Şans Paketi',
          icon: '🔥',
          price: 750,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'Elenmeye karşı koruma (+1 Ekstra Can ve +300 Liderlik Puanı).',
          enabled: true,
          purchaseLimit: 3,
          effect: 'SECOND_CHANCE',
          createdAt: now
        },
        // 🎨 COSMETICS CATEGORY (Section 18: RGB Username 1000 💚 & Animated Name 1500 💚)
        {
          id: 'ITEM-RGB-NAME',
          name: 'RGB Kullanıcı Adı',
          icon: '🌈',
          price: 1000,
          currency: 'EMERALD',
          category: 'Cosmetics',
          requiredRole: 'ANY',
          description:
            'Profil, Partiler ve Liderlik Tablosunda akıcı animasyonlu RGB gökkuşağı isim efektini açar!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RGB_NAME',
          createdAt: now
        },
        {
          id: 'ITEM-ANIMATED-NAME',
          name: 'Animasyonlu İsim & Efekt',
          icon: '🎨',
          price: 1500,
          currency: 'EMERALD',
          category: 'Cosmetics',
          requiredRole: 'ANY',
          description:
            'Profilinizde parıldayan Minecraft büyü (Enchantment) aurası ve animasyonlu isim efektini açar!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'ANIMATED_NAME',
          createdAt: now
        },
        {
          id: 'ITEM-BORDER-EMERALD',
          name: 'Zümrüt Profil Çerçevesi',
          icon: '🖼️',
          price: 750,
          currency: 'EMERALD',
          category: 'Cosmetics',
          requiredRole: 'ANY',
          description: 'Profil avatarınız için parlayan Zümrüt çerçeve kozmetiği açar!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'PROFILE_BORDER_EMERALD',
          createdAt: now
        },
        {
          id: 'ITEM-BG-NETHER',
          name: 'Nether Profil Arka Planı',
          icon: '🌌',
          price: 850,
          currency: 'EMERALD',
          category: 'Cosmetics',
          requiredRole: 'ANY',
          description: 'Profil kartınız için özel Nether Kalesi arka plan temasını açar!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'PROFILE_BG_NETHER',
          createdAt: now
        },
        // ⭐ SPECIAL & VIP CATEGORY
        {
          id: 'ITEM-EMERALD-BOOSTER',
          name: 'Zümrüt Çarpanı (Emerald Booster)',
          icon: '💎',
          price: 750,
          currency: 'EMERALD',
          category: 'Special',
          requiredRole: 'ANY',
          description: 'Bir sonraki oyunda kazandığınız Zümrüt ödülünü +%50 artırır.',
          enabled: true,
          purchaseLimit: 5,
          effect: 'EMERALD_BOOSTER',
          createdAt: now
        },
        {
          id: 'ITEM-TOURNAMENT-TICKET',
          name: 'Turnuva Bileti',
          icon: '🎟️',
          price: 1000,
          currency: 'EMERALD',
          category: 'Special',
          requiredRole: 'ANY',
          description: 'Şampiyona Parti odaları için özel giriş bileti (+500 Liderlik Puanı).',
          enabled: true,
          purchaseLimit: 10,
          effect: 'TOURNAMENT_TICKET',
          createdAt: now
        },
        {
          id: 'ITEM-VIP-CROWN-PACK',
          name: 'VIP Zümrüt Paketi',
          icon: '👑',
          price: 600,
          currency: 'EMERALD',
          category: 'VIP',
          requiredRole: 'VIP',
          description: 'Sadece VIP üyelerine özel paket: +2 Ekstra Can ve +1 Puan Çarpanı.',
          enabled: true,
          purchaseLimit: 3,
          effect: 'VIP_PACK',
          createdAt: now
        },
        // 👑 RANKS CATEGORY (Sections 5, 6, 7, 8, 9, 18)
        {
          id: 'ITEM-RANK-VIP',
          name: 'VIP Rütbesi',
          icon: '👑',
          price: 1000,
          priceTL: 200,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'VIP ayrıcalıklarını açar: Parti Oluşturma (4 Kişi), Davet Gönderme, Yüksek Öncelikli Destek & 1.25x Zümrüt Çarpanı!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_VIP',
          rankId: 'VIP',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-VIP-PLUS',
          name: 'VIP+ Rütbesi',
          icon: '👑',
          price: 1750,
          priceTL: 350,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'VIP özelliklerine ek olarak 6 Kişilik Parti, 1.50x Zümrüt Çarpanı, Çok Yüksek Öncelik & 6 Ekstra Can kapasitesi!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_VIP_PLUS',
          rankId: 'VIP_PLUS',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVP',
          name: 'MVP Rütbesi',
          icon: '⚔️',
          price: 2500,
          priceTL: 500,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'VIP+ özelliklerine ek olarak 8 Kişilik Parti, 1.75x Zümrüt Çarpanı & Çok Yüksek Öncelikli Destek/Hata/Öneri!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVP',
          rankId: 'MVP',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVP-PLUS',
          name: 'MVP+ Rütbesi',
          icon: '🌟',
          price: 3750,
          priceTL: 750,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'MVP özelliklerine ek olarak 10 Kişilik Parti, 2.00x Zümrüt Çarpanı, Animasyonlu Profil & 🌟 MVP+ Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVP_PLUS',
          rankId: 'MVP_PLUS',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVIP',
          name: 'MVIP Rütbesi',
          icon: '💎',
          price: 4500,
          priceTL: 900,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'MVP+ özelliklerine ek olarak 12 Kişilik Parti, 2.25x Zümrüt Çarpanı, Çok Yüksek Öncelik & 💎 MVIP Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVIP',
          rankId: 'MVIP',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVIP-PLUS',
          name: 'MVIP+ Rütbesi',
          icon: '🔥',
          price: 5500,
          priceTL: 1100,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'MVIP özelliklerine ek olarak 16 Kişilik Parti, 2.50x Zümrüt Çarpanı, Çok Yüksek Öncelik & 🔥 MVIP+ Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVIP_PLUS',
          rankId: 'MVIP_PLUS',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-ELITE',
          name: 'ELITE Rütbesi',
          icon: '⚡',
          price: 4500,
          priceTL: 900,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            '12 Kişilik Parti, 2.25x Zümrüt Çarpanı, Çok Yüksek Öncelik & Ametist ⚡ ELITE Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_ELITE',
          rankId: 'ELITE',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-LEGEND',
          name: 'LEGEND Rütbesi',
          icon: '🔱',
          price: 3000,
          priceTL: 1200,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            '14 Kişilik Parti, 2.50x Zümrüt Çarpanı, Çok Yüksek Öncelik & Kızıl 🔱 LEGEND Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_LEGEND',
          rankId: 'LEGEND',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-CHAMPION',
          name: 'CHAMPION Rütbesi',
          icon: '🏆',
          price: 4000,
          priceTL: 1600,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            '16 Kişilik Parti, 2.75x Zümrüt Çarpanı, Çok Yüksek Öncelik & Altın 🏆 CHAMPION Rozeti!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_CHAMPION',
          rankId: 'CHAMPION',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MILLIONAIRE',
          name: 'MILLIONAIRE Rütbesi',
          icon: '💎',
          price: 5000,
          priceTL: 2000,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description:
            'Efsanevi 💎 MILLIONAIRE Rütbesi! 20 Kişilik Parti, 3.00x Zümrüt Çarpanı + Otomatik RGB Kullanıcı Adı!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MILLIONAIRE',
          rankId: 'MILLIONAIRE',
          createdAt: now
        }
      ];

      store.set(ECON_KEYS.SHOP_ITEMS, items);
      return items;
    },

    _saveShopItems(items) {
      store.set(ECON_KEYS.SHOP_ITEMS, items);
    },

    listItems() {
      return this._ensureShopItems().map(i => ({ ...i }));
    },

    listShopItems(includeDisabled = false, categoryFilter = 'ALL') {
      // Include Emerald Packages when viewing ALL or Emeralds category
      const packagesAsItems = paymentService
        .listEmeraldPackages(includeDisabled)
        .map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          icon: pkg.icon || '⬛',
          iconType: pkg.iconType || 'NETHERITE_INGOT',
          ingotCount: pkg.ingotCount || 1,
          badge: pkg.badge || '',
          price: pkg.priceTL,
          emeraldsGranted: pkg.emeralds,
          currency: 'TRY',
          category: 'Emeralds',
          requiredRole: 'ANY',
          description: `Netherite Külçesi Zümrüt Paketi — Stripe Güvencesiyle ${pkg.emeralds.toLocaleString('tr-TR')} 💚 Zümrüt satın alın (Kur: 5 💚 = 1 TL).`,
          enabled: pkg.enabled !== false,
          purchaseLimit: 99,
          effect: 'EMERALD_PACKAGE'
        }));

      const rawItems = this.listItems().map(item => ({
        ...item,
        currency: item.currency || 'EMERALD',
        category: item.category || 'Gameplay',
        requiredRole: item.requiredRole || 'ANY',
        purchaseLimit: item.purchaseLimit || item.maxPurchase || 5,
        effectType: item.effect || item.effectType || 'EXTRA_LIFE',
        maxPerGame: item.purchaseLimit || item.maxPurchase || 1
      }));

      const all = [...packagesAsItems, ...rawItems];
      const enabledFiltered = includeDisabled ? all : all.filter(i => i.enabled);
      if (!categoryFilter || categoryFilter === 'ALL') return enabledFiltered;
      return enabledFiltered.filter(
        i => i.category.toLowerCase() === String(categoryFilter).toLowerCase()
      );
    },

    // Section 33: Evaluate Purchase Eligibility & Explain Why Disabled
    evaluateEligibility(session, item) {
      if (!session) {
        return { canBuy: false, reason: 'Lütfen giriş yapın', buttonLabel: 'Giriş Gerekli' };
      }
      if (!item.enabled) {
        return { canBuy: false, reason: 'Admin tarafından devre dışı', buttonLabel: 'Devre Dışı' };
      }

      const profile = economyService.getPlayerEconomyProfile(session.username);
      const isVip = authGuard.isVipOrAdmin(session);
      const perms = authGuard.getUserPermissions(session);

      if (item.requiredRole === 'VIP' && !isVip) {
        return { canBuy: false, reason: 'VIP Rütbesi Gerektirir', buttonLabel: '🔒 VIP Gerekli' };
      }

      if (item.effect === 'RGB_NAME' && profile.rgbOwned) {
        return {
          canBuy: false,
          reason: 'Zaten Sahipsiniz (Profil / Kozmetikler bölümünden aktif edin)',
          buttonLabel: '✅ Sahipsiniz'
        };
      }

      if (item.effect === 'ANIMATED_NAME' && profile.animatedNameOwned) {
        return {
          canBuy: false,
          reason: 'Zaten Sahipsiniz',
          buttonLabel: '✅ Sahipsiniz'
        };
      }

      if (item.rankId && (profile.ownedRanks || []).includes(item.rankId)) {
        return {
          canBuy: false,
          reason: 'Bu Rütbe Zaten Açık',
          buttonLabel: '✅ Rütbe Açık'
        };
      }

      const maxLivesAllowed = Math.max(perms.maxExtraLives || 5, item.purchaseLimit || 5);
      if (item.effect === 'EXTRA_LIFE' && profile.extraLives >= maxLivesAllowed) {
        return {
          canBuy: false,
          reason: `Maksimum Ekstra Can (${maxLivesAllowed}) sınırına ulaşıldı`,
          buttonLabel: 'Maks. Kapasite'
        };
      }

      if (item.currency === 'TRY' || item.effect === 'EMERALD_PACKAGE') {
        return {
          canBuy: true,
          reason: 'Güvenli Stripe Ödemesi (5 💚 = 1 TL)',
          buttonLabel: `💳 Satın Al (${item.price} TL)`
        };
      }

      if (profile.emeraldCoins < item.price) {
        return {
          canBuy: false,
          reason: 'Yetersiz Zümrüt Bakiyesi',
          buttonLabel: 'Yetersiz Zümrüt'
        };
      }

      return {
        canBuy: true,
        reason: 'Satın alınabilir',
        buttonLabel: `🛒 SATIN AL (${item.price.toLocaleString('tr-TR')} 💚)`
      };
    },

    purchaseItem(session, itemId) {
      authGuard.verifySession(session);

      // Check if itemId is an Emerald Package first
      const pkg = paymentService
        .listEmeraldPackages(true)
        .find(p => p.id.toUpperCase() === String(itemId || '').toUpperCase());
      if (pkg) {
        if (pkg.enabled === false) {
          throw new Error(`"${pkg.name}" şu anda devre dışı.`);
        }
        return paymentService.createCheckoutSession(session, {
          productType: 'EMERALD_PACKAGE',
          packageId: pkg.id,
          title: pkg.name,
          emeraldsGranted: pkg.emeralds,
          priceTL: pkg.priceTL,
          currency: 'TRY'
        });
      }

      const items = this._ensureShopItems();
      const normalizedId = String(itemId || '')
        .toUpperCase()
        .replace(/_/g, '-');
      const matched = items.find(
        i =>
          i.id.toUpperCase() === normalizedId ||
          i.id === itemId ||
          (normalizedId === 'EXTRA-LIFE' && i.id === 'ITEM-EXTRA-LIFE')
      );
      const item = matched || items.find(i => i.id === itemId);

      if (!item) {
        throw new Error('Ürün Zümrüt Mağazasında bulunamadı.');
      }

      if (!item.enabled) {
        throw new Error(`"${item.name}" şu anda devre dışı.`);
      }

      if (item.requiredRole === 'VIP' && !authGuard.isVipOrAdmin(session)) {
        throw new Error('VIP Gerekli: Bu ürünü yalnızca VIP ve üzeri rütbeli oyuncular satın alabilir.');
      }

      if (item.currency === 'TRY') {
        return paymentService.createCheckoutSession(session, {
          productType: item.rankId ? 'RANK' : 'ITEM',
          packageId: item.id,
          title: item.name,
          emeraldsGranted: 0,
          rankGranted: item.rankId || null,
          priceTL: item.price,
          currency: 'TRY'
        });
      }

      const lockKey = `shop_buy_${session.username}_${item.id}`;
      acquireLock(lockKey);

      try {
        const price = Math.max(0, Number(item.price));
        const accounts = economyService._ensureAccounts();
        const accIdx = accounts.findIndex(
          a => a.username.toLowerCase() === session.username.toLowerCase()
        );
        if (accIdx === -1) {
          economyService.getOrCreateAccount(session.username, session.role);
          releaseLock(lockKey);
          return this.purchaseItem(session, item.id);
        }

        const acc = accounts[accIdx];
        const perms = authGuard.getUserPermissions(session);
        const limit =
          item.effect === 'EXTRA_LIFE'
            ? Math.max(perms.maxExtraLives || 5, item.purchaseLimit || 5)
            : item.purchaseLimit || item.maxPurchase || 5;

        if (item.effect === 'EXTRA_LIFE' && acc.extraLives >= limit) {
          throw new Error(
            `Maksimum Ekstra Can sınırına (${limit}) ulaştınız! Yenisini almadan önce mevcut canlarınızı kullanın.`
          );
        }
        if (item.effect === 'RGB_NAME' && acc.rgbOwned) {
          throw new Error('RGB Kullanıcı Adı kozmetiğine zaten sahipsiniz!');
        }
        if (item.effect === 'ANIMATED_NAME' && acc.animatedNameOwned) {
          throw new Error('Animasyonlu İsim kozmetiğine zaten sahipsiniz!');
        }
        if (item.rankId && (acc.ownedRanks || []).includes(item.rankId)) {
          throw new Error(`${item.name} rütbesine zaten sahipsiniz!`);
        }

        if (acc.balance < price) {
          throw new Error(
            `Yetersiz Zümrüt! Gereken: ${price} 💚, Mevcut Bakiye: ${acc.balance} 💚`
          );
        }

        const snapshot = JSON.stringify(acc);

        try {
          const prevBal = acc.balance;
          acc.balance = Math.max(0, acc.balance - price);
          acc.totalSpent += price;

          const eff = item.effect || item.effectType;
          if (eff === 'EXTRA_LIFE') {
            acc.extraLives = (acc.extraLives || 0) + 1;
          } else if (eff === 'SECOND_CHANCE') {
            acc.extraLives = (acc.extraLives || 0) + 1;
            acc.points = (acc.points || 0) + 300;
            acc.secondChanceOwned = (acc.secondChanceOwned || 0) + 1;
          } else if (eff === 'SCORE_BOOSTER') {
            acc.scoreBoosterOwned = (acc.scoreBoosterOwned || 0) + 1;
          } else if (eff === 'EMERALD_BOOSTER') {
            acc.emeraldBoosterOwned = (acc.emeraldBoosterOwned || 0) + 1;
          } else if (eff === 'TOURNAMENT_TICKET') {
            acc.tournamentTickets = (acc.tournamentTickets || 0) + 1;
            acc.points = (acc.points || 0) + 500;
          } else if (eff === 'VIP_PACK') {
            acc.extraLives = (acc.extraLives || 0) + 2;
            acc.scoreBoosterOwned = (acc.scoreBoosterOwned || 0) + 1;
          } else if (eff === 'PROFILE_BORDER_EMERALD') {
            if (userService) {
              userService.updateProfileCustomization(session, { profileBorder: 'emerald' });
            }
          } else if (eff === 'PROFILE_BG_NETHER') {
            if (userService) {
              userService.updateProfileCustomization(session, { profileBackground: 'nether_fortress' });
            }
          } else if (eff === 'RGB_NAME') {
            acc.rgbOwned = true;
            acc.rgbEnabled = true;
            if (userService) {
              const allUsers = userService._getAllRaw();
              const u = allUsers.find(
                x => x.minecraftUsername.toLowerCase() === session.username.toLowerCase()
              );
              if (u) {
                u.cosmetics = u.cosmetics || {};
                u.cosmetics.rgbOwned = true;
                u.cosmetics.rgbEnabled = true;
                userService._saveAllRaw(allUsers);
              }
            }
          } else if (eff === 'ANIMATED_NAME') {
            acc.animatedNameOwned = true;
            if (userService) {
              const allUsers = userService._getAllRaw();
              const u = allUsers.find(
                x => x.minecraftUsername.toLowerCase() === session.username.toLowerCase()
              );
              if (u) {
                u.cosmetics = u.cosmetics || {};
                u.cosmetics.animatedNameOwned = true;
                u.cosmetics.animatedNameEnabled = true;
                userService._saveAllRaw(allUsers);
              }
            }
          } else if (item.rankId || String(eff).startsWith('RANK_')) {
            const targetRank = item.rankId || String(eff).replace('RANK_', '');
            acc.ownedRanks = acc.ownedRanks || ['PLAYER'];
            if (!acc.ownedRanks.includes(targetRank)) acc.ownedRanks.push(targetRank);
            acc.equippedRank = targetRank;

            const rankDef = rankService.getRankById(targetRank);
            if (rankDef && (rankDef.grantsVip || rankDef.permissions?.canCreateParty)) {
              acc.isVip = true;
              if (acc.role !== 'ADMIN') acc.role = 'VIP';
            }
            if (rankDef?.permissions?.rgbName || targetRank === 'MILLIONAIRE') {
              acc.rgbOwned = true;
              acc.rgbEnabled = true;
            }
            if (userService) {
              userService._grantRankInternal(session.username, targetRank, null);
            }
          }

          acc.updatedAt = new Date().toISOString();
          economyService._saveAccounts(accounts);
          if (userService) {
            userService.syncFromEconomyAccount(acc);
          }

          const tx = economyService._recordTransaction({
            playerId: acc.playerId,
            username: acc.username,
            amount: -price,
            type: 'SHOP_PURCHASE',
            reason: `Purchased ${item.icon} ${item.name}`,
            previousBalance: prevBal,
            newBalance: acc.balance,
            source: 'Emerald Shop'
          });

          activityService.log(
            'SHOP_PURCHASE',
            session.username,
            `${session.username} purchased "${item.name}" for ${price} 💚 (${prevBal} → ${acc.balance})`
          );

          return {
            ok: true,
            item,
            account: { ...acc },
            profile: normalizeAccount(acc),
            transaction: tx
          };
        } catch (innerErr) {
          accounts[accIdx] = JSON.parse(snapshot);
          economyService._saveAccounts(accounts);
          throw innerErr;
        }
      } finally {
        releaseLock(lockKey);
      }
    },

    // ADMIN SHOP MANAGEMENT
    createShopItem(session, itemData) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const name = String(itemData.name || '').trim();
      if (!name) throw new Error('Item name cannot be empty.');

      const newItem = {
        id: 'ITEM-' + Date.now().toString(36).toUpperCase(),
        name,
        description:
          String(itemData.description || '').trim() || 'Special Minecraft tournament item.',
        icon: String(itemData.icon || '💎').trim(),
        price: Math.max(0, Math.round(Number(itemData.price) || 100)),
        currency: itemData.currency || 'EMERALD',
        category: itemData.category || 'Gameplay',
        requiredRole: itemData.requiredRole || 'ANY',
        enabled: itemData.enabled !== false,
        purchaseLimit: Math.max(
          1,
          Math.round(Number(itemData.purchaseLimit || itemData.maxPurchase) || 3)
        ),
        effect: itemData.effect || itemData.effectType || 'EXTRA_LIFE',
        createdAt: new Date().toISOString()
      };

      items.push(newItem);
      this._saveShopItems(items);
      activityService.log(
        'SHOP_ITEM_CREATED',
        session.username,
        `Admin ${session.username} created shop item "${newItem.name}" (${newItem.price} ${newItem.currency})`
      );
      return newItem;
    },

    updateShopItem(session, itemId, updates = {}) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const target = items.find(i => i.id === itemId);
      if (!target) throw new Error('Shop item not found.');

      if (updates.name !== undefined) target.name = String(updates.name).trim();
      if (updates.description !== undefined)
        target.description = String(updates.description).trim();
      if (updates.icon !== undefined) target.icon = String(updates.icon).trim();
      if (updates.price !== undefined)
        target.price = Math.max(0, Math.round(Number(updates.price)));
      if (updates.currency !== undefined) target.currency = updates.currency;
      if (updates.category !== undefined) target.category = updates.category;
      if (updates.requiredRole !== undefined) target.requiredRole = updates.requiredRole;
      if (updates.enabled !== undefined) target.enabled = Boolean(updates.enabled);
      if (updates.purchaseLimit !== undefined)
        target.purchaseLimit = Math.max(1, Math.round(Number(updates.purchaseLimit)));

      this._saveShopItems(items);
      activityService.log(
        'SHOP_ITEM_UPDATED',
        session.username,
        `Admin ${session.username} updated shop item "${target.name}"`
      );
      return target;
    },

    adminSaveShopItem(session, itemData) {
      const existing = this._ensureShopItems().find(i => i.id === itemData.id);
      if (existing) {
        return this.updateShopItem(session, itemData.id, {
          ...itemData,
          effect: itemData.effectType || itemData.effect
        });
      }
      return this.createShopItem(session, {
        ...itemData,
        effect: itemData.effectType || itemData.effect
      });
    }
  };

  // ==========================================
  // 6. EXTRA LIFE SERVICE (Section 19)
  // ==========================================
  const extraLifeService = {
    canOfferExtraLife(username, gameId, levelNumber) {
      const cfg = configService.getConfig();
      if (!cfg.extraLifeEnabled) return false;
      if (!username || !gameId) return false;

      const elimKey = `${username}::${gameId}::L${levelNumber}`;
      if (consumedEliminationKeys.has(elimKey)) return false;

      const logs = store.get(ECON_KEYS.EXTRA_LIVES, []);
      const usedInThisGame = logs.filter(
        x => x.username.toLowerCase() === username.toLowerCase() && x.gameId === gameId
      ).length;
      if (usedInThisGame >= cfg.extraLifeMaxPerGame) return false;

      const acc = economyService.getOrCreateAccount(username);
      return acc.extraLives > 0;
    },

    canUseExtraLife(session, gameId, levelNumber) {
      if (!session || !gameId) {
        return { canUse: false, availableCount: 0, reason: 'Invalid session or gameId' };
      }
      const cfg = configService.getConfig();
      if (!cfg.extraLife.enabled) {
        return {
          canUse: false,
          availableCount: 0,
          reason: 'Extra Life feature is disabled by Admin'
        };
      }
      const elimKey = `${session.username}::${gameId}::L${levelNumber}`;
      if (consumedEliminationKeys.has(elimKey)) {
        return { canUse: false, availableCount: 0, reason: 'Already used on this question' };
      }
      const logs = store.get(ECON_KEYS.EXTRA_LIVES, []);
      const usedInThisGame = logs.filter(
        x => x.username.toLowerCase() === session.username.toLowerCase() && x.gameId === gameId
      ).length;
      if (usedInThisGame >= cfg.extraLife.maxPerGame) {
        return {
          canUse: false,
          availableCount: 0,
          reason: `Max Extra Lives per game (${cfg.extraLife.maxPerGame}) reached`
        };
      }
      const acc = economyService.getOrCreateAccount(session.username, session.role);
      const availableCount = Number(acc.extraLives || 0);
      return {
        canUse: availableCount > 0,
        availableCount,
        reason: availableCount > 0 ? 'OK' : 'No Extra Lives owned'
      };
    },

    consumeExtraLife(session, arg1, arg2) {
      authGuard.verifySession(session);
      let gameId = arg1;
      let levelNumber = arg2;
      let partyId = null;
      if (arg1 && typeof arg1 === 'object') {
        gameId = arg1.gameId;
        levelNumber = arg1.levelNumber;
        partyId = arg1.partyId || null;
      }

      const elimKey = `${session.username}::${gameId}::L${levelNumber}`;
      const lockKey = `extralife_${elimKey}`;
      acquireLock(lockKey);

      try {
        if (!this.canOfferExtraLife(session.username, gameId, levelNumber)) {
          throw new Error('Cannot use Extra Life on this question.');
        }

        let updatedAcc = null;
        updatedAcc = economyService._mutateAccount(session.username, acc => {
          if (acc.extraLives <= 0) {
            throw new Error('You do not have any Extra Lives available!');
          }
          acc.extraLives -= 1;
          acc.extraLivesUsed = (acc.extraLivesUsed || 0) + 1;
        });

        consumedEliminationKeys.add(elimKey);

        const logs = store.get(ECON_KEYS.EXTRA_LIVES, []);
        const usageRecord = {
          id: 'EXL-' + Date.now(),
          playerId: updatedAcc.playerId,
          username: updatedAcc.username,
          gameId,
          partyId,
          levelNumber,
          timestamp: new Date().toISOString()
        };
        logs.unshift(usageRecord);
        store.set(ECON_KEYS.EXTRA_LIVES, logs);

        economyService._recordTransaction({
          playerId: updatedAcc.playerId,
          username: updatedAcc.username,
          amount: 0,
          type: 'EXTRA_LIFE_USED',
          reason: `❤️ Extra Life Used (Question ${levelNumber})`,
          previousBalance: updatedAcc.balance,
          newBalance: updatedAcc.balance,
          gameId,
          partyId,
          source: 'Gameplay'
        });

        activityService.log(
          'EXTRA_LIFE_USED',
          session.username,
          `❤️ ${session.username} used an Extra Life on Question ${levelNumber} (Game: ${gameId})`
        );

        achievementService.checkAndUnlock(session.username);

        return {
          ok: true,
          account: updatedAcc,
          remainingExtraLives: updatedAcc.extraLives,
          extraLivesUsed: updatedAcc.extraLivesUsed,
          usageRecord
        };
      } finally {
        releaseLock(lockKey);
      }
    },

    useExtraLifeInGame(session, gameId, levelNumber, partyId = null) {
      return this.consumeExtraLife(session, { gameId, levelNumber, partyId });
    }
  };

  // ==========================================
  // 7. DAILY LOGIN REWARD SERVICE
  // ==========================================
  const dailyRewardService = {
    getStatus(username) {
      const acc = economyService.getOrCreateAccount(username);
      const cfg = configService.getConfig();
      const u = userService ? userService.getUserByUsername(username) : null;
      const isVip = Boolean(
        acc.isVip || u?.vipStatus?.isVip || u?.role === 'VIP' || u?.role === 'ADMIN'
      );
      const cooldownMs = cfg.dailyCooldownHours * 3600 * 1000;
      const now = Date.now();
      const baseReward = isVip ? cfg.vipDailyLoginReward : cfg.dailyLoginBaseReward;
      const streakArr = isVip ? cfg.vipDailyStreakRewards : cfg.dailyStreakRewards;

      if (!acc.lastDailyClaimAt) {
        return {
          canClaim: true,
          isVip,
          nextStreakDay: 1,
          rewardAmount: streakArr[0] || baseReward,
          remainingMs: 0
        };
      }

      const lastTime = new Date(acc.lastDailyClaimAt).getTime();
      const elapsed = now - lastTime;

      if (elapsed < cooldownMs) {
        return {
          canClaim: false,
          isVip,
          nextStreakDay: acc.dailyStreak || 1,
          rewardAmount: streakArr[(acc.dailyStreak || 1) % 7] || baseReward,
          remainingMs: cooldownMs - elapsed
        };
      }

      const streakBroken = elapsed > cooldownMs * 2.2;
      const nextStreak = streakBroken ? 1 : ((acc.dailyStreak || 0) % 7) + 1;
      const reward = streakArr[nextStreak - 1] || baseReward;

      return {
        canClaim: true,
        isVip,
        nextStreakDay: nextStreak,
        rewardAmount: reward,
        remainingMs: 0
      };
    },

    canClaimDailyReward(username) {
      const acc = economyService.getOrCreateAccount(username);
      const st = this.getStatus(username);
      return {
        ...st,
        currentStreak: Number(acc.dailyStreak || 0)
      };
    },

    claimDailyReward(session) {
      authGuard.verifySession(session);
      const lockKey = `daily_${session.username}`;
      acquireLock(lockKey);

      try {
        const st = this.getStatus(session.username);
        if (!st.canClaim) {
          const hrs = Math.ceil(st.remainingMs / (3600 * 1000));
          throw new Error(
            `Daily reward already claimed! You can claim again in ~${hrs} hour(s).`
          );
        }

        let prevBal = 0;
        let newBal = 0;
        const updatedAcc = economyService._mutateAccount(session.username, acc => {
          prevBal = acc.balance;
          acc.balance += st.rewardAmount;
          acc.totalEarned += st.rewardAmount;
          newBal = acc.balance;
          acc.dailyStreak = st.nextStreakDay;
          acc.lastDailyClaimAt = new Date().toISOString();
        });

        economyService._recordTransaction({
          playerId: updatedAcc.playerId,
          username: updatedAcc.username,
          amount: st.rewardAmount,
          type: 'DAILY_REWARD',
          reason: `${st.isVip ? '👑 VIP ' : ''}Daily Reward (Day ${st.nextStreakDay})`,
          previousBalance: prevBal,
          newBalance: newBal,
          source: st.isVip ? 'Daily Bonus (VIP)' : 'Daily Bonus'
        });

        activityService.log(
          'DAILY_REWARD',
          session.username,
          `${session.username} claimed Day ${st.nextStreakDay} Daily Reward (+${st.rewardAmount} 💚)`
        );

        achievementService.checkAndUnlock(session.username);

        return {
          ok: true,
          streakDay: st.nextStreakDay,
          streak: st.nextStreakDay,
          reward: st.rewardAmount,
          rewardAmount: st.rewardAmount,
          balance: updatedAcc.balance,
          newBalance: updatedAcc.balance,
          account: updatedAcc,
          profile: normalizeAccount(updatedAcc)
        };
      } finally {
        releaseLock(lockKey);
      }
    }
  };

  // ==========================================
  // 8. ACHIEVEMENTS & BADGES SERVICE
  // ==========================================
  const ACHIEVEMENTS_CATALOG = [
    {
      id: 'ACH_FIRST_WIN',
      icon: '🏆',
      title: 'İlk Zafer',
      description: 'İlk Minecraft Milyoner oyununuzu kazanın (15/15).',
      bonusEmeralds: 50
    },
    {
      id: 'ACH_EMERALD_HUNTER',
      icon: '💚',
      title: 'Zümrüt Avcısı',
      description: 'Cüzdanınızda 1.000+ Zümrüt biriktirin.',
      bonusEmeralds: 75
    },
    {
      id: 'ACH_QUIZ_MASTER',
      icon: '🧠',
      title: 'Bilgi Ustası',
      description: 'En az 10 Minecraft Milyoner oyunu oynayın.',
      bonusEmeralds: 50
    },
    {
      id: 'ACH_SECOND_CHANCE',
      icon: '❤️',
      title: 'İkinci Şans',
      description: 'Bir oyunda Ekstra Can kullanarak oyuna geri dönün.',
      bonusEmeralds: 40
    },
    {
      id: 'ACH_MILLIONAIRE',
      icon: '💎',
      title: 'Milyoner',
      description: 'Toplam 10.000+ Liderlik Tablosu Puanına ulaşın.',
      bonusEmeralds: 100
    },
    {
      id: 'ACH_CHAMPION',
      icon: '👑',
      title: 'Liderlik Şampiyonu',
      description: 'Minecraft Milyoner Liderlik Tablosunda 1. sıraya yükselin.',
      bonusEmeralds: 150
    }
  ];

  const achievementService = {
    getCatalog() {
      return ACHIEVEMENTS_CATALOG;
    },

    getUnlockedForPlayer(username) {
      const map = store.get(ECON_KEYS.ACHIEVEMENTS, {});
      const key = Object.keys(map).find(
        k => k.toLowerCase() === String(username).toLowerCase()
      );
      return key ? map[key] : [];
    },

    getPlayerAchievements(username) {
      const unlockedIds = new Set(this.getUnlockedForPlayer(username));
      return ACHIEVEMENTS_CATALOG.map(ach => ({
        ...ach,
        unlocked: unlockedIds.has(ach.id)
      }));
    },

    checkAndUnlock(username) {
      const acc = economyService.getOrCreateAccount(username);
      const map = store.get(ECON_KEYS.ACHIEVEMENTS, {});
      const key =
        Object.keys(map).find(k => k.toLowerCase() === String(username).toLowerCase()) ||
        username;
      const unlocked = new Set(map[key] || []);
      const newlyUnlocked = [];

      const rankInfo = leaderboardService.getPlayerRank(username);

      const conditions = {
        ACH_FIRST_WIN: acc.gamesWon >= 1,
        ACH_EMERALD_HUNTER: acc.balance >= 1000,
        ACH_QUIZ_MASTER: acc.gamesPlayed >= 10,
        ACH_SECOND_CHANCE: acc.extraLivesUsed >= 1,
        ACH_MILLIONAIRE: acc.points >= 10000,
        ACH_CHAMPION: rankInfo && rankInfo.rank === 1
      };

      ACHIEVEMENTS_CATALOG.forEach(ach => {
        if (conditions[ach.id] && !unlocked.has(ach.id)) {
          unlocked.add(ach.id);
          newlyUnlocked.push(ach);
        }
      });

      if (newlyUnlocked.length > 0) {
        map[key] = Array.from(unlocked);
        store.set(ECON_KEYS.ACHIEVEMENTS, map);
      }

      return newlyUnlocked;
    }
  };

  // ==========================================
  // 9. LEADERBOARD SERVICE (Section 20: Rank, Username, Rank Badge, Points, Emeralds, Wins, Games, Win Rate)
  // ==========================================
  const leaderboardService = {
    getSortedLeaderboard(limit = 50, searchQuery = '', sortBy = 'POINTS') {
      const accounts = economyService.getAllAccounts().map(normalizeAccount);
      const sortKey = String(sortBy || 'POINTS').toUpperCase();

      accounts.sort((a, b) => {
        if (sortKey === 'WINS') {
          if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
          return b.points - a.points;
        }
        if (sortKey === 'EMERALDS') {
          if (b.balance !== a.balance) return b.balance - a.balance;
          return b.points - a.points;
        }
        if (sortKey === 'GAMES') {
          if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
          return b.points - a.points;
        }
        // Default: POINTS
        if (b.points !== a.points) return b.points - a.points;
        if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
        return b.balance - a.balance;
      });

      const ranked = accounts.map((acc, index) => ({
        rank: index + 1,
        ...acc
      }));

      let filtered = ranked;
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = ranked.filter(r => r.username.toLowerCase().includes(q));
      }

      return {
        allRanked: ranked,
        entries: filtered.slice(0, limit),
        top3: ranked.slice(0, 3)
      };
    },

    getLeaderboard({ limit = 50, search = '', sortBy = 'POINTS' } = {}) {
      return this.getSortedLeaderboard(limit, search, sortBy).entries;
    },

    getPlayerRank(username, sortBy = 'POINTS') {
      const { allRanked } = this.getSortedLeaderboard(500, '', sortBy);
      const found = allRanked.find(
        r => r.username.toLowerCase() === String(username || '').toLowerCase()
      );
      if (found) return found;

      const acc = normalizeAccount(economyService.getOrCreateAccount(username));
      return {
        rank: allRanked.length + 1,
        ...acc
      };
    },

    getPlayerRankAndSummary(username) {
      return this.getPlayerRank(username, 'POINTS');
    }
  };

  // Attach to global MCMServices
  Object.assign(window.MCMServices, {
    configService,
    rankService,
    economyService,
    shopService,
    extraLifeService,
    dailyRewardService,
    achievementService,
    leaderboardService
  });
})();
