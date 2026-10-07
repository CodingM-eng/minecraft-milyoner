/**
 * MINECRAFT MILYONER — TOURNAMENT, ACCOUNT, PARTY, VIP, ECONOMY & ADMIN CONTROLLER
 *
 * Connects all UI views to the modular service layer:
 * - Step-by-Step License -> Username Login & Welcome Back flow
 * - User Dashboard & VIP Dashboard
 * - Party System (Strict VIP/ADMIN create & invite; PLAYER join/leave; NEVER resets license/account)
 * - Leaderboard (Sort by Points, Wins, Emeralds, Games Played + Top 3 Podium)
 * - Emerald Shop & Rank Shop (Categories: Gameplay, Ranks, Cosmetics, VIP, Special)
 * - Separate VIP Shop (200 TL VIP Package via paymentService abstraction)
 * - Player Profile, Achievements & RGB Username Cosmetics
 * - Support Tickets, Bug Reports & Suggestions (with automatic VIP HIGH Priority)
 * - Account Settings (Immutable User ID username change, salted SHA-256 password hash, Cosmetics)
 * - 16-Page English-Only Admin Panel (Dashboard, Users, Licenses, Parties, Leaderboard,
 *   Economy, Shop, VIP, Support, Bug Reports, Suggestions, Transactions, Achievements,
 *   Backups, Activity Logs, Settings)
 */

(function () {
  'use strict';

  const {
    authGuard,
    userService,
    licenseService,
    partyService,
    supportService,
    paymentService,
    backupService,
    activityService,
    configService,
    rankService,
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
      this.pendingLicenseToken = null;
      this.selectedPartyId = null;
      this.currentInvitationText = '';
      this.confirmCallback = null;
      this.leaderboardLimit = 10;
      this.leaderboardSort = 'POINTS';
      this.selectedShopCategory = 'ALL';
      this.extraLifeCallbacks = null;
      this.leaderboardRefreshTimer = null;
      this.activeCheckoutSession = null;

      this.init();
    }

    init() {
      this.bindLicenseGate();
      this.bindTopBar();
      this.bindPartyLobby();
      this.bindLeaderboardScreen();
      this.bindEmeraldShopScreen();
      this.bindVipShopScreen();
      this.bindStripeCheckoutModal();
      this.bindProfileAndCosmetics();
      this.bindSupportHub();
      this.bindAccountSettings();
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
      }, 10000);

      // Check URL for ?invite=MCM-XXXX parameter
      try {
        const params = new URLSearchParams(window.location.search);
        const inviteParam = params.get('invite');
        if (inviteParam) {
          this.pendingInviteCodeFromUrl = inviteParam.trim().toUpperCase();
        }
      } catch (e) {}

      // 1. Check active session in storage
      const existingSession = licenseService.getActiveSession();
      if (existingSession) {
        this.applyAuthenticatedSession(existingSession, false);
        return;
      }

      // 2. Check remembered account for "WELCOME BACK" screen
      const remembered = licenseService.getRememberedUser();
      if (remembered && remembered.username) {
        this.lockWithLicenseGate(true);
      } else {
        this.lockWithLicenseGate(false);
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
      if (titleEl) titleEl.textContent = title || '⚠️ Confirm Action';
      if (msgEl) msgEl.textContent = message || 'Are you sure you want to proceed?';
      if (acceptText) acceptText.textContent = acceptLabel || 'Confirm';

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
    // SECTION 1 & 2: STEP-BY-STEP LOGIN & WELCOME BACK GATE
    // ==========================================
    lockWithLicenseGate(showWelcomeBack = false) {
      this.session = null;
      this.pendingLicenseToken = null;
      if (window.mcQuizGame) {
        window.mcQuizGame.isUnlocked = false;
      }
      document.body.classList.add('gate-locked');

      const gateEl = document.getElementById('access-gate');
      const wbStep = document.getElementById('gate-step-welcome-back');
      const licForm = document.getElementById('gate-form-license');
      const userForm = document.getElementById('gate-form-username');
      const errorEl = document.getElementById('access-gate-error');
      const loadingEl = document.getElementById('access-gate-loading');
      const inputEl = document.getElementById('access-code-input');

      if (gateEl) gateEl.classList.remove('hidden');
      if (errorEl) errorEl.classList.add('hidden');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (userForm) userForm.classList.add('hidden');

      const remembered = licenseService.getRememberedUser();
      if (showWelcomeBack && remembered && remembered.username) {
        if (wbStep) wbStep.classList.remove('hidden');
        if (licForm) licForm.classList.add('hidden');
        const wbName = document.getElementById('wb-username-display');
        const wbRole = document.getElementById('wb-role-badge');
        const wbLic = document.getElementById('wb-license-badge');
        if (wbName) wbName.textContent = remembered.username;
        if (wbRole) {
          wbRole.textContent = remembered.role || 'PLAYER';
          wbRole.className = `role-badge role-${String(remembered.role || 'player').toLowerCase()}`;
        }
        if (wbLic) wbLic.textContent = remembered.licenseName || 'Saved License';
      } else {
        if (wbStep) wbStep.classList.add('hidden');
        if (licForm) licForm.classList.remove('hidden');
        if (inputEl) {
          inputEl.value = '';
          setTimeout(() => inputEl.focus(), 60);
        }
      }

      this.updateTopBarSessionUI();
    }

    bindLicenseGate() {
      const gateEl = document.getElementById('access-gate');
      const gateCard = gateEl ? gateEl.querySelector('.gate-card') : null;
      const wbStep = document.getElementById('gate-step-welcome-back');
      const wbContinueBtn = document.getElementById('btn-wb-continue');
      const wbSwitchBtn = document.getElementById('btn-wb-switch-account');

      const licForm = document.getElementById('gate-form-license');
      const codeInput = document.getElementById('access-code-input');
      const errorEl = document.getElementById('access-gate-error');
      const loadingEl = document.getElementById('access-gate-loading');
      const submitLicBtn = document.getElementById('btn-license-submit');
      const visBtn = document.getElementById('btn-toggle-code-vis');

      const userForm = document.getElementById('gate-form-username');
      const verifiedLicNameEl = document.getElementById('gate-verified-lic-name');
      const userInput = document.getElementById('access-username-input');
      const pwdInput = document.getElementById('access-password-input');
      const userErrorEl = document.getElementById('access-username-error');
      const backToLicBtn = document.getElementById('btn-gate-back-to-license');
      const submitUserBtn = document.getElementById('btn-username-submit');

      if (visBtn && codeInput) {
        visBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const isPwd = codeInput.type === 'password';
          codeInput.type = isPwd ? 'text' : 'password';
          visBtn.textContent = isPwd ? '🙈' : '👁️';
          codeInput.focus();
        });
      }

      // Welcome Back -> Continue
      if (wbContinueBtn) {
        wbContinueBtn.addEventListener('click', () => {
          window.soundManager.playCorrect();
          const resumed = licenseService.resumeRememberedAccount();
          if (resumed) {
            this.applyAuthenticatedSession(resumed, true);
          } else {
            this.lockWithLicenseGate(false);
          }
        });
      }

      // Welcome Back -> Switch Account
      if (wbSwitchBtn) {
        wbSwitchBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.lockWithLicenseGate(false);
        });
      }

      // Step 1: Validate License Code
      if (licForm && codeInput) {
        licForm.addEventListener('submit', async e => {
          e.preventDefault();
          const rawCode = codeInput.value.trim();

          if (errorEl) errorEl.classList.add('hidden');
          if (loadingEl) loadingEl.classList.remove('hidden');
          if (submitLicBtn) submitLicBtn.disabled = true;

          const res = await licenseService.validateLicenseStep(rawCode);

          if (loadingEl) loadingEl.classList.add('hidden');
          if (submitLicBtn) submitLicBtn.disabled = false;

          if (!res.ok) {
            window.soundManager.playWrong();
            if (errorEl) {
              errorEl.textContent = `❌ ${res.error}`;
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

          // License valid -> Move to Step 2 (Enter Minecraft Username)
          window.soundManager.playClick();
          this.pendingLicenseToken = res.licenseToken;
          if (wbStep) wbStep.classList.add('hidden');
          licForm.classList.add('hidden');
          if (userForm) userForm.classList.remove('hidden');
          if (userErrorEl) userErrorEl.classList.add('hidden');

          if (verifiedLicNameEl) {
            verifiedLicNameEl.textContent = `${res.licenseToken.licenseName} (${res.licenseToken.role})`;
          }
          if (userInput) {
            userInput.value = res.licenseToken.suggestedUsername || '';
            setTimeout(() => userInput.focus(), 60);
          }
        });
      }

      // Back to Step 1
      if (backToLicBtn) {
        backToLicBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.pendingLicenseToken = null;
          if (userForm) userForm.classList.add('hidden');
          if (licForm) licForm.classList.remove('hidden');
        });
      }

      // Step 2: Enter Minecraft Username -> Create/Load Account -> Dashboard
      if (userForm && userInput) {
        userForm.addEventListener('submit', async e => {
          e.preventDefault();
          if (!this.pendingLicenseToken) {
            this.lockWithLicenseGate(false);
            return;
          }

          const usernameVal = userInput.value.trim();
          const pwdVal = pwdInput ? pwdInput.value : '';
          if (userErrorEl) userErrorEl.classList.add('hidden');
          if (submitUserBtn) submitUserBtn.disabled = true;

          const res = await licenseService.completeAccountStep(
            this.pendingLicenseToken,
            usernameVal,
            pwdVal
          );

          if (submitUserBtn) submitUserBtn.disabled = false;

          if (!res.ok) {
            window.soundManager.playWrong();
            if (userErrorEl) {
              userErrorEl.textContent = `❌ ${res.error}`;
              userErrorEl.classList.remove('hidden');
            }
            return;
          }

          window.soundManager.playCorrect();
          if (pwdInput) pwdInput.value = '';
          this.applyAuthenticatedSession(res.session, true);
        });
      }
    }

    applyAuthenticatedSession(session, isFreshLogin = false) {
      this.session = licenseService.refreshSessionRole(session) || session;
      document.body.classList.remove('gate-locked');

      const gateEl = document.getElementById('access-gate');
      if (gateEl) gateEl.classList.add('hidden');

      // Ensure economy profile & user account are synchronized
      economyService.getOrCreateAccount(this.session.username, this.session.role);

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

      // If URL had ?invite=MCM-XXXX, automatically join or open party lobby
      if (this.pendingInviteCodeFromUrl) {
        const code = this.pendingInviteCodeFromUrl;
        this.pendingInviteCodeFromUrl = null;
        try {
          const joined = partyService.joinPartyByInviteCode(this.session, code);
          this.selectedPartyId = joined.id;
          this.showToast(`You joined the party "${joined.name}" successfully.`, 'success');
          this.navigateToScreen('screen-party');
          return;
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }

      if (isFreshLogin) {
        const effRole = authGuard.getEffectiveRole(this.session);
        if (effRole === 'ADMIN') {
          this.showToast(`Welcome back, ${this.session.username}! Admin Panel unlocked.`, 'info');
        } else if (effRole === 'VIP') {
          this.showToast(`Welcome, 👑 VIP ${this.session.username}!`, 'success');
        } else {
          this.showToast(`Welcome, ${this.session.username}!`, 'success');
        }
      }
    }

    handleLogout(clearRemembered = false) {
      licenseService.logout(clearRemembered);
      this.showToast('Signed out. You can continue with your saved account or switch license.', 'info');
      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-menu');
      }
      this.lockWithLicenseGate(!clearRemembered);
    }

    // ==========================================
    // RGB USERNAME HELPER (SECTION 13)
    // ==========================================
    formatUsernameHtml(username, forceRgb = null) {
      const clean = this.escapeHtml(username);
      let isRgb = forceRgb;
      if (isRgb === null && username) {
        const prof = economyService.getPlayerEconomyProfile(username);
        isRgb = Boolean(prof && prof.rgbOwned && prof.rgbEnabled);
      }
      if (isRgb) {
        return `<span class="rgb-username-text">🌈 ${clean}</span>`;
      }
      return clean;
    }

    // ==========================================
    // TOP BAR, NAVIGATION & USER/VIP DASHBOARD
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
      const logoutBtn = document.getElementById('btn-top-logout');

      if (!this.session) {
        if (navBar) navBar.classList.add('hidden');
        if (emeraldPill) emeraldPill.classList.add('hidden');
        if (dailyBtn) dailyBtn.classList.add('hidden');
        if (badge) badge.classList.add('hidden');
        if (adminBtn) adminBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        return;
      }

      const effRole = authGuard.getEffectiveRole(this.session);
      this.session.role = effRole;

      if (navBar) navBar.classList.remove('hidden');
      if (navAdminBtn) navAdminBtn.classList.toggle('hidden', effRole !== 'ADMIN');
      if (emeraldPill) emeraldPill.classList.remove('hidden');
      if (dailyBtn) dailyBtn.classList.remove('hidden');
      if (badge) badge.classList.remove('hidden');
      if (nameEl) {
        nameEl.innerHTML = this.formatUsernameHtml(this.session.username);
      }
      if (roleEl) {
        roleEl.textContent = effRole;
        roleEl.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (adminBtn) {
        adminBtn.classList.toggle('hidden', effRole !== 'ADMIN');
      }
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    }

    syncEconomyHeaderUI() {
      if (!this.session) return;
      this.session = licenseService.refreshSessionRole(this.session) || this.session;
      const effRole = authGuard.getEffectiveRole(this.session);
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const rankSummary = leaderboardService.getPlayerRankAndSummary(this.session.username);
      const dailyStatus = dailyRewardService.canClaimDailyReward(this.session.username);

      const extraOwned =
        (profile.inventory?.extraLives || 0) + (profile.inventory?.secondChance || 0);

      // Top Header Pill
      const topBal = document.getElementById('top-emerald-balance');
      const topExtra = document.getElementById('top-extralives-count');
      if (topBal) topBal.textContent = profile.emeraldCoins.toLocaleString('en-US');
      if (topExtra) topExtra.textContent = extraOwned;

      // Game Stage Extra Life Pill
      const gameExtra = document.getElementById('game-extralife-count');
      if (gameExtra) gameExtra.textContent = extraOwned;

      // User Dashboard Welcome & VIP Banner (Sections 31 & 32)
      const dashUserEl = document.getElementById('dash-welcome-username');
      const dashRoleBadge = document.getElementById('dash-welcome-role-badge');
      const dashRankBadge = document.getElementById('dash-welcome-rank-badge');
      const vipDashPanel = document.getElementById('vip-dashboard-panel');
      const vipDashExpiry = document.getElementById('vip-dash-expiry');

      if (dashUserEl) {
        dashUserEl.innerHTML = this.formatUsernameHtml(this.session.username, profile.rgbOwned && profile.rgbEnabled);
      }
      if (dashRoleBadge) {
        dashRoleBadge.textContent = effRole;
        dashRoleBadge.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (dashRankBadge) {
        dashRankBadge.textContent = profile.rankBadge || `⛏️ ${effRole}`;
      }

      const isVipOrAdmin = effRole === 'VIP' || effRole === 'ADMIN' || profile.isVip;
      if (vipDashPanel) {
        vipDashPanel.classList.toggle('hidden', !isVipOrAdmin);
      }
      if (vipDashExpiry && profile.vipStatus) {
        vipDashExpiry.textContent = profile.vipStatus.expiresAt
          ? `Expires: ${new Date(profile.vipStatus.expiresAt).toLocaleDateString('en-US')}`
          : 'Lifetime VIP Access';
      }

      // Daily Reward Button State
      const dailyBtn = document.getElementById('btn-daily-reward');
      const dailyLabel = document.getElementById('daily-reward-label');
      const widgetDailyBtn = document.getElementById('btn-widget-claim-daily');
      if (dailyBtn && dailyLabel) {
        if (dailyStatus.canClaim) {
          dailyLabel.textContent = `DAILY (+${dailyStatus.rewardAmount} 💚)`;
          dailyBtn.disabled = false;
        } else {
          dailyLabel.textContent = `STREAK: ${dailyStatus.currentStreak}d`;
          dailyBtn.disabled = false;
        }
      }
      if (widgetDailyBtn) {
        if (dailyStatus.canClaim) {
          widgetDailyBtn.textContent = `🎁 Claim Daily Reward (+${dailyStatus.rewardAmount} 💚)`;
          widgetDailyBtn.disabled = false;
        } else {
          widgetDailyBtn.textContent = `✅ Claimed (Streak: ${dailyStatus.currentStreak}d)`;
          widgetDailyBtn.disabled = true;
        }
      }

      // Dashboard Economy Widget (Section 31)
      const dRank = document.getElementById('dash-econ-rank');
      const dPoints = document.getElementById('dash-econ-points');
      const dEmeralds = document.getElementById('dash-econ-emeralds');
      const dGames = document.getElementById('dash-econ-games');
      const dWins = document.getElementById('dash-econ-wins');
      const dExtra = document.getElementById('dash-econ-extralives');

      if (dRank) dRank.textContent = `#${rankSummary.rank}`;
      if (dPoints) dPoints.textContent = `${profile.totalPoints.toLocaleString('en-US')}`;
      if (dEmeralds) {
        dEmeralds.textContent = `💚 ${profile.emeraldCoins.toLocaleString('en-US')} Emeralds`;
      }
      if (dGames) dGames.textContent = profile.gamesPlayed.toLocaleString('en-US');
      if (dWins) dWins.textContent = profile.gamesWon.toLocaleString('en-US');
      if (dExtra) dExtra.textContent = `❤️ ${extraOwned}`;
    }

    navigateToScreen(screenId) {
      try {
        authGuard.verifySession(this.session);
      } catch (err) {
        this.showToast(err.message, 'error');
        if (!this.session) {
          this.lockWithLicenseGate(false);
        }
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

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen(screenId);
      }

      document.querySelectorAll('[data-nav-screen]').forEach(btn => {
        if (btn.classList.contains('main-nav-btn')) {
          btn.classList.toggle('active', btn.getAttribute('data-nav-screen') === screenId);
        }
      });

      this.syncEconomyHeaderUI();
      if (screenId === 'screen-leaderboard') this.renderLeaderboard();
      if (screenId === 'screen-shop') this.renderEmeraldShop();
      if (screenId === 'screen-vip-shop') this.renderVipShop();
      if (screenId === 'screen-profile') this.renderPlayerProfile();
      if (screenId === 'screen-history') this.renderEmeraldHistory();
      if (screenId === 'screen-support') this.renderSupportHub();
      if (screenId === 'screen-account-settings') this.renderAccountSettings();
    }

    bindTopBar() {
      const adminBtn = document.getElementById('btn-top-admin');
      const logoutBtn = document.getElementById('btn-top-logout');
      const heroPartyBtn = document.getElementById('btn-open-party-hub');
      const heroLbBtn = document.getElementById('btn-open-leaderboard-hero');
      const heroShopBtn = document.getElementById('btn-open-shop-hero');
      const pillShopBtn = document.getElementById('btn-pill-open-shop');
      const sessionBadge = document.getElementById('top-session-badge');
      const dailyBtn = document.getElementById('btn-daily-reward');
      const widgetDailyBtn = document.getElementById('btn-widget-claim-daily');
      const vipCreatePartyBtn = document.getElementById('btn-vip-dash-create-party');
      const vipManagePartyBtn = document.getElementById('btn-vip-dash-manage-party');

      document.querySelectorAll('[data-nav-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const target = btn.getAttribute('data-nav-screen');
          if (target) this.navigateToScreen(target);
        });
      });

      document.querySelectorAll('[data-open-support-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const tab = btn.getAttribute('data-open-support-tab') || 'support';
          this.navigateToScreen('screen-support');
          this.switchSupportTab(tab);
        });
      });

      if (adminBtn) {
        adminBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openAdminPanel();
        });
      }

      if (heroPartyBtn) {
        heroPartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby();
        });
      }

      if (vipCreatePartyBtn) {
        vipCreatePartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby(true);
        });
      }

      if (vipManagePartyBtn) {
        vipManagePartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby(false);
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

      const cardLb = document.getElementById('card-goto-leaderboard');
      const cardShop = document.getElementById('card-goto-shop');
      const cardProf = document.getElementById('card-goto-profile');
      if (cardLb) cardLb.addEventListener('click', () => this.navigateToScreen('screen-leaderboard'));
      if (cardShop) cardShop.addEventListener('click', () => this.navigateToScreen('screen-shop'));
      if (cardProf) cardProf.addEventListener('click', () => this.navigateToScreen('screen-profile'));

      if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.claimDailyReward();
        });
      }

      if (widgetDailyBtn) {
        widgetDailyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.claimDailyReward();
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.handleLogout(false);
        });
      }
    }

    // ==========================================
    // DAILY EMERALD REWARD (Normal +25 / VIP +50)
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
          `🎁 +${res.rewardAmount} Emerald Coins Claimed! (Streak: ${res.streak}d)`,
          'success'
        );
        this.syncEconomyHeaderUI();
      } catch (err) {
        window.soundManager.playWrong();
        this.showToast(err.message, 'error');
      }
    }

    // ==========================================
    // SECTION 26: EXTRA LIFE REVIVE SYSTEM
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

      if (qLabel) qLabel.textContent = `Question ${questionNumber} / 15`;
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
            extraLifeService.useExtraLifeInGame(
              this.session,
              gameId,
              questionNumber,
              this.selectedPartyId
            );
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
    // GAME OUTCOME -> EMERALD & LEADERBOARD REWARDS
    // ==========================================
    onGameFinished(outcome) {
      if (!this.session) return;
      try {
        const res = economyService.recordGameOutcome(this.session, outcome);
        this.syncEconomyHeaderUI();

        if (res.emeraldReward > 0 || res.pointsEarned > 0) {
          this.showToast(
            `🟩 +${res.emeraldReward} Emerald Coins & ⭐ +${res.pointsEarned} Leaderboard Points earned!`,
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
    // SECTION 24: LEADERBOARD SYSTEM UI
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

      document.querySelectorAll('[data-lb-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.leaderboardSort = btn.getAttribute('data-lb-sort') || 'POINTS';
          document.querySelectorAll('[data-lb-sort]').forEach(b => {
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
          this.showToast('Leaderboard refreshed!', 'info');
        });
      }
    }

    renderLeaderboard() {
      if (!this.session) return;
      const searchQ = document.getElementById('input-leaderboard-search')?.value || '';
      const allRanked = leaderboardService.getLeaderboard({
        limit: 50,
        search: '',
        sortBy: this.leaderboardSort
      });
      const filteredRanked = leaderboardService.getLeaderboard({
        limit: this.leaderboardLimit,
        search: searchQ,
        sortBy: this.leaderboardSort
      });
      const currentUserSummary = leaderboardService.getPlayerRank(
        this.session.username,
        this.leaderboardSort
      );

      // 1. Current User Position Banner
      const bannerEl = document.getElementById('leaderboard-current-user-banner');
      if (bannerEl) {
        bannerEl.innerHTML = `
          <div>
            <span>👤 Your Position: </span>
            <strong class="gold-text">#${currentUserSummary.rank} ${this.formatUsernameHtml(
              currentUserSummary.username,
              currentUserSummary.rgbOwned && currentUserSummary.rgbEnabled
            )}</strong>
            <span class="role-badge role-${currentUserSummary.role.toLowerCase()}" style="margin-left:0.4rem;">${currentUserSummary.rankBadge}</span>
          </div>
          <div style="display:flex; gap:1.1rem; flex-wrap:wrap;">
            <span>⭐ Points: <strong>${currentUserSummary.totalPoints.toLocaleString('en-US')}</strong></span>
            <span>💚 Emeralds: <strong class="emerald-text">${currentUserSummary.emeraldCoins.toLocaleString('en-US')}</strong></span>
            <span>🏆 Wins: <strong>${currentUserSummary.gamesWon}</strong></span>
          </div>
        `;
      }

      // 2. Top 3 Podium (2nd Silver, 1st Gold, 3rd Bronze)
      const podiumEl = document.getElementById('leaderboard-podium');
      if (podiumEl) {
        const top1 = allRanked[0];
        const top2 = allRanked[1];
        const top3 = allRanked[2];
        const podiumOrder = [
          { data: top2, rank: '2nd', medal: '🥈', cls: 'podium-rank-2' },
          { data: top1, rank: '1st', medal: '🥇', cls: 'podium-rank-1' },
          { data: top3, rank: '3rd', medal: '🥉', cls: 'podium-rank-3' }
        ];

        podiumEl.innerHTML = podiumOrder
          .filter(item => item.data)
          .map(
            item => `
            <div class="podium-card ${item.cls}">
              <div class="podium-medal">${item.medal} ${item.rank}</div>
              <div class="podium-username">${this.formatUsernameHtml(
                item.data.username,
                item.data.rgbOwned && item.data.rgbEnabled
              )}</div>
              <div style="margin:0.2rem 0;"><span class="role-badge role-${item.data.role.toLowerCase()}">${item.data.rankBadge}</span></div>
              <div class="podium-points">${item.data.totalPoints.toLocaleString('en-US')} Points</div>
              <div class="podium-meta">
                <span class="emerald-text">💚 ${item.data.emeraldCoins.toLocaleString('en-US')}</span>
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
            <td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">
              No matching players found.
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
              ? '🥇 1st'
              : row.rank === 2
              ? '🥈 2nd'
              : row.rank === 3
              ? '🥉 3rd'
              : `#${row.rank}`;

          return `
            <tr class="${isMe ? 'lb-current-user-row' : ''}">
              <td class="lb-rank-cell">${rankBadge}</td>
              <td>
                <strong>⛏️ ${this.formatUsernameHtml(
                  row.username,
                  row.rgbOwned && row.rgbEnabled
                )}</strong>
                ${isMe ? '<span class="role-badge role-player" style="margin-left:0.4rem;">YOU</span>' : ''}
              </td>
              <td><span class="role-badge role-${row.role.toLowerCase()}">${this.escapeHtml(row.rankBadge)}</span></td>
              <td><strong class="gold-text">${row.totalPoints.toLocaleString('en-US')} Points</strong></td>
              <td><strong class="emerald-text">💚 ${row.emeraldCoins.toLocaleString('en-US')}</strong></td>
              <td>${row.gamesPlayed}</td>
              <td class="emerald-text">${row.gamesWon}</td>
              <td><strong>${row.winRate}%</strong></td>
              <td>❤️ ${row.extraLivesUsed}</td>
            </tr>
          `;
        })
        .join('');
    }

    // ==========================================
    // SECTION 16-27: EMERALD SHOP, RANK SHOP & STRIPE CHECKOUT UI
    // ==========================================
    bindEmeraldShopScreen() {
      document.querySelectorAll('[data-shop-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.selectedShopCategory = btn.getAttribute('data-shop-cat') || 'ALL';
          document.querySelectorAll('[data-shop-cat]').forEach(b => {
            b.classList.toggle('active', b === btn);
          });
          this.renderEmeraldShop();
        });
      });
    }

    renderEmeraldShop() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const items =
        this.selectedShopCategory === 'Emeralds'
          ? []
          : shopService.listShopItems(false, this.selectedShopCategory);
      const emeraldPackages =
        this.selectedShopCategory === 'ALL' || this.selectedShopCategory === 'Emeralds'
          ? paymentService.getEmeraldPackages(false)
          : [];

      const balEl = document.getElementById('shop-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('en-US')} Emerald Coins`;
      }

      const invExtra = document.getElementById('shop-inv-extralife');
      const invSecond = document.getElementById('shop-inv-secondchance');
      const invBoost = document.getElementById('shop-inv-scorebooster');
      const invEmBoost = document.getElementById('shop-inv-emeraldbooster');
      const invTicket = document.getElementById('shop-inv-ticket');
      const invRgb = document.getElementById('shop-inv-rgb');

      if (invExtra) invExtra.textContent = profile.inventory?.extraLives || 0;
      if (invSecond) invSecond.textContent = profile.inventory?.secondChance || 0;
      if (invBoost) invBoost.textContent = profile.inventory?.scoreBooster || 0;
      if (invEmBoost) invEmBoost.textContent = profile.inventory?.emeraldBooster || 0;
      if (invTicket) invTicket.textContent = profile.inventory?.tournamentTickets || 0;
      if (invRgb) {
        invRgb.textContent = profile.rgbOwned
          ? profile.rgbEnabled
            ? 'Enabled 🌈'
            : 'Owned (Disabled)'
          : 'Locked';
      }

      const grid = document.getElementById('emerald-shop-grid');
      if (!grid) return;

      const packagesHtml = emeraldPackages
        .map(
          pkg => `
            <div class="shop-item-card">
              <div>
                <div class="shop-item-top">
                  <div class="shop-item-icon">${this.escapeHtml(pkg.icon || '💚')}</div>
                  <span class="shop-item-price-tag">${pkg.priceTL.toLocaleString('en-US')} TL</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                  <h3 class="shop-item-title" style="margin:0;">${this.escapeHtml(pkg.title)}</h3>
                  <span class="role-badge role-vip">${this.escapeHtml(pkg.badge || '5 💚 = 1 TL')}</span>
                </div>
                <p class="shop-item-desc">"Purchase ${pkg.emeralds.toLocaleString('en-US')} Emerald Coins securely via Stripe (${pkg.priceTL} TL)."</p>
              </div>
              <div class="shop-item-footer">
                <span class="meta-muted">Stripe Verified Webhook</span>
                <button
                  type="button"
                  class="mc-btn mc-btn-emerald mc-btn-small btn-buy-emerald-pkg"
                  data-pkg-id="${this.escapeHtml(pkg.id)}"
                >
                  <span class="btn-inner">Buy (${pkg.priceTL} TL)</span>
                </button>
              </div>
            </div>
          `
        )
        .join('');

      const itemsHtml = items
        .map(item => {
          const check = shopService.evaluateEligibility(this.session, item);
          const priceStr =
            item.currency === 'TRY'
              ? `${item.price} TL`
              : `💚 ${item.price.toLocaleString('en-US')} Emeralds`;
          const reqBadge =
            item.requiredRole === 'VIP'
              ? '<span class="role-badge role-vip">Requires VIP</span>'
              : `<span class="meta-muted">${this.escapeHtml(item.category)}</span>`;
          const rankTlBtn =
            item.effectType === 'GRANT_RANK' && item.priceTL && check.canBuy
              ? `<button
                   type="button"
                   class="mc-btn mc-btn-gold mc-btn-small btn-buy-rank-tl"
                   data-rank-id="${this.escapeHtml(item.targetRank)}"
                 >
                   <span class="btn-inner">💳 ${item.priceTL} TL</span>
                 </button>`
              : '';

          return `
            <div class="shop-item-card">
              <div>
                <div class="shop-item-top">
                  <div class="shop-item-icon">${this.escapeHtml(item.icon)}</div>
                  <span class="shop-item-price-tag">${priceStr}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                  <h3 class="shop-item-title" style="margin:0;">${this.escapeHtml(item.name)}</h3>
                  ${reqBadge}
                </div>
                <p class="shop-item-desc">"${this.escapeHtml(item.description)}"</p>
              </div>
              <div class="shop-item-footer" style="gap:0.4rem; flex-wrap:wrap;">
                <span class="meta-muted">${this.escapeHtml(check.reason)}</span>
                <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                  ${rankTlBtn}
                  <button
                    type="button"
                    class="mc-btn ${check.canBuy ? 'mc-btn-emerald' : 'mc-btn-stone'} mc-btn-small btn-buy-shop-item"
                    data-item-id="${this.escapeHtml(item.id)}"
                    ${check.canBuy ? '' : 'disabled'}
                  >
                    <span class="btn-inner">${this.escapeHtml(check.buttonLabel)}</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      grid.innerHTML = packagesHtml + itemsHtml;

      grid.querySelectorAll('.btn-buy-emerald-pkg').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const pkgId = btn.getAttribute('data-pkg-id');
          this.openStripeCheckoutModal({ type: 'EMERALDS', packageId: pkgId });
        });
      });

      grid.querySelectorAll('.btn-buy-rank-tl').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const rankId = btn.getAttribute('data-rank-id');
          this.openStripeCheckoutModal({ type: 'RANK', rankId });
        });
      });

      grid.querySelectorAll('.btn-buy-shop-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.getAttribute('data-item-id');
          btn.disabled = true;
          try {
            const res = shopService.purchaseItem(this.session, itemId);
            this.session = licenseService.refreshSessionRole(this.session) || this.session;
            this.updateTopBarSessionUI();
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
    // STRIPE CHECKOUT & WEBHOOK VERIFICATION MODAL (SECTIONS 23-27)
    // ==========================================
    openStripeCheckoutModal(payload) {
      try {
        const res = paymentService.createCheckoutSession(this.session, payload);
        this.activeCheckoutSession = res.checkoutSession;

        const modal = document.getElementById('modal-stripe-checkout');
        const idEl = document.getElementById('stripe-chk-session-id');
        const itemEl = document.getElementById('stripe-chk-item-label');
        const amtEl = document.getElementById('stripe-chk-amount-tl');
        const badgeEl = document.getElementById('stripe-chk-status-badge');

        if (idEl) idEl.textContent = res.checkoutSession.id;
        if (itemEl) itemEl.textContent = res.checkoutSession.title;
        if (amtEl) amtEl.textContent = `${res.checkoutSession.amount} TL`;
        if (badgeEl) {
          badgeEl.textContent = res.checkoutSession.status;
          badgeEl.className = 'status-pill status-WAITING';
        }
        if (modal) modal.classList.remove('hidden');
      } catch (err) {
        window.soundManager.playWrong();
        this.showToast(err.message, 'error');
      }
    }

    bindStripeCheckoutModal() {
      const modal = document.getElementById('modal-stripe-checkout');
      const completeBtn = document.getElementById('btn-stripe-complete-pay');
      const failBtn = document.getElementById('btn-stripe-simulate-fail');

      if (completeBtn) {
        completeBtn.addEventListener('click', () => {
          if (!this.activeCheckoutSession) return;
          try {
            const webhookRes = paymentService.completeTestModeCheckout(
              this.session,
              this.activeCheckoutSession.id
            );
            this.activeCheckoutSession = null;
            if (modal) modal.classList.add('hidden');

            this.session = licenseService.refreshSessionRole(this.session) || this.session;
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderEmeraldShop();
            this.renderVipShop();

            window.soundManager.playCorrect();
            if (window.mcQuizGame) {
              window.mcQuizGame.particles.spawnBurst(
                window.innerWidth / 2,
                window.innerHeight / 2,
                'emerald',
                55
              );
            }
            this.showToast(
              `✅ Stripe Webhook Verified (${webhookRes.eventId}): ${webhookRes.payment.title} credited!`,
              'success'
            );
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (failBtn) {
        failBtn.addEventListener('click', () => {
          if (!this.activeCheckoutSession) return;
          window.soundManager.playWrong();
          try {
            paymentService.failCheckoutSession(
              this.activeCheckoutSession.id,
              'Simulated card decline in Stripe Test Mode'
            );
            this.activeCheckoutSession = null;
            if (modal) modal.classList.add('hidden');
            this.showToast(
              '❌ Payment failed in Stripe Test Mode. 0 Emeralds were granted.',
              'error'
            );
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }
    }

    // ==========================================
    // SECTION 9 & 10: SEPARATE VIP SHOP & PAYMENT ABSTRACTION
    // ==========================================
    bindVipShopScreen() {
      const buyVipBtn = document.getElementById('btn-buy-vip-package');
      const gotoRankShopBtn = document.getElementById('btn-goto-rank-shop');

      if (buyVipBtn) {
        buyVipBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const res = paymentService.initiateCheckout(this.session, {
            type: 'RANK',
            rankId: 'VIP',
            packageId: 'VIP_PACKAGE_200TL',
            title: '👑 VIP Membership (200 TL)',
            priceTL: 200
          });
          this.activeCheckoutSession = res.intent;
          const statusBox = document.getElementById('payment-service-status-box');
          const statusMsg = document.getElementById('payment-service-status-msg');
          if (statusBox && statusMsg) {
            statusMsg.textContent = `${res.message} (Session ID: ${res.intent.id})`;
            statusBox.classList.remove('hidden');
          }
          const modal = document.getElementById('modal-stripe-checkout');
          const idEl = document.getElementById('stripe-chk-session-id');
          const itemEl = document.getElementById('stripe-chk-item-label');
          const amtEl = document.getElementById('stripe-chk-amount-tl');
          const badgeEl = document.getElementById('stripe-chk-status-badge');
          if (idEl) idEl.textContent = res.intent.id;
          if (itemEl) itemEl.textContent = res.intent.title;
          if (amtEl) amtEl.textContent = `${res.intent.amount} TL`;
          if (badgeEl) {
            badgeEl.textContent = res.intent.status;
            badgeEl.className = 'status-pill status-WAITING';
          }
          if (modal) modal.classList.remove('hidden');
        });
      }

      if (gotoRankShopBtn) {
        gotoRankShopBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.selectedShopCategory = 'Ranks';
          document.querySelectorAll('[data-shop-cat]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-shop-cat') === 'Ranks');
          });
          this.navigateToScreen('screen-shop');
        });
      }
    }

    renderVipShop() {
      if (!this.session) return;
      const cfg = configService.getConfig();
      const effRole = authGuard.getEffectiveRole(this.session);
      const statusBadge = document.getElementById('vip-shop-user-status');
      if (statusBadge) {
        statusBadge.textContent = effRole;
        statusBadge.className = `role-badge role-${effRole.toLowerCase()}`;
      }

      const normWin = document.getElementById('cmp-normal-win');
      const vipWin = document.getElementById('cmp-vip-win');
      const normDaily = document.getElementById('cmp-normal-daily');
      const vipDaily = document.getElementById('cmp-vip-daily');

      if (normWin) normWin.textContent = `+${cfg.rewards.gameWon} 💚`;
      if (vipWin) vipWin.textContent = `+${cfg.rewards.vipGameWon} 💚`;
      if (normDaily) normDaily.textContent = `+${cfg.rewards.dailyLogin} 💚`;
      if (vipDaily) vipDaily.textContent = `+${cfg.rewards.vipDailyLogin} 💚`;
    }

    // ==========================================
    // SECTION 13, 25 & 33: PLAYER PROFILE, RGB COSMETICS & ACHIEVEMENTS
    // ==========================================
    bindProfileAndCosmetics() {
      const enableRgbBtn = document.getElementById('btn-profile-rgb-enable');
      const disableRgbBtn = document.getElementById('btn-profile-rgb-disable');

      if (enableRgbBtn) {
        enableRgbBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.setRgbUsernameEnabled(this.session, true);
            economyService._mutateAccount(this.session.username, acc => {
              acc.rgbOwned = true;
              acc.rgbEnabled = true;
            });
            this.showToast('🌈 RGB Username enabled!', 'success');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderPlayerProfile();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      if (disableRgbBtn) {
        disableRgbBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.setRgbUsernameEnabled(this.session, false);
            economyService._mutateAccount(this.session.username, acc => {
              acc.rgbEnabled = false;
            });
            this.showToast('RGB Username disabled.', 'info');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderPlayerProfile();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }
    }

    renderPlayerProfile() {
      if (!this.session) return;
      const summary = leaderboardService.getPlayerRankAndSummary(this.session.username);
      const achievements = achievementService.getPlayerAchievements(this.session.username);
      const dailyStatus = dailyRewardService.canClaimDailyReward(this.session.username);

      const uName = document.getElementById('profile-username');
      const uRole = document.getElementById('profile-role-badge');
      const uRank = document.getElementById('profile-rank-badge');
      const uIdEl = document.getElementById('profile-immutable-id');
      const rgbPreview = document.getElementById('profile-rgb-preview');
      const rgbPill = document.getElementById('profile-rgb-status-pill');

      if (uName) {
        uName.innerHTML = this.formatUsernameHtml(
          summary.username,
          summary.rgbOwned && summary.rgbEnabled
        );
      }
      if (uRole) {
        uRole.textContent = summary.role;
        uRole.className = `role-badge role-${summary.role.toLowerCase()}`;
      }
      if (uRank) uRank.textContent = `${summary.rankBadge} • Rank #${summary.rank}`;
      if (uIdEl) uIdEl.textContent = `Immutable Account ID: ${summary.userId || this.session.userId}`;
      if (rgbPreview) rgbPreview.textContent = summary.username;
      if (rgbPill) {
        const statusStr = summary.rgbOwned
          ? summary.rgbEnabled
            ? 'ENABLED'
            : 'OWNED (OFF)'
          : 'LOCKED';
        rgbPill.textContent = statusStr;
        rgbPill.className = `status-pill status-${summary.rgbOwned && summary.rgbEnabled ? 'ACTIVE' : 'DISABLED'}`;
      }

      const extraOwned =
        (summary.inventory?.extraLives || 0) + (summary.inventory?.secondChance || 0);

      document.getElementById('prof-stat-rank').textContent = `#${summary.rank}`;
      document.getElementById('prof-stat-points').textContent =
        `${summary.totalPoints.toLocaleString('en-US')} Points`;
      document.getElementById('prof-stat-emeralds').textContent =
        `💚 ${summary.emeraldCoins.toLocaleString('en-US')} Emerald Coins`;
      document.getElementById('prof-stat-games').textContent =
        summary.gamesPlayed.toLocaleString('en-US');
      document.getElementById('prof-stat-winloss').textContent =
        `${summary.gamesWon} W / ${summary.gamesLost} L`;
      document.getElementById('prof-stat-winrate').textContent = `${summary.winRate}%`;
      document.getElementById('prof-stat-extralives').textContent =
        `${extraOwned} Owned / ${summary.extraLivesUsed} Used`;
      document.getElementById('prof-stat-avgscore').textContent =
        `${summary.averageScore.toLocaleString('en-US')} Pts`;
      document.getElementById('prof-stat-bestscore').textContent =
        `${summary.bestScore.toLocaleString('en-US')} Emerald`;
      document.getElementById('prof-stat-earned').textContent =
        `+${summary.totalEmeraldsEarned.toLocaleString('en-US')} Emeralds`;
      document.getElementById('prof-stat-spent').textContent =
        `-${summary.totalEmeraldsSpent.toLocaleString('en-US')} Emeralds`;
      document.getElementById('prof-stat-streak').textContent =
        `${dailyStatus.currentStreak} Days`;

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
    // EMERALD TRANSACTION HISTORY UI
    // ==========================================
    renderEmeraldHistory() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const txs = economyService.getTransactionHistory(this.session, this.session.username);

      const balEl = document.getElementById('history-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('en-US')} Emerald Coins`;
      }

      const listEl = document.getElementById('player-history-list');
      if (!listEl) return;

      if (txs.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state-box">No Emerald Coin transactions recorded yet.</div>';
        return;
      }

      listEl.innerHTML = txs
        .map(tx => {
          const isNeg = tx.amount < 0;
          const sign = tx.amount > 0 ? '+' : '';
          const amountText =
            tx.amount === 0
              ? '❤️ 1 Extra Life Consumed'
              : `${sign}${tx.amount.toLocaleString('en-US')} Emeralds`;
          return `
            <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
              <div class="tx-main">
                <span class="tx-reason">${this.escapeHtml(tx.reason)} <span class="meta-muted">(${this.escapeHtml(tx.id)})</span></span>
                <span class="tx-meta">🕒 ${tx.dateFormatted} • Prev: 💚 ${Number(tx.previousBalance || 0).toLocaleString('en-US')} → New: 💚 ${tx.balanceAfter.toLocaleString('en-US')} • Source: ${this.escapeHtml(tx.source || 'System')}</span>
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
    // SECTIONS 6, 7 & 8: PARTY SYSTEM (STRICT PERMISSIONS, NEVER RESETS LICENSE)
    // ==========================================
    openPartyLobby(openCreateBox = false) {
      if (!this.session) {
        this.lockWithLicenseGate(false);
        return;
      }

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-party');
      }

      document.querySelectorAll('[data-nav-screen]').forEach(btn => {
        if (btn.classList.contains('main-nav-btn')) {
          btn.classList.toggle('active', btn.getAttribute('data-nav-screen') === 'screen-party');
        }
      });

      this.renderPartyLobby(openCreateBox);
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
          this.navigateToScreen('screen-menu');
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
          const perms = authGuard.getUserPermissions(this.session);
          if (!perms.canCreateParty) {
            this.showToast('Access Denied: Only VIP, MVP, and ADMIN users can create parties.', 'error');
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
            const modeSelect = document.getElementById('input-party-mode');
            const descInput = document.getElementById('input-party-desc');
            const newParty = partyService.createParty(this.session, {
              name: nameInput.value,
              maxPlayers: Number(maxSelect.value),
              gameMode: modeSelect ? modeSelect.value : 'Classic Millionaire (15 Qs)',
              description: descInput ? descInput.value : ''
            });
            nameInput.value = '';
            if (descInput) descInput.value = '';
            this.selectedPartyId = newParty.id;
            window.soundManager.playCorrect();
            this.showToast(`Party "${newParty.name}" created! Invite Code: ${newParty.inviteCode}`, 'success');
            this.renderPartyLobby(false);
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Section 1 & 8: Join Party — NEVER resets license or account!
      if (joinForm) {
        joinForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const codeInp = document.getElementById('input-join-invite-code');
            const joinedParty = partyService.joinPartyByInviteCode(this.session, codeInp.value);
            codeInp.value = '';
            this.selectedPartyId = joinedParty.id;
            window.soundManager.playCorrect();
            this.showToast('SUCCESS — "You joined the party successfully."', 'success');
            this.renderPartyLobby(false);
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

    renderPartyLobby(forceShowCreate = false) {
      if (!this.session) return;
      const effRole = authGuard.getEffectiveRole(this.session);
      const perms = authGuard.getUserPermissions(this.session);
      const profile = economyService.getPlayerEconomyProfile(this.session.username);

      const welcomeTitle = document.getElementById('party-welcome-title');
      const roleBadge = document.getElementById('party-user-role-badge');
      const licName = document.getElementById('party-user-license-name');
      const createBtn = document.getElementById('btn-open-create-party');
      const createBox = document.getElementById('organizer-create-party-box');
      const maxSelect = document.getElementById('input-party-max');

      if (welcomeTitle) {
        welcomeTitle.innerHTML = `Welcome, ${this.formatUsernameHtml(this.session.username)}`;
      }
      if (roleBadge) {
        roleBadge.textContent = profile.rankBadge || effRole;
        roleBadge.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (licName) licName.textContent = this.session.licenseName || 'Active Account';

      // Populate maxPlayers options dynamically up to user's rank maxPartySize (Section 8)
      if (maxSelect && perms.canCreateParty) {
        const cap = Math.min(32, perms.maxPartySize || 4);
        const sizes = [2, 4, 6, 8, 10, 12, 14, 16, 20, 32].filter(n => n <= cap);
        if (!sizes.includes(cap)) sizes.push(cap);
        maxSelect.innerHTML = sizes
          .map(
            n =>
              `<option value="${n}" ${n === cap ? 'selected' : ''}>${n} Players ${
                n === cap ? `(${profile.rank || effRole} Max)` : ''
              }</option>`
          )
          .join('');
      }

      // Section 9: Normal PLAYER sees [ Join Party ] ONLY. Ranked & ADMIN see [ Create Party ]
      const canCreateParty = Boolean(perms.canCreateParty);
      if (createBtn) createBtn.classList.toggle('hidden', !canCreateParty);
      if (createBox) {
        if (!canCreateParty) {
          createBox.classList.add('hidden');
        } else if (forceShowCreate) {
          createBox.classList.remove('hidden');
        }
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
            No parties found. Enter a Party Code (e.g. <strong>MCM-8K2P</strong>) above to join!
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
                <span>👑 Owner: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                <span>🎮 Mode: <strong>${this.escapeHtml(p.gameMode || 'Classic')}</strong></span>
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
            Select a party from the left list or enter an Invite Code to view party details.
          </div>
        `;
        return;
      }

      const effRole = authGuard.getEffectiveRole(this.session);
      const perms = authGuard.getUserPermissions(this.session);
      const isOwner = party.organizer.toLowerCase() === this.session.username.toLowerCase();
      // Section 9 & 10: ONLY ranked owner with canInvitePlayers or ADMIN can see party management & invite controls
      const canManage = effRole === 'ADMIN' || (Boolean(perms.canInvitePlayers) && isOwner);
      const isParticipant = party.participants.some(
        pt => pt.username.toLowerCase() === this.session.username.toLowerCase() && pt.joinStatus === 'JOINED'
      );
      const joinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      const createdDate = new Date(party.createdAt).toLocaleString('en-US');

      const managementToolbarHtml = canManage
        ? `
          <div class="party-owner-toolbar">
            <div class="owner-toolbar-title">👑 RANKED OWNER / ADMIN PARTY MANAGEMENT</div>
            <div class="inline-join-form">
              <input type="text" id="inp-invite-username" class="mc-input mc-input-sm" placeholder="Minecraft username to invite..." />
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
                <span class="btn-inner">▶️ Start Party Game</span>
              </button>
              <select id="sel-party-status-change" class="mc-select mc-select-xs">
                ${PARTY_STATUSES.map(
                  st => `<option value="${st}" ${party.status === st ? 'selected' : ''}>Status: ${st}</option>`
                ).join('')}
              </select>
              <button type="button" id="btn-party-cancel" class="mc-btn mc-btn-danger mc-btn-small" ${
                party.status === 'CANCELLED' ? 'disabled' : ''
              }>
                <span class="btn-inner">✖ Cancel Party</span>
              </button>
            </div>
          </div>
        `
        : '';

      const participantActionBar = `
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap; margin-bottom:1rem;">
          ${
            !isParticipant && party.status !== 'CANCELLED'
              ? `<button type="button" id="btn-detail-quick-join" class="mc-btn mc-btn-emerald mc-btn-small">
                   <span class="btn-inner">🎟️ Join This Party (${party.inviteCode})</span>
                 </button>`
              : ''
          }
          ${
            isParticipant
              ? `<button type="button" id="btn-detail-leave-party" class="mc-btn mc-btn-danger mc-btn-small">
                   <span class="btn-inner">🚪 Leave Party</span>
                 </button>`
              : ''
          }
        </div>
      `;

      container.innerHTML = `
        <div class="party-detail-header">
          <div>
            <div class="party-detail-title">${this.escapeHtml(party.name)}</div>
            <div class="meta-muted">Party ID: <strong>${party.id}</strong> • Created At: ${createdDate}</div>
            ${party.description ? `<p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(party.description)}</p>` : ''}
          </div>
          <span class="status-pill status-${party.status}">${party.status}</span>
        </div>

        <div class="party-meta-grid">
          <div class="party-meta-box">
            <span>Owner</span>
            <strong class="gold-text">${this.formatUsernameHtml(party.organizer)}</strong>
          </div>
          <div class="party-meta-box">
            <span>Players / Max</span>
            <strong>${joinedCount} / ${party.maxPlayers}</strong>
          </div>
          <div class="party-meta-box">
            <span>Game Mode</span>
            <strong>${this.escapeHtml(party.gameMode || 'Classic Millionaire')}</strong>
          </div>
          <div class="party-meta-box">
            <span>Invite Code</span>
            <strong class="emerald-text">${party.inviteCode}</strong>
          </div>
        </div>

        ${participantActionBar}
        ${managementToolbarHtml}

        <h4 class="panel-sec-title">👥 Participants (${party.participants.length})</h4>
        <div class="participants-grid">
          ${party.participants
            .map(pt => {
              const joinedTime = new Date(pt.joinedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const canRemoveThis =
                canManage && pt.username.toLowerCase() !== party.organizer.toLowerCase();
              return `
                <div class="participant-card">
                  <div class="participant-top">
                    <span class="participant-name">⛏️ ${this.formatUsernameHtml(pt.username)}</span>
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
                        )}">Remove Player</button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      // Quick Join / Leave Party bindings
      const quickJoinBtn = document.getElementById('btn-detail-quick-join');
      if (quickJoinBtn) {
        quickJoinBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            partyService.joinPartyByInviteCode(this.session, party.inviteCode);
            window.soundManager.playCorrect();
            this.showToast('SUCCESS — "You joined the party successfully."', 'success');
            this.renderPartyLobby(false);
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      const leaveBtn = document.getElementById('btn-detail-leave-party');
      if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            partyService.leaveParty(this.session, party.id);
            this.showToast(`You left "${party.name}". Your license and account remain active.`, 'info');
            this.renderPartyLobby(false);
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

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
                this.showToast(`Player ${targetUser} invited successfully.`, 'success');
              }
              this.renderPartyLobby(false);
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          });
        }

        if (copyCodeBtn) {
          copyCodeBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.copyToClipboard(
              party.inviteCode,
              `Invite code copied: ${party.inviteCode}`
            );
          });
        }

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            window.soundManager.playCorrect();
            try {
              partyService.setPartyStatus(this.session, party.id, 'ACTIVE');
              this.showToast('Party game started!', 'success');
              this.renderPartyLobby(false);
              if (window.mcQuizGame) {
                window.mcQuizGame.startNewGame();
              }
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          });
        }

        if (statusSel) {
          statusSel.addEventListener('change', () => {
            try {
              partyService.setPartyStatus(this.session, party.id, statusSel.value);
              this.showToast(`Party status updated to ${statusSel.value}`, 'info');
              this.renderPartyLobby(false);
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.askConfirmation(
              '✖ Cancel Party',
              `Are you sure you want to cancel "${party.name}"?`,
              'Cancel Party',
              () => {
                try {
                  partyService.setPartyStatus(this.session, party.id, 'CANCELLED');
                  this.showToast('Party cancelled.', 'info');
                  this.renderPartyLobby(false);
                } catch (err) {
                  this.showToast(err.message, 'error');
                }
              }
            );
          });
        }

        container.querySelectorAll('.btn-remove-pt').forEach(btn => {
          btn.addEventListener('click', () => {
            window.soundManager.playClick();
            const targetUser = btn.getAttribute('data-username');
            this.askConfirmation(
              '👥 Remove Participant',
              `Are you sure you want to remove "${targetUser}" from this party?`,
              'Remove Player',
              () => {
                try {
                  partyService.removeParticipant(this.session, party.id, targetUser);
                  this.showToast(`${targetUser} removed from party.`, 'info');
                  this.renderPartyLobby(false);
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
    // INVITATION MODAL
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
            'Party invitation copied to clipboard!'
          );
        });
      }
    }

    // ==========================================
    // SECTIONS 14, 15, 16 & 17: SUPPORT, BUG REPORTS & SUGGESTIONS HUB
    // ==========================================
    bindSupportHub() {
      document.querySelectorAll('[data-support-pane]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.switchSupportTab(btn.getAttribute('data-support-pane'));
        });
      });

      const supForm = document.getElementById('form-submit-support');
      if (supForm) {
        supForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const category = document.getElementById('sup-category')?.value;
            const title = document.getElementById('sup-title')?.value;
            const description = document.getElementById('sup-desc')?.value;
            const ticket = supportService.createSupportTicket(this.session, {
              category,
              title,
              description
            });
            supForm.reset();
            window.soundManager.playCorrect();
            this.showToast(
              `Support ticket ${ticket.id} submitted (${ticket.priority} Priority)!`,
              'success'
            );
            this.renderSupportHub();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      const bugForm = document.getElementById('form-submit-bug');
      if (bugForm) {
        bugForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const title = document.getElementById('bug-title')?.value;
            const category = document.getElementById('bug-category')?.value;
            const relatedParty = document.getElementById('bug-party')?.value;
            const attachmentUrl = document.getElementById('bug-attachment')?.value;
            const description = document.getElementById('bug-desc')?.value;
            const bug = supportService.createBugReport(this.session, {
              title,
              category,
              relatedParty,
              attachmentUrl,
              description
            });
            bugForm.reset();
            window.soundManager.playCorrect();
            this.showToast(
              `Bug report ${bug.id} submitted (${bug.priority} Priority)!`,
              'success'
            );
            this.renderSupportHub();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      const sugForm = document.getElementById('form-submit-suggestion');
      if (sugForm) {
        sugForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const title = document.getElementById('sug-title')?.value;
            const category = document.getElementById('sug-category')?.value;
            const description = document.getElementById('sug-desc')?.value;
            const sug = supportService.createSuggestion(this.session, {
              title,
              category,
              description
            });
            sugForm.reset();
            window.soundManager.playCorrect();
            this.showToast(
              `Suggestion ${sug.id} submitted (${sug.priority} Priority)!`,
              'success'
            );
            this.renderSupportHub();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      const sugSortSel = document.getElementById('filter-user-suggestions-sort');
      if (sugSortSel) {
        sugSortSel.addEventListener('change', () => this.renderSupportHub());
      }
    }

    switchSupportTab(paneName) {
      document.querySelectorAll('[data-support-pane]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-support-pane') === paneName);
      });
      document.querySelectorAll('.support-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== `support-pane-${paneName}`);
      });
      this.renderSupportHub();
    }

    renderSupportHub() {
      if (!this.session) return;
      const priority = supportService.computeUserPriority(this.session);
      const prioInd = document.getElementById('support-priority-indicator');
      if (prioInd) {
        prioInd.textContent =
          priority === 'HIGH'
            ? '🔥 VIP PRIORITY ACTIVE'
            : priority === 'CRITICAL'
            ? '🛡️ ADMIN PRIORITY'
            : 'STANDARD PRIORITY';
        prioInd.className = `priority-pill priority-${priority}`;
      }

      // 1. User Support Tickets
      const supListEl = document.getElementById('user-support-tickets-list');
      if (supListEl) {
        const tickets = supportService.listSupportTickets(this.session, true);
        supListEl.innerHTML =
          tickets.length === 0
            ? '<div class="empty-state-box">You have not submitted any support tickets yet.</div>'
            : tickets
                .map(
                  t => `
                <div class="tx-row">
                  <div class="tx-main">
                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                      <span class="tx-reason">${this.escapeHtml(t.title)}</span>
                      <span class="priority-pill priority-${t.priority}">${
                        t.priority === 'HIGH' ? '🔥 VIP PRIORITY' : t.priority
                      }</span>
                      <span class="status-pill status-${t.status === 'RESOLVED' ? 'ACTIVE' : 'WAITING'}">${t.status}</span>
                    </div>
                    <span class="tx-meta">[${t.id}] • ${this.escapeHtml(t.category)} • ${new Date(t.createdAt).toLocaleString('en-US')}</span>
                    <p class="panel-sec-desc" style="margin-top:0.25rem;">${this.escapeHtml(t.description)}</p>
                    ${
                      t.adminReply
                        ? `<div class="emerald-text" style="font-size:0.84rem; margin-top:0.25rem;">🛡️ Admin Reply: ${this.escapeHtml(t.adminReply)}</div>`
                        : ''
                    }
                  </div>
                </div>
              `
                )
                .join('');
      }

      // 2. User Bug Reports
      const bugListEl = document.getElementById('user-bug-reports-list');
      if (bugListEl) {
        const bugs = supportService.listBugReports(this.session, false);
        bugListEl.innerHTML =
          bugs.length === 0
            ? '<div class="empty-state-box">No bug reports submitted yet.</div>'
            : bugs
                .map(
                  b => `
                <div class="tx-row">
                  <div class="tx-main">
                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                      <span class="tx-reason">${this.escapeHtml(b.title)}</span>
                      <span class="priority-pill priority-${b.priority}">${
                        b.priority === 'HIGH' ? '🔥 VIP PRIORITY' : b.priority
                      }</span>
                      <span class="status-pill status-WAITING">${b.status}</span>
                    </div>
                    <span class="tx-meta">[${b.id}] by ${this.escapeHtml(b.username)} • ${this.escapeHtml(b.category)} ${b.relatedParty ? `• Party: ${this.escapeHtml(b.relatedParty)}` : ''}</span>
                    <p class="panel-sec-desc" style="margin-top:0.25rem;">${this.escapeHtml(b.description)}</p>
                  </div>
                </div>
              `
                )
                .join('');
      }

      // 3. Community Suggestions
      const sugListEl = document.getElementById('user-suggestions-list');
      const sortBy = document.getElementById('filter-user-suggestions-sort')?.value || 'PRIORITY';
      if (sugListEl) {
        const sugs = supportService.listSuggestions(this.session, sortBy);
        sugListEl.innerHTML =
          sugs.length === 0
            ? '<div class="empty-state-box">No suggestions yet.</div>'
            : sugs
                .map(s => {
                  const voted = (s.votedBy || []).some(
                    u => u.toLowerCase() === this.session.username.toLowerCase()
                  );
                  return `
                  <div class="tx-row">
                    <div class="tx-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <span class="tx-reason">${this.escapeHtml(s.title)}</span>
                        <span class="priority-pill priority-${s.priority}">${
                          s.priority === 'HIGH' ? '👑 VIP PRIORITY' : s.priority
                        }</span>
                        <span class="status-pill status-ACTIVE">${s.status}</span>
                      </div>
                      <span class="tx-meta">[${s.id}] by ${this.escapeHtml(s.username)} • ${this.escapeHtml(s.category)}</span>
                      <p class="panel-sec-desc" style="margin-top:0.25rem;">${this.escapeHtml(s.description)}</p>
                    </div>
                    <button type="button" class="act-btn ${voted ? 'emerald' : ''} btn-vote-sug" data-sug-id="${s.id}">
                      👍 ${s.votes || 0}
                    </button>
                  </div>
                `;
                })
                .join('');

        sugListEl.querySelectorAll('.btn-vote-sug').forEach(btn => {
          btn.addEventListener('click', () => {
            window.soundManager.playClick();
            const id = btn.getAttribute('data-sug-id');
            supportService.voteSuggestion(this.session, id);
            this.renderSupportHub();
          });
        });
      }
    }

    // ==========================================
    // SECTION 27: ACCOUNT SETTINGS
    // ==========================================
    bindAccountSettings() {
      const unameForm = document.getElementById('form-acc-username');
      const pwdForm = document.getElementById('form-acc-password');
      const rgbEnableBtn = document.getElementById('btn-acc-rgb-enable');
      const rgbDisableBtn = document.getElementById('btn-acc-rgb-disable');
      const notifChk = document.getElementById('chk-acc-notifications');
      const logoutBtn = document.getElementById('btn-acc-logout');

      if (unameForm) {
        unameForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const inp = document.getElementById('inp-acc-new-username');
            const res = userService.changeUsername(this.session, inp.value);
            this.session = res.session;
            inp.value = '';
            window.soundManager.playCorrect();
            this.showToast(
              `Username updated to "${this.session.username}" (Account ID ${res.user.id} preserved)!`,
              'success'
            );
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderAccountSettings();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (pwdForm) {
        pwdForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const curr = document.getElementById('inp-acc-curr-pwd')?.value || '';
            const next = document.getElementById('inp-acc-new-pwd')?.value || '';
            userService.changePassword(this.session, curr, next);
            pwdForm.reset();
            window.soundManager.playCorrect();
            this.showToast('Password hash updated securely (salted SHA-256).', 'success');
            this.renderAccountSettings();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (rgbEnableBtn) {
        rgbEnableBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.setRgbUsernameEnabled(this.session, true);
            economyService._mutateAccount(this.session.username, acc => {
              acc.rgbOwned = true;
              acc.rgbEnabled = true;
            });
            this.showToast('🌈 RGB Username enabled!', 'success');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderAccountSettings();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      if (rgbDisableBtn) {
        rgbDisableBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.setRgbUsernameEnabled(this.session, false);
            economyService._mutateAccount(this.session.username, acc => {
              acc.rgbEnabled = false;
            });
            this.showToast('RGB Username disabled.', 'info');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderAccountSettings();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      if (notifChk) {
        notifChk.addEventListener('change', () => {
          userService.updateSettings(this.session, { notifications: notifChk.checked });
          this.showToast('Notification settings saved.', 'info');
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.handleLogout(false);
        });
      }
    }

    renderAccountSettings() {
      if (!this.session) return;
      const user = userService.getUserByUsername(this.session.username);
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      if (!user) return;

      document.getElementById('acc-info-userid').textContent = user.id;
      document.getElementById('acc-info-username').innerHTML = this.formatUsernameHtml(
        user.minecraftUsername,
        profile.rgbOwned && profile.rgbEnabled
      );
      document.getElementById('acc-info-role').textContent = `${user.role} (${profile.rankBadge})`;
      document.getElementById('acc-info-vip').textContent = user.vipStatus?.isVip
        ? `👑 ACTIVE (${user.vipStatus.expiresAt || 'Lifetime'})`
        : 'Standard Player';
      document.getElementById('acc-info-license').textContent = `${user.licenseId} (${this.session.codeMasked || 'Verified'})`;
      document.getElementById('acc-info-pwd-status').textContent = user.hasPassword
        ? '🔒 Password Hash Set (SHA-256)'
        : 'No Password Set (License Auth)';
    }

    // ==========================================
    // SECTIONS 31-37: ADMIN PANEL — 100% ENGLISH ONLY (18 PAGES)
    // ==========================================
    openAdminPanel() {
      try {
        authGuard.requireRole(this.session, ['ADMIN']);
      } catch (err) {
        this.showToast(err.message, 'error');
        return;
      }

      const nameEl = document.getElementById('admin-profile-name');
      if (nameEl) nameEl.textContent = this.session.username;

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-admin');
      }

      document.querySelectorAll('[data-nav-screen]').forEach(btn => {
        if (btn.classList.contains('main-nav-btn')) {
          btn.classList.toggle('active', btn.getAttribute('data-nav-screen') === 'screen-admin');
        }
      });

      this.renderAdminAll();
    }

    bindAdminPanel() {
      document.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const tab = btn.getAttribute('data-admin-tab');
          this.switchAdminTab(tab);
        });
      });

      const mobMoreBtn = document.getElementById('btn-admin-mob-more');
      const sidebarNav = document.getElementById('admin-sidebar-nav');
      if (mobMoreBtn && sidebarNav) {
        mobMoreBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          sidebarNav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }

      const goGameBtn = document.getElementById('btn-admin-go-game');
      if (goGameBtn) {
        goGameBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-menu');
        });
      }

      const viewAllLogsBtn = document.getElementById('btn-dash-view-all-logs');
      if (viewAllLogsBtn) {
        viewAllLogsBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.switchAdminTab('activity');
        });
      }

      // Users Search & Filter
      const searchUsers = document.getElementById('search-adm-users');
      const filterUsersRole = document.getElementById('filter-adm-users-role');
      if (searchUsers) searchUsers.addEventListener('input', () => this.renderAdminUsers());
      if (filterUsersRole) filterUsersRole.addEventListener('change', () => this.renderAdminUsers());

      // Ranks Save Form (Section 6, 7, 34)
      const saveRankForm = document.getElementById('form-admin-save-rank');
      if (saveRankForm) {
        saveRankForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const id = document.getElementById('adm-rank-id')?.value.trim();
            const name = document.getElementById('adm-rank-name')?.value.trim();
            const badgeIcon = document.getElementById('adm-rank-icon')?.value.trim() || '⚡';
            const badgeColor = document.getElementById('adm-rank-color')?.value.trim() || '#fbbf24';
            const emeraldPrice = Number(document.getElementById('adm-rank-emerald-price')?.value || 0);
            const tlPrice = Number(document.getElementById('adm-rank-tl-price')?.value || 0);
            const maxPartySize = Number(document.getElementById('adm-rank-party-limit')?.value || 4);
            const emeraldMultiplier = Number(document.getElementById('adm-rank-multiplier')?.value || 1.0);
            const supportPriority = document.getElementById('adm-rank-priority')?.value || 'HIGH';
            const canCreateParty = document.getElementById('adm-rank-can-party')?.value === 'true';

            const saved = rankService.adminSaveRank(this.session, {
              id,
              name,
              badgeIcon,
              badgeColor,
              emeraldPrice,
              tlPrice,
              permissions: {
                canCreateParty,
                canInvitePlayers: canCreateParty,
                maxPartySize,
                emeraldMultiplier,
                supportPriority,
                bugPriority: supportPriority,
                suggestionPriority: supportPriority,
                maxExtraLives: 2,
                cosmetics: true,
                rgbName: emeraldPrice >= 3000,
                profileEffects: emeraldPrice >= 1500
              }
            });

            saveRankForm.reset();
            window.soundManager.playCorrect();
            this.showToast(`Rank "${saved.name}" (${saved.id}) saved!`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Licenses Create & Filter
      const genCodeBtn = document.getElementById('btn-adm-gen-code');
      const codeInp = document.getElementById('adm-lic-code');
      const roleSel = document.getElementById('adm-lic-role');
      if (genCodeBtn && codeInp) {
        genCodeBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const r = roleSel ? roleSel.value : 'PLAYER';
          codeInp.value = licenseService.generateRandomCode(r);
        });
      }

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

            const created = licenseService.createLicense(this.session, {
              name,
              code,
              role,
              expiresAt,
              assignedUsername
            });

            createLicForm.reset();
            window.soundManager.playCorrect();
            this.showToast(`License created: ${created.code} (${created.role})`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      const searchLic = document.getElementById('search-adm-licenses');
      const filterLic = document.getElementById('filter-adm-licenses');
      if (searchLic) searchLic.addEventListener('input', () => this.renderAdminLicenses());
      if (filterLic) filterLic.addEventListener('change', () => this.renderAdminLicenses());

      // Parties Search & Filter
      const searchPrt = document.getElementById('search-adm-parties');
      const filterPrt = document.getElementById('filter-adm-parties');
      const quickPartyBtn = document.getElementById('btn-adm-quick-party');
      if (searchPrt) searchPrt.addEventListener('input', () => this.renderAdminParties());
      if (filterPrt) filterPrt.addEventListener('change', () => this.renderAdminParties());
      if (quickPartyBtn) {
        quickPartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.openPartyLobby(true);
        });
      }

      // Admin Leaderboard Sort
      const admLbSort = document.getElementById('adm-lb-sort');
      if (admLbSort) {
        admLbSort.addEventListener('change', () => this.renderAdminLeaderboard());
      }

      // Economy Balance Operations
      document.querySelectorAll('[data-adm-econ-op]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const op = btn.getAttribute('data-adm-econ-op');
          const targetUser = (document.getElementById('adm-econ-username')?.value || '').trim();
          const amountVal = Number(document.getElementById('adm-econ-amount')?.value || 0);
          const reasonVal = (document.getElementById('adm-econ-reason')?.value || '').trim();

          if (!targetUser) {
            this.showToast('Please enter a player username.', 'error');
            return;
          }

          this.askConfirmation(
            `💚 Admin Economy Action (${op})`,
            `Are you sure you want to execute ${op} (${amountVal} Emeralds) for "${targetUser}"?`,
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
                this.showToast(`Updated Emerald balance for "${targetUser}" (${op}).`, 'success');
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

      // Economy Config Form
      const cfgForm = document.getElementById('form-admin-economy-config');
      if (cfgForm) {
        cfgForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const newRewards = {
              gameCompleted: Number(document.getElementById('cfg-reward-completed')?.value || 25),
              gameWon: Number(document.getElementById('cfg-reward-won')?.value || 100),
              vipGameWon: Number(document.getElementById('cfg-reward-vip-won')?.value || 150),
              dailyLogin: Number(document.getElementById('cfg-reward-daily')?.value || 25),
              vipDailyLogin: Number(document.getElementById('cfg-reward-vip-daily')?.value || 50),
              top3Finish: Number(document.getElementById('cfg-reward-top3')?.value || 150),
              tournamentWinner: Number(document.getElementById('cfg-reward-tournament')?.value || 500)
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
            this.showToast('Economy, VIP Bonus & Extra Life configuration saved!', 'success');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin Create Shop Item
      const createShopForm = document.getElementById('form-admin-create-shop-item');
      if (createShopForm) {
        createShopForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const name = document.getElementById('adm-shop-name')?.value || '';
            const icon = document.getElementById('adm-shop-icon')?.value || '💎';
            const price = Number(document.getElementById('adm-shop-price')?.value || 500);
            const category = document.getElementById('adm-shop-category')?.value || 'Gameplay';
            const requiredRole = document.getElementById('adm-shop-req-role')?.value || 'ANY';
            const effectType = document.getElementById('adm-shop-effect')?.value || 'EXTRA_LIFE';
            const description = document.getElementById('adm-shop-desc')?.value || '';

            shopService.adminSaveShopItem(this.session, {
              name,
              icon,
              price,
              category,
              requiredRole,
              effectType,
              description,
              enabled: true
            });

            createShopForm.reset();
            window.soundManager.playCorrect();
            this.showToast(`Shop item "${name}" created successfully!`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playWrong();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin Rank Shop / VIP Assignment Form (Section 34)
      const grantVipForm = document.getElementById('form-admin-grant-vip');
      const revokeVipBtn = document.getElementById('btn-adm-revoke-vip');
      if (grantVipForm) {
        grantVipForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const uname = document.getElementById('adm-vip-username')?.value.trim();
            const targetRank = document.getElementById('adm-vip-rank-select')?.value || 'VIP';
            const exp = document.getElementById('adm-vip-expires')?.value || null;
            userService.adminSetVipStatus(this.session, uname, {
              rank: targetRank,
              isVip: targetRank !== 'PLAYER',
              expiresAt: exp
            });
            economyService._mutateAccount(uname, acc => {
              acc.rank = targetRank;
              acc.isVip = targetRank !== 'PLAYER';
              if (acc.role !== 'ADMIN') acc.role = targetRank === 'PLAYER' ? 'PLAYER' : 'VIP';
            });
            window.soundManager.playCorrect();
            this.showToast(`👑 Rank ${targetRank} assigned to ${uname}!`, 'success');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }
      if (revokeVipBtn) {
        revokeVipBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const uname = document.getElementById('adm-vip-username')?.value.trim();
          if (!uname) {
            this.showToast('Please enter a username.', 'error');
            return;
          }
          try {
            userService.adminSetVipStatus(this.session, uname, {
              rank: 'PLAYER',
              isVip: false,
              expiresAt: null
            });
            economyService._mutateAccount(uname, acc => {
              acc.rank = 'PLAYER';
              acc.isVip = false;
              if (acc.role === 'VIP') acc.role = 'PLAYER';
            });
            this.showToast(`Reset ${uname} rank to PLAYER.`, 'info');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin Payments Status Filter (Section 36)
      const filterPayments = document.getElementById('filter-adm-payments-status');
      if (filterPayments) {
        filterPayments.addEventListener('change', () => this.renderAdminPaymentsTab());
      }

      // Admin Suggestions Sort
      const admSugSort = document.getElementById('adm-suggestions-sort');
      if (admSugSort) {
        admSugSort.addEventListener('change', () => this.renderAdminSuggestions());
      }

      // Admin Transactions Search
      const searchTx = document.getElementById('search-adm-tx-history');
      if (searchTx) {
        searchTx.addEventListener('input', () => this.renderAdminTransactions());
      }

      // Admin Create & Download Backup (Section 37)
      const createBackupBtn = document.getElementById('btn-adm-create-backup');
      if (createBackupBtn) {
        createBackupBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            const snap = backupService.createBackup(this.session, 'Manual Admin Backup');
            window.soundManager.playCorrect();
            this.showToast(`Backup ${snap.version} (${snap.id}) created!`, 'success');
            this.renderAdminBackups();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      const downloadBackupBtn = document.getElementById('btn-adm-download-latest-backup');
      if (downloadBackupBtn) {
        downloadBackupBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            const jsonStr = backupService.exportBackupJson(this.session, null);
            this.downloadJsonFile(`minecraft-milyoner-backup-${Date.now()}.json`, jsonStr);
            this.showToast('Backup JSON downloaded!', 'success');
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // Clear Activity Logs
      const clearLogsBtn = document.getElementById('btn-adm-clear-logs');
      if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.askConfirmation(
            '🗑️ Clear Activity Logs',
            'Are you sure you want to clear all system activity logs?',
            'Clear Logs',
            () => {
              try {
                activityService.clearAll(this.session);
                this.showToast('Activity logs cleared.', 'info');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      }

      // Settings Buttons
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
          this.handleLogout(false);
        });
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
      if (!this.session || authGuard.getEffectiveRole(this.session) !== 'ADMIN') return;
      this.renderAdminDashboard();
      this.renderAdminUsers();
      this.renderAdminRanksTab();
      this.renderAdminLicenses();
      this.renderAdminParties();
      this.renderAdminLeaderboard();
      this.renderAdminEconomyTab();
      this.renderAdminShopTab();
      this.renderAdminVipTab();
      this.renderAdminPaymentsTab();
      this.renderAdminSupport();
      this.renderAdminBugs();
      this.renderAdminSuggestions();
      this.renderAdminTransactions();
      this.renderAdminAchievements();
      this.renderAdminBackups();
      this.renderAdminActivity();
    }

    // 1. Admin Dashboard (Section 32: 12 Cards)
    renderAdminDashboard() {
      const users = userService.getAllUsers();
      const parties = partyService.listParties(this.session);
      const econProfiles = economyService.getAllProfiles();
      const tickets = supportService.listSupportTickets(this.session, false);
      const bugs = supportService.listBugReports(this.session, false);
      const sugs = supportService.listSuggestions(this.session, 'PRIORITY');
      const logs = activityService.getAll();
      const cfg = configService.getConfig();
      const revMetrics = paymentService.getRevenueMetrics();

      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status === 'ACTIVE').length;
      const vipUsers = users.filter(
        u => ['VIP', 'VIP_PLUS'].includes(u.rank) || (u.vipStatus?.isVip && !['MVP', 'MVP_PLUS', 'ELITE', 'LEGEND', 'CHAMPION', 'MILLIONAIRE'].includes(u.rank))
      ).length;
      const mvpUsers = users.filter(u =>
        ['MVP', 'MVP_PLUS', 'ELITE', 'LEGEND', 'CHAMPION', 'MILLIONAIRE'].includes(u.rank)
      ).length;
      const totalParties = parties.length;
      const activeParties = parties.filter(p =>
        ['WAITING', 'READY', 'STARTING', 'ACTIVE'].includes(p.status)
      ).length;
      const totalEmeralds = econProfiles.reduce((sum, p) => sum + (p.emeraldCoins || 0), 0);
      const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN PROGRESS').length;
      const openBugs = bugs.filter(b => b.status !== 'RESOLVED' && b.status !== 'CLOSED').length;
      const openSuggestions = sugs.filter(
        s => s.status !== 'COMPLETED' && s.status !== 'DECLINED'
      ).length;

      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      setTxt('adm-card-total-users', totalUsers);
      setTxt('adm-card-active-users', activeUsers);
      setTxt('adm-card-vip-users', vipUsers);
      setTxt('adm-card-mvp-users', mvpUsers);
      setTxt('adm-card-active-parties', activeParties);
      setTxt('adm-card-total-parties', totalParties);
      setTxt('adm-card-total-emeralds', `${totalEmeralds.toLocaleString('en-US')} 💚`);
      setTxt('adm-card-emeralds-sold', `${revMetrics.emeraldsSold.toLocaleString('en-US')} 💚`);
      setTxt('adm-card-revenue', `${revMetrics.totalRevenueTL.toLocaleString('en-US')} TL`);
      setTxt('adm-card-open-tickets', openTickets);
      setTxt('adm-card-open-bugs', openBugs);
      setTxt('adm-card-open-suggestions', openSuggestions);

      const stEx = document.getElementById('adm-status-extralife');
      if (stEx) {
        stEx.textContent = cfg.extraLife.enabled ? 'ENABLED' : 'DISABLED';
        stEx.className = cfg.extraLife.enabled ? 'emerald-text' : 'wrong-text';
      }

      const recentEl = document.getElementById('adm-dash-recent-activity');
      if (recentEl) {
        const recent = logs.slice(0, 8);
        recentEl.innerHTML =
          recent.length === 0
            ? '<div class="empty-state-box">No recent system activity.</div>'
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

    // 2. Admin Users Page (Section 33)
    renderAdminUsers() {
      const wrap = document.getElementById('adm-users-list');
      if (!wrap) return;

      const q = (document.getElementById('search-adm-users')?.value || '').toLowerCase().trim();
      const roleFilter = document.getElementById('filter-adm-users-role')?.value || 'ALL';
      let users = userService.getAllUsers();

      if (roleFilter !== 'ALL') {
        users = users.filter(u => u.role === roleFilter || u.rank === roleFilter);
      }
      if (q) {
        users = users.filter(
          u =>
            u.minecraftUsername.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q) ||
            (u.rank || '').toLowerCase().includes(q)
        );
      }

      wrap.innerHTML = users
        .map(u => {
          const prof = economyService.getPlayerEconomyProfile(u.minecraftUsername);
          const createdStr = new Date(u.createdAt).toLocaleDateString('en-US');
          const loginStr = new Date(u.lastLogin).toLocaleString('en-US');
          const rankLabel = u.rank || u.role || 'PLAYER';

          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <strong>⛏️ ${this.formatUsernameHtml(u.minecraftUsername, prof.rgbOwned && prof.rgbEnabled)}</strong>
                  <span class="meta-muted">(${u.id})</span>
                  <span class="role-badge role-${u.role.toLowerCase()}">${this.escapeHtml(prof.rankBadge || rankLabel)}</span>
                  <span class="status-pill status-${u.status === 'ACTIVE' ? 'ACTIVE' : 'REVOKED'}">${u.status}</span>
                </div>
                <div class="adm-row-sub">
                  <span>Rank: <strong class="gold-text">${this.escapeHtml(rankLabel)}</strong></span>
                  <span>⭐ Points: <strong>${prof.totalPoints.toLocaleString('en-US')}</strong></span>
                  <span>💚 Emeralds: <strong class="emerald-text">${prof.emeraldCoins.toLocaleString('en-US')}</strong></span>
                  <span>🎮 Games: <strong>${prof.gamesPlayed} (${prof.gamesWon}W / ${prof.gamesLost}L)</strong></span>
                  <span>📅 Created: ${createdStr}</span>
                  <span>🕒 Last Login: ${loginStr}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn" data-usr-act="role" data-user="${this.escapeHtml(u.minecraftUsername)}" data-role="${u.rank || u.role}">Assign Rank / Role</button>
                <button type="button" class="act-btn emerald" data-usr-act="econ" data-user="${this.escapeHtml(u.minecraftUsername)}">Edit Emeralds</button>
                <button type="button" class="act-btn ${u.status === 'SUSPENDED' ? 'emerald' : 'danger'}" data-usr-act="suspend" data-user="${this.escapeHtml(u.minecraftUsername)}">${u.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}</button>
                <button type="button" class="act-btn danger" data-usr-act="reset" data-user="${this.escapeHtml(u.minecraftUsername)}">Reset Account</button>
              </div>
            </div>
          `;
        })
        .join('');

      wrap.querySelectorAll('[data-usr-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-usr-act');
          const uname = btn.getAttribute('data-user');
          const currRole = btn.getAttribute('data-role');

          if (act === 'role') {
            const nextRole = prompt(
              `Enter new Rank or Role for ${uname} (PLAYER, VIP, VIP+, MVP, MVP+, ELITE, LEGEND, CHAMPION, MILLIONAIRE, or ADMIN):`,
              currRole === 'PLAYER' ? 'VIP' : 'MVP'
            );
            if (nextRole) {
              try {
                userService.adminUpdateUserRole(this.session, uname, nextRole);
                const normRank = nextRole.trim().toUpperCase().replace(/\+/g, '_PLUS');
                economyService._mutateAccount(uname, acc => {
                  acc.rank = normRank;
                  acc.isVip = normRank !== 'PLAYER';
                  acc.role = normRank === 'ADMIN' ? 'ADMIN' : normRank === 'PLAYER' ? 'PLAYER' : 'VIP';
                });
                this.showToast(`Rank/Role for ${uname} updated to ${nextRole.toUpperCase()}`, 'success');
                this.syncEconomyHeaderUI();
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          } else if (act === 'econ') {
            this.switchAdminTab('economy');
            const inp = document.getElementById('adm-econ-username');
            if (inp) {
              inp.value = uname;
              inp.focus();
            }
          } else if (act === 'suspend') {
            try {
              const updated = userService.adminToggleSuspendUser(this.session, uname);
              this.showToast(`${uname} status is now ${updated.status}`, 'info');
              this.renderAdminAll();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          } else if (act === 'reset') {
            this.askConfirmation(
              '⚠️ Reset Account',
              `Are you sure you want to reset Emeralds, Points, and Game statistics for "${uname}"?`,
              'Reset Account',
              () => {
                try {
                  userService.adminResetUserAccount(this.session, uname);
                  this.showToast(`Account reset completed for ${uname}.`, 'info');
                  this.syncEconomyHeaderUI();
                  this.renderAdminAll();
                } catch (err) {
                  this.showToast(err.message, 'error');
                }
              }
            );
          }
        });
      });
    }

    // 3. Admin Ranks Page (Section 6, 7, 34)
    renderAdminRanksTab() {
      const wrap = document.getElementById('adm-ranks-list');
      if (!wrap) return;
      const ranks = rankService.getAllRanks();

      wrap.innerHTML = ranks
        .map(r => {
          const p = r.permissions || {};
          const isProtected = ['PLAYER', 'VIP', 'ADMIN'].includes(r.id);
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span style="font-size:1.3rem;">${this.escapeHtml(r.badgeIcon)}</span>
                  <span class="adm-code-title" style="color:${this.escapeHtml(r.badgeColor)};">${this.escapeHtml(r.name)} (${this.escapeHtml(r.id)})</span>
                  <strong class="emerald-text">💚 ${(r.emeraldPrice || 0).toLocaleString('en-US')} Emeralds</strong>
                  <strong class="gold-text">💳 ${(r.tlPrice || 0).toLocaleString('en-US')} TL</strong>
                </div>
                <div class="adm-row-sub">
                  <span>Create Party: <strong>${p.canCreateParty ? 'YES' : 'NO'}</strong></span>
                  <span>Max Party Size: <strong>${p.maxPartySize >= 999 ? 'Unlimited' : p.maxPartySize}</strong></span>
                  <span>Emerald Multiplier: <strong>${p.emeraldMultiplier || 1}x</strong></span>
                  <span>Priority: <strong>${p.supportPriority || 'NORMAL'}</strong></span>
                  <span>RGB Included: <strong>${p.rgbName ? 'YES' : 'NO'}</strong></span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-rnk-act="edit" data-id="${this.escapeHtml(r.id)}">Load into Editor</button>
                ${
                  !isProtected
                    ? `<button type="button" class="act-btn danger" data-rnk-act="delete" data-id="${this.escapeHtml(r.id)}">Delete</button>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      wrap.querySelectorAll('[data-rnk-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-rnk-act');
          const id = btn.getAttribute('data-id');
          const r = rankService.getRankById(id);
          if (!r) return;

          if (act === 'edit') {
            document.getElementById('adm-rank-id').value = r.id;
            document.getElementById('adm-rank-name').value = r.name;
            document.getElementById('adm-rank-icon').value = r.badgeIcon;
            document.getElementById('adm-rank-color').value = r.badgeColor;
            document.getElementById('adm-rank-emerald-price').value = r.emeraldPrice;
            document.getElementById('adm-rank-tl-price').value = r.tlPrice;
            document.getElementById('adm-rank-party-limit').value = r.permissions.maxPartySize;
            document.getElementById('adm-rank-multiplier').value = r.permissions.emeraldMultiplier;
            document.getElementById('adm-rank-priority').value = r.permissions.supportPriority;
            document.getElementById('adm-rank-can-party').value = String(r.permissions.canCreateParty);
            this.showToast(`Loaded rank ${r.name} into editor.`, 'info');
          } else if (act === 'delete') {
            try {
              rankService.adminDeleteRank(this.session, id);
              this.showToast(`Rank ${id} deleted.`, 'info');
              this.renderAdminAll();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          }
        });
      });
    }

    // 4. Admin Licenses Page
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
        wrap.innerHTML = '<div class="empty-state-box">No matching licenses found.</div>';
        return;
      }

      wrap.innerHTML = list
        .map(l => {
          const createdStr = new Date(l.createdAt).toLocaleDateString('en-US');
          const expiresStr = l.expiresAt
            ? new Date(l.expiresAt).toLocaleDateString('en-US')
            : 'Never';
          const sessionInfo = l.currentSessionUser
            ? `🟢 Active User: ${this.escapeHtml(l.currentSessionUser)}`
            : l.assignedUsername
            ? `👤 Assigned: ${this.escapeHtml(l.assignedUsername)}`
            : 'Unassigned';

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
                <button type="button" class="act-btn emerald" data-lic-action="copy" data-code="${this.escapeHtml(l.code)}">Copy</button>
                <button type="button" class="act-btn" data-lic-action="role" data-id="${l.id}" data-role="${l.role}">Assign Role</button>
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
          const currRole = btn.getAttribute('data-role');

          if (action === 'copy') {
            this.copyToClipboard(code, `License code copied: ${code}`);
          } else if (action === 'role') {
            const nextRole = prompt(
              'Enter role for this license (PLAYER, VIP, or ADMIN):',
              currRole === 'PLAYER' ? 'VIP' : 'PLAYER'
            );
            if (nextRole) {
              licenseService.updateLicenseRoleOrExpiry(this.session, id, { role: nextRole });
              this.showToast('License role updated.', 'success');
              this.renderAdminAll();
            }
          } else if (action === 'disable') {
            licenseService.updateLicenseStatus(this.session, id, 'DISABLED');
            this.showToast('License disabled.', 'info');
            this.renderAdminAll();
          } else if (action === 'activate') {
            licenseService.updateLicenseStatus(this.session, id, 'ACTIVE');
            this.showToast('License reactivated.', 'success');
            this.renderAdminAll();
          } else if (action === 'revoke') {
            this.askConfirmation(
              '⚠️ Revoke License',
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
              '🗑️ Delete License',
              'Are you sure you want to permanently delete this license?',
              'Delete',
              () => {
                licenseService.deleteLicense(this.session, id);
                this.showToast('License deleted.', 'info');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    // 5. Admin Parties Page
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
        wrap.innerHTML = '<div class="empty-state-box">No parties found.</div>';
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
                  <span>👑 Owner: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                  <span>🎮 Mode: <strong>${this.escapeHtml(p.gameMode || 'Classic')}</strong></span>
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
            this.openPartyLobby(false);
          } else if (act === 'forcestart') {
            partyService.setPartyStatus(this.session, id, 'ACTIVE');
            this.showToast('Party force-started by Admin.', 'success');
            this.renderAdminAll();
          } else if (act === 'transfer') {
            const newOwner = prompt('Enter new party owner Minecraft username:');
            if (newOwner && newOwner.trim()) {
              try {
                partyService.transferOwnership(this.session, id, newOwner.trim());
                this.showToast(`Party ownership transferred to ${newOwner.trim()}.`, 'success');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          } else if (act === 'cancel') {
            partyService.setPartyStatus(this.session, id, 'CANCELLED');
            this.showToast('Party cancelled.', 'info');
            this.renderAdminAll();
          } else if (act === 'delete') {
            this.askConfirmation(
              '🗑️ Delete Party',
              'Are you sure you want to permanently delete this party?',
              'Delete Party',
              () => {
                partyService.deleteParty(this.session, id);
                this.showToast('Party deleted.', 'info');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    // 6. Admin Leaderboard Page
    renderAdminLeaderboard() {
      const wrap = document.getElementById('adm-leaderboard-list');
      if (!wrap) return;
      const sortBy = document.getElementById('adm-lb-sort')?.value || 'POINTS';
      const ranked = leaderboardService.getLeaderboard({ limit: 50, search: '', sortBy });

      wrap.innerHTML = ranked
        .map(
          r => `
          <div class="adm-row-card">
            <div class="adm-row-main">
              <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                <span class="gold-text" style="font-weight:800;">#${r.rank}</span>
                <strong>⛏️ ${this.formatUsernameHtml(r.username, r.rgbOwned && r.rgbEnabled)}</strong>
                <span class="role-badge role-${r.role.toLowerCase()}">${r.rankBadge}</span>
              </div>
              <div class="adm-row-sub">
                <span>⭐ Points: <strong>${r.totalPoints.toLocaleString('en-US')}</strong></span>
                <span>💚 Emeralds: <strong class="emerald-text">${r.emeraldCoins.toLocaleString('en-US')}</strong></span>
                <span>🏆 Wins: <strong>${r.gamesWon} (${r.winRate}%)</strong></span>
                <span>🎮 Games Played: <strong>${r.gamesPlayed}</strong></span>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }

    // 7. Admin Economy Page (Section 35)
    renderAdminEconomyTab() {
      const cfg = configService.getConfig();
      const econProfiles = economyService.getAllProfiles();

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

      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = v;
      };
      setVal('cfg-reward-completed', cfg.rewards.gameCompleted);
      setVal('cfg-reward-won', cfg.rewards.gameWon);
      setVal('cfg-reward-vip-won', cfg.rewards.vipGameWon);
      setVal('cfg-reward-daily', cfg.rewards.dailyLogin);
      setVal('cfg-reward-vip-daily', cfg.rewards.vipDailyLogin);
      setVal('cfg-reward-top3', cfg.rewards.top3Finish);
      setVal('cfg-reward-tournament', cfg.rewards.tournamentWinner);
      setVal('cfg-extralife-price', cfg.extraLife.price);
      setVal('cfg-extralife-max', cfg.extraLife.maxPerGame);
      setVal('cfg-extralife-enabled', String(cfg.extraLife.enabled));

      // Render Emerald Purchase Packages (500 - 10,000 💚)
      const pkgWrap = document.getElementById('adm-emerald-packages-list');
      if (pkgWrap) {
        const pkgs = paymentService.getEmeraldPackages(true);
        pkgWrap.innerHTML = pkgs
          .map(
            pkg => `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span>${this.escapeHtml(pkg.icon || '💚')}</span>
                  <strong>${this.escapeHtml(pkg.title)}</strong>
                  <span class="emerald-text">💚 ${pkg.emeralds.toLocaleString('en-US')} Emeralds</span>
                  <span class="gold-text">💳 ${pkg.priceTL.toLocaleString('en-US')} TL</span>
                  <span class="status-pill status-${pkg.enabled !== false ? 'ACTIVE' : 'DISABLED'}">${
                    pkg.enabled !== false ? 'ENABLED' : 'DISABLED'
                  }</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn" data-pkg-edit="${this.escapeHtml(pkg.id)}">Edit TL Price</button>
              </div>
            </div>
          `
          )
          .join('');

        pkgWrap.querySelectorAll('[data-pkg-edit]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.soundManager.playClick();
            const id = btn.getAttribute('data-pkg-edit');
            const target = pkgs.find(x => x.id === id);
            if (!target) return;
            const rawPrice = prompt(
              `Enter TL price for ${target.title} (min 100 TL):`,
              String(target.priceTL)
            );
            if (rawPrice !== null && rawPrice.trim() !== '') {
              try {
                paymentService.adminSaveEmeraldPackage(this.session, {
                  ...target,
                  priceTL: Number(rawPrice)
                });
                this.showToast(`Updated ${target.title} price to ${rawPrice} TL.`, 'success');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          });
        });
      }
    }

    // 8. Admin Emerald Shop Page
    renderAdminShopTab() {
      const shopWrap = document.getElementById('adm-shop-items-list');
      if (!shopWrap) return;
      const items = shopService.listShopItems(true, 'ALL');

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
                <span class="role-badge role-player">${this.escapeHtml(item.category)}</span>
                <strong class="emerald-text">💚 ${item.price.toLocaleString('en-US')} Emeralds</strong>
              </div>
              <div class="adm-row-sub">
                <span>Effect: <strong>${item.effectType}</strong></span>
                <span>Required Role: <strong>${item.requiredRole}</strong></span>
                <span>Limit: <strong>${item.purchaseLimit}</strong></span>
                <span>"${this.escapeHtml(item.description)}"</span>
              </div>
            </div>
            <div class="adm-row-actions">
              <button type="button" class="act-btn" data-shop-adm="price" data-id="${this.escapeHtml(item.id)}">Change Price</button>
              <button type="button" class="act-btn ${item.enabled ? 'danger' : 'emerald'}" data-shop-adm="toggle" data-id="${this.escapeHtml(item.id)}">${item.enabled ? 'Disable' : 'Enable'}</button>
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
          const allItems = shopService.listShopItems(true, 'ALL');
          const target = allItems.find(x => x.id === id);
          if (!target) return;

          if (act === 'toggle') {
            shopService.adminSaveShopItem(this.session, {
              ...target,
              enabled: !target.enabled
            });
            this.showToast(
              `${target.name} is now ${!target.enabled ? 'ENABLED' : 'DISABLED'}.`,
              'info'
            );
            this.renderAdminAll();
          } else if (act === 'price') {
            const rawNewPrice = prompt(
              `Enter new Emerald Coin price for "${target.name}":`,
              String(target.price)
            );
            if (rawNewPrice !== null && rawNewPrice.trim() !== '') {
              const parsed = Math.max(0, Math.floor(Number(rawNewPrice)));
              if (!Number.isNaN(parsed)) {
                shopService.adminSaveShopItem(this.session, {
                  ...target,
                  price: parsed
                });
                this.showToast(`${target.name} price updated to ${parsed} Emeralds.`, 'success');
                this.renderAdminAll();
              }
            }
          }
        });
      });
    }

    // 9. Admin Rank Shop & VIP Management Page (Section 34)
    renderAdminVipTab() {
      const vipWrap = document.getElementById('adm-vip-users-list');
      if (!vipWrap) return;

      const rankedUsers = userService
        .getAllUsers()
        .filter(u => u.role === 'VIP' || u.role === 'ADMIN' || u.vipStatus?.isVip || (u.rank && u.rank !== 'PLAYER'));

      vipWrap.innerHTML =
        rankedUsers.length === 0
          ? '<div class="empty-state-box">No ranked members found.</div>'
          : rankedUsers
              .map(u => {
                const prof = economyService.getPlayerEconomyProfile(u.minecraftUsername);
                return `
                  <div class="adm-row-card">
                    <div class="adm-row-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <strong>👑 ${this.escapeHtml(u.minecraftUsername)}</strong>
                        <span class="role-badge role-${u.role.toLowerCase()}">${this.escapeHtml(prof.rankBadge || u.rank || u.role)}</span>
                      </div>
                      <div class="adm-row-sub">
                        <span>Rank Tier: <strong>${this.escapeHtml(u.rank || u.vipStatus?.tier || 'VIP')}</strong></span>
                        <span>Max Party Size: <strong>${prof.permissions?.maxPartySize || 4}</strong></span>
                        <span>Expires: <strong>${u.rankExpiration || u.vipStatus?.expiresAt || 'Lifetime'}</strong></span>
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('');
    }

    // 10. Admin Payments Page (Section 25, 36)
    renderAdminPaymentsTab() {
      const payWrap = document.getElementById('adm-vip-payments-list');
      if (!payWrap) return;

      const statusFilter = document.getElementById('filter-adm-payments-status')?.value || 'ALL';
      let payments = paymentService.listPaymentIntents(this.session);
      if (statusFilter !== 'ALL') {
        payments = payments.filter(p => p.status === statusFilter);
      }

      if (payments.length === 0) {
        payWrap.innerHTML =
          '<div class="empty-state-box">No Stripe payment sessions recorded for this filter.</div>';
        return;
      }

      payWrap.innerHTML = payments
        .map(p => {
          const statusClass =
            p.status === 'PAID'
              ? 'ACTIVE'
              : p.status === 'PENDING'
              ? 'WAITING'
              : 'REVOKED';
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                  <span class="adm-code-title">${this.escapeHtml(p.id)}</span>
                  <span class="status-pill status-${statusClass}">${this.escapeHtml(p.status)}</span>
                  <strong>⛏️ ${this.escapeHtml(p.username)}</strong>
                  <strong class="gold-text">${p.amount} ${this.escapeHtml(p.currency)}</strong>
                </div>
                <div class="adm-row-sub">
                  <span>Item: <strong>${this.escapeHtml(p.title)}</strong></span>
                  <span>Type: <strong>${this.escapeHtml(p.type || 'EMERALDS')}</strong></span>
                  ${p.webhookEventId ? `<span>Webhook Event: <code>${this.escapeHtml(p.webhookEventId)}</code></span>` : ''}
                  <span>Created: ${new Date(p.createdAt).toLocaleString('en-US')}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                ${
                  p.status === 'PAID'
                    ? `<button type="button" class="act-btn danger" data-pay-act="refund" data-id="${this.escapeHtml(p.id)}">Refund</button>`
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');

      payWrap.querySelectorAll('[data-pay-act="refund"]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const id = btn.getAttribute('data-id');
          this.askConfirmation(
            '💸 Refund Payment',
            `Are you sure you want to mark payment ${id} as REFUNDED and reverse credited Emeralds?`,
            'Confirm Refund',
            () => {
              try {
                paymentService.adminRefundPayment(this.session, id, 'Admin Panel Refund');
                this.showToast(`Payment ${id} refunded.`, 'info');
                this.syncEconomyHeaderUI();
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      });
    }

    // 11. Admin Support Tickets Page (Section 28 & 30)
    renderAdminSupport() {
      const wrap = document.getElementById('adm-support-list');
      if (!wrap) return;
      const tickets = supportService.listSupportTickets(this.session, false);

      wrap.innerHTML =
        tickets.length === 0
          ? '<div class="empty-state-box">No support tickets found.</div>'
          : tickets
              .map(
                t => `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${t.priority.replace(/\s+/g, '_')}">${this.escapeHtml(t.priority)} PRIORITY</span>
                    <strong>${this.escapeHtml(t.title)}</strong>
                    <span class="status-pill status-${t.status === 'RESOLVED' ? 'ACTIVE' : 'WAITING'}">${t.status}</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>Ticket ID: <strong>${t.id}</strong></span>
                    <span>User: <strong>${this.escapeHtml(t.username)} (${this.escapeHtml(t.rank || t.role)})</strong></span>
                    <span>Category: <strong>${this.escapeHtml(t.category)}</strong></span>
                    <span>Created: ${new Date(t.createdAt).toLocaleString('en-US')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(t.description)}</p>
                  ${t.adminReply ? `<div class="emerald-text" style="font-size:0.84rem; margin-top:0.2rem;">Reply: ${this.escapeHtml(t.adminReply)}</div>` : ''}
                </div>
                <div class="adm-row-actions">
                  <button type="button" class="act-btn emerald" data-adm-sup="reply" data-id="${t.id}">Reply &amp; Resolve</button>
                  <button type="button" class="act-btn" data-adm-sup="close" data-id="${t.id}">Close</button>
                </div>
              </div>
            `
              )
              .join('');

      wrap.querySelectorAll('[data-adm-sup]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-adm-sup');
          const id = btn.getAttribute('data-id');
          if (act === 'reply') {
            const reply = prompt('Enter Admin reply for this support ticket:');
            if (reply !== null) {
              supportService.adminUpdateSupportTicket(this.session, id, {
                status: 'RESOLVED',
                adminReply: reply.trim() || 'Resolved by Admin.'
              });
              this.showToast(`Ticket ${id} resolved.`, 'success');
              this.renderAdminAll();
            }
          } else if (act === 'close') {
            supportService.adminUpdateSupportTicket(this.session, id, { status: 'CLOSED' });
            this.showToast(`Ticket ${id} closed.`, 'info');
            this.renderAdminAll();
          }
        });
      });
    }

    // 12. Admin Bug Reports Page (Section 28 & 30)
    renderAdminBugs() {
      const wrap = document.getElementById('adm-bugs-list');
      if (!wrap) return;
      const bugs = supportService.listBugReports(this.session, false);
      const statuses = ['OPEN', 'IN PROGRESS', 'WAITING FOR USER', 'RESOLVED', 'CLOSED'];

      wrap.innerHTML =
        bugs.length === 0
          ? '<div class="empty-state-box">No bug reports found.</div>'
          : bugs
              .map(
                b => `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${b.priority.replace(/\s+/g, '_')}">${this.escapeHtml(b.priority)} PRIORITY</span>
                    <strong>${this.escapeHtml(b.title)}</strong>
                    <span class="status-pill status-WAITING">${b.status}</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>ID: <strong>${b.id}</strong></span>
                    <span>User: <strong>${this.escapeHtml(b.username)} (${this.escapeHtml(b.rank || (b.isVip ? 'VIP' : 'PLAYER'))})</strong></span>
                    <span>Category: <strong>${this.escapeHtml(b.category)}</strong></span>
                    ${b.relatedParty ? `<span>Party: <strong>${this.escapeHtml(b.relatedParty)}</strong></span>` : ''}
                    <span>Created: ${new Date(b.createdAt).toLocaleString('en-US')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(b.description)}</p>
                </div>
                <div class="adm-row-actions">
                  <select class="mc-select mc-select-xs adm-bug-status-sel" data-bug-id="${b.id}">
                    ${statuses
                      .map(
                        st => `<option value="${st}" ${b.status === st ? 'selected' : ''}>${st}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>
            `
              )
              .join('');

      wrap.querySelectorAll('.adm-bug-status-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.getAttribute('data-bug-id');
          supportService.adminUpdateBugStatus(this.session, id, sel.value);
          this.showToast(`Bug ${id} status updated to ${sel.value}.`, 'success');
          this.renderAdminAll();
        });
      });
    }

    // 13. Admin Suggestions Page (Section 29 & 30)
    renderAdminSuggestions() {
      const wrap = document.getElementById('adm-suggestions-list');
      if (!wrap) return;
      const sortBy = document.getElementById('adm-suggestions-sort')?.value || 'PRIORITY';
      const sugs = supportService.listSuggestions(this.session, sortBy);
      const statuses = ['REVIEWING', 'PLANNED', 'IN DEVELOPMENT', 'COMPLETED', 'DECLINED'];

      wrap.innerHTML =
        sugs.length === 0
          ? '<div class="empty-state-box">No suggestions found.</div>'
          : sugs
              .map(
                s => `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${s.priority.replace(/\s+/g, '_')}">${this.escapeHtml(s.priority)} PRIORITY</span>
                    <strong>${this.escapeHtml(s.title)}</strong>
                    <span class="status-pill status-ACTIVE">${s.status}</span>
                    <span class="gold-text">👍 ${s.votes || 0} Votes</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>ID: <strong>${s.id}</strong></span>
                    <span>User: <strong>${this.escapeHtml(s.username)} (${this.escapeHtml(s.rank || s.role)})</strong></span>
                    <span>Category: <strong>${this.escapeHtml(s.category)}</strong></span>
                    <span>Created: ${new Date(s.createdAt).toLocaleString('en-US')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(s.description)}</p>
                </div>
                <div class="adm-row-actions">
                  <select class="mc-select mc-select-xs adm-sug-status-sel" data-sug-id="${s.id}">
                    ${statuses
                      .map(
                        st => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>
            `
              )
              .join('');

      wrap.querySelectorAll('.adm-sug-status-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.getAttribute('data-sug-id');
          supportService.adminUpdateSuggestionStatus(this.session, id, sel.value);
          this.showToast(`Suggestion ${id} status updated to ${sel.value}.`, 'success');
          this.renderAdminAll();
        });
      });
    }

    // 14. Admin Transactions Page
    renderAdminTransactions() {
      const txListEl = document.getElementById('adm-tx-history-list');
      if (!txListEl) return;
      const q = (document.getElementById('search-adm-tx-history')?.value || '').toLowerCase().trim();
      let allTxs = economyService.getTransactionHistory(this.session, null);
      if (q) {
        allTxs = allTxs.filter(
          tx =>
            tx.username.toLowerCase().includes(q) ||
            tx.reason.toLowerCase().includes(q) ||
            tx.id.toLowerCase().includes(q)
        );
      }

      txListEl.innerHTML =
        allTxs.length === 0
          ? '<div class="empty-state-box">No transactions found.</div>'
          : allTxs
              .slice(0, 100)
              .map(tx => {
                const isNeg = tx.amount < 0;
                const sign = tx.amount > 0 ? '+' : '';
                const amtStr =
                  tx.amount === 0
                    ? '❤️ 1 Extra Life Used'
                    : `${sign}${tx.amount.toLocaleString('en-US')} Emeralds`;
                return `
                  <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
                    <div class="tx-main">
                      <span class="tx-reason"><strong>⛏️ ${this.escapeHtml(
                        tx.username
                      )}</strong> — ${this.escapeHtml(tx.reason)} <span class="meta-muted">[${tx.id}]</span></span>
                      <span class="tx-meta">[${tx.dateFormatted}] • Prev Balance: 💚 ${Number(tx.previousBalance || 0).toLocaleString('en-US')} → New Balance: 💚 ${tx.balanceAfter.toLocaleString('en-US')} • Source: ${this.escapeHtml(tx.source || 'System')}</span>
                    </div>
                    <div class="tx-amount ${isNeg ? 'wrong-text' : 'emerald-text'}">${amtStr}</div>
                  </div>
                `;
              })
              .join('');
    }

    // 15. Admin Achievements Page
    renderAdminAchievements() {
      const wrap = document.getElementById('adm-achievements-list');
      if (!wrap) return;
      const catalog = achievementService.getCatalog();
      wrap.innerHTML = catalog
        .map(
          a => `
          <div class="adm-row-card">
            <div class="adm-row-main">
              <div style="display:flex; gap:0.55rem; align-items:center;">
                <span style="font-size:1.4rem;">${a.icon}</span>
                <strong>${this.escapeHtml(a.title)}</strong>
                <span class="meta-muted">(${a.id})</span>
              </div>
              <div class="adm-row-sub">
                <span>${this.escapeHtml(a.description)}</span>
                <span class="emerald-text">Bonus: +${a.bonusEmeralds} 💚</span>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }

    // 16. Admin Backups Page (Section 37)
    renderAdminBackups() {
      const wrap = document.getElementById('adm-backups-list');
      if (!wrap) return;
      const backups = backupService.listBackups(this.session);

      wrap.innerHTML = backups
        .map(
          b => `
          <div class="adm-row-card">
            <div class="adm-row-main">
              <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                <span class="adm-code-title">${this.escapeHtml(b.id)}</span>
                <span class="status-pill status-ACTIVE">${this.escapeHtml(b.version)}</span>
                <strong>${this.escapeHtml(b.label)}</strong>
              </div>
              <div class="adm-row-sub">
                <span>📅 Created: ${new Date(b.createdAt).toLocaleString('en-US')}</span>
                <span>📁 <code>backup/users/</code> (${b.counts.users})</span>
                <span>📁 <code>backup/parties/</code> (${b.counts.parties})</span>
                <span>📁 <code>backup/licenses/</code> (${b.counts.licenses})</span>
                <span>📁 <code>backup/transactions/</code> (${b.counts.transactions})</span>
                <span>📁 <code>backup/payments/</code> (${b.counts.payments || 0})</span>
                <span>📁 <code>backup/settings/</code> (Ready)</span>
              </div>
            </div>
            <div class="adm-row-actions">
              <button type="button" class="act-btn emerald" data-bkp-act="download" data-id="${b.id}">⬇️ Download Backup</button>
              <button type="button" class="act-btn" data-bkp-act="export" data-id="${b.id}">Copy JSON</button>
              <button type="button" class="act-btn danger" data-bkp-act="restore" data-id="${b.id}">Restore Snapshot</button>
            </div>
          </div>
        `
        )
        .join('');

      wrap.querySelectorAll('[data-bkp-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-bkp-act');
          const id = btn.getAttribute('data-id');
          const target = backups.find(x => x.id === id);
          if (!target) return;

          if (act === 'download') {
            const jsonStr = JSON.stringify(target, null, 2);
            this.downloadJsonFile(`minecraft-milyoner-${target.id}.json`, jsonStr);
            this.showToast(`Downloaded ${target.id}.json!`, 'success');
          } else if (act === 'export') {
            this.copyToClipboard(
              JSON.stringify(target, null, 2),
              `Backup ${target.id} JSON copied to clipboard!`
            );
          } else if (act === 'restore') {
            this.askConfirmation(
              '💾 Restore Backup Snapshot',
              `Are you sure you want to restore system state to ${target.id} (${target.version})?`,
              'Restore Backup',
              () => {
                backupService.restoreBackup(this.session, id);
                this.showToast(`Restored backup ${target.id}.`, 'success');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    // 17. Admin Activity Logs
    renderAdminActivity() {
      const wrap = document.getElementById('adm-full-activity-list');
      if (!wrap) return;
      const logs = activityService.getAll();
      wrap.innerHTML =
        logs.length === 0
          ? '<div class="empty-state-box">No activity logs recorded.</div>'
          : logs
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
    downloadJsonFile(filename, content) {
      try {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        this.copyToClipboard(content, 'Backup JSON copied to clipboard!');
      }
    }

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
        this.showToast('Copy failed.', 'error');
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
