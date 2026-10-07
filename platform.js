/**
 * MINECRAFT MILYONER — TOURNAMENT & ADMIN PLATFORM CONTROLLER
 * Connects UI Components (License Login Gate, Party Lobby, Invitation Modal,
 * Confirmation Dialog, Toast Notifications, and Admin Panel) to MCMServices.
 */

(function () {
  'use strict';

  const {
    authGuard,
    licenseService,
    partyService,
    playerService,
    activityService,
    configService,
    economyService,
    shopService,
    extraLifeService,
    dailyRewardService,
    achievementService,
    leaderboardService,
    PARTY_STATUSES
  } = window.MCMServices;

  class TournamentPlatformController {
    constructor() {
      this.session = null;
      this.selectedPartyId = null;
      this.currentInvitationText = '';
      this.confirmCallback = null;
      this.leaderboardLimit = 10;
      this.extraLifeCallbacks = null;
      this.leaderboardRefreshTimer = null;

      this.init();
    }

    init() {
      this.bindLicenseGate();
      this.bindTopBar();
      this.bindPartyLobby();
      this.bindLeaderboardScreen();
      this.bindEmeraldShopScreen();
      this.bindExtraLifeModal();
      this.bindAdminPanel();
      this.bindConfirmModal();
      this.bindInvitationModal();

      // Live automatic refresh for Leaderboard & Economy header
      this.leaderboardRefreshTimer = setInterval(() => {
        if (!this.session) return;
        const lbScreen = document.getElementById('screen-leaderboard');
        if (lbScreen && lbScreen.classList.contains('active')) {
          this.renderLeaderboard();
        }
        this.syncEconomyHeaderUI();
      }, 12000);

      // Check if a valid signed session already exists in storage
      const existingSession = licenseService.getActiveSession();
      if (existingSession) {
        this.applyAuthenticatedSession(existingSession, false);
      } else {
        this.lockWithLicenseGate();
      }
    }

    // ==========================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================
    showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `mc-toast toast-${type}`;
      const icon = type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '✅';
      toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 260);
      }, 3600);
    }

    // ==========================================
    // CONFIRMATION DIALOG
    // ==========================================
    askConfirmation(title, message, acceptLabel, onConfirm) {
      const modal = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const acceptText = document.getElementById('btn-confirm-accept-text');

      if (!modal) return;
      if (titleEl) titleEl.textContent = title || '⚠️ İşlemi Onayla';
      if (msgEl) msgEl.textContent = message || 'Bu işlemi yapmak istediğinize emin misiniz?';
      if (acceptText) acceptText.textContent = acceptLabel || 'Confirm (Onayla)';

      this.confirmCallback = onConfirm;
      modal.classList.remove('hidden');
    }

    bindConfirmModal() {
      const modal = document.getElementById('modal-confirm');
      const closeBtn = document.getElementById('btn-confirm-close');
      const cancelBtn = document.getElementById('btn-confirm-cancel');
      const acceptBtn = document.getElementById('btn-confirm-accept');

      const close = () => {
        if (modal) modal.classList.add('hidden');
        this.confirmCallback = null;
      };

      if (closeBtn) closeBtn.addEventListener('click', close);
      if (cancelBtn) cancelBtn.addEventListener('click', close);
      if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const cb = this.confirmCallback;
          close();
          if (typeof cb === 'function') cb();
        });
      }
    }

    // ==========================================
    // 1. LICENSE LOGIN GATE
    // ==========================================
    lockWithLicenseGate() {
      this.session = null;
      if (window.mcQuizGame) {
        window.mcQuizGame.isUnlocked = false;
      }
      document.body.classList.add('gate-locked');

      const gateEl = document.getElementById('access-gate');
      const inputEl = document.getElementById('access-code-input');
      const errorEl = document.getElementById('access-gate-error');
      const loadingEl = document.getElementById('access-gate-loading');

      if (gateEl) gateEl.classList.remove('hidden');
      if (errorEl) errorEl.classList.add('hidden');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (inputEl) {
        inputEl.value = '';
        setTimeout(() => inputEl.focus(), 60);
      }

      this.updateTopBarSessionUI();
    }

    bindLicenseGate() {
      const gateEl = document.getElementById('access-gate');
      const gateCard = gateEl ? gateEl.querySelector('.gate-card') : null;
      const formEl = document.getElementById('access-gate-form');
      const codeInput = document.getElementById('access-code-input');
      const userInput = document.getElementById('access-username-input');
      const errorEl = document.getElementById('access-gate-error');
      const loadingEl = document.getElementById('access-gate-loading');
      const submitBtn = document.getElementById('btn-license-submit');
      const visBtn = document.getElementById('btn-toggle-code-vis');

      if (visBtn && codeInput) {
        visBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const isPwd = codeInput.type === 'password';
          codeInput.type = isPwd ? 'text' : 'password';
          visBtn.textContent = isPwd ? '🙈' : '👁️';
          codeInput.focus();
        });
      }

      if (formEl && codeInput) {
        formEl.addEventListener('submit', async e => {
          e.preventDefault();
          const rawCode = codeInput.value.trim();
          const customUser = userInput ? userInput.value.trim() : '';

          if (errorEl) errorEl.classList.add('hidden');
          if (loadingEl) loadingEl.classList.remove('hidden');
          if (submitBtn) submitBtn.disabled = true;

          const result = await licenseService.validateAndLogin(rawCode, customUser);

          if (loadingEl) loadingEl.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = false;

          if (!result.ok) {
            window.soundManager.playWrong();
            if (errorEl) {
              errorEl.textContent = `❌ ${result.error}`;
              errorEl.classList.remove('hidden');
            }
            if (gateCard) {
              gateCard.classList.remove('shake');
              void gateCard.offsetWidth;
              gateCard.classList.add('shake');
            }
            codeInput.select();
            return;
          }

          window.soundManager.playCorrect();
          this.applyAuthenticatedSession(result.session, true);
        });
      }
    }

    applyAuthenticatedSession(session, isFreshLogin = false) {
      this.session = session;
      document.body.classList.remove('gate-locked');

      const gateEl = document.getElementById('access-gate');
      if (gateEl) gateEl.classList.add('hidden');

      if (window.mcQuizGame) {
        window.mcQuizGame.isUnlocked = true;
        if (isFreshLogin) {
          window.mcQuizGame.particles.spawnBurst(
            window.innerWidth / 2,
            window.innerHeight / 2,
            'emerald',
            50
          );
        }
        if (window.soundManager.musicEnabled && !window.soundManager.currentMusicMode) {
          window.soundManager.startMusic('menu');
        }
      }

      this.updateTopBarSessionUI();
      this.syncEconomyHeaderUI();

      // Route based on Role when logging in
      if (isFreshLogin) {
        if (session.role === 'ADMIN') {
          this.showToast(`Hoş geldin ${session.username}! Admin Panel yetkileri açıldı.`, 'info');
          this.openAdminPanel();
        } else if (session.role === 'ORGANIZER') {
          this.showToast(`Hoş geldin ${session.username}! Organizatör paneli hazır.`, 'success');
          this.openPartyLobby();
        } else {
          this.showToast(`Hoş geldin ${session.username}!`, 'success');
        }
      }
    }

    handleLogout() {
      licenseService.logout();
      this.showToast('Oturum kapatıldı. Yeni lisans kodu girebilirsiniz.', 'info');
      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-menu');
      }
      this.lockWithLicenseGate();
    }

    // ==========================================
    // TOP BAR, NAVIGATION & DASHBOARD ECONOMY WIDGET
    // ==========================================
    updateTopBarSessionUI() {
      const navBar = document.getElementById('main-nav-bar');
      const navAdminBtn = document.getElementById('btn-nav-admin');
      const emeraldPill = document.getElementById('top-emerald-pill');
      const dailyBtn = document.getElementById('btn-daily-reward');
      const badge = document.getElementById('top-session-badge');
      const nameEl = document.getElementById('top-session-username');
      const roleEl = document.getElementById('top-session-role');
      const adminBtn = document.getElementById('btn-top-admin');
      const partyBtn = document.getElementById('btn-top-party');
      const logoutBtn = document.getElementById('btn-top-logout');

      if (!this.session) {
        if (navBar) navBar.classList.add('hidden');
        if (emeraldPill) emeraldPill.classList.add('hidden');
        if (dailyBtn) dailyBtn.classList.add('hidden');
        if (badge) badge.classList.add('hidden');
        if (adminBtn) adminBtn.classList.add('hidden');
        if (partyBtn) partyBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        return;
      }

      if (navBar) navBar.classList.remove('hidden');
      if (navAdminBtn) navAdminBtn.classList.toggle('hidden', this.session.role !== 'ADMIN');
      if (emeraldPill) emeraldPill.classList.remove('hidden');
      if (dailyBtn) dailyBtn.classList.remove('hidden');
      if (badge) badge.classList.remove('hidden');
      if (nameEl) nameEl.textContent = this.session.username;
      if (roleEl) {
        roleEl.textContent = this.session.role;
        roleEl.className = `role-badge role-${this.session.role.toLowerCase()}`;
      }

      if (adminBtn) {
        adminBtn.classList.toggle('hidden', this.session.role !== 'ADMIN');
      }
      if (partyBtn) partyBtn.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    }

    syncEconomyHeaderUI() {
      if (!this.session) return;
      const profile = leaderboardService.getPlayerRankAndSummary(this.session.username);
      const extraLivesTotal =
        (profile.inventory?.extraLives || 0) + (profile.inventory?.secondChance || 0);
      const dailyStatus = dailyRewardService.canClaimDailyReward(this.session.username);
      const cfg = configService.getConfig();

      // Top Header Emerald Pill
      const topBal = document.getElementById('top-emerald-balance');
      const topLives = document.getElementById('top-extralives-count');
      if (topBal) topBal.textContent = profile.emeraldCoins.toLocaleString('tr-TR');
      if (topLives) topLives.textContent = extraLivesTotal;

      // Game Screen Extra Life Pill
      const gameLives = document.getElementById('game-extralife-count');
      if (gameLives) gameLives.textContent = extraLivesTotal;

      // Daily Reward Button
      const dailyBtn = document.getElementById('btn-daily-reward');
      const dailyLabel = document.getElementById('daily-reward-label');
      const widgetDailyBtn = document.getElementById('btn-widget-claim-daily');
      if (dailyLabel) {
        dailyLabel.textContent = dailyStatus.canClaim
          ? `CLAIM +${cfg.rewards.dailyLogin} 💚`
          : 'CLAIMED ✓';
      }
      if (dailyBtn) {
        dailyBtn.disabled = !dailyStatus.canClaim;
      }
      if (widgetDailyBtn) {
        widgetDailyBtn.disabled = !dailyStatus.canClaim;
        widgetDailyBtn.textContent = dailyStatus.canClaim
          ? `🎁 Claim Daily Reward (+${cfg.rewards.dailyLogin} Emeralds)`
          : `✅ Daily Reward Claimed (Streak: ${dailyStatus.currentStreak}d)`;
      }

      // Section 31: Dashboard Economy Widget
      const dRank = document.getElementById('dash-econ-rank');
      const dPoints = document.getElementById('dash-econ-points');
      const dEmeralds = document.getElementById('dash-econ-emeralds');
      const dGames = document.getElementById('dash-econ-games');
      const dWins = document.getElementById('dash-econ-wins');
      const dLives = document.getElementById('dash-econ-extralives');

      if (dRank) dRank.textContent = `#${profile.rank}`;
      if (dPoints) dPoints.textContent = `${profile.totalPoints.toLocaleString('tr-TR')} Points`;
      if (dEmeralds) {
        dEmeralds.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Emerald Coins`;
      }
      if (dGames) dGames.textContent = profile.gamesPlayed.toLocaleString('tr-TR');
      if (dWins) dWins.textContent = profile.gamesWon.toLocaleString('tr-TR');
      if (dLives) dLives.textContent = `${extraLivesTotal}`;
    }

    navigateToScreen(screenId) {
      try {
        authGuard.verifySession(this.session);
      } catch (err) {
        this.showToast(err.message, 'error');
        this.lockWithLicenseGate();
        return;
      }

      if (screenId === 'screen-admin') {
        this.openAdminPanel();
        return;
      }
      if (screenId === 'screen-party') {
        this.openPartyLobby();
        return;
      }
      if (screenId === 'screen-menu') {
        if (window.mcQuizGame) window.mcQuizGame.returnToMainMenu();
        return;
      }

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen(screenId);
      }

      this.syncEconomyHeaderUI();

      if (screenId === 'screen-leaderboard') {
        this.renderLeaderboard();
      } else if (screenId === 'screen-shop') {
        this.renderEmeraldShop();
      } else if (screenId === 'screen-profile') {
        this.renderPlayerProfile();
      } else if (screenId === 'screen-history') {
        this.renderEmeraldHistory();
      }
    }

    bindTopBar() {
      const adminBtn = document.getElementById('btn-top-admin');
      const partyBtn = document.getElementById('btn-top-party');
      const menuPartyBtn = document.getElementById('btn-open-party-hub');
      const logoutBtn = document.getElementById('btn-top-logout');
      const dailyBtn = document.getElementById('btn-daily-reward');
      const widgetDailyBtn = document.getElementById('btn-widget-claim-daily');
      const pillShopBtn = document.getElementById('btn-pill-open-shop');
      const sessionBadge = document.getElementById('top-session-badge');
      const heroLbBtn = document.getElementById('btn-open-leaderboard-hero');
      const heroShopBtn = document.getElementById('btn-open-shop-hero');
      const cardLb = document.getElementById('card-goto-leaderboard');
      const cardShop = document.getElementById('card-goto-shop');
      const cardProf = document.getElementById('card-goto-profile');

      // All [data-nav-screen] buttons across header and pages
      document.querySelectorAll('[data-nav-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const target = btn.getAttribute('data-nav-screen');
          this.navigateToScreen(target);
        });
      });

      if (adminBtn) {
        adminBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openAdminPanel();
        });
      }

      if (partyBtn) {
        partyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby();
        });
      }

      if (menuPartyBtn) {
        menuPartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby();
        });
      }

      if (heroLbBtn) {
        heroLbBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-leaderboard');
        });
      }

      if (heroShopBtn) {
        heroShopBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-shop');
        });
      }

      if (pillShopBtn) {
        pillShopBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-shop');
        });
      }

      if (sessionBadge) {
        sessionBadge.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-profile');
        });
      }

      if (cardLb) {
        cardLb.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-leaderboard');
        });
      }
      if (cardShop) {
        cardShop.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-shop');
        });
      }
      if (cardProf) {
        cardProf.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-profile');
        });
      }

      if (dailyBtn) {
        dailyBtn.addEventListener('click', () => this.claimDailyReward());
      }
      if (widgetDailyBtn) {
        widgetDailyBtn.addEventListener('click', () => this.claimDailyReward());
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.handleLogout();
        });
      }
    }

    // ==========================================
    // SECTION 32: DAILY EMERALD REWARD
    // ==========================================
    claimDailyReward() {
      try {
        const res = dailyRewardService.claimDailyReward(this.session);
        window.soundManager.playCorrect();
        if (window.mcQuizGame) {
          window.mcQuizGame.particles.spawnBurst(
            window.innerWidth / 2,
            window.innerHeight / 2,
            'emerald',
            50
          );
        }
        this.showToast(
          `🎁 +${res.rewardAmount} Emerald Coins Claimed! (Daily Login Streak: ${res.streak}d)`,
          'success'
        );
        this.syncEconomyHeaderUI();
      } catch (err) {
        window.soundManager.playWrong();
        this.showToast(err.message, 'error');
      }
    }

    // ==========================================
    // SECTION 23 & 24: EXTRA LIFE REVIVE SYSTEM
    // ==========================================
    canOfferExtraLife(gameId, questionNumber) {
      if (!this.session) return false;
      const check = extraLifeService.canUseExtraLife(this.session, gameId, questionNumber);
      return check.canUse;
    }

    promptExtraLifeRevive(gameId, questionNumber, onRevive, onExit) {
      const check = extraLifeService.canUseExtraLife(this.session, gameId, questionNumber);
      if (!check.canUse) {
        if (typeof onExit === 'function') onExit();
        return;
      }

      const modal = document.getElementById('modal-extralife');
      const qLabel = document.getElementById('extralife-question-label');
      const countEl = document.getElementById('extralife-modal-count');

      if (qLabel) qLabel.textContent = `Soru ${questionNumber} / 15`;
      if (countEl) countEl.textContent = `❤️ ${check.availableCount}`;

      this.extraLifeCallbacks = { gameId, questionNumber, onRevive, onExit };
      if (modal) modal.classList.remove('hidden');
    }

    bindExtraLifeModal() {
      const modal = document.getElementById('modal-extralife');
      const useBtn = document.getElementById('btn-use-extralife');
      const skipBtn = document.getElementById('btn-skip-extralife');

      if (useBtn) {
        useBtn.addEventListener('click', () => {
          if (!this.extraLifeCallbacks) return;
          const { gameId, questionNumber, onRevive, onExit } = this.extraLifeCallbacks;
          this.extraLifeCallbacks = null;
          if (modal) modal.classList.add('hidden');

          try {
            extraLifeService.useExtraLifeInGame(this.session, gameId, questionNumber);
            this.syncEconomyHeaderUI();
            this.showToast('❤️ EXTRA LIFE USED — "You have returned to the game!"', 'success');
            if (typeof onRevive === 'function') onRevive();
          } catch (err) {
            this.showToast(err.message, 'error');
            if (typeof onExit === 'function') onExit();
          }
        });
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const cb = this.extraLifeCallbacks?.onExit;
          this.extraLifeCallbacks = null;
          if (modal) modal.classList.add('hidden');
          if (typeof cb === 'function') cb();
        });
      }
    }

    // ==========================================
    // SECTION 21: GAME OUTCOME -> EMERALD & LEADERBOARD REWARDS
    // ==========================================
    onGameFinished(outcome) {
      if (!this.session) return;
      try {
        const res = economyService.recordGameOutcome(this.session, outcome);
        this.syncEconomyHeaderUI();

        if (res.emeraldReward > 0 || res.pointsEarned > 0) {
          this.showToast(
            `🟩 +${res.emeraldReward} Emerald Coins & ⭐ +${res.pointsEarned} Leaderboard Points kazandın!`,
            'success'
          );
        }

        if (res.newlyUnlocked && res.newlyUnlocked.length > 0) {
          res.newlyUnlocked.forEach(ach => {
            this.showToast(`🎖️ Achievement Unlocked: ${ach.icon} ${ach.title}!`, 'info');
          });
        }
      } catch (err) {
        console.warn('Game outcome economy error:', err);
      }
    }

    // ==========================================
    // SECTION 19: LEADERBOARD SYSTEM UI
    // ==========================================
    bindLeaderboardScreen() {
      document.querySelectorAll('[data-lb-limit]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.leaderboardLimit = Number(btn.getAttribute('data-lb-limit')) || 10;
          document.querySelectorAll('[data-lb-limit]').forEach(b => {
            b.classList.toggle('active', b === btn);
          });
          this.renderLeaderboard();
        });
      });

      const searchInp = document.getElementById('input-leaderboard-search');
      if (searchInp) {
        searchInp.addEventListener('input', () => this.renderLeaderboard());
      }

      const refreshBtn = document.getElementById('btn-leaderboard-refresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.renderLeaderboard();
          this.showToast('Leaderboard güncellendi!', 'info');
        });
      }
    }

    renderLeaderboard() {
      if (!this.session) return;
      const searchQ = document.getElementById('input-leaderboard-search')?.value || '';
      const allRanked = leaderboardService.getLeaderboard({ limit: 50, search: '' });
      const filteredRanked = leaderboardService.getLeaderboard({
        limit: this.leaderboardLimit,
        search: searchQ
      });
      const currentUserSummary = leaderboardService.getPlayerRankAndSummary(this.session.username);

      // 1. Current User Position Banner
      const bannerEl = document.getElementById('leaderboard-current-user-banner');
      if (bannerEl) {
        bannerEl.innerHTML = `
          <div>
            <span>👤 Senin Sıralaman (Your Position): </span>
            <strong class="gold-text">#${currentUserSummary.rank} ${this.escapeHtml(
              currentUserSummary.username
            )}</strong>
          </div>
          <div style="display:flex; gap:1.1rem; flex-wrap:wrap;">
            <span>⭐ Points: <strong>${currentUserSummary.totalPoints.toLocaleString(
              'tr-TR'
            )} Points</strong></span>
            <span>💚 Emerald Balance: <strong class="emerald-text">${currentUserSummary.emeraldCoins.toLocaleString(
              'tr-TR'
            )} Emerald Coins</strong></span>
            <span>🏆 Wins: <strong>${currentUserSummary.gamesWon}</strong></span>
          </div>
        `;
      }

      // 2. Top 3 Podium (#2 Silver, #1 Gold, #3 Bronze)
      const podiumEl = document.getElementById('leaderboard-podium');
      if (podiumEl) {
        const top1 = allRanked[0];
        const top2 = allRanked[1];
        const top3 = allRanked[2];
        const podiumOrder = [
          { data: top2, rank: 2, medal: '🥈', cls: 'podium-rank-2' },
          { data: top1, rank: 1, medal: '🥇', cls: 'podium-rank-1' },
          { data: top3, rank: 3, medal: '🥉', cls: 'podium-rank-3' }
        ];

        podiumEl.innerHTML = podiumOrder
          .filter(item => item.data)
          .map(
            item => `
            <div class="podium-card ${item.cls}">
              <div class="podium-medal">${item.medal}</div>
              <div class="podium-username">${this.escapeHtml(item.data.username)}</div>
              <div class="podium-points">${item.data.totalPoints.toLocaleString('tr-TR')} Points</div>
              <div class="podium-meta">
                <span class="emerald-text">💚 ${item.data.emeraldCoins.toLocaleString(
                  'tr-TR'
                )} Emeralds</span>
                <span>🏆 ${item.data.gamesWon} Wins</span>
              </div>
            </div>
          `
          )
          .join('');
      }

      // 3. Leaderboard Table Rows
      const tbody = document.getElementById('leaderboard-table-body');
      if (!tbody) return;

      if (filteredRanked.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">
              Aramanıza uygun oyuncu bulunamadı.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filteredRanked
        .map(row => {
          const isMe = row.username.toLowerCase() === this.session.username.toLowerCase();
          const rankBadge =
            row.rank === 1
              ? '🥇 1'
              : row.rank === 2
              ? '🥈 2'
              : row.rank === 3
              ? '🥉 3'
              : `#${row.rank}`;

          return `
            <tr class="${isMe ? 'lb-current-user-row' : ''}">
              <td class="lb-rank-cell">${rankBadge}</td>
              <td>
                <strong>⛏️ ${this.escapeHtml(row.username)}</strong>
                ${isMe ? '<span class="role-badge role-player" style="margin-left:0.4rem;">SEN</span>' : ''}
              </td>
              <td><strong class="gold-text">${row.totalPoints.toLocaleString('tr-TR')} Points</strong></td>
              <td><strong class="emerald-text">💚 ${row.emeraldCoins.toLocaleString('tr-TR')} Emerald Coins</strong></td>
              <td>${row.gamesPlayed}</td>
              <td class="emerald-text">${row.gamesWon}</td>
              <td class="wrong-text">${row.gamesLost}</td>
              <td>❤️ ${row.extraLivesUsed}</td>
            </tr>
          `;
        })
        .join('');
    }

    // ==========================================
    // SECTION 22 & 35: EMERALD SHOP UI
    // ==========================================
    bindEmeraldShopScreen() {
      // Bound dynamically in renderEmeraldShop
    }

    renderEmeraldShop() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const items = shopService.listShopItems(false);

      const balEl = document.getElementById('shop-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Emerald Coins`;
      }

      const invExtra = document.getElementById('shop-inv-extralife');
      const invSecond = document.getElementById('shop-inv-secondchance');
      const invBoost = document.getElementById('shop-inv-scorebooster');
      const invTicket = document.getElementById('shop-inv-ticket');

      if (invExtra) invExtra.textContent = profile.inventory?.extraLives || 0;
      if (invSecond) invSecond.textContent = profile.inventory?.secondChance || 0;
      if (invBoost) invBoost.textContent = profile.inventory?.scoreBooster || 0;
      if (invTicket) invTicket.textContent = profile.inventory?.tournamentTickets || 0;

      const grid = document.getElementById('emerald-shop-grid');
      if (!grid) return;

      grid.innerHTML = items
        .map(item => {
          const canAfford = profile.emeraldCoins >= item.price;
          return `
            <div class="shop-item-card">
              <div>
                <div class="shop-item-top">
                  <div class="shop-item-icon">${this.escapeHtml(item.icon)}</div>
                  <span class="shop-item-price-tag">💚 ${item.price.toLocaleString(
                    'tr-TR'
                  )} Emeralds</span>
                </div>
                <h3 class="shop-item-title">${this.escapeHtml(item.name)}</h3>
                <p class="shop-item-desc">"${this.escapeHtml(item.description)}"</p>
              </div>
              <div class="shop-item-footer">
                <span class="meta-muted">Limit: ${item.maxPerGame} / game</span>
                <button
                  type="button"
                  class="mc-btn ${canAfford ? 'mc-btn-emerald' : 'mc-btn-stone'} mc-btn-small btn-buy-shop-item"
                  data-item-id="${this.escapeHtml(item.id)}"
                >
                  <span class="btn-inner">🛒 BUY (${item.price.toLocaleString('tr-TR')} 💚)</span>
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      grid.querySelectorAll('.btn-buy-shop-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-item-id');
          btn.disabled = true;
          try {
            const res = shopService.purchaseItem(this.session, itemId);
            window.soundManager.playCorrect();
            if (window.mcQuizGame) {
              const rect = btn.getBoundingClientRect();
              window.mcQuizGame.particles.spawnBurst(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
                'emerald',
                42
              );
            }
            this.showToast(
              `✅ Purchased ${res.item.icon} ${res.item.name} (-${res.item.price} Emeralds)!`,
              'success'
            );
            this.syncEconomyHeaderUI();
            this.renderEmeraldShop();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    }

    // ==========================================
    // SECTION 25 & 33: PLAYER PROFILE & ACHIEVEMENTS UI
    // ==========================================
    renderPlayerProfile() {
      if (!this.session) return;
      const summary = leaderboardService.getPlayerRankAndSummary(this.session.username);
      const achievements = achievementService.getPlayerAchievements(this.session.username);
      const dailyStatus = dailyRewardService.canClaimDailyReward(this.session.username);

      const uName = document.getElementById('profile-username');
      const uRole = document.getElementById('profile-role-badge');
      const uRank = document.getElementById('profile-rank-badge');

      if (uName) uName.textContent = summary.username;
      if (uRole) {
        uRole.textContent = this.session.role;
        uRole.className = `role-badge role-${this.session.role.toLowerCase()}`;
      }
      if (uRank) uRank.textContent = `Rank #${summary.rank}`;

      const extraOwned =
        (summary.inventory?.extraLives || 0) + (summary.inventory?.secondChance || 0);

      document.getElementById('prof-stat-rank').textContent = `#${summary.rank}`;
      document.getElementById('prof-stat-points').textContent =
        `${summary.totalPoints.toLocaleString('tr-TR')} Points`;
      document.getElementById('prof-stat-emeralds').textContent =
        `💚 ${summary.emeraldCoins.toLocaleString('tr-TR')} Emerald Coins`;
      document.getElementById('prof-stat-games').textContent =
        summary.gamesPlayed.toLocaleString('tr-TR');
      document.getElementById('prof-stat-winloss').textContent =
        `${summary.gamesWon} W / ${summary.gamesLost} L`;
      document.getElementById('prof-stat-winrate').textContent = `%${summary.winRate}`;
      document.getElementById('prof-stat-extralives').textContent =
        `${extraOwned} Owned / ${summary.extraLivesUsed} Used`;
      document.getElementById('prof-stat-avgscore').textContent =
        `${summary.averageScore.toLocaleString('tr-TR')} Emerald`;
      document.getElementById('prof-stat-bestscore').textContent =
        `${summary.bestScore.toLocaleString('tr-TR')} Emerald`;
      document.getElementById('prof-stat-earned').textContent =
        `+${summary.totalEmeraldsEarned.toLocaleString('tr-TR')} Emeralds`;
      document.getElementById('prof-stat-spent').textContent =
        `-${summary.totalEmeraldsSpent.toLocaleString('tr-TR')} Emeralds`;
      document.getElementById('prof-stat-streak').textContent =
        `${dailyStatus.currentStreak} Gün`;

      const unlockedCount = achievements.filter(a => a.unlocked).length;
      const counterEl = document.getElementById('prof-achievements-counter');
      if (counterEl) {
        counterEl.textContent = `${unlockedCount} / ${achievements.length} Unlocked`;
      }

      const achGrid = document.getElementById('profile-achievements-grid');
      if (achGrid) {
        achGrid.innerHTML = achievements
          .map(
            a => `
            <div class="achievement-card ${a.unlocked ? 'unlocked' : ''}">
              <div class="ach-icon">${a.icon}</div>
              <div class="ach-info">
                <div class="ach-title">${this.escapeHtml(a.title)} ${
                  a.unlocked ? '✅' : '🔒'
                }</div>
                <div class="ach-desc">${this.escapeHtml(a.description)}</div>
              </div>
            </div>
          `
          )
          .join('');
      }
    }

    // ==========================================
    // SECTION 26: EMERALD TRANSACTION HISTORY UI
    // ==========================================
    renderEmeraldHistory() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const txs = economyService.getTransactionHistory(this.session, this.session.username);

      const balEl = document.getElementById('history-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Emerald Coins`;
      }

      const listEl = document.getElementById('player-history-list');
      if (!listEl) return;

      if (txs.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state-box">Henüz Emerald Coin işlem geçmişiniz bulunmuyor.</div>';
        return;
      }

      listEl.innerHTML = txs
        .map(tx => {
          const isNeg = tx.amount < 0;
          const sign = tx.amount > 0 ? '+' : '';
          const amountText =
            tx.amount === 0
              ? '❤️ 1 Extra Life Consumed'
              : `${sign}${tx.amount.toLocaleString('tr-TR')} Emeralds`;
          return `
            <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
              <div class="tx-main">
                <span class="tx-reason">${this.escapeHtml(tx.reason)}</span>
                <span class="tx-meta">🕒 ${tx.dateFormatted} • Balance After: 💚 ${tx.balanceAfter.toLocaleString(
                  'tr-TR'
                )} Emeralds</span>
              </div>
              <div class="tx-amount ${isNeg ? 'wrong-text' : 'emerald-text'}">
                ${amountText}
              </div>
            </div>
          `;
        })
        .join('');
    }

    // ==========================================
    // 4-8. PARTY & USER DASHBOARD (PLAYER / ORGANIZER / ADMIN)
    // ==========================================
    openPartyLobby() {
      try {
        authGuard.verifySession(this.session);
      } catch (err) {
        this.showToast(err.message, 'error');
        this.lockWithLicenseGate();
        return;
      }

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-party');
      }
      this.renderPartyLobby();
    }

    bindPartyLobby() {
      const backMenuBtn = document.getElementById('btn-party-back-menu');
      const playSoloBtn = document.getElementById('btn-party-play-solo');
      const openCreateBtn = document.getElementById('btn-open-create-party');
      const createBox = document.getElementById('organizer-create-party-box');
      const createForm = document.getElementById('form-create-party');
      const joinForm = document.getElementById('form-join-party');
      const statusFilter = document.getElementById('filter-user-party-status');

      if (backMenuBtn) {
        backMenuBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          if (window.mcQuizGame) window.mcQuizGame.returnToMainMenu();
        });
      }

      if (playSoloBtn) {
        playSoloBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          if (window.mcQuizGame) window.mcQuizGame.startNewGame();
        });
      }

      if (openCreateBtn && createBox) {
        openCreateBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          if (!['ADMIN', 'ORGANIZER'].includes(this.session?.role)) {
            this.showToast('Parti oluşturma yetkiniz yok!', 'error');
            return;
          }
          createBox.classList.toggle('hidden');
          const nameInp = document.getElementById('input-party-name');
          if (!createBox.classList.contains('hidden') && nameInp) nameInp.focus();
        });
      }

      if (createForm) {
        createForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const nameInput = document.getElementById('input-party-name');
            const maxSelect = document.getElementById('input-party-max');
            const newParty = partyService.createParty(this.session, {
              name: nameInput.value,
              maxPlayers: Number(maxSelect.value)
            });
            nameInput.value = '';
            this.selectedPartyId = newParty.id;
            window.soundManager.playCorrect();
            this.showToast('Party created successfully.', 'success');
            this.renderPartyLobby();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (joinForm) {
        joinForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const codeInp = document.getElementById('input-join-invite-code');
            const joinedParty = partyService.joinPartyByInviteCode(this.session, codeInp.value);
            codeInp.value = '';
            this.selectedPartyId = joinedParty.id;
            window.soundManager.playCorrect();
            this.showToast(`"${joinedParty.name}" partisine başarıyla katıldınız!`, 'success');
            this.renderPartyLobby();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (statusFilter) {
        statusFilter.addEventListener('change', () => this.renderPartyList());
      }
    }

    renderPartyLobby() {
      if (!this.session) return;

      const welcomeTitle = document.getElementById('party-welcome-title');
      const roleBadge = document.getElementById('party-user-role-badge');
      const licName = document.getElementById('party-user-license-name');
      const createBtn = document.getElementById('btn-open-create-party');
      const createBox = document.getElementById('organizer-create-party-box');

      if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${this.session.username}`;
      if (roleBadge) {
        roleBadge.textContent = this.session.role;
        roleBadge.className = `role-badge role-${this.session.role.toLowerCase()}`;
      }
      if (licName) licName.textContent = this.session.licenseName || '';

      // Enforce Rule 4: ONLY ADMIN and ORGANIZER can see Create Party UI
      const canCreateParty = ['ADMIN', 'ORGANIZER'].includes(this.session.role);
      if (createBtn) createBtn.classList.toggle('hidden', !canCreateParty);
      if (createBox) {
        createBox.classList.toggle('hidden', !canCreateParty);
      }

      this.renderPartyList();
      this.renderSelectedPartyDetail();
    }

    renderPartyList() {
      const listEl = document.getElementById('user-parties-list');
      const filterEl = document.getElementById('filter-user-party-status');
      if (!listEl || !this.session) return;

      const statusFilter = filterEl ? filterEl.value : 'ALL';
      let parties = partyService.listParties(this.session);
      if (statusFilter !== 'ALL') {
        parties = parties.filter(p => p.status === statusFilter);
      }

      if (!this.selectedPartyId && parties.length > 0) {
        this.selectedPartyId = parties[0].id;
      }

      if (parties.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-box">
            Henüz katıldığınız bir parti bulunmuyor. Bir davet kodu (Örn: <strong>MCM-8K2P</strong>) girerek katılabilirsiniz.
          </div>
        `;
        return;
      }

      listEl.innerHTML = parties
        .map(p => {
          const joinedCount = p.participants.filter(pt => pt.joinStatus === 'JOINED').length;
          const isSelected = p.id === this.selectedPartyId;
          return `
            <div class="party-item-card ${isSelected ? 'selected' : ''}" data-party-id="${p.id}">
              <div class="party-item-top">
                <span class="party-item-title">${this.escapeHtml(p.name)}</span>
                <span class="status-pill status-${p.status}">${p.status}</span>
              </div>
              <div class="party-item-meta">
                <span>👑 Organizer: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                <span>👥 Players: <strong>${joinedCount} / ${p.maxPlayers}</strong></span>
                <span>🎟️ Invite Code: <strong class="emerald-text">${p.inviteCode}</strong></span>
              </div>
            </div>
          `;
        })
        .join('');

      listEl.querySelectorAll('.party-item-card').forEach(card => {
        card.addEventListener('click', () => {
          window.soundManager.playClick();
          this.selectedPartyId = card.getAttribute('data-party-id');
          this.renderPartyList();
          this.renderSelectedPartyDetail();
        });
      });
    }

    renderSelectedPartyDetail() {
      const container = document.getElementById('party-detail-container');
      if (!container || !this.session) return;

      const party = this.selectedPartyId
        ? partyService.getPartyById(this.session, this.selectedPartyId)
        : null;

      if (!party) {
        container.innerHTML = `
          <div class="empty-state-box">
            Detaylarını görüntülemek için sol taraftan bir parti seçin veya davet kodu ile bir partiye katılın.
          </div>
        `;
        return;
      }

      const isOwner = party.organizer.toLowerCase() === this.session.username.toLowerCase();
      const canManage =
        this.session.role === 'ADMIN' || (this.session.role === 'ORGANIZER' && isOwner);
      const joinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      const createdDate = new Date(party.createdAt).toLocaleString('tr-TR');

      // Owner / Organizer / Admin Management Dashboard
      const managementToolbarHtml = canManage
        ? `
          <div class="party-owner-toolbar">
            <div class="owner-toolbar-title">🛠️ PARTY MANAGEMENT DASHBOARD (Parti Sahibi / Yönetici Kontrolü)</div>
            <div class="inline-join-form">
              <input type="text" id="inp-invite-username" class="mc-input mc-input-sm" placeholder="Davet edilecek Minecraft kullanıcı adı (opsiyonel)..." />
              <button type="button" id="btn-detail-invite" class="mc-btn mc-btn-emerald mc-btn-small">
                <span class="btn-inner">✉️ Invite Player</span>
              </button>
              <button type="button" id="btn-detail-copy-code" class="mc-btn mc-btn-stone mc-btn-small">
                <span class="btn-inner">📋 Copy Invite Code</span>
              </button>
            </div>

            <div class="owner-actions-wrap">
              <button type="button" id="btn-party-start" class="mc-btn mc-btn-emerald mc-btn-small" ${
                party.status === 'CANCELLED' ? 'disabled' : ''
              }>
                <span class="btn-inner">▶️ Start Game (Yarışmayı Başlat)</span>
              </button>
              <select id="sel-party-status-change" class="mc-select mc-select-xs">
                ${PARTY_STATUSES.map(
                  st => `<option value="${st}" ${party.status === st ? 'selected' : ''}>Durum: ${st}</option>`
                ).join('')}
              </select>
              <button type="button" id="btn-party-cancel" class="mc-btn mc-btn-danger mc-btn-small" ${
                party.status === 'CANCELLED' ? 'disabled' : ''
              }>
                <span class="btn-inner">✖ Close / Cancel Party</span>
              </button>
            </div>
          </div>
        `
        : '';

      container.innerHTML = `
        <div class="party-detail-header">
          <div>
            <div class="party-detail-title">${this.escapeHtml(party.name)}</div>
            <div class="meta-muted">Party ID: <strong>${party.id}</strong> • Created At: ${createdDate}</div>
          </div>
          <span class="status-pill status-${party.status}">${party.status}</span>
        </div>

        <div class="party-meta-grid">
          <div class="party-meta-box">
            <span>Organizer</span>
            <strong class="gold-text">${this.escapeHtml(party.organizer)}</strong>
          </div>
          <div class="party-meta-box">
            <span>Players</span>
            <strong>${joinedCount} / ${party.maxPlayers}</strong>
          </div>
          <div class="party-meta-box">
            <span>Invite Code</span>
            <strong class="emerald-text">${party.inviteCode}</strong>
          </div>
          <div class="party-meta-box">
            <span>Status</span>
            <strong>${party.status}</strong>
          </div>
        </div>

        ${managementToolbarHtml}

        <h4 class="panel-sec-title">👥 Katılımcılar (Participants — ${party.participants.length})</h4>
        <div class="participants-grid">
          ${party.participants
            .map(pt => {
              const joinedTime = new Date(pt.joinedAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const canRemoveThis =
                canManage && pt.username.toLowerCase() !== party.organizer.toLowerCase();
              return `
                <div class="participant-card">
                  <div class="participant-top">
                    <span class="participant-name">⛏️ ${this.escapeHtml(pt.username)}</span>
                    <span class="role-badge role-${pt.role.toLowerCase()}">${pt.role}</span>
                  </div>
                  <div class="participant-sub">
                    <span class="status-pill status-${pt.joinStatus}">${pt.joinStatus}</span>
                    <span>Joined: ${joinedTime}</span>
                  </div>
                  ${
                    canRemoveThis
                      ? `<button type="button" class="act-btn danger btn-remove-pt" data-username="${this.escapeHtml(
                          pt.username
                        )}">Remove Player (Çıkar)</button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      // Bind management events if authorized
      if (canManage) {
        const inviteBtn = document.getElementById('btn-detail-invite');
        const copyCodeBtn = document.getElementById('btn-detail-copy-code');
        const startBtn = document.getElementById('btn-party-start');
        const cancelBtn = document.getElementById('btn-party-cancel');
        const statusSel = document.getElementById('sel-party-status-change');

        if (inviteBtn) {
          inviteBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            const userInp = document.getElementById('inp-invite-username');
            const targetUser = userInp ? userInp.value.trim() : '';
            try {
              const invData = partyService.invitePlayer(this.session, party.id, targetUser);
              if (userInp) userInp.value = '';
              this.openInvitationModal(invData);
              if (targetUser) {
                this.showToast('Player invited successfully.', 'success');
              }
              this.renderPartyLobby();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          });
        }

        if (copyCodeBtn) {
          copyCodeBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.copyToClipboard(party.inviteCode, `Davet kodu kopyalandı: ${party.inviteCode}`);
          });
        }

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.askConfirmation(
              '▶️ Oyunu Başlat (Start Game)',
              `"${party.name}" partisi için Minecraft Milyoner yarışmasını başlatmak istediğinize emin misiniz?`,
              'Start Game',
              () => {
                try {
                  partyService.setPartyStatus(this.session, party.id, 'ACTIVE');
                  this.showToast(`"${party.name}" yarışması başlatıldı!`, 'success');
                  if (window.mcQuizGame) {
                    window.mcQuizGame.startNewGame();
                  }
                } catch (err) {
                  this.showToast(err.message, 'error');
                }
              }
            );
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.askConfirmation(
              '✖ Partiyi Kapat / İptal Et',
              `"${party.name}" partisini kapatmak (CANCELLED) istediğinize emin misiniz?`,
              'Close Party',
              () => {
                try {
                  partyService.setPartyStatus(this.session, party.id, 'CANCELLED');
                  this.showToast('Parti kapatıldı.', 'info');
                  this.renderPartyLobby();
                } catch (err) {
                  this.showToast(err.message, 'error');
                }
              }
            );
          });
        }

        if (statusSel) {
          statusSel.addEventListener('change', e => {
            try {
              partyService.setPartyStatus(this.session, party.id, e.target.value);
              this.showToast(`Parti durumu ${e.target.value} olarak güncellendi.`, 'info');
              this.renderPartyLobby();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          });
        }

        container.querySelectorAll('.btn-remove-pt').forEach(btn => {
          btn.addEventListener('click', () => {
            const uname = btn.getAttribute('data-username');
            this.askConfirmation(
              '⚠️ Oyuncuyu Çıkar (Remove Player)',
              `"${uname}" adlı oyuncuyu partiden çıkarmak istediğinize emin misiniz?`,
              'Remove Player',
              () => {
                try {
                  partyService.removeParticipant(this.session, party.id, uname);
                  this.showToast(`${uname} partiden çıkarıldı.`, 'info');
                  this.renderPartyLobby();
                } catch (err) {
                  this.showToast(err.message, 'error');
                }
              }
            );
          });
        });
      }
    }

    // ==========================================
    // 5. INVITATION MODAL
    // ==========================================
    openInvitationModal(invData) {
      const modal = document.getElementById('modal-invite');
      const nameEl = document.getElementById('inv-party-name');
      const orgEl = document.getElementById('inv-party-organizer');
      const codeEl = document.getElementById('inv-party-code');

      if (!modal) return;
      if (nameEl) nameEl.textContent = invData.partyName;
      if (orgEl) orgEl.textContent = invData.organizer;
      if (codeEl) codeEl.textContent = invData.inviteCode;

      this.currentInvitationText = invData.invitationText;
      modal.classList.remove('hidden');
    }

    bindInvitationModal() {
      const copyBtn = document.getElementById('btn-copy-invitation');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.copyToClipboard(
            this.currentInvitationText,
            'Player invited successfully — Davetiye panoya kopyalandı!'
          );
        });
      }
    }

    // ==========================================
    // 2, 9, 10, 12. ADMIN PANEL
    // ==========================================
    openAdminPanel() {
      try {
        authGuard.requireRole(this.session, ['ADMIN']);
      } catch (err) {
        window.soundManager.playWrong();
        this.showToast(err.message, 'error');
        return;
      }

      const profileName = document.getElementById('admin-profile-name');
      if (profileName) profileName.textContent = this.session.username;

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-admin');
      }
      this.renderAdminAll();
    }

    bindAdminPanel() {
      // Sidebar Tabs
      document.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const tab = btn.getAttribute('data-admin-tab');
          this.switchAdminTab(tab);
        });
      });

      const goGameBtn = document.getElementById('btn-admin-go-game');
      if (goGameBtn) {
        goGameBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          if (window.mcQuizGame) window.mcQuizGame.returnToMainMenu();
        });
      }

      const viewAllLogsBtn = document.getElementById('btn-dash-view-all-logs');
      if (viewAllLogsBtn) {
        viewAllLogsBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.switchAdminTab('activity');
        });
      }

      // Generate Random License Code
      const genCodeBtn = document.getElementById('btn-adm-gen-code');
      const roleSelect = document.getElementById('adm-lic-role');
      const codeInput = document.getElementById('adm-lic-code');

      if (genCodeBtn && codeInput) {
        genCodeBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const role = roleSelect ? roleSelect.value : 'PLAYER';
          codeInput.value = licenseService.generateRandomCode(role);
        });
      }

      // Create License Submit
      const createLicForm = document.getElementById('form-admin-create-license');
      if (createLicForm) {
        createLicForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const name = document.getElementById('adm-lic-name').value;
            const code = document.getElementById('adm-lic-code').value;
            const role = document.getElementById('adm-lic-role').value;
            const expiresAt = document.getElementById('adm-lic-expires').value || null;
            const assignedUsername = document.getElementById('adm-lic-user').value || null;

            licenseService.createLicense(this.session, {
              name,
              code,
              role,
              expiresAt,
              assignedUsername
            });

            createLicForm.reset();
            window.soundManager.playCorrect();
            this.showToast('License created successfully.', 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Search & Filters
      ['search-adm-licenses', 'filter-adm-licenses'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.renderAdminLicenses());
      });

      ['search-adm-parties', 'filter-adm-parties'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.renderAdminParties());
      });

      const searchPlayers = document.getElementById('search-adm-players');
      if (searchPlayers) {
        searchPlayers.addEventListener('input', () => this.renderAdminPlayers());
      }

      // Quick Party Create from Admin
      const admQuickParty = document.getElementById('btn-adm-quick-party');
      if (admQuickParty) {
        admQuickParty.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            const count = partyService.listParties(this.session).length + 1;
            partyService.createParty(this.session, {
              name: `Minecraft Championship #${count}`,
              maxPlayers: 4
            });
            this.showToast('Party created successfully.', 'success');
            this.renderAdminAll();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // Clear Activity Logs
      const clearLogsBtn = document.getElementById('btn-adm-clear-logs');
      if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
          this.askConfirmation(
            '🗑️ Kayıtları Temizle',
            'Tüm sistem hareket kayıtlarını (Activity Log) temizlemek istediğinize emin misiniz?',
            'Temizle',
            () => {
              try {
                activityService.clearAll(this.session);
                this.showToast('Aktivite kayıtları temizlendi.', 'info');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      }

      // Settings Tab Buttons
      const admAudioBtn = document.getElementById('btn-adm-open-audio');
      if (admAudioBtn) {
        admAudioBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          if (window.mcQuizGame) window.mcQuizGame.openModal('modal-audio');
        });
      }

      const admLogoutBtn = document.getElementById('btn-adm-logout');
      if (admLogoutBtn) {
        admLogoutBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.handleLogout();
        });
      }

      // ==========================================
      // ADMIN ECONOMY CONTROLS (SECTIONS 27, 28, 29)
      // ==========================================
      document.querySelectorAll('[data-adm-econ-op]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const op = btn.getAttribute('data-adm-econ-op');
          const targetUser = (document.getElementById('adm-econ-username')?.value || '').trim();
          const amountVal = Number(document.getElementById('adm-econ-amount')?.value || 0);
          const reasonVal = (document.getElementById('adm-econ-reason')?.value || '').trim();

          if (!targetUser) {
            this.showToast('Lütfen işlem yapılacak oyuncunun kullanıcı adını girin.', 'error');
            return;
          }

          const opLabels = {
            GIVE: `+${amountVal} Emerald Coins eklemek`,
            REMOVE: `-${amountVal} Emerald Coins çıkarmak`,
            SET: `Emerald bakiyesini ${amountVal} olarak ayarlamak`,
            RESET: `Emerald bakiyesini 0 olarak sıfırlamak`
          };

          this.askConfirmation(
            `💚 Admin Economy Action (${op})`,
            `"${targetUser}" adlı oyuncuya ${opLabels[op] || op} istediğinize emin misiniz?`,
            `Confirm ${op}`,
            () => {
              try {
                economyService.adminModifyBalance(this.session, {
                  username: targetUser,
                  operation: op,
                  amount: amountVal,
                  reason: reasonVal || `Admin ${op}`
                });
                window.soundManager.playCorrect();
                this.showToast(`"${targetUser}" Emerald bakiyesi güncellendi (${op}).`, 'success');
                this.syncEconomyHeaderUI();
                this.renderAdminAll();
              } catch (err) {
                window.soundManager.playWrong();
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      });

      // Save Economy & Extra Life Configuration
      const cfgForm = document.getElementById('form-admin-economy-config');
      if (cfgForm) {
        cfgForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const newRewards = {
              gameCompleted: Number(document.getElementById('cfg-reward-completed')?.value || 0),
              gameWon: Number(document.getElementById('cfg-reward-won')?.value || 0),
              top3Finish: Number(document.getElementById('cfg-reward-top3')?.value || 0),
              tournamentWinner: Number(document.getElementById('cfg-reward-tournament')?.value || 0),
              dailyLogin: Number(document.getElementById('cfg-reward-daily')?.value || 0)
            };
            const newExtraLife = {
              price: Number(document.getElementById('cfg-extralife-price')?.value || 500),
              maxPerGame: Number(document.getElementById('cfg-extralife-max')?.value || 1),
              enabled: document.getElementById('cfg-extralife-enabled')?.value === 'true'
            };

            configService.updateConfig(this.session, {
              rewards: newRewards,
              extraLife: newExtraLife
            });

            window.soundManager.playCorrect();
            this.showToast('Economy & Extra Life konfigürasyonu kaydedildi!', 'success');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Create New Shop Item
      const createShopForm = document.getElementById('form-admin-create-shop-item');
      if (createShopForm) {
        createShopForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const name = document.getElementById('adm-shop-name')?.value || '';
            const icon = document.getElementById('adm-shop-icon')?.value || '💎';
            const price = Number(document.getElementById('adm-shop-price')?.value || 500);
            const effectType = document.getElementById('adm-shop-effect')?.value || 'EXTRA_LIFE';
            const description = document.getElementById('adm-shop-desc')?.value || '';

            shopService.adminSaveShopItem(this.session, {
              name,
              icon,
              price,
              effectType,
              description,
              enabled: true
            });

            createShopForm.reset();
            window.soundManager.playCorrect();
            this.showToast('Yeni Emerald Shop ürünü oluşturuldu!', 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Global Transaction History Search
      const searchTx = document.getElementById('search-adm-tx-history');
      if (searchTx) {
        searchTx.addEventListener('input', () => this.renderAdminEconomyTab());
      }
    }

    switchAdminTab(tabName) {
      document.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === tabName);
      });
      document.querySelectorAll('.admin-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `admin-tab-${tabName}`);
      });
      this.renderAdminAll();
    }

    renderAdminAll() {
      if (!this.session || this.session.role !== 'ADMIN') return;
      this.renderAdminDashboard();
      this.renderAdminEconomyTab();
      this.renderAdminLicenses();
      this.renderAdminParties();
      this.renderAdminPlayers();
      this.renderAdminActivity();
    }

    renderAdminDashboard() {
      const licenses = licenseService.listLicensesForAdmin(this.session);
      const parties = partyService.listParties(this.session);
      const logs = activityService.getAll();
      const econProfiles = economyService.getAllProfiles();
      const cfg = configService.getConfig();

      const totalLic = licenses.length;
      const activeLic = licenses.filter(l => l.effectiveStatus === 'ACTIVE').length;
      const revokedLic = licenses.filter(l => l.effectiveStatus === 'REVOKED').length;

      const totalParties = parties.length;
      const activeParties = parties.filter(p =>
        ['WAITING', 'READY', 'STARTING', 'ACTIVE'].includes(p.status)
      ).length;
      const totalParticipants = parties.reduce((sum, p) => sum + p.participants.length, 0);

      const totalEmeralds = econProfiles.reduce((sum, p) => sum + (p.emeraldCoins || 0), 0);
      const totalExtraLivesUsed = econProfiles.reduce(
        (sum, p) => sum + (p.extraLivesUsed || 0),
        0
      );

      document.getElementById('adm-metric-total-lic').textContent = totalLic;
      document.getElementById('adm-metric-active-lic').textContent = activeLic;
      document.getElementById('adm-metric-revoked-lic').textContent = revokedLic;
      document.getElementById('adm-metric-total-parties').textContent = totalParties;
      document.getElementById('adm-metric-active-parties').textContent = activeParties;
      document.getElementById('adm-metric-total-participants').textContent = totalParticipants;

      const emEl = document.getElementById('adm-metric-total-emeralds');
      const exEl = document.getElementById('adm-metric-extralives-used');
      const stEx = document.getElementById('adm-status-extralife');

      if (emEl) emEl.textContent = `${totalEmeralds.toLocaleString('tr-TR')} 💚`;
      if (exEl) exEl.textContent = totalExtraLivesUsed;
      if (stEx) {
        stEx.textContent = cfg.extraLife.enabled ? 'ENABLED' : 'DISABLED';
        stEx.className = cfg.extraLife.enabled ? 'emerald-text' : 'wrong-text';
      }

      const recentEl = document.getElementById('adm-dash-recent-activity');
      if (recentEl) {
        const recent = logs.slice(0, 7);
        recentEl.innerHTML =
          recent.length === 0
            ? '<div class="empty-state-box">Henüz aktivite kaydı yok.</div>'
            : recent
                .map(
                  item => `
                <div class="activity-item">
                  <span class="act-time">[${item.timeFormatted}]</span>
                  <span class="act-msg">${this.escapeHtml(item.message)}</span>
                </div>
              `
                )
                .join('');
      }
    }

    renderAdminEconomyTab() {
      const cfg = configService.getConfig();
      const econProfiles = economyService.getAllProfiles();

      // Populate players datalist for quick selection
      const datalist = document.getElementById('adm-econ-players-datalist');
      if (datalist) {
        datalist.innerHTML = econProfiles
          .map(
            p =>
              `<option value="${this.escapeHtml(p.username)}">${this.escapeHtml(
                p.username
              )} (💚 ${p.emeraldCoins} Emeralds | ⭐ ${p.totalPoints} Pts)</option>`
          )
          .join('');
      }

      // Populate Config Form Inputs
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = v;
      };
      setVal('cfg-reward-completed', cfg.rewards.gameCompleted);
      setVal('cfg-reward-won', cfg.rewards.gameWon);
      setVal('cfg-reward-top3', cfg.rewards.top3Finish);
      setVal('cfg-reward-tournament', cfg.rewards.tournamentWinner);
      setVal('cfg-reward-daily', cfg.rewards.dailyLogin);
      setVal('cfg-extralife-price', cfg.extraLife.price);
      setVal('cfg-extralife-max', cfg.extraLife.maxPerGame);
      setVal('cfg-extralife-enabled', String(cfg.extraLife.enabled));

      // Populate Shop Items List for Admin
      const shopWrap = document.getElementById('adm-shop-items-list');
      if (shopWrap) {
        const items = shopService.listShopItems(true);
        shopWrap.innerHTML = items
          .map(
            item => `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span style="font-size:1.35rem;">${this.escapeHtml(item.icon)}</span>
                  <span class="adm-code-title">${this.escapeHtml(item.name)}</span>
                  <span class="status-pill status-${item.enabled ? 'ACTIVE' : 'DISABLED'}">${
                    item.enabled ? 'ENABLED' : 'DISABLED'
                  }</span>
                  <strong class="emerald-text">💚 ${item.price.toLocaleString(
                    'tr-TR'
                  )} Emeralds</strong>
                </div>
                <div class="adm-row-sub">
                  <span>Effect: <strong>${item.effectType}</strong></span>
                  <span>Max/Game: <strong>${item.maxPerGame}</strong></span>
                  <span>"${this.escapeHtml(item.description)}"</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn" data-shop-adm="price" data-id="${this.escapeHtml(
                  item.id
                )}" data-price="${item.price}">Change Price</button>
                <button type="button" class="act-btn ${
                  item.enabled ? 'danger' : 'emerald'
                }" data-shop-adm="toggle" data-id="${this.escapeHtml(item.id)}" data-enabled="${
                  item.enabled
                }">${item.enabled ? 'Disable Item' : 'Enable Item'}</button>
              </div>
            </div>
          `
          )
          .join('');

        shopWrap.querySelectorAll('[data-shop-adm]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.soundManager.playClick();
            const act = btn.getAttribute('data-shop-adm');
            const id = btn.getAttribute('data-id');
            const allItems = shopService.listShopItems(true);
            const target = allItems.find(x => x.id === id);
            if (!target) return;

            if (act === 'toggle') {
              shopService.adminSaveShopItem(this.session, {
                ...target,
                enabled: !target.enabled
              });
              this.showToast(
                `${target.name} durumu ${!target.enabled ? 'ENABLED' : 'DISABLED'} yapıldı.`,
                'info'
              );
              this.renderAdminAll();
            } else if (act === 'price') {
              const rawNewPrice = prompt(
                `"${target.name}" için yeni Emerald Coin fiyatını girin:`,
                String(target.price)
              );
              if (rawNewPrice !== null && rawNewPrice.trim() !== '') {
                const parsed = Math.max(0, Math.floor(Number(rawNewPrice)));
                if (!Number.isNaN(parsed)) {
                  shopService.adminSaveShopItem(this.session, {
                    ...target,
                    price: parsed
                  });
                  this.showToast(`${target.name} fiyatı ${parsed} Emeralds olarak güncellendi.`, 'success');
                  this.renderAdminAll();
                }
              }
            }
          });
        });
      }

      // Populate Global Transaction History
      const txListEl = document.getElementById('adm-tx-history-list');
      if (txListEl) {
        const q = (document.getElementById('search-adm-tx-history')?.value || '')
          .toLowerCase()
          .trim();
        let allTxs = economyService.getTransactionHistory(this.session, null);
        if (q) {
          allTxs = allTxs.filter(
            tx =>
              tx.username.toLowerCase().includes(q) ||
              tx.reason.toLowerCase().includes(q) ||
              tx.type.toLowerCase().includes(q)
          );
        }

        if (allTxs.length === 0) {
          txListEl.innerHTML = '<div class="empty-state-box">Kayıtlı işlem bulunamadı.</div>';
        } else {
          txListEl.innerHTML = allTxs
            .slice(0, 80)
            .map(tx => {
              const isNeg = tx.amount < 0;
              const sign = tx.amount > 0 ? '+' : '';
              const amtStr =
                tx.amount === 0
                  ? '❤️ 1 Extra Life Used'
                  : `${sign}${tx.amount.toLocaleString('tr-TR')} Emeralds`;
              return `
                <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
                  <div class="tx-main">
                    <span class="tx-reason"><strong>⛏️ ${this.escapeHtml(
                      tx.username
                    )}</strong> — ${this.escapeHtml(tx.reason)}</span>
                    <span class="tx-meta">[${tx.dateFormatted}] • Type: ${
                      tx.type
                    } • Balance After: 💚 ${tx.balanceAfter.toLocaleString('tr-TR')} Emeralds</span>
                  </div>
                  <div class="tx-amount ${isNeg ? 'wrong-text' : 'emerald-text'}">${amtStr}</div>
                </div>
              `;
            })
            .join('');
        }
      }
    }

    renderAdminLicenses() {
      const wrap = document.getElementById('adm-licenses-list');
      if (!wrap) return;

      const q = (document.getElementById('search-adm-licenses')?.value || '').toLowerCase().trim();
      const statusFilter = document.getElementById('filter-adm-licenses')?.value || 'ALL';

      let list = licenseService.listLicensesForAdmin(this.session);
      if (statusFilter !== 'ALL') {
        list = list.filter(l => l.effectiveStatus === statusFilter);
      }
      if (q) {
        list = list.filter(
          l =>
            l.code.toLowerCase().includes(q) ||
            l.name.toLowerCase().includes(q) ||
            (l.assignedUsername || '').toLowerCase().includes(q)
        );
      }

      if (list.length === 0) {
        wrap.innerHTML = '<div class="empty-state-box">Filtreye uygun lisans bulunamadı.</div>';
        return;
      }

      wrap.innerHTML = list
        .map(l => {
          const createdStr = new Date(l.createdAt).toLocaleDateString('tr-TR');
          const expiresStr = l.expiresAt
            ? new Date(l.expiresAt).toLocaleDateString('tr-TR')
            : 'Never';
          const sessionInfo = l.currentSessionUser
            ? `🟢 Kullanımda: ${this.escapeHtml(l.currentSessionUser)}`
            : l.assignedUsername
            ? `👤 Atanan: ${this.escapeHtml(l.assignedUsername)}`
            : 'Boşta';

          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span class="adm-code-title">${this.escapeHtml(l.code)}</span>
                  <span class="role-badge role-${l.role.toLowerCase()}">${l.role}</span>
                  <span class="status-pill status-${l.effectiveStatus}">${l.effectiveStatus}</span>
                  <strong>${this.escapeHtml(l.name)}</strong>
                </div>
                <div class="adm-row-sub">
                  <span>📅 Created: ${createdStr}</span>
                  <span>⏳ Expires: <strong>${expiresStr}</strong></span>
                  <span>${sessionInfo}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-lic-action="copy" data-code="${this.escapeHtml(
                  l.code
                )}">Copy</button>
                ${
                  l.effectiveStatus === 'ACTIVE'
                    ? `<button type="button" class="act-btn" data-lic-action="disable" data-id="${l.id}">Disable</button>`
                    : `<button type="button" class="act-btn emerald" data-lic-action="activate" data-id="${l.id}">Reactivate</button>`
                }
                ${
                  l.effectiveStatus !== 'REVOKED'
                    ? `<button type="button" class="act-btn danger" data-lic-action="revoke" data-id="${l.id}">Revoke</button>`
                    : ''
                }
                <button type="button" class="act-btn danger" data-lic-action="delete" data-id="${l.id}">Delete</button>
              </div>
            </div>
          `;
        })
        .join('');

      wrap.querySelectorAll('[data-lic-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const action = btn.getAttribute('data-lic-action');
          const id = btn.getAttribute('data-id');
          const code = btn.getAttribute('data-code');

          if (action === 'copy') {
            this.copyToClipboard(code, `Lisans kodu kopyalandı: ${code}`);
          } else if (action === 'disable') {
            licenseService.updateLicenseStatus(this.session, id, 'DISABLED');
            this.showToast('Lisans devre dışı bırakıldı (Disabled).', 'info');
            this.renderAdminAll();
          } else if (action === 'activate') {
            licenseService.updateLicenseStatus(this.session, id, 'ACTIVE');
            this.showToast('Lisans yeniden aktif edildi (Activated).', 'success');
            this.renderAdminAll();
          } else if (action === 'revoke') {
            this.askConfirmation(
              '⚠️ Lisansı İptal Et (Revoke License)',
              'Are you sure you want to revoke this license?',
              'Revoke',
              () => {
                licenseService.updateLicenseStatus(this.session, id, 'REVOKED');
                this.showToast('License revoked.', 'info');
                this.renderAdminAll();
              }
            );
          } else if (action === 'delete') {
            this.askConfirmation(
              '🗑️ Lisansı Sil (Delete License)',
              'Bu lisansı kalıcı olarak silmek istediğinize emin misiniz?',
              'Delete',
              () => {
                licenseService.deleteLicense(this.session, id);
                this.showToast('Lisans silindi.', 'info');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    renderAdminParties() {
      const wrap = document.getElementById('adm-parties-list');
      if (!wrap) return;

      const q = (document.getElementById('search-adm-parties')?.value || '').toLowerCase().trim();
      const statusFilter = document.getElementById('filter-adm-parties')?.value || 'ALL';

      let parties = partyService.listParties(this.session);
      if (statusFilter !== 'ALL') {
        parties = parties.filter(p => p.status === statusFilter);
      }
      if (q) {
        parties = parties.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            p.organizer.toLowerCase().includes(q) ||
            p.inviteCode.toLowerCase().includes(q)
        );
      }

      if (parties.length === 0) {
        wrap.innerHTML = '<div class="empty-state-box">Kayıtlı parti bulunamadı.</div>';
        return;
      }

      wrap.innerHTML = parties
        .map(p => {
          const joinedCount = p.participants.filter(pt => pt.joinStatus === 'JOINED').length;
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span class="adm-code-title">${this.escapeHtml(p.name)}</span>
                  <span class="status-pill status-${p.status}">${p.status}</span>
                  <span class="meta-muted">(${p.id})</span>
                </div>
                <div class="adm-row-sub">
                  <span>👑 Organizer: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                  <span>👥 Players: <strong>${joinedCount} / ${p.maxPlayers}</strong></span>
                  <span>🎟️ Invite Code: <strong class="emerald-text">${p.inviteCode}</strong></span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-prt-action="inspect" data-id="${p.id}">Inspect / Manage</button>
                <button type="button" class="act-btn emerald" data-prt-action="forcestart" data-id="${p.id}">Force Start</button>
                <button type="button" class="act-btn" data-prt-action="transfer" data-id="${p.id}">Transfer Owner</button>
                <button type="button" class="act-btn danger" data-prt-action="cancel" data-id="${p.id}">Cancel</button>
                <button type="button" class="act-btn danger" data-prt-action="delete" data-id="${p.id}">Delete</button>
              </div>
            </div>
          `;
        })
        .join('');

      wrap.querySelectorAll('[data-prt-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-prt-action');
          const id = btn.getAttribute('data-id');

          if (act === 'inspect') {
            this.selectedPartyId = id;
            this.openPartyLobby();
          } else if (act === 'forcestart') {
            partyService.setPartyStatus(this.session, id, 'ACTIVE');
            this.showToast('Parti Admin tarafından başlatıldı (Force Started).', 'success');
            this.renderAdminAll();
          } else if (act === 'transfer') {
            const newOwner = prompt('Yeni parti sahibinin (Organizer) Minecraft kullanıcı adını girin:');
            if (newOwner && newOwner.trim()) {
              try {
                partyService.transferOwnership(this.session, id, newOwner.trim());
                this.showToast(`Parti sahipliği ${newOwner.trim()} kullanıcısına devredildi.`, 'success');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          } else if (act === 'cancel') {
            this.askConfirmation(
              '✖ Partiyi İptal Et',
              'Bu partiyi CANCELLED durumuna getirmek istediğinize emin misiniz?',
              'Cancel Party',
              () => {
                partyService.setPartyStatus(this.session, id, 'CANCELLED');
                this.showToast('Parti iptal edildi.', 'info');
                this.renderAdminAll();
              }
            );
          } else if (act === 'delete') {
            this.askConfirmation(
              '🗑️ Partiyi Sil',
              'Bu partiyi tamamen silmek istediğinize emin misiniz?',
              'Delete Party',
              () => {
                partyService.deleteParty(this.session, id);
                this.showToast('Parti silindi.', 'info');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    renderAdminPlayers() {
      const wrap = document.getElementById('adm-players-list');
      if (!wrap) return;

      const q = (document.getElementById('search-adm-players')?.value || '').toLowerCase().trim();
      const players = playerService.getAllPlayers();
      const ranked = leaderboardService.getLeaderboard({ limit: 50, search: q });

      wrap.innerHTML = ranked
        .map(r => {
          const pInfo = players.find(
            x => x.username.toLowerCase() === r.username.toLowerCase()
          ) || {
            role: 'PLAYER',
            status: 'OFFLINE',
            licenseId: 'STD',
            lastSeenAt: Date.now()
          };
          const seen = new Date(pInfo.lastSeenAt).toLocaleString('tr-TR');
          const extraOwned =
            (r.inventory?.extraLives || 0) + (r.inventory?.secondChance || 0);

          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span class="gold-text" style="font-family:var(--font-display); font-weight:800;">#${r.rank}</span>
                  <strong>⛏️ ${this.escapeHtml(r.username)}</strong>
                  <span class="role-badge role-${pInfo.role.toLowerCase()}">${pInfo.role}</span>
                  <span class="status-pill status-${
                    pInfo.status === 'ONLINE' ? 'ACTIVE' : 'DISABLED'
                  }">${pInfo.status}</span>
                </div>
                <div class="adm-row-sub">
                  <span>⭐ Points: <strong class="gold-text">${r.totalPoints.toLocaleString(
                    'tr-TR'
                  )}</strong></span>
                  <span>💚 Balance: <strong class="emerald-text">${r.emeraldCoins.toLocaleString(
                    'tr-TR'
                  )} Emerald Coins</strong></span>
                  <span>🎮 Games: <strong>${r.gamesPlayed} (${r.gamesWon}W / ${
                    r.gamesLost
                  }L)</strong></span>
                  <span>❤️ Extra Lives: <strong>${extraOwned} Owned / ${
                    r.extraLivesUsed
                  } Used</strong></span>
                  <span>🕒 Son Görülme: ${seen}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald btn-adm-manage-player-econ" data-username="${this.escapeHtml(
                  r.username
                )}">💚 Manage Emeralds</button>
              </div>
            </div>
          `;
        })
        .join('');

      wrap.querySelectorAll('.btn-adm-manage-player-econ').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const uname = btn.getAttribute('data-username');
          this.switchAdminTab('economy');
          const inp = document.getElementById('adm-econ-username');
          if (inp) {
            inp.value = uname;
            inp.focus();
          }
        });
      });
    }

    renderAdminActivity() {
      const wrap = document.getElementById('adm-full-activity-list');
      if (!wrap) return;

      const logs = activityService.getAll();
      if (logs.length === 0) {
        wrap.innerHTML = '<div class="empty-state-box">Kayıtlı sistem hareketi bulunmuyor.</div>';
        return;
      }

      wrap.innerHTML = logs
        .map(
          item => `
          <div class="activity-item">
            <span class="act-time">[${item.timeFormatted}]</span>
            <span class="act-msg">${this.escapeHtml(item.message)}</span>
          </div>
        `
        )
        .join('');
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    copyToClipboard(text, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => this.showToast(successMsg, 'success'))
          .catch(() => this.fallbackCopy(text, successMsg));
      } else {
        this.fallbackCopy(text, successMsg);
      }
    }

    fallbackCopy(text, successMsg) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        this.showToast(successMsg, 'success');
      } catch (e) {
        this.showToast('Kopyalama başarısız oldu.', 'error');
      }
      ta.remove();
    }

    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.mcmPlatform = new TournamentPlatformController();
  });
})();
