/**
 * MINECRAFT MILYONER — ECONOMY, LEADERBOARD, SHOP, EXTRA LIFE & ACHIEVEMENTS SERVICES
 * Modular Service Architecture:
 * - configService
 * - economyService
 * - shopService
 * - extraLifeService
 * - leaderboardService
 * - dailyRewardService
 * - achievementService
 *
 * Uses closure-scoped anti-tamper state + storage persistence so browser console
 * cannot trivially overwrite balances, and can be swapped with a REST/SQL backend.
 */

(function () {
  'use strict';

  const { authGuard, activityService, playerService } = window.MCMServices;

  const ECON_KEYS = {
    CONFIG: 'mcm_econ_config_v2',
    ACCOUNTS: 'mcm_econ_accounts_v2',
    TRANSACTIONS: 'mcm_econ_transactions_v2',
    SHOP_ITEMS: 'mcm_econ_shop_items_v2',
    PURCHASES: 'mcm_econ_purchases_v2',
    EXTRA_LIVES: 'mcm_econ_extralives_v2',
    ACHIEVEMENTS: 'mcm_econ_achievements_v2',
    SCORES: 'mcm_econ_scores_v2'
  };

  // In-memory transaction lock to prevent double-click / race condition exploits
  const activeLocks = new Set();
  const consumedEliminationKeys = new Set();

  function acquireLock(lockKey) {
    if (activeLocks.has(lockKey)) {
      throw new Error('İşlem devam ediyor, lütfen bekleyin (Double-click / Race Condition korundu).');
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
      } catch (e) {
        console.warn('Storage write error:', e);
      }
    }
  };

  // ==========================================
  // 1. ADMIN CONFIGURATION SERVICE (Section 21 & 35)
  // ==========================================
  const DEFAULT_CONFIG = {
    gameCompletedReward: 25,
    gameWonReward: 100,
    top3FinishReward: 150,
    tournamentWinnerReward: 500,
    dailyLoginBaseReward: 25,
    dailyStreakRewards: [25, 30, 35, 40, 50, 75, 100],
    dailyCooldownHours: 24,
    extraLifePrice: 500,
    extraLifeMaxPerPlayer: 3,
    extraLifeMaxPerGame: 1,
    pointsPerCorrectAnswer: 150,
    pointsPerGameWin: 1500,
    leaderboardDefaultSize: 10
  };

  const configService = {
    getConfig() {
      const saved = store.get(ECON_KEYS.CONFIG, null);
      return saved ? { ...DEFAULT_CONFIG, ...saved } : { ...DEFAULT_CONFIG };
    },

    updateConfig(session, newValues) {
      authGuard.requireRole(session, ['ADMIN']);
      const current = this.getConfig();
      const updated = {
        ...current,
        gameCompletedReward: Math.max(0, Number(newValues.gameCompletedReward ?? current.gameCompletedReward)),
        gameWonReward: Math.max(0, Number(newValues.gameWonReward ?? current.gameWonReward)),
        top3FinishReward: Math.max(0, Number(newValues.top3FinishReward ?? current.top3FinishReward)),
        tournamentWinnerReward: Math.max(0, Number(newValues.tournamentWinnerReward ?? current.tournamentWinnerReward)),
        dailyLoginBaseReward: Math.max(0, Number(newValues.dailyLoginBaseReward ?? current.dailyLoginBaseReward)),
        dailyCooldownHours: Math.max(1, Number(newValues.dailyCooldownHours ?? current.dailyCooldownHours)),
        extraLifePrice: Math.max(10, Number(newValues.extraLifePrice ?? current.extraLifePrice)),
        extraLifeMaxPerPlayer: Math.max(1, Number(newValues.extraLifeMaxPerPlayer ?? current.extraLifeMaxPerPlayer)),
        pointsPerCorrectAnswer: Math.max(10, Number(newValues.pointsPerCorrectAnswer ?? current.pointsPerCorrectAnswer)),
        pointsPerGameWin: Math.max(100, Number(newValues.pointsPerGameWin ?? current.pointsPerGameWin))
      };
      store.set(ECON_KEYS.CONFIG, updated);

      // Sync Extra Life default shop item price & maxPurchase
      shopService._syncExtraLifeWithConfig(updated);

      activityService.log(
        'CONFIG_UPDATED',
        session.username,
        `${session.username} updated Economy & Reward configuration`
      );
      return updated;
    }
  };

  // ==========================================
  // 2. ECONOMY ACCOUNT & TRANSACTION SERVICE (Section 20, 26, 27, 29)
  // ==========================================
  const SEED_COMPETITORS = [
    { username: 'Mashallah', role: 'ADMIN', points: 14850, balance: 2450, games: 42, wins: 18, losses: 24, extraLives: 2, extraLivesUsed: 3, bestScore: 5000000 },
    { username: 'DragonSlayer99', role: 'PLAYER', points: 12450, balance: 1820, games: 38, wins: 15, losses: 23, extraLives: 1, extraLivesUsed: 2, bestScore: 5000000 },
    { username: 'NetherKing_TR', role: 'ORGANIZER', points: 10820, balance: 1540, games: 31, wins: 12, losses: 19, extraLives: 1, extraLivesUsed: 1, bestScore: 1000000 },
    { username: 'RedstoneMaster', role: 'PLAYER', points: 9450, balance: 980, games: 29, wins: 10, losses: 19, extraLives: 0, extraLivesUsed: 4, bestScore: 1000000 },
    { username: 'DiamondHunter', role: 'PLAYER', points: 8920, balance: 1120, games: 27, wins: 9, losses: 18, extraLives: 1, extraLivesUsed: 2, bestScore: 750000 },
    { username: 'Steve', role: 'PLAYER', points: 7840, balance: 750, games: 24, wins: 8, losses: 16, extraLives: 1, extraLivesUsed: 1, bestScore: 500000 },
    { username: 'OrganizerAlex', role: 'ORGANIZER', points: 7120, balance: 890, games: 21, wins: 7, losses: 14, extraLives: 0, extraLivesUsed: 1, bestScore: 500000 },
    { username: 'EnderQueen', role: 'PLAYER', points: 6540, balance: 620, games: 19, wins: 6, losses: 13, extraLives: 0, extraLivesUsed: 0, bestScore: 250000 },
    { username: 'CreeperBoom', role: 'PLAYER', points: 5890, balance: 430, games: 18, wins: 5, losses: 13, extraLives: 0, extraLivesUsed: 2, bestScore: 100000 },
    { username: 'WardenHunter', role: 'PLAYER', points: 5120, balance: 510, games: 16, wins: 4, losses: 12, extraLives: 1, extraLivesUsed: 0, bestScore: 100000 },
    { username: 'VillagerTrader', role: 'PLAYER', points: 4450, balance: 1350, games: 15, wins: 4, losses: 11, extraLives: 0, extraLivesUsed: 1, bestScore: 50000 },
    { username: 'BlazeRunner', role: 'PLAYER', points: 3780, balance: 310, games: 12, wins: 3, losses: 9, extraLives: 0, extraLivesUsed: 0, bestScore: 20000 }
  ];

  const economyService = {
    _ensureAccounts() {
      let accounts = store.get(ECON_KEYS.ACCOUNTS, null);
      if (accounts && Array.isArray(accounts) && accounts.length > 0) {
        return accounts;
      }

      const now = new Date().toISOString();
      accounts = SEED_COMPETITORS.map(c => ({
        playerId: 'PLY-' + c.username.toUpperCase(),
        username: c.username,
        role: c.role,
        balance: c.balance,
        totalEarned: c.balance + c.extraLivesUsed * 500,
        totalSpent: c.extraLivesUsed * 500,
        points: c.points,
        gamesPlayed: c.games,
        gamesWon: c.wins,
        gamesLost: c.losses,
        bestScore: c.bestScore,
        extraLives: c.extraLives,
        extraLivesUsed: c.extraLivesUsed,
        secondChanceOwned: 0,
        scoreBoosterOwned: 0,
        tournamentTickets: 0,
        dailyStreak: 1,
        lastDailyClaimAt: null,
        updatedAt: now
      }));

      store.set(ECON_KEYS.ACCOUNTS, accounts);
      this._seedInitialTransactions();
      return accounts;
    },

    _seedInitialTransactions() {
      const existing = store.get(ECON_KEYS.TRANSACTIONS, null);
      if (existing && existing.length > 0) return;

      const now = Date.now();
      const txs = [
        {
          id: 'TX-1001',
          playerId: 'PLY-MASHALLAH',
          username: 'Mashallah',
          amount: 100,
          type: 'REWARD',
          reason: 'Game Victory',
          previousBalance: 2850,
          newBalance: 2950,
          timestamp: new Date(now - 3600 * 1000 * 2).toISOString()
        },
        {
          id: 'TX-1002',
          playerId: 'PLY-MASHALLAH',
          username: 'Mashallah',
          amount: -500,
          type: 'PURCHASE',
          reason: 'Extra Life',
          previousBalance: 2950,
          newBalance: 2450,
          timestamp: new Date(now - 3600 * 1000 * 1).toISOString()
        },
        {
          id: 'TX-1003',
          playerId: 'PLY-STEVE',
          username: 'Steve',
          amount: 25,
          type: 'DAILY_REWARD',
          reason: 'Daily Reward (Day 1)',
          previousBalance: 725,
          newBalance: 750,
          timestamp: new Date(now - 3600 * 1000 * 5).toISOString()
        }
      ];
      store.set(ECON_KEYS.TRANSACTIONS, txs);
    },

    _saveAccounts(accounts) {
      store.set(ECON_KEYS.ACCOUNTS, accounts);
    },

    getOrCreateAccount(username, role = 'PLAYER') {
      const cleanName = String(username || 'Steve').trim();
      const accounts = this._ensureAccounts();
      let acc = accounts.find(a => a.username.toLowerCase() === cleanName.toLowerCase());
      if (!acc) {
        acc = {
          playerId: 'PLY-' + cleanName.toUpperCase() + '-' + Date.now().toString(36).toUpperCase(),
          username: cleanName,
          role,
          balance: 250, // Starting welcome Emerald Coins
          totalEarned: 250,
          totalSpent: 0,
          points: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          bestScore: 0,
          extraLives: 0,
          extraLivesUsed: 0,
          secondChanceOwned: 0,
          scoreBoosterOwned: 0,
          tournamentTickets: 0,
          dailyStreak: 0,
          lastDailyClaimAt: null,
          updatedAt: new Date().toISOString()
        };
        accounts.push(acc);
        this._saveAccounts(accounts);
        this._recordTransaction({
          playerId: acc.playerId,
          username: acc.username,
          amount: 250,
          type: 'WELCOME_BONUS',
          reason: 'Hoş Geldin Başlangıç Ödülü',
          previousBalance: 0,
          newBalance: 250
        });
      }
      return { ...acc };
    },

    getAllAccounts() {
      return this._ensureAccounts().map(a => ({ ...a }));
    },

    _recordTransaction({ playerId, username, amount, type, reason, previousBalance, newBalance, partyId = null, gameId = null }) {
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
        partyId,
        gameId,
        timestamp: new Date().toISOString()
      };
      list.unshift(tx);
      if (list.length > 400) list.length = 400;
      store.set(ECON_KEYS.TRANSACTIONS, list);
      return tx;
    },

    getTransactions(session, filterUsername = null) {
      authGuard.verifySession(session);
      const all = store.get(ECON_KEYS.TRANSACTIONS, []);
      if (session.role === 'ADMIN' && !filterUsername) {
        return all;
      }
      const targetUser = filterUsername || session.username;
      return all.filter(t => t.username.toLowerCase() === targetUser.toLowerCase());
    },

    // Authorized balance mutation (internal & gameplay rewards)
    _mutateAccount(username, mutatorFn) {
      const accounts = this._ensureAccounts();
      const idx = accounts.findIndex(a => a.username.toLowerCase() === String(username).toLowerCase());
      if (idx === -1) {
        this.getOrCreateAccount(username);
        return this._mutateAccount(username, mutatorFn);
      }
      const acc = accounts[idx];
      mutatorFn(acc);
      acc.balance = Math.max(0, Math.round(acc.balance)); // Never allow negative balance
      acc.updatedAt = new Date().toISOString();
      this._saveAccounts(accounts);
      return { ...acc };
    },

    // Gameplay completion reward & score update
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
      const lockKey = `game_outcome_${session.username}_${gameId}`;
      acquireLock(lockKey);

      try {
        let earnedEmeralds = cfg.gameCompletedReward;
        let earnedPoints = questionsAnswered * cfg.pointsPerCorrectAnswer;
        let reasonParts = ['Game Completed'];

        if (won) {
          earnedEmeralds += cfg.gameWonReward;
          earnedPoints += cfg.pointsPerGameWin;
          reasonParts = ['Game Victory'];
        } else if (questionsAnswered >= 10) {
          earnedEmeralds += Math.round(cfg.top3FinishReward * 0.5);
          reasonParts = ['High Stage Reached (10+)'];
        }

        let prevBal = 0;
        let newBal = 0;
        let usedBooster = false;

        const updatedAcc = this._mutateAccount(session.username, acc => {
          if (acc.scoreBoosterOwned > 0) {
            earnedPoints = Math.round(earnedPoints * 1.5);
            earnedEmeralds = Math.round(earnedEmeralds * 1.25);
            acc.scoreBoosterOwned--;
            usedBooster = true;
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

        this._recordTransaction({
          playerId: updatedAcc.playerId,
          username: updatedAcc.username,
          amount: earnedEmeralds,
          type: won ? 'GAME_WIN' : 'GAME_COMPLETED',
          reason: reasonParts.join(' + ') + (usedBooster ? ' (⭐ Booster Active)' : ''),
          previousBalance: prevBal,
          newBalance: newBal,
          gameId
        });

        // Evaluate achievements
        const unlocked = achievementService.checkAndUnlock(session.username);

        return {
          earnedEmeralds,
          earnedPoints,
          usedBooster,
          account: updatedAcc,
          unlockedAchievements: unlocked
        };
      } finally {
        releaseLock(lockKey);
      }
    },

    // ADMIN ECONOMY CONTROLS (Section 27)
    adminModifyBalance(session, targetUsername, mode, amountValue, customReason = '') {
      authGuard.requireRole(session, ['ADMIN']);
      const val = Math.max(0, Math.round(Number(amountValue) || 0));

      let prevBal = 0;
      let nextBal = 0;
      let delta = 0;
      let playerId = '';

      const updated = this._mutateAccount(targetUsername, acc => {
        playerId = acc.playerId;
        prevBal = acc.balance;
        if (mode === 'GIVE') {
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
        newBalance: nextBal
      });

      activityService.log(
        `ECONOMY_${mode}`,
        session.username,
        `${session.username} (${mode}) Emerald balance for ${updated.username}: ${prevBal} → ${nextBal} 💚`
      );

      achievementService.checkAndUnlock(updated.username);
      return updated;
    }
  };

  // ==========================================
  // 3. EMERALD SHOP & ANTI-EXPLOIT PURCHASE SERVICE (Section 22, 28, 29)
  // ==========================================
  const shopService = {
    _ensureShopItems() {
      let items = store.get(ECON_KEYS.SHOP_ITEMS, null);
      if (items && Array.isArray(items) && items.length > 0) {
        return items;
      }

      const cfg = configService.getConfig();
      items = [
        {
          id: 'ITEM-EXTRA-LIFE',
          name: 'Extra Life',
          icon: '❤️',
          price: cfg.extraLifePrice,
          category: 'Gameplay',
          description: 'Use an Extra Life to return to the game after losing.',
          enabled: true,
          maxPurchase: cfg.extraLifeMaxPerPlayer,
          cooldownSeconds: 0,
          effect: 'EXTRA_LIFE'
        },
        {
          id: 'ITEM-SECOND-CHANCE',
          name: 'Second Chance',
          icon: '🔥',
          price: 750,
          category: 'Gameplay',
          description: 'One-time protection against elimination (+1 Extra Life & +300 Bonus Points).',
          enabled: true,
          maxPurchase: 2,
          cooldownSeconds: 0,
          effect: 'SECOND_CHANCE'
        },
        {
          id: 'ITEM-SCORE-BOOSTER',
          name: 'Score Booster',
          icon: '⭐',
          price: 400,
          category: 'Boosters',
          description: 'Increase your score (+50%) and Emerald (+25%) reward from the next completed game.',
          enabled: true,
          maxPurchase: 5,
          cooldownSeconds: 0,
          effect: 'SCORE_BOOSTER'
        },
        {
          id: 'ITEM-TOURNAMENT-TICKET',
          name: 'Tournament Ticket',
          icon: '🎟️',
          price: 1000,
          category: 'Tournament',
          description: 'Redeem an additional tournament entry (+500 Leaderboard Points + VIP Ticket).',
          enabled: true,
          maxPurchase: 10,
          cooldownSeconds: 0,
          effect: 'TOURNAMENT_TICKET'
        }
      ];

      store.set(ECON_KEYS.SHOP_ITEMS, items);
      return items;
    },

    _syncExtraLifeWithConfig(cfg) {
      const items = this._ensureShopItems();
      const extraLife = items.find(i => i.effect === 'EXTRA_LIFE');
      if (extraLife) {
        extraLife.price = cfg.extraLifePrice;
        extraLife.maxPurchase = cfg.extraLifeMaxPerPlayer;
        store.set(ECON_KEYS.SHOP_ITEMS, items);
      }
    },

    listItems() {
      return this._ensureShopItems().map(i => ({ ...i }));
    },

    // Atomic 10-step verified purchase flow with rollback protection (Section 29)
    purchaseItem(session, itemId) {
      // 1. VERIFY PLAYER
      authGuard.verifySession(session);
      const lockKey = `buy_${session.username}_${itemId}`;

      // 5. LOCK TRANSACTION (prevents double-click / race conditions)
      acquireLock(lockKey);

      try {
        const items = this._ensureShopItems();
        // 2. VERIFY ITEM
        const item = items.find(i => i.id === itemId);
        if (!item) {
          throw new Error('Ürün mağazada bulunamadı.');
        }

        // 3. VERIFY ITEM IS ENABLED
        if (!item.enabled) {
          throw new Error(`"${item.name}" şu anda satışa kapalıdır (Disabled).`);
        }

        const price = Math.max(0, Number(item.price));
        const accounts = economyService._ensureAccounts();
        const accIdx = accounts.findIndex(
          a => a.username.toLowerCase() === session.username.toLowerCase()
        );
        if (accIdx === -1) {
          economyService.getOrCreateAccount(session.username, session.role);
          return this.purchaseItem(session, itemId);
        }

        const acc = accounts[accIdx];

        // Check ownership cap / maximum purchase limit
        if (item.effect === 'EXTRA_LIFE' && acc.extraLives >= item.maxPurchase) {
          throw new Error(
            `Maksimum Extra Life sınırına (${item.maxPurchase} adet) ulaştınız! Önce mevcut haklarınızı kullanın.`
          );
        }
        if (item.effect === 'SCORE_BOOSTER' && acc.scoreBoosterOwned >= item.maxPurchase) {
          throw new Error(`En fazla ${item.maxPurchase} adet Score Booster biriktirebilirsiniz.`);
        }

        // 4. VERIFY BALANCE
        if (acc.balance < price) {
          throw new Error(
            `Yetersiz Emerald Bakiye! Gereken: ${price} 💚, Mevcut: ${acc.balance} 💚`
          );
        }

        // Snapshot for atomic rollback if anything fails
        const snapshot = JSON.stringify(acc);

        try {
          const prevBal = acc.balance;
          // 6. DEDUCT EMERALDS
          acc.balance -= price;
          acc.totalSpent += price;

          // 7. GRANT ITEM
          if (item.effect === 'EXTRA_LIFE') {
            acc.extraLives = (acc.extraLives || 0) + 1;
          } else if (item.effect === 'SECOND_CHANCE') {
            acc.extraLives = (acc.extraLives || 0) + 1;
            acc.points = (acc.points || 0) + 300;
            acc.secondChanceOwned = (acc.secondChanceOwned || 0) + 1;
          } else if (item.effect === 'SCORE_BOOSTER') {
            acc.scoreBoosterOwned = (acc.scoreBoosterOwned || 0) + 1;
          } else if (item.effect === 'TOURNAMENT_TICKET') {
            acc.tournamentTickets = (acc.tournamentTickets || 0) + 1;
            acc.points = (acc.points || 0) + 500;
          } else {
            acc.points = (acc.points || 0) + 100;
          }

          acc.updatedAt = new Date().toISOString();
          economyService._saveAccounts(accounts);

          // 8. SAVE TRANSACTION
          const tx = economyService._recordTransaction({
            playerId: acc.playerId,
            username: acc.username,
            amount: -price,
            type: 'SHOP_PURCHASE',
            reason: `${item.name}`,
            previousBalance: prevBal,
            newBalance: acc.balance
          });

          const purchases = store.get(ECON_KEYS.PURCHASES, []);
          purchases.unshift({
            purchaseId: 'PUR-' + Date.now(),
            transactionId: tx.id,
            playerId: acc.playerId,
            username: acc.username,
            itemId: item.id,
            itemName: item.name,
            cost: price,
            previousBalance: prevBal,
            newBalance: acc.balance,
            timestamp: tx.timestamp
          });
          store.set(ECON_KEYS.PURCHASES, purchases);

          activityService.log(
            'SHOP_PURCHASE',
            session.username,
            `${session.username} purchased "${item.name}" for ${price} 💚 (${prevBal} → ${acc.balance})`
          );

          return {
            ok: true,
            item,
            account: { ...acc },
            transaction: tx
          };
        } catch (innerErr) {
          // Rollback account state
          accounts[accIdx] = JSON.parse(snapshot);
          economyService._saveAccounts(accounts);
          throw innerErr;
        }
      } finally {
        releaseLock(lockKey);
      }
    },

    // ADMIN SHOP MANAGEMENT (Section 28)
    createShopItem(session, itemData) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const name = String(itemData.name || '').trim();
      if (!name) throw new Error('Ürün adı boş olamaz.');

      const newItem = {
        id: 'ITEM-' + Date.now().toString(36).toUpperCase(),
        name,
        description: String(itemData.description || '').trim() || 'Özel Minecraft turnuva eşyası.',
        icon: String(itemData.icon || '💎').trim(),
        price: Math.max(1, Math.round(Number(itemData.price) || 250)),
        category: String(itemData.category || 'Gameplay').trim(),
        enabled: itemData.enabled !== false,
        maxPurchase: Math.max(1, Number(itemData.maxPurchase) || 5),
        cooldownSeconds: Math.max(0, Number(itemData.cooldownSeconds) || 0),
        effect: String(itemData.effect || 'CUSTOM_ITEM').trim()
      };

      items.push(newItem);
      store.set(ECON_KEYS.SHOP_ITEMS, items);
      activityService.log(
        'SHOP_ITEM_CREATED',
        session.username,
        `${session.username} created shop item "${newItem.name}" (${newItem.price} 💚)`
      );
      return newItem;
    },

    updateShopItem(session, itemId, updates) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const target = items.find(i => i.id === itemId);
      if (!target) throw new Error('Ürün bulunamadı.');

      if (typeof updates.price === 'number' && !isNaN(updates.price)) {
        target.price = Math.max(1, Math.round(updates.price));
      }
      if (typeof updates.enabled === 'boolean') {
        target.enabled = updates.enabled;
      }
      if (updates.name) target.name = String(updates.name).trim();
      if (updates.maxPurchase) target.maxPurchase = Math.max(1, Number(updates.maxPurchase));

      store.set(ECON_KEYS.SHOP_ITEMS, items);
      activityService.log(
        'SHOP_ITEM_UPDATED',
        session.username,
        `${session.username} updated shop item "${target.name}" (Price: ${target.price} 💚, Enabled: ${target.enabled})`
      );
      return target;
    },

    deleteShopItem(session, itemId) {
      authGuard.requireRole(session, ['ADMIN']);
      const items = this._ensureShopItems();
      const idx = items.findIndex(i => i.id === itemId);
      if (idx === -1) throw new Error('Ürün bulunamadı.');
      const removed = items.splice(idx, 1)[0];
      store.set(ECON_KEYS.SHOP_ITEMS, items);
      activityService.log(
        'SHOP_ITEM_DELETED',
        session.username,
        `${session.username} deleted shop item "${removed.name}"`
      );
      return removed;
    }
  };

  // ==========================================
  // 4. EXTRA LIFE SERVICE (Section 23 & 24)
  // ==========================================
  const extraLifeService = {
    canUseExtraLife(session, gameId, levelNumber) {
      if (!session || !gameId) return false;
      const elimKey = `${session.username}::${gameId}::L${levelNumber}`;
      if (consumedEliminationKeys.has(elimKey)) return false;

      // Also check if already revived max times in this gameId
      const cfg = configService.getConfig();
      const logs = store.get(ECON_KEYS.EXTRA_LIVES, []);
      const usedInThisGame = logs.filter(
        x => x.username.toLowerCase() === session.username.toLowerCase() && x.gameId === gameId
      ).length;

      if (usedInThisGame >= cfg.extraLifeMaxPerGame) return false;

      const acc = economyService.getOrCreateAccount(session.username, session.role);
      return acc.extraLives > 0;
    },

    consumeExtraLife(session, { gameId, partyId = null, levelNumber }) {
      authGuard.verifySession(session);
      const elimKey = `${session.username}::${gameId}::L${levelNumber}`;
      const lockKey = `use_extralife_${elimKey}`;
      acquireLock(lockKey);

      try {
        if (consumedEliminationKeys.has(elimKey)) {
          throw new Error('Bu elenme için zaten Extra Life kullanıldı!');
        }

        const cfg = configService.getConfig();
        const history = store.get(ECON_KEYS.EXTRA_LIVES, []);
        const usedInThisGame = history.filter(
          x => x.username.toLowerCase() === session.username.toLowerCase() && x.gameId === gameId
        ).length;

        if (usedInThisGame >= cfg.extraLifeMaxPerGame) {
          throw new Error('Bir oyunda kullanılabilecek maksimum Extra Life sınırına ulaştınız!');
        }

        const accounts = economyService._ensureAccounts();
        const acc = accounts.find(
          a => a.username.toLowerCase() === session.username.toLowerCase()
        );
        if (!acc || acc.extraLives <= 0) {
          throw new Error('Kullanılabilir Extra Life hakkınız bulunmuyor!');
        }

        const prevLives = acc.extraLives;
        acc.extraLives -= 1;
        acc.extraLivesUsed = (acc.extraLivesUsed || 0) + 1;
        acc.updatedAt = new Date().toISOString();
        economyService._saveAccounts(accounts);

        consumedEliminationKeys.add(elimKey);

        const record = {
          id: 'EXL-' + Date.now(),
          playerId: acc.playerId,
          username: acc.username,
          partyId: partyId || 'SOLO',
          gameId,
          levelNumber,
          item: 'Extra Life',
          cost: cfg.extraLifePrice,
          previousLives: prevLives,
          newLives: acc.extraLives,
          previousBalance: acc.balance,
          newBalance: acc.balance,
          transactionType: 'EXTRA_LIFE_USED',
          status: 'Used',
          timestamp: new Date().toISOString()
        };

        history.unshift(record);
        store.set(ECON_KEYS.EXTRA_LIVES, history);

        economyService._recordTransaction({
          playerId: acc.playerId,
          username: acc.username,
          amount: 0,
          type: 'EXTRA_LIFE_USED',
          reason: `Extra Life Used (Soru #${levelNumber})`,
          previousBalance: acc.balance,
          newBalance: acc.balance,
          partyId,
          gameId
        });

        activityService.log(
          'EXTRA_LIFE_USED',
          session.username,
          `${session.username} used an ❤️ Extra Life on Question #${levelNumber} and returned to the game!`
        );

        const unlocked = achievementService.checkAndUnlock(session.username);

        return {
          ok: true,
          record,
          account: { ...acc },
          unlockedAchievements: unlocked
        };
      } finally {
        releaseLock(lockKey);
      }
    },

    getHistory(session) {
      authGuard.verifySession(session);
      const all = store.get(ECON_KEYS.EXTRA_LIVES, []);
      if (session.role === 'ADMIN') return all;
      return all.filter(x => x.username.toLowerCase() === session.username.toLowerCase());
    }
  };

  // ==========================================
  // 5. DAILY REWARD & STREAK SERVICE (Section 32)
  // ==========================================
  const dailyRewardService = {
    getStatus(username) {
      const acc = economyService.getOrCreateAccount(username);
      const cfg = configService.getConfig();
      const cooldownMs = cfg.dailyCooldownHours * 3600 * 1000;
      const now = Date.now();

      if (!acc.lastDailyClaimAt) {
        return {
          canClaim: true,
          nextStreakDay: 1,
          rewardAmount: cfg.dailyStreakRewards[0] || cfg.dailyLoginBaseReward,
          remainingMs: 0
        };
      }

      const lastTime = new Date(acc.lastDailyClaimAt).getTime();
      const elapsed = now - lastTime;

      if (elapsed < cooldownMs) {
        return {
          canClaim: false,
          nextStreakDay: acc.dailyStreak || 1,
          rewardAmount:
            cfg.dailyStreakRewards[Math.min((acc.dailyStreak || 1) - 1, 6)] ||
            cfg.dailyLoginBaseReward,
          remainingMs: cooldownMs - elapsed
        };
      }

      // Reset streak if missed more than 2x cooldown period (48h)
      const streakBroken = elapsed > cooldownMs * 2.2;
      const nextStreak = streakBroken ? 1 : ((acc.dailyStreak || 0) % 7) + 1;
      const reward =
        cfg.dailyStreakRewards[nextStreak - 1] || cfg.dailyLoginBaseReward;

      return {
        canClaim: true,
        nextStreakDay: nextStreak,
        rewardAmount: reward,
        remainingMs: 0
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
          throw new Error(`Günlük ödülünüzü zaten aldınız! Yaklaşık ${hrs} saat sonra tekrar alabilirsiniz.`);
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
          reason: `Daily Reward (Day ${st.nextStreakDay})`,
          previousBalance: prevBal,
          newBalance: newBal
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
          rewardAmount: st.rewardAmount,
          account: updatedAcc
        };
      } finally {
        releaseLock(lockKey);
      }
    }
  };

  // ==========================================
  // 6. ACHIEVEMENTS SERVICE (Section 33)
  // ==========================================
  const ACHIEVEMENTS_CATALOG = [
    {
      id: 'ACH_FIRST_VICTORY',
      title: 'First Victory',
      icon: '🏆',
      description: 'Win your first game.',
      rewardEmeralds: 100,
      rewardPoints: 250,
      check: acc => acc.gamesWon >= 1
    },
    {
      id: 'ACH_EMERALD_HUNTER',
      title: 'Emerald Hunter',
      icon: '💚',
      description: 'Earn 1,000 Emerald Coins.',
      rewardEmeralds: 150,
      rewardPoints: 300,
      check: acc => acc.totalEarned >= 1000
    },
    {
      id: 'ACH_UNSTOPPABLE',
      title: 'Unstoppable',
      icon: '🔥',
      description: 'Win 5 games.',
      rewardEmeralds: 250,
      rewardPoints: 500,
      check: acc => acc.gamesWon >= 5
    },
    {
      id: 'ACH_CHAMPION',
      title: 'Champion',
      icon: '👑',
      description: 'Reach #1 on the leaderboard.',
      rewardEmeralds: 500,
      rewardPoints: 1000,
      check: (acc, rank) => rank === 1
    },
    {
      id: 'ACH_SECOND_CHANCE',
      title: 'Second Chance',
      icon: '❤️',
      description: 'Successfully use an Extra Life.',
      rewardEmeralds: 100,
      rewardPoints: 200,
      check: acc => acc.extraLivesUsed >= 1
    },
    {
      id: 'ACH_MILLIONAIRE',
      title: 'Millionaire',
      icon: '💎',
      description: 'Reach 10,000 Emerald Coins.',
      rewardEmeralds: 1000,
      rewardPoints: 2000,
      check: acc => acc.balance >= 10000 || acc.totalEarned >= 10000
    }
  ];

  const achievementService = {
    getUnlockedMap() {
      return store.get(ECON_KEYS.ACHIEVEMENTS, {
        Mashallah: ['ACH_FIRST_VICTORY', 'ACH_EMERALD_HUNTER', 'ACH_UNSTOPPABLE', 'ACH_CHAMPION', 'ACH_SECOND_CHANCE']
      });
    },

    getPlayerAchievements(username) {
      const map = this.getUnlockedMap();
      const key = Object.keys(map).find(k => k.toLowerCase() === String(username).toLowerCase());
      const unlockedIds = key ? map[key] : [];

      return ACHIEVEMENTS_CATALOG.map(ach => ({
        id: ach.id,
        title: ach.title,
        icon: ach.icon,
        description: ach.description,
        rewardEmeralds: ach.rewardEmeralds,
        rewardPoints: ach.rewardPoints,
        unlocked: unlockedIds.includes(ach.id)
      }));
    },

    checkAndUnlock(username) {
      const acc = economyService.getOrCreateAccount(username);
      const rankInfo = leaderboardService.getPlayerRank(username);
      const map = this.getUnlockedMap();
      const existingKey =
        Object.keys(map).find(k => k.toLowerCase() === String(username).toLowerCase()) ||
        acc.username;

      if (!map[existingKey]) map[existingKey] = [];
      const unlockedNow = [];

      ACHIEVEMENTS_CATALOG.forEach(ach => {
        if (!map[existingKey].includes(ach.id) && ach.check(acc, rankInfo.rank)) {
          map[existingKey].push(ach.id);
          unlockedNow.push(ach);

          // Grant achievement reward
          let prev = 0;
          let next = 0;
          economyService._mutateAccount(acc.username, a => {
            prev = a.balance;
            a.balance += ach.rewardEmeralds;
            a.totalEarned += ach.rewardEmeralds;
            a.points += ach.rewardPoints;
            next = a.balance;
          });

          economyService._recordTransaction({
            playerId: acc.playerId,
            username: acc.username,
            amount: ach.rewardEmeralds,
            type: 'ACHIEVEMENT',
            reason: `Achievement Unlocked: ${ach.title}`,
            previousBalance: prev,
            newBalance: next
          });

          activityService.log(
            'ACHIEVEMENT_UNLOCKED',
            acc.username,
            `${acc.username} unlocked achievement "${ach.title}" (+${ach.rewardEmeralds} 💚)`
          );
        }
      });

      if (unlockedNow.length > 0) {
        store.set(ECON_KEYS.ACHIEVEMENTS, map);
      }
      return unlockedNow;
    }
  };

  // ==========================================
  // 7. LEADERBOARD SERVICE & NORMALIZATION ADAPTERS (Section 19 & 25)
  // ==========================================
  function normalizeAccount(acc) {
    if (!acc) return null;
    const gamesPlayed = Number(acc.gamesPlayed || 0);
    const gamesWon = Number(acc.gamesWon || 0);
    const bestScore = Number(acc.bestScore || 0);
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const averageScore = gamesPlayed > 0 ? Math.round(bestScore * 0.45) : 0;

    return {
      ...acc,
      emeraldCoins: Number(acc.balance || 0),
      totalPoints: Number(acc.points || 0),
      totalEmeraldsEarned: Number(acc.totalEarned || 0),
      totalEmeraldsSpent: Number(acc.totalSpent || 0),
      winRate,
      averageScore,
      inventory: {
        extraLives: Number(acc.extraLives || 0),
        secondChance: Number(acc.secondChanceOwned || 0),
        scoreBooster: Number(acc.scoreBoosterOwned || 0),
        tournamentTickets: Number(acc.tournamentTickets || 0)
      }
    };
  }

  // Extend configService with nested rewards/extraLife view & updater
  const origGetConfig = configService.getConfig.bind(configService);
  configService.getConfig = function () {
    const raw = origGetConfig();
    const enabledFlag = raw.extraLifeEnabled !== false;
    return {
      ...raw,
      rewards: {
        gameCompleted: raw.gameCompletedReward,
        gameWon: raw.gameWonReward,
        top3Finish: raw.top3FinishReward,
        tournamentWinner: raw.tournamentWinnerReward,
        dailyLogin: raw.dailyLoginBaseReward
      },
      extraLife: {
        price: raw.extraLifePrice,
        maxPerGame: raw.extraLifeMaxPerGame || 1,
        maxPerPlayer: raw.extraLifeMaxPerPlayer || 3,
        enabled: enabledFlag
      }
    };
  };

  const origUpdateConfig = configService.updateConfig.bind(configService);
  configService.updateConfig = function (session, newValues = {}) {
    const flat = { ...newValues };
    if (newValues.rewards) {
      flat.gameCompletedReward = newValues.rewards.gameCompleted;
      flat.gameWonReward = newValues.rewards.gameWon;
      flat.top3FinishReward = newValues.rewards.top3Finish;
      flat.tournamentWinnerReward = newValues.rewards.tournamentWinner;
      flat.dailyLoginBaseReward = newValues.rewards.dailyLogin;
    }
    if (newValues.extraLife) {
      flat.extraLifePrice = newValues.extraLife.price;
      flat.extraLifeMaxPerGame = newValues.extraLife.maxPerGame;
      flat.extraLifeEnabled = newValues.extraLife.enabled;
    }
    const updated = origUpdateConfig(session, flat);
    if (typeof flat.extraLifeMaxPerGame === 'number') {
      updated.extraLifeMaxPerGame = Math.max(1, Number(flat.extraLifeMaxPerGame));
    }
    if (typeof flat.extraLifeEnabled === 'boolean') {
      updated.extraLifeEnabled = flat.extraLifeEnabled;
    }
    store.set(ECON_KEYS.CONFIG, updated);
    return this.getConfig();
  };

  // Extend economyService with profile & transaction helpers
  economyService.getPlayerEconomyProfile = function (username) {
    return normalizeAccount(this.getOrCreateAccount(username));
  };

  economyService.getAllProfiles = function () {
    return this.getAllAccounts().map(normalizeAccount);
  };

  economyService.getTransactionHistory = function (session, filterUsername = null) {
    const list = this.getTransactions(session, filterUsername);
    return list.map(tx => ({
      ...tx,
      balanceAfter: Number(tx.newBalance ?? tx.balanceAfter ?? 0),
      dateFormatted: new Date(tx.timestamp).toLocaleString('tr-TR')
    }));
  };

  const origRecordGameOutcome = economyService.recordGameOutcome.bind(economyService);
  economyService.recordGameOutcome = function (session, outcome) {
    const res = origRecordGameOutcome(session, outcome);
    return {
      ...res,
      emeraldReward: res.earnedEmeralds,
      pointsEarned: res.earnedPoints,
      newlyUnlocked: res.unlockedAchievements,
      profile: normalizeAccount(res.account)
    };
  };

  const origAdminModify = economyService.adminModifyBalance.bind(economyService);
  economyService.adminModifyBalance = function (session, arg1, mode, amountValue, customReason) {
    if (arg1 && typeof arg1 === 'object') {
      const res = origAdminModify(
        session,
        arg1.username,
        arg1.operation,
        arg1.amount,
        arg1.reason
      );
      return normalizeAccount(res);
    }
    return normalizeAccount(origAdminModify(session, arg1, mode, amountValue, customReason));
  };

  // Extend shopService with listShopItems, adminSaveShopItem & normalized purchaseItem
  shopService.listShopItems = function (includeDisabled = false) {
    const all = this.listItems().map(item => ({
      ...item,
      effectType: item.effect || item.effectType || 'EXTRA_LIFE',
      maxPerGame: item.maxPurchase || item.maxPerGame || 1
    }));
    return includeDisabled ? all : all.filter(i => i.enabled);
  };

  shopService.adminSaveShopItem = function (session, itemData) {
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
  };

  const origPurchaseItem = shopService.purchaseItem.bind(shopService);
  shopService.purchaseItem = function (session, itemId) {
    // Support both 'item_extra_life' and 'ITEM-EXTRA-LIFE' style IDs
    const items = this._ensureShopItems();
    const normalizedId = String(itemId || '')
      .toUpperCase()
      .replace(/_/g, '-');
    const matched = items.find(
      i => i.id.toUpperCase() === normalizedId || i.id === itemId
    );
    const res = origPurchaseItem(session, matched ? matched.id : itemId);
    return {
      ...res,
      profile: normalizeAccount(res.account)
    };
  };

  // Extend extraLifeService with detailed canUseExtraLife & useExtraLifeInGame
  extraLifeService.canUseExtraLife = function (session, gameId, levelNumber) {
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
  };

  extraLifeService.useExtraLifeInGame = function (session, gameId, levelNumber, partyId = null) {
    return this.consumeExtraLife(session, { gameId, levelNumber, partyId });
  };

  // Extend dailyRewardService with canClaimDailyReward & enriched claimDailyReward
  dailyRewardService.canClaimDailyReward = function (username) {
    const acc = economyService.getOrCreateAccount(username);
    const st = this.getStatus(username);
    return {
      ...st,
      currentStreak: Number(acc.dailyStreak || 0)
    };
  };

  const origClaimDaily = dailyRewardService.claimDailyReward.bind(dailyRewardService);
  dailyRewardService.claimDailyReward = function (session) {
    const res = origClaimDaily(session);
    return {
      ...res,
      streak: res.streakDay,
      newBalance: res.account.balance,
      profile: normalizeAccount(res.account)
    };
  };

  const leaderboardService = {
    getSortedLeaderboard(limit = 50, searchQuery = '') {
      const accounts = economyService.getAllAccounts().map(normalizeAccount);
      // Sort descending by total points, then by gamesWon, then by balance
      accounts.sort((a, b) => {
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

    getLeaderboard({ limit = 50, search = '' } = {}) {
      return this.getSortedLeaderboard(limit, search).entries;
    },

    getPlayerRank(username) {
      const { allRanked } = this.getSortedLeaderboard(500);
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
      return this.getPlayerRank(username);
    }
  };

  // Attach to global MCMServices
  Object.assign(window.MCMServices, {
    configService,
    economyService,
    shopService,
    extraLifeService,
    dailyRewardService,
    achievementService,
    leaderboardService
  });
})();
