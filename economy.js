/**
 * MINECRAFT MILYONER — ECONOMY, LEADERBOARD, SHOP, RANKS, RGB COSMETICS & EXTRA LIFE SERVICES
 *
 * Modular Services:
 * - configService (Normal & VIP Rewards, Extra Life Config)
 * - rankService (Configurable Ranks: VIP, MVP, MVP+, LEGEND, CHAMPION, MILLIONAIRE)
 * - economyService (Persistent Emerald Balances, VIP Bonus, Admin Controls, Full Audit Ledger)
 * - shopService (Categories: Gameplay, Ranks, Cosmetics, VIP, Special + Eligibility Checks)
 * - extraLifeService (Atomic Extra Life Consumption & Anti-Duplicate Protection)
 * - dailyRewardService (Normal +25 💚 / VIP +50 💚 Daily Reward & Streak)
 * - achievementService (Automatic Milestone Unlocking)
 * - leaderboardService (Sort by Points, Wins, Emeralds, Games Played + Top 3 Podium)
 */

(function () {
  'use strict';

  const { authGuard, activityService, userService, paymentService } = window.MCMServices;

  const ECON_KEYS = {
    CONFIG: 'mcm_econ_config_v3',
    ACCOUNTS: 'mcm_econ_accounts_v2',
    TRANSACTIONS: 'mcm_econ_transactions_v2',
    SHOP_ITEMS: 'mcm_econ_shop_items_v3',
    RANKS: 'mcm_econ_ranks_v3',
    PURCHASES: 'mcm_econ_purchases_v2',
    EXTRA_LIVES: 'mcm_econ_extralives_v2',
    ACHIEVEMENTS: 'mcm_econ_achievements_v2'
  };

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
  // 1. CONFIGURABLE REWARD & EXTRA LIFE SETTINGS (Sections 10, 21, 25)
  // ==========================================
  const DEFAULT_CONFIG = {
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
  // 2. CONFIGURABLE RANK SYSTEM (Section 12)
  // ==========================================
  const DEFAULT_RANKS = [
    {
      id: 'PLAYER',
      displayName: 'Player',
      badge: '⛏️ PLAYER',
      color: '#a6b4d0',
      permissions: ['JOIN_PARTY', 'USE_SHOP'],
      grantsVip: false,
      price: 0,
      currency: 'EMERALD'
    },
    {
      id: 'VIP',
      displayName: 'VIP',
      badge: '👑 VIP',
      color: '#ffbe2e',
      permissions: ['CREATE_PARTY', 'INVITE_PLAYER', 'PRIORITY_SUPPORT', 'VIP_BONUS', 'VIP_SHOP'],
      grantsVip: true,
      price: 200,
      emeraldPrice: 2000,
      currency: 'TRY'
    },
    {
      id: 'MVP',
      displayName: 'MVP',
      badge: '⚔️ MVP',
      color: '#36e2ec',
      permissions: ['JOIN_PARTY', 'USE_SHOP', 'MVP_BADGE'],
      grantsVip: false,
      price: 1500,
      currency: 'EMERALD'
    },
    {
      id: 'MVP_PLUS',
      displayName: 'MVP+',
      badge: '🌟 MVP+',
      color: '#36e2ec',
      permissions: ['CREATE_PARTY', 'INVITE_PLAYER', 'PRIORITY_SUPPORT', 'VIP_BONUS', 'VIP_SHOP'],
      grantsVip: true,
      price: 2200,
      currency: 'EMERALD'
    },
    {
      id: 'LEGEND',
      displayName: 'LEGEND',
      badge: '🔱 LEGEND',
      color: '#ff6b6b',
      permissions: ['CREATE_PARTY', 'INVITE_PLAYER', 'PRIORITY_SUPPORT', 'VIP_BONUS', 'VIP_SHOP'],
      grantsVip: true,
      price: 3000,
      currency: 'EMERALD'
    },
    {
      id: 'CHAMPION',
      displayName: 'CHAMPION',
      badge: '🏆 CHAMPION',
      color: '#ffd700',
      permissions: ['CREATE_PARTY', 'INVITE_PLAYER', 'PRIORITY_SUPPORT', 'VIP_BONUS', 'VIP_SHOP'],
      grantsVip: true,
      price: 4000,
      currency: 'EMERALD'
    },
    {
      id: 'MILLIONAIRE',
      displayName: 'MILLIONAIRE',
      badge: '💎 MILLIONAIRE',
      color: '#23d160',
      permissions: ['CREATE_PARTY', 'INVITE_PLAYER', 'PRIORITY_SUPPORT', 'VIP_BONUS', 'VIP_SHOP', 'RGB_NAME'],
      grantsVip: true,
      price: 5000,
      currency: 'EMERALD'
    },
    {
      id: 'ADMIN',
      displayName: 'ADMIN',
      badge: '🛡️ ADMIN',
      color: '#ff5252',
      permissions: ['ALL'],
      grantsVip: true,
      price: 0,
      currency: 'EMERALD'
    }
  ];

  const rankService = {
    getRanks() {
      const saved = store.get(ECON_KEYS.RANKS, null);
      if (saved && Array.isArray(saved) && saved.length > 0) return saved;
      store.set(ECON_KEYS.RANKS, DEFAULT_RANKS);
      return DEFAULT_RANKS;
    },

    getRankById(rankId) {
      const all = this.getRanks();
      return (
        all.find(r => r.id.toUpperCase() === String(rankId || 'PLAYER').toUpperCase()) || all[0]
      );
    }
  };

  // ==========================================
  // 3. NORMALIZE ACCOUNT HELPER
  // ==========================================
  function normalizeAccount(acc) {
    if (!acc) return null;
    const u = userService ? userService.getUserByUsername(acc.username) : null;
    const balance = Number(acc.balance ?? acc.emeraldCoins ?? u?.emeraldBalance ?? 0);
    const points = Number(acc.points ?? acc.totalPoints ?? u?.points ?? 0);
    const gamesPlayed = Number(acc.gamesPlayed || u?.gamesPlayed || 0);
    const gamesWon = Number(acc.gamesWon || u?.gamesWon || 0);
    const gamesLost = Number(acc.gamesLost || u?.gamesLost || 0);
    const extraLives = Number(acc.extraLives ?? acc.inventory?.extraLives ?? u?.extraLives ?? 0);
    const secondChanceOwned = Number(acc.secondChanceOwned ?? acc.inventory?.secondChance ?? 0);
    const scoreBoosterOwned = Number(acc.scoreBoosterOwned ?? acc.inventory?.scoreBooster ?? 0);
    const emeraldBoosterOwned = Number(acc.emeraldBoosterOwned ?? acc.inventory?.emeraldBooster ?? 0);
    const tournamentTickets = Number(acc.tournamentTickets ?? acc.inventory?.tournamentTickets ?? 0);
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const averageScore = gamesPlayed > 0 ? Math.round(points / gamesPlayed) : 0;

    const effectiveRole = u ? u.role : acc.role || 'PLAYER';
    const isVip = Boolean(
      effectiveRole === 'VIP' ||
        effectiveRole === 'ADMIN' ||
        u?.vipStatus?.isVip ||
        acc.isVip
    );
    const rankId = u?.rankId || acc.equippedRank || effectiveRole;
    const rankObj = rankService.getRankById(rankId);
    const rgbOwned = Boolean(acc.rgbOwned || u?.cosmetics?.rgbOwned || effectiveRole === 'ADMIN');
    const rgbEnabled = Boolean(
      u?.cosmetics?.rgbEnabled !== undefined ? u.cosmetics.rgbEnabled : acc.rgbEnabled
    );

    return {
      ...acc,
      userId: u?.id || acc.playerId,
      role: effectiveRole,
      isVip,
      vipStatus: u?.vipStatus || { isVip, tier: isVip ? 'VIP' : 'NONE', expiresAt: null },
      rankId,
      rankBadge: rankObj.badge,
      rankColor: rankObj.color,
      rgbOwned,
      rgbEnabled,
      ownedRanks: acc.ownedRanks || [effectiveRole],
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
  // 4. EMERALD ECONOMY SERVICE (Sections 10, 20, 21, 25)
  // ==========================================
  const economyService = {
    _ensureAccounts() {
      const existing = store.get(ECON_KEYS.ACCOUNTS, null);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        return existing;
      }

      const now = new Date().toISOString();
      const seeded = [
        {
          playerId: 'USR-1001',
          username: 'Mashallah',
          role: 'ADMIN',
          isVip: true,
          equippedRank: 'ADMIN',
          ownedRanks: ['ADMIN', 'VIP', 'MILLIONAIRE'],
          rgbOwned: true,
          rgbEnabled: true,
          balance: 2450,
          points: 14850,
          gamesPlayed: 18,
          gamesWon: 12,
          gamesLost: 6,
          extraLives: 3,
          extraLivesUsed: 2,
          scoreBoosterOwned: 1,
          emeraldBoosterOwned: 1,
          secondChanceOwned: 1,
          tournamentTickets: 2,
          totalEarned: 3950,
          totalSpent: 1500,
          bestScore: 5000000,
          lastDailyClaimAt: null,
          dailyStreak: 4,
          updatedAt: now
        },
        {
          playerId: 'USR-1002',
          username: 'DragonSlayer99',
          role: 'VIP',
          isVip: true,
          equippedRank: 'VIP',
          ownedRanks: ['VIP'],
          rgbOwned: true,
          rgbEnabled: true,
          balance: 1820,
          points: 12450,
          gamesPlayed: 16,
          gamesWon: 9,
          gamesLost: 7,
          extraLives: 2,
          extraLivesUsed: 3,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 1,
          totalEarned: 3320,
          totalSpent: 1500,
          bestScore: 5000000,
          lastDailyClaimAt: null,
          dailyStreak: 3,
          updatedAt: now
        },
        {
          playerId: 'USR-1003',
          username: 'NetherKing_TR',
          role: 'VIP',
          isVip: true,
          equippedRank: 'MVP_PLUS',
          ownedRanks: ['VIP', 'MVP_PLUS'],
          rgbOwned: false,
          rgbEnabled: false,
          balance: 1540,
          points: 10820,
          gamesPlayed: 15,
          gamesWon: 8,
          gamesLost: 7,
          extraLives: 1,
          extraLivesUsed: 2,
          scoreBoosterOwned: 1,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 1,
          totalEarned: 2540,
          totalSpent: 1000,
          bestScore: 2500000,
          lastDailyClaimAt: null,
          dailyStreak: 2,
          updatedAt: now
        },
        {
          playerId: 'USR-1004',
          username: 'OrganizerAlex',
          role: 'VIP',
          isVip: true,
          equippedRank: 'VIP',
          ownedRanks: ['VIP'],
          rgbOwned: false,
          rgbEnabled: false,
          balance: 1290,
          points: 9450,
          gamesPlayed: 14,
          gamesWon: 7,
          gamesLost: 7,
          extraLives: 1,
          extraLivesUsed: 1,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 1,
          totalEarned: 1790,
          totalSpent: 500,
          bestScore: 1000000,
          lastDailyClaimAt: null,
          dailyStreak: 2,
          updatedAt: now
        },
        {
          playerId: 'USR-1005',
          username: 'DiamondHunter',
          role: 'PLAYER',
          isVip: false,
          equippedRank: 'PLAYER',
          ownedRanks: ['PLAYER'],
          rgbOwned: false,
          rgbEnabled: false,
          balance: 980,
          points: 8920,
          gamesPlayed: 12,
          gamesWon: 6,
          gamesLost: 6,
          extraLives: 1,
          extraLivesUsed: 1,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 0,
          totalEarned: 1480,
          totalSpent: 500,
          bestScore: 1000000,
          lastDailyClaimAt: null,
          dailyStreak: 1,
          updatedAt: now
        },
        {
          playerId: 'USR-1006',
          username: 'Steve',
          role: 'PLAYER',
          isVip: false,
          equippedRank: 'PLAYER',
          ownedRanks: ['PLAYER'],
          rgbOwned: false,
          rgbEnabled: false,
          balance: 650,
          points: 6540,
          gamesPlayed: 9,
          gamesWon: 4,
          gamesLost: 5,
          extraLives: 0,
          extraLivesUsed: 1,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 0,
          totalEarned: 1150,
          totalSpent: 500,
          bestScore: 250000,
          lastDailyClaimAt: null,
          dailyStreak: 1,
          updatedAt: now
        }
      ];

      store.set(ECON_KEYS.ACCOUNTS, seeded);

      const initialTx = [
        {
          id: 'TX-SEED-01',
          playerId: 'USR-1001',
          username: 'Mashallah',
          amount: 500,
          type: 'TOURNAMENT_WIN',
          reason: 'Tournament Winner Reward',
          previousBalance: 1950,
          newBalance: 2450,
          source: 'System',
          timestamp: now
        },
        {
          id: 'TX-SEED-02',
          playerId: 'USR-1002',
          username: 'DragonSlayer99',
          amount: 150,
          type: 'VIP_GAME_WIN',
          reason: 'VIP Game Victory (+150 💚)',
          previousBalance: 1670,
          newBalance: 1820,
          source: 'System',
          timestamp: now
        },
        {
          id: 'TX-SEED-03',
          playerId: 'USR-1005',
          username: 'DiamondHunter',
          amount: -500,
          type: 'SHOP_PURCHASE',
          reason: 'Purchased ❤️ Extra Life',
          previousBalance: 1480,
          newBalance: 980,
          source: 'Emerald Shop',
          timestamp: now
        }
      ];
      store.set(ECON_KEYS.TRANSACTIONS, initialTx);

      return seeded;
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
      const cleanName = String(username || 'Steve').trim();
      const accounts = this._ensureAccounts();
      let acc = accounts.find(a => a.username.toLowerCase() === cleanName.toLowerCase());

      if (!acc) {
        const now = new Date().toISOString();
        const u = userService ? userService.getUserByUsername(cleanName) : null;
        acc = {
          playerId: u?.id || 'USR-' + Date.now().toString(36).toUpperCase(),
          username: cleanName,
          role: u?.role || role,
          isVip: Boolean(u?.vipStatus?.isVip || role === 'VIP' || role === 'ADMIN'),
          equippedRank: u?.rankId || role,
          ownedRanks: [u?.rankId || role],
          rgbOwned: Boolean(u?.cosmetics?.rgbOwned || role === 'ADMIN'),
          rgbEnabled: Boolean(u?.cosmetics?.rgbEnabled || role === 'ADMIN'),
          balance: 250,
          points: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          extraLives: 0,
          extraLivesUsed: 0,
          scoreBoosterOwned: 0,
          emeraldBoosterOwned: 0,
          secondChanceOwned: 0,
          tournamentTickets: 0,
          totalEarned: 250,
          totalSpent: 0,
          bestScore: 0,
          lastDailyClaimAt: null,
          dailyStreak: 0,
          updatedAt: now
        };
        accounts.push(acc);
        this._saveAccounts(accounts);

        this._recordTransaction({
          playerId: acc.playerId,
          username: acc.username,
          amount: 250,
          type: 'WELCOME_BONUS',
          reason: 'Welcome Starter Emerald Bonus',
          previousBalance: 0,
          newBalance: 250,
          source: 'System'
        });
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
        username,
        amount: Number(amount),
        type,
        reason,
        previousBalance: Number(previousBalance),
        newBalance: Number(newBalance),
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

    // Section 10 & 21: Gameplay Completion Reward (with VIP Emerald Bonus!)
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
      const lockKey = `game_outcome_${session.username}_${gameId}`;
      acquireLock(lockKey);

      try {
        let earnedEmeralds = isVip ? cfg.vipGameCompletedReward : cfg.gameCompletedReward;
        let earnedPoints = questionsAnswered * cfg.pointsPerCorrectAnswer;
        let reasonParts = [isVip ? 'VIP Game Completed' : 'Game Completed'];

        if (won) {
          earnedEmeralds += isVip ? cfg.vipGameWonReward : cfg.gameWonReward;
          earnedPoints += cfg.pointsPerGameWin;
          reasonParts = [isVip ? '👑 VIP Game Victory Bonus' : 'Game Victory'];
        } else if (questionsAnswered >= 10) {
          earnedEmeralds += Math.round(cfg.top3FinishReward * 0.5);
          reasonParts = ['High Stage Reached (10+)'];
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
          source: isVip ? 'System (VIP Bonus)' : 'System'
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

    // Section 25: ADMIN ECONOMY CONTROLS
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
          acc.balance = val;
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
  // 5. EMERALD SHOP, RANK SHOP & COSMETICS SERVICE (Sections 9, 11, 12, 13, 33)
  // ==========================================
  const shopService = {
    _ensureShopItems() {
      let items = store.get(ECON_KEYS.SHOP_ITEMS, null);
      if (items && Array.isArray(items) && items.length > 0) {
        return items;
      }

      const cfg = configService.getConfig();
      const now = new Date().toISOString();
      items = [
        // GAMEPLAY CATEGORY
        {
          id: 'ITEM-EXTRA-LIFE',
          name: 'Extra Life',
          icon: '❤️',
          price: cfg.extraLifePrice,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'Use an Extra Life to return to the game after losing.',
          enabled: true,
          purchaseLimit: cfg.extraLifeMaxPerPlayer,
          effect: 'EXTRA_LIFE',
          createdAt: now
        },
        {
          id: 'ITEM-SCORE-BOOSTER',
          name: 'Score Booster',
          icon: '⭐',
          price: 400,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'Increase your leaderboard score reward by +50% on the next completed game.',
          enabled: true,
          purchaseLimit: 5,
          effect: 'SCORE_BOOSTER',
          createdAt: now
        },
        {
          id: 'ITEM-SECOND-CHANCE',
          name: 'Second Chance',
          icon: '🔥',
          price: 750,
          currency: 'EMERALD',
          category: 'Gameplay',
          requiredRole: 'ANY',
          description: 'One-time protection against elimination (+1 Extra Life & +300 Bonus Points).',
          enabled: true,
          purchaseLimit: 3,
          effect: 'SECOND_CHANCE',
          createdAt: now
        },
        // SPECIAL CATEGORY
        {
          id: 'ITEM-EMERALD-BOOSTER',
          name: 'Emerald Booster',
          icon: '💎',
          price: 750,
          currency: 'EMERALD',
          category: 'Special',
          requiredRole: 'ANY',
          description: 'Boosts your Emerald Coin reward by +50% on your next game.',
          enabled: true,
          purchaseLimit: 5,
          effect: 'EMERALD_BOOSTER',
          createdAt: now
        },
        {
          id: 'ITEM-TOURNAMENT-TICKET',
          name: 'Tournament Ticket',
          icon: '🎟️',
          price: 1000,
          currency: 'EMERALD',
          category: 'Special',
          requiredRole: 'ANY',
          description: 'Entry ticket for Championship Party rooms (+500 Leaderboard Points).',
          enabled: true,
          purchaseLimit: 10,
          effect: 'TOURNAMENT_TICKET',
          createdAt: now
        },
        // COSMETICS CATEGORY (Section 13: RGB Name)
        {
          id: 'ITEM-RGB-NAME',
          name: 'RGB Name',
          icon: '🌈',
          price: 1000,
          currency: 'EMERALD',
          category: 'Cosmetics',
          requiredRole: 'ANY',
          description: 'Unlock smooth animated RGB gradient username styling across Profile, Parties & Leaderboard!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RGB_NAME',
          createdAt: now
        },
        // VIP CATEGORY
        {
          id: 'ITEM-VIP-CROWN-PACK',
          name: 'VIP Emerald Pack',
          icon: '👑',
          price: 600,
          currency: 'EMERALD',
          category: 'VIP',
          requiredRole: 'VIP',
          description: 'Exclusive VIP-only bundle: +2 Extra Lives & +1 Score Booster.',
          enabled: true,
          purchaseLimit: 3,
          effect: 'VIP_PACK',
          createdAt: now
        },
        // RANKS CATEGORY (Section 12: Purchasable Ranks)
        {
          id: 'ITEM-RANK-VIP',
          name: 'VIP Rank (Emerald Pass)',
          icon: '👑',
          price: 2000,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Unlocks full VIP Membership: Create Parties, Invite Players, Priority Support & VIP Emerald Bonus!',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_VIP',
          rankId: 'VIP',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVP',
          name: 'MVP Rank',
          icon: '⚔️',
          price: 1500,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Prestigious aqua MVP rank badge displayed on Leaderboard and Profile.',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVP',
          rankId: 'MVP',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MVP-PLUS',
          name: 'MVP+ Rank',
          icon: '🌟',
          price: 2200,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Includes all VIP party creation & priority permissions plus the 🌟 MVP+ badge.',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_MVP_PLUS',
          rankId: 'MVP_PLUS',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-LEGEND',
          name: 'LEGEND Rank',
          icon: '🔱',
          price: 3000,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Crimson 🔱 LEGEND rank badge + full VIP party & priority benefits.',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_LEGEND',
          rankId: 'LEGEND',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-CHAMPION',
          name: 'CHAMPION Rank',
          icon: '🏆',
          price: 4000,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Golden 🏆 CHAMPION tournament rank + full VIP privileges.',
          enabled: true,
          purchaseLimit: 1,
          effect: 'RANK_CHAMPION',
          rankId: 'CHAMPION',
          createdAt: now
        },
        {
          id: 'ITEM-RANK-MILLIONAIRE',
          name: 'MILLIONAIRE Rank',
          icon: '💎',
          price: 5000,
          currency: 'EMERALD',
          category: 'Ranks',
          requiredRole: 'ANY',
          description: 'Ultimate 💎 MILLIONAIRE rank! Unlocks full VIP privileges + automatic RGB Username.',
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
      const all = this.listItems().map(item => ({
        ...item,
        currency: item.currency || 'EMERALD',
        category: item.category || 'Gameplay',
        requiredRole: item.requiredRole || 'ANY',
        purchaseLimit: item.purchaseLimit || item.maxPurchase || 5,
        effectType: item.effect || item.effectType || 'EXTRA_LIFE',
        maxPerGame: item.purchaseLimit || item.maxPurchase || 1
      }));
      const enabledFiltered = includeDisabled ? all : all.filter(i => i.enabled);
      if (!categoryFilter || categoryFilter === 'ALL') return enabledFiltered;
      return enabledFiltered.filter(
        i => i.category.toLowerCase() === String(categoryFilter).toLowerCase()
      );
    },

    // Section 33: Evaluate Purchase Eligibility & Explain Why Disabled
    evaluateEligibility(session, item) {
      if (!session) {
        return { canBuy: false, reason: 'Please log in', buttonLabel: 'Login Required' };
      }
      if (!item.enabled) {
        return { canBuy: false, reason: 'Disabled by Admin', buttonLabel: 'Unavailable' };
      }

      const profile = economyService.getPlayerEconomyProfile(session.username);
      const isVip = authGuard.isVipOrAdmin(session);

      if (item.requiredRole === 'VIP' && !isVip) {
        return { canBuy: false, reason: 'Requires VIP', buttonLabel: '🔒 Requires VIP' };
      }

      if (item.effect === 'RGB_NAME' && profile.rgbOwned) {
        return {
          canBuy: false,
          reason: 'Already Owned (Enable in Profile / Cosmetics)',
          buttonLabel: '✅ Owned'
        };
      }

      if (item.rankId && (profile.ownedRanks || []).includes(item.rankId)) {
        return {
          canBuy: false,
          reason: 'Rank Already Unlocked',
          buttonLabel: '✅ Rank Owned'
        };
      }

      if (item.effect === 'EXTRA_LIFE' && profile.extraLives >= (item.purchaseLimit || 5)) {
        return {
          canBuy: false,
          reason: `Max Extra Lives (${item.purchaseLimit || 5}) reached`,
          buttonLabel: 'Max Owned'
        };
      }

      if (item.currency === 'TRY') {
        return {
          canBuy: true,
          reason: 'Real-money VIP package via paymentService',
          buttonLabel: `💳 BUY (${item.price} TL)`
        };
      }

      if (profile.emeraldCoins < item.price) {
        return {
          canBuy: false,
          reason: 'Not enough Emeralds',
          buttonLabel: 'Not enough Emeralds'
        };
      }

      return {
        canBuy: true,
        reason: 'Available for purchase',
        buttonLabel: `🛒 BUY (${item.price.toLocaleString('en-US')} 💚)`
      };
    },

    purchaseItem(session, itemId) {
      authGuard.verifySession(session);
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
        throw new Error('Item not found in the Emerald Shop.');
      }

      if (!item.enabled) {
        throw new Error(`"${item.name}" is currently disabled.`);
      }

      if (item.requiredRole === 'VIP' && !authGuard.isVipOrAdmin(session)) {
        throw new Error('Requires VIP: Only VIP and ADMIN members can purchase this item.');
      }

      if (item.currency === 'TRY') {
        return paymentService.initiateCheckout(session, {
          packageId: item.id,
          title: item.name,
          priceTL: item.price
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
        const limit = item.purchaseLimit || item.maxPurchase || 5;

        if (item.effect === 'EXTRA_LIFE' && acc.extraLives >= limit) {
          throw new Error(`Maximum Extra Life limit (${limit}) reached! Use one before buying more.`);
        }
        if (item.effect === 'RGB_NAME' && acc.rgbOwned) {
          throw new Error('You already own the RGB Name cosmetic!');
        }
        if (item.rankId && (acc.ownedRanks || []).includes(item.rankId)) {
          throw new Error(`You already own the ${item.name}!`);
        }

        if (acc.balance < price) {
          throw new Error(`Not enough Emeralds! Required: ${price} 💚, Balance: ${acc.balance} 💚`);
        }

        const snapshot = JSON.stringify(acc);

        try {
          const prevBal = acc.balance;
          acc.balance -= price;
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
          } else if (item.rankId || String(eff).startsWith('RANK_')) {
            const targetRank = item.rankId || String(eff).replace('RANK_', '');
            acc.ownedRanks = acc.ownedRanks || ['PLAYER'];
            if (!acc.ownedRanks.includes(targetRank)) acc.ownedRanks.push(targetRank);
            acc.equippedRank = targetRank;

            const rankDef = rankService.getRankById(targetRank);
            if (rankDef && rankDef.grantsVip) {
              acc.isVip = true;
              if (acc.role !== 'ADMIN') acc.role = 'VIP';
            }
            if (targetRank === 'MILLIONAIRE') {
              acc.rgbOwned = true;
              acc.rgbEnabled = true;
            }

            if (userService) {
              const allUsers = userService._getAllRaw();
              const u = allUsers.find(
                x => x.minecraftUsername.toLowerCase() === session.username.toLowerCase()
              );
              if (u) {
                u.rankId = targetRank;
                u.cosmetics = u.cosmetics || {};
                u.cosmetics.equippedRank = targetRank;
                if (rankDef && rankDef.grantsVip) {
                  if (u.role !== 'ADMIN') u.role = 'VIP';
                  u.vipStatus = {
                    isVip: true,
                    tier: targetRank,
                    expiresAt: null,
                    grantedAt: new Date().toISOString()
                  };
                }
                if (targetRank === 'MILLIONAIRE') {
                  u.cosmetics.rgbOwned = true;
                  u.cosmetics.rgbEnabled = true;
                }
                userService._saveAllRaw(allUsers);
              }
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

    // ADMIN SHOP MANAGEMENT (Section 25)
    createShopItem(session, itemData) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const name = String(itemData.name || '').trim();
      if (!name) throw new Error('Item name cannot be empty.');

      const newItem = {
        id: 'ITEM-' + Date.now().toString(36).toUpperCase(),
        name,
        description: String(itemData.description || '').trim() || 'Special Minecraft tournament item.',
        icon: String(itemData.icon || '💎').trim(),
        price: Math.max(0, Math.round(Number(itemData.price) || 100)),
        currency: itemData.currency || 'EMERALD',
        category: itemData.category || 'Gameplay',
        requiredRole: itemData.requiredRole || 'ANY',
        enabled: itemData.enabled !== false,
        purchaseLimit: Math.max(1, Math.round(Number(itemData.purchaseLimit || itemData.maxPurchase) || 3)),
        effect: itemData.effect || itemData.effectType || 'EXTRA_LIFE',
        createdAt: new Date().toISOString()
      };

      items.push(newItem);
      this._saveShopItems(items);
      activityService.log(
        'SHOP_ITEM_CREATED',
        session.username,
        `Admin ${session.username} created shop item "${newItem.name}" (${newItem.price} 💚)`
      );
      return newItem;
    },

    updateShopItem(session, itemId, updates = {}) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const target = items.find(i => i.id === itemId);
      if (!target) throw new Error('Shop item not found.');

      if (updates.name !== undefined) target.name = String(updates.name).trim();
      if (updates.description !== undefined) target.description = String(updates.description).trim();
      if (updates.icon !== undefined) target.icon = String(updates.icon).trim();
      if (updates.price !== undefined) target.price = Math.max(0, Math.round(Number(updates.price)));
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
  // 6. EXTRA LIFE SERVICE (Section 26)
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
        return { canUse: false, availableCount: 0, reason: 'Extra Life feature is disabled by Admin' };
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
  // 7. DAILY LOGIN REWARD SERVICE (Section 10: Normal +25 💚 / VIP +50 💚)
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
      title: 'First Victory',
      description: 'Win your first Minecraft Milyoner game (15/15).',
      bonusEmeralds: 50
    },
    {
      id: 'ACH_EMERALD_HUNTER',
      icon: '💚',
      title: 'Emerald Hunter',
      description: 'Accumulate 1,000+ Emerald Coins in your wallet.',
      bonusEmeralds: 75
    },
    {
      id: 'ACH_QUIZ_MASTER',
      icon: '🧠',
      title: 'Quiz Master',
      description: 'Play at least 10 Minecraft Milyoner games.',
      bonusEmeralds: 50
    },
    {
      id: 'ACH_SECOND_CHANCE',
      icon: '❤️',
      title: 'Second Chance',
      description: 'Use an Extra Life to revive and continue a game.',
      bonusEmeralds: 40
    },
    {
      id: 'ACH_MILLIONAIRE',
      icon: '💎',
      title: 'Millionaire',
      description: 'Reach 10,000+ total Leaderboard Points.',
      bonusEmeralds: 100
    },
    {
      id: 'ACH_CHAMPION',
      icon: '👑',
      title: 'Leaderboard Champion',
      description: 'Reach Rank #1 on the Minecraft Milyoner Leaderboard.',
      bonusEmeralds: 150
    }
  ];

  const achievementService = {
    getCatalog() {
      return ACHIEVEMENTS_CATALOG;
    },

    getUnlockedForPlayer(username) {
      const map = store.get(ECON_KEYS.ACHIEVEMENTS, {
        Mashallah: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_QUIZ_MASTER', 'ACH_SECOND_CHANCE', 'ACH_MILLIONAIRE', 'ACH_CHAMPION'],
        DragonSlayer99: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_QUIZ_MASTER', 'ACH_SECOND_CHANCE', 'ACH_MILLIONAIRE'],
        NetherKing_TR: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_QUIZ_MASTER', 'ACH_SECOND_CHANCE', 'ACH_MILLIONAIRE'],
        OrganizerAlex: ['ACH_FIRST_WIN', 'ACH_EMERALD_HUNTER', 'ACH_QUIZ_MASTER', 'ACH_SECOND_CHANCE'],
        DiamondHunter: ['ACH_FIRST_WIN', 'ACH_QUIZ_MASTER', 'ACH_SECOND_CHANCE'],
        Steve: ['ACH_FIRST_WIN', 'ACH_SECOND_CHANCE']
      });
      const key = Object.keys(map).find(k => k.toLowerCase() === String(username).toLowerCase());
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
        Object.keys(map).find(k => k.toLowerCase() === String(username).toLowerCase()) || username;
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
  // 9. LEADERBOARD SERVICE (Section 24: Sort by Points, Wins, Emeralds, Games Played)
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
