/**
 * MINECRAFT MİLYONER — TURNUVA, HESAP, PARTİ, VIP, EKONOMİ, AVATAR & ADMİN KONTROLCÜSÜ
 *
 * Tüm arayüz ekranlarını 15 modüler servise bağlar:
 * - Adım Adım Lisans -> Kullanıcı Adı Girişi & "Tekrar Hoş Geldin" akışı
 * - Tam Boyutlu Minecraft Yan Menü Çekmecesi (☰ MENÜ) & Mobil Admin Çekmecesi
 * - Oyuncu Profili, Profil Fotoğrafı Yükleme (160x160 Kare Kırpma + Önizleme) & Minecraft Piksel Avatar
 * - Profil Özelleştirme (Çerçeve, Arka Plan, Tema, Gizlilik, Başarım Vitrini, RGB İsim)
 * - Parti Sistemi (Sadece Rütbeli/ADMIN oluşturur & davet eder; Normal oyuncu katılır/ayrılır; Lisansı ASLA sıfırlamaz)
 * - Liderlik Tablosu (Puan, Galibiyet, Zümrüt, Oyun Sayısı sıralaması + İlk 3 Podyumu)
 * - Zümrüt Mağazası, Rütbe Mağazası, Kozmetikler & VIP Mağazası (Stripe Test Modu & Webhook Doğrulaması)
 * - Destek Talepleri, Hata Bildirimleri & Öneriler (VIP Yüksek, VIP+/MVP Çok Yüksek Öncelik)
 * - 18 Sayfalı %100 Türkçe Admin Paneli
 */

(function () {
  'use strict';

  const {
    authGuard,
    authService,
    userService,
    licenseService,
    partyService,
    supportService,
    bugService,
    suggestionService,
    avatarService,
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
    soundService,
    PARTY_STATUSES
  } = window.MCMServices;

  const PARTY_STATUS_LABELS_TR = {
    WAITING: 'BEKLİYOR',
    READY: 'HAZIR',
    STARTING: 'BAŞLIYOR',
    ACTIVE: 'AKTİF',
    FINISHED: 'TAMAMLANDI',
    CANCELLED: 'İPTAL EDİLDİ'
  };

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
      this.pendingCroppedAvatarDataUrl = null;

      this.init();
    }

    init() {
      this.bindLicenseGate();
      this.bindTopBar();
      this.bindMainMenuDrawer();
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
      this.bindGranularAudioSettings();

      // Liderlik tablosu ve üst bar için canlı otomatik yenileme
      this.leaderboardRefreshTimer = setInterval(() => {
        if (!this.session) return;
        const lbScreen = document.getElementById('screen-leaderboard');
        if (lbScreen && lbScreen.classList.contains('active')) {
          this.renderLeaderboard();
        }
        this.syncEconomyHeaderUI();
      }, 10000);

      // URL ?invite=MCM-XXXX kontrolü
      try {
        const params = new URLSearchParams(window.location.search);
        const inviteParam = params.get('invite');
        if (inviteParam) {
          this.pendingInviteCodeFromUrl = inviteParam.trim().toUpperCase();
        }
      } catch (e) {}

      // Tarayıcı Geri/İleri (popstate) navigasyon desteği
      window.addEventListener('popstate', () => {
        if (!this.session) return;
        this.restoreRouteFromHash(true);
      });

      // 1. Aktif oturumu kontrol et
      const existingSession = licenseService.getActiveSession();
      if (existingSession) {
        this.applyAuthenticatedSession(existingSession, false);
        return;
      }

      // 2. Kayıtlı hesabı kontrol et ("TEKRAR HOŞ GELDİN" ekranı)
      const remembered = licenseService.getRememberedUser();
      if (remembered && remembered.username) {
        this.lockWithLicenseGate(true);
      } else {
        this.lockWithLicenseGate(false);
      }
    }

    // ==========================================
    // BİLDİRİM (TOAST) SİSTEMİ
    // ==========================================
    showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      if (window.soundManager) {
        if (type === 'info') window.soundManager.playNotification();
      }

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
    // ONAY PENCERESİ (CONFIRM MODAL)
    // ==========================================
    askConfirmation(title, message, acceptLabel, onConfirm) {
      const modal = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const acceptText = document.getElementById('btn-confirm-accept-text');

      if (!modal) return;
      if (titleEl) titleEl.textContent = title || '⚠️ İşlemi Onayla';
      if (msgEl) msgEl.textContent = message || 'Devam etmek istediğinize emin misiniz?';
      if (acceptText) acceptText.textContent = acceptLabel || 'Onayla';

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
    // DETAYLI SES AYARLARI BAĞLANTILARI (BÖLÜM 4 & 30)
    // ==========================================
    bindGranularAudioSettings() {
      const menuChk = document.getElementById('chk-audio-menu-sound');
      const notifChk = document.getElementById('chk-audio-notif-sound');
      const shopChk = document.getElementById('chk-audio-shop-sound');
      const accAudioBtn = document.getElementById('btn-acc-open-audio');

      const syncCheckboxes = () => {
        if (!window.soundManager) return;
        if (menuChk) menuChk.checked = window.soundManager.menuSoundEnabled !== false;
        if (notifChk) notifChk.checked = window.soundManager.notificationSoundEnabled !== false;
        if (shopChk) shopChk.checked = window.soundManager.shopSoundEnabled !== false;
      };

      syncCheckboxes();

      if (menuChk) {
        menuChk.addEventListener('change', () => {
          if (window.soundManager) {
            window.soundManager.setMenuSoundEnabled(menuChk.checked);
            window.soundManager.playClick();
          }
        });
      }
      if (notifChk) {
        notifChk.addEventListener('change', () => {
          if (window.soundManager) {
            window.soundManager.setNotificationSoundEnabled(notifChk.checked);
            window.soundManager.playNotification();
          }
        });
      }
      if (shopChk) {
        shopChk.addEventListener('change', () => {
          if (window.soundManager) {
            window.soundManager.setShopSoundEnabled(shopChk.checked);
            window.soundManager.playPurchase();
          }
        });
      }
      if (accAudioBtn) {
        accAudioBtn.addEventListener('click', () => {
          window.soundManager.playMenuOpen();
          syncCheckboxes();
          if (window.mcQuizGame) window.mcQuizGame.openModal('modal-audio');
        });
      }
    }

    // ==========================================
    // SAĞ TARAFTAN AÇILAN KOMPAKT ANA MENÜ ÇEKMECESİ (☰ MENÜ)
    // ==========================================
    bindMainMenuDrawer() {
      const openBtn = document.getElementById('btn-open-main-drawer');
      const closeBtn = document.getElementById('btn-close-main-drawer');
      const backdrop = document.getElementById('main-menu-backdrop');
      const drawer = document.getElementById('main-menu-drawer');
      const drawerUserCard = document.getElementById('drawer-user-card');

      const openDrawer = () => {
        if (!this.session) return;
        this.syncMainMenuDrawerUI();
        if (drawer) {
          drawer.classList.remove('hidden');
          drawer.setAttribute('aria-hidden', 'false');
          requestAnimationFrame(() => drawer.classList.add('open'));
        }
        if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
        if (backdrop) backdrop.classList.remove('hidden');
        if (window.soundManager) window.soundManager.playMenuOpen();
      };

      const closeDrawer = (playSound = true) => {
        if (drawer) {
          drawer.classList.remove('open');
          drawer.setAttribute('aria-hidden', 'true');
          setTimeout(() => {
            if (!drawer.classList.contains('open')) drawer.classList.add('hidden');
          }, 240);
        }
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
        if (backdrop) backdrop.classList.add('hidden');
        if (playSound && window.soundManager) window.soundManager.playMenuClose();
      };

      this.openMainMenuDrawer = openDrawer;
      this.closeMainMenuDrawer = closeDrawer;

      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (drawer && drawer.classList.contains('open')) {
            closeDrawer(true);
          } else {
            openDrawer();
          }
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', () => closeDrawer(true));
      }
      if (backdrop) {
        backdrop.addEventListener('click', () => closeDrawer(true));
      }

      // ESC tuşu ile menüyü kapatma
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
          closeDrawer(true);
        }
      });

      if (drawerUserCard) {
        const goProfile = () => {
          closeDrawer(false);
          window.soundManager.playClick();
          this.navigateToScreen('screen-profile');
        };
        drawerUserCard.addEventListener('click', goProfile);
        drawerUserCard.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goProfile();
          }
        });
      }

      // Tüm sağ menü butonlarını bağla (Profil, Destek, Hata Bildir, Öneri Gönder, Zümrüt Mağazası, Rütbe Mağazası, Partiler, İstatistikler, Liderlik Tablosu, Nasıl Oynanır?, Ayarlar, Admin, Çıkış Yap)
      const drawerEl = document.getElementById('main-menu-drawer');
      if (drawerEl) {
        drawerEl.querySelectorAll('.drawer-nav-item').forEach(btn => {
          btn.addEventListener('click', e => {
            e.preventDefault();
            window.soundManager.playClick();

            const action = btn.getAttribute('data-drawer-action');
            const supportTab = btn.getAttribute('data-drawer-support-tab');
            const shopCat = btn.getAttribute('data-drawer-shop-cat');
            const targetScreen =
              btn.getAttribute('data-drawer-screen') || btn.getAttribute('data-drawer-nav');

            closeDrawer(false);

            // 1. Özel Aksiyonlar (İstatistikler Modalı, Nasıl Oynanır Modalı, Çıkış Yap)
            if (action === 'logout') {
              this.handleLogout(false);
              return;
            }
            if (action === 'open-stats') {
              if (window.mcQuizGame) {
                window.mcQuizGame.renderMenuStats();
                window.mcQuizGame.openModal('modal-stats');
              }
              this.updateActiveDrawerHighlight(null, { action: 'open-stats' });
              this.pushRouteHash('#stats');
              return;
            }
            if (action === 'open-rules') {
              if (window.mcQuizGame) {
                window.mcQuizGame.openModal('modal-rules');
              }
              this.updateActiveDrawerHighlight(null, { action: 'open-rules' });
              this.pushRouteHash('#rules');
              return;
            }

            // 2. Destek Sekmeleri (Destek, Hata Bildir, Öneri Gönder)
            if (supportTab) {
              this.navigateToScreen('screen-support', { supportTab });
              return;
            }

            // 3. Mağaza Kategorisi (Zümrüt Mağazası / Rütbe Mağazası)
            if (shopCat) {
              this.selectedShopCategory = shopCat;
              document.querySelectorAll('[data-shop-cat]').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-shop-cat') === shopCat);
              });
            }

            // 4. Ekran Navigasyonu
            if (targetScreen) {
              this.navigateToScreen(targetScreen, { shopCat });
            }
          });
        });
      }
    }

    updateActiveDrawerHighlight(screenId, options = {}) {
      const drawerEl = document.getElementById('main-menu-drawer');
      if (!drawerEl) return;

      drawerEl.querySelectorAll('.drawer-nav-item').forEach(btn => {
        btn.classList.remove('active');
        const btnAction = btn.getAttribute('data-drawer-action');
        const btnSupport = btn.getAttribute('data-drawer-support-tab');
        const btnScreen =
          btn.getAttribute('data-drawer-screen') || btn.getAttribute('data-drawer-nav');
        const btnShopCat = btn.getAttribute('data-drawer-shop-cat');

        if (options.action && btnAction === options.action) {
          btn.classList.add('active');
          return;
        }
        if (screenId === 'screen-support' && options.supportTab && btnSupport === options.supportTab) {
          btn.classList.add('active');
          return;
        }
        if (screenId && btnScreen === screenId && !btnSupport) {
          if (screenId === 'screen-shop' && options.shopCat && btnShopCat && btnShopCat !== options.shopCat) {
            return;
          }
          btn.classList.add('active');
        }
      });
    }

    pushRouteHash(hash, replace = false) {
      if (!hash) return;
      try {
        if (window.location.hash === hash) return;
        const url = `${window.location.pathname}${window.location.search}${hash}`;
        if (replace) {
          window.history.replaceState({ hash }, '', url);
        } else {
          window.history.pushState({ hash }, '', url);
        }
      } catch (e) {}
    }

    restoreRouteFromHash(fromPopState = false) {
      if (!this.session) return false;
      const rawHash = (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
      if (!rawHash || rawHash === 'home' || rawHash === 'menu') {
        if (fromPopState) {
          this.navigateToScreen('screen-menu', { skipHistory: true });
        }
        return false;
      }

      const closeOpenModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      };
      closeOpenModals();

      switch (rawHash) {
        case 'profile':
        case 'profil':
          this.navigateToScreen('screen-profile', { skipHistory: true });
          return true;
        case 'support':
        case 'destek':
          this.navigateToScreen('screen-support', { supportTab: 'support', skipHistory: true });
          return true;
        case 'bug':
        case 'hata':
          this.navigateToScreen('screen-support', { supportTab: 'bug', skipHistory: true });
          return true;
        case 'suggestion':
        case 'oneri':
          this.navigateToScreen('screen-support', { supportTab: 'suggestion', skipHistory: true });
          return true;
        case 'shop':
        case 'magaza':
          this.selectedShopCategory = 'ALL';
          this.navigateToScreen('screen-shop', { shopCat: 'ALL', skipHistory: true });
          return true;
        case 'ranks':
        case 'rutbe':
        case 'vip':
          this.navigateToScreen('screen-vip-shop', { skipHistory: true });
          return true;
        case 'party':
        case 'partiler':
          this.navigateToScreen('screen-party', { skipHistory: true });
          return true;
        case 'leaderboard':
        case 'liderlik':
          this.navigateToScreen('screen-leaderboard', { skipHistory: true });
          return true;
        case 'settings':
        case 'ayarlar':
          this.navigateToScreen('screen-account-settings', { skipHistory: true });
          return true;
        case 'history':
        case 'gecmis':
          this.navigateToScreen('screen-history', { skipHistory: true });
          return true;
        case 'admin':
          if (authGuard.getEffectiveRole(this.session) === 'ADMIN') {
            this.navigateToScreen('screen-admin', { skipHistory: true });
            return true;
          }
          break;
        case 'stats':
        case 'istatistikler':
          this.navigateToScreen('screen-menu', { skipHistory: true });
          if (window.mcQuizGame) {
            window.mcQuizGame.renderMenuStats();
            window.mcQuizGame.openModal('modal-stats');
          }
          this.updateActiveDrawerHighlight(null, { action: 'open-stats' });
          return true;
        case 'rules':
        case 'kurallar':
          this.navigateToScreen('screen-menu', { skipHistory: true });
          if (window.mcQuizGame) {
            window.mcQuizGame.openModal('modal-rules');
          }
          this.updateActiveDrawerHighlight(null, { action: 'open-rules' });
          return true;
        default:
          break;
      }
      return false;
    }

    syncMainMenuDrawerUI() {
      if (!this.session) return;
      const effRole = authGuard.getEffectiveRole(this.session);
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const userObj = userService.getUserByUsername(this.session.username);
      const avatarUrl = avatarService.getUserAvatarUrl(userObj || this.session.username);
      const borderKey = userObj?.profileBorder || 'stone';

      const dAvatar = document.getElementById('drawer-user-avatar');
      const dName = document.getElementById('drawer-user-name');
      const dRole =
        document.getElementById('drawer-user-rank') || document.getElementById('drawer-user-role');
      const dEmeralds = document.getElementById('drawer-user-emeralds');
      const dAdminBtn = document.getElementById('btn-drawer-admin');

      if (dAvatar) {
        dAvatar.src = avatarUrl;
        dAvatar.className = `mc-avatar-img mc-avatar-sm avatar-border-${borderKey}`;
      }
      if (dName) {
        dName.innerHTML = this.formatUsernameHtml(
          this.session.username,
          profile.rgbOwned && profile.rgbEnabled
        );
      }
      if (dRole) {
        dRole.textContent = profile.rankBadge || effRole;
        dRole.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (dEmeralds) {
        dEmeralds.textContent = profile.emeraldCoins.toLocaleString('tr-TR');
      }
      if (dAdminBtn) {
        dAdminBtn.classList.toggle('hidden', effRole !== 'ADMIN');
      }
    }

    // ==========================================
    // AVATAR & TEMA YARDIMCILARI (BÖLÜM 9, 10, 11, 29)
    // ==========================================
    getAvatarImgHtml(username, sizeClass = 'mc-avatar-xs') {
      const userObj = userService.getUserByUsername(username);
      const url = avatarService.getUserAvatarUrl(userObj || username);
      const border = userObj?.profileBorder || 'stone';
      return `<img src="${url}" alt="${this.escapeHtml(username)}" class="mc-avatar-img ${sizeClass} avatar-border-${border}" />`;
    }

    applyUserThemePreference() {
      if (!this.session) {
        document.body.classList.remove('theme-mc-light');
        return;
      }
      const userObj = userService.getUserByUsername(this.session.username);
      const theme = userObj?.settings?.theme || 'dark';
      document.body.classList.toggle('theme-mc-light', theme === 'light');
    }

    // ==========================================
    // KAYIT OL / GİRİŞ YAP / ŞİFREMİ UNUTTUM & TEKRAR HOŞ GELDİN EKRANI
    // ==========================================
    switchAuthGateTab(tabName = 'login') {
      const loginForm = document.getElementById('gate-form-login');
      const regForm = document.getElementById('gate-form-register');
      const forgotForm = document.getElementById('gate-form-forgot');

      document.querySelectorAll('[data-auth-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-auth-tab') === tabName);
      });

      if (loginForm) loginForm.classList.toggle('hidden', tabName !== 'login');
      if (regForm) regForm.classList.toggle('hidden', tabName !== 'register');
      if (forgotForm) forgotForm.classList.toggle('hidden', tabName !== 'forgot');

      ['gate-login-error', 'gate-register-error', 'gate-forgot-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
    }

    lockWithLicenseGate(showWelcomeBack = false) {
      this.session = null;
      this.pendingLicenseToken = null;
      if (window.mcQuizGame) {
        window.mcQuizGame.isUnlocked = false;
      }
      document.body.classList.add('gate-locked');
      document.body.classList.remove('theme-mc-light');

      const gateEl = document.getElementById('access-gate');
      const wbStep = document.getElementById('gate-step-welcome-back');
      const authTabs = document.getElementById('gate-auth-tabs');
      const loginForm = document.getElementById('gate-form-login');
      const regForm = document.getElementById('gate-form-register');
      const forgotForm = document.getElementById('gate-form-forgot');

      if (gateEl) gateEl.classList.remove('hidden');

      const remembered = licenseService.getRememberedUser();
      if (showWelcomeBack && remembered && remembered.username) {
        if (wbStep) wbStep.classList.remove('hidden');
        if (authTabs) authTabs.classList.add('hidden');
        if (loginForm) loginForm.classList.add('hidden');
        if (regForm) regForm.classList.add('hidden');
        if (forgotForm) forgotForm.classList.add('hidden');

        const wbName = document.getElementById('wb-username-display');
        const wbRole = document.getElementById('wb-role-badge');
        const wbLic = document.getElementById('wb-license-badge');
        const wbAvatarBox = document.getElementById('wb-avatar-box');

        if (wbName) wbName.textContent = remembered.username;
        if (wbRole) {
          wbRole.textContent = remembered.role || 'PLAYER';
          wbRole.className = `role-badge role-${String(remembered.role || 'player').toLowerCase()}`;
        }
        if (wbLic) wbLic.textContent = remembered.licenseName || 'Kayıtlı Lisans';
        if (wbAvatarBox) {
          wbAvatarBox.innerHTML = this.getAvatarImgHtml(remembered.username, 'mc-avatar-sm');
        }
      } else {
        if (wbStep) wbStep.classList.add('hidden');
        if (authTabs) authTabs.classList.remove('hidden');
        this.switchAuthGateTab('login');
        const loginUserInp = document.getElementById('login-username-input');
        if (loginUserInp) {
          setTimeout(() => loginUserInp.focus(), 60);
        }
      }

      this.updateTopBarSessionUI();
    }

    bindLicenseGate() {
      const gateEl = document.getElementById('access-gate');
      const gateCard = gateEl ? gateEl.querySelector('.gate-card') : null;
      const wbContinueBtn = document.getElementById('btn-wb-continue');
      const wbSwitchBtn = document.getElementById('btn-wb-switch-account');

      const loginForm = document.getElementById('gate-form-login');
      const regForm = document.getElementById('gate-form-register');
      const forgotForm = document.getElementById('gate-form-forgot');
      const toggleLoginPwdBtn = document.getElementById('btn-toggle-login-pwd');
      const loginPwdInp = document.getElementById('login-password-input');

      const shakeGate = () => {
        if (!gateCard) return;
        gateCard.classList.remove('shake');
        void gateCard.offsetWidth;
        gateCard.classList.add('shake');
      };

      // Sekme geçişleri (Giriş Yap / Kayıt Ol / Şifremi Unuttum)
      document.querySelectorAll('[data-auth-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const tab = btn.getAttribute('data-auth-tab') || 'login';
          this.switchAuthGateTab(tab);
        });
      });

      if (toggleLoginPwdBtn && loginPwdInp) {
        toggleLoginPwdBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const isPwd = loginPwdInp.type === 'password';
          loginPwdInp.type = isPwd ? 'text' : 'password';
          toggleLoginPwdBtn.textContent = isPwd ? '🙈' : '👁️';
          loginPwdInp.focus();
        });
      }

      // Tekrar Hoş Geldin -> Devam Et
      if (wbContinueBtn) {
        wbContinueBtn.addEventListener('click', () => {
          window.soundManager.playSuccess();
          const resumed = licenseService.resumeRememberedAccount();
          if (resumed) {
            this.applyAuthenticatedSession(resumed, true);
          } else {
            this.lockWithLicenseGate(false);
          }
        });
      }

      // Tekrar Hoş Geldin -> Hesap Değiştir
      if (wbSwitchBtn) {
        wbSwitchBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.lockWithLicenseGate(false);
        });
      }

      // 1. GİRİŞ YAP FORMU
      if (loginForm) {
        loginForm.addEventListener('submit', async e => {
          e.preventDefault();
          const username = document.getElementById('login-username-input')?.value || '';
          const password = document.getElementById('login-password-input')?.value || '';
          const licenseCode = document.getElementById('login-license-input')?.value || '';
          const errEl = document.getElementById('gate-login-error');
          const submitBtn = document.getElementById('btn-login-submit');

          if (errEl) errEl.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = true;

          const res = await licenseService.loginWithCredentials({
            username,
            password,
            licenseCode
          });

          if (submitBtn) submitBtn.disabled = false;

          if (!res.ok) {
            window.soundManager.playError();
            if (errEl) {
              errEl.textContent = `❌ ${res.error}`;
              errEl.classList.remove('hidden');
            }
            shakeGate();
            return;
          }

          window.soundManager.playSuccess();
          loginForm.reset();
          this.applyAuthenticatedSession(res.session, true);
        });
      }

      // 2. KAYIT OL FORMU
      if (regForm) {
        regForm.addEventListener('submit', async e => {
          e.preventDefault();
          const username = document.getElementById('reg-username-input')?.value || '';
          const password = document.getElementById('reg-password-input')?.value || '';
          const confirmPassword = document.getElementById('reg-password-confirm-input')?.value || '';
          const licenseCode = document.getElementById('reg-license-input')?.value || '';
          const errEl = document.getElementById('gate-register-error');
          const submitBtn = document.getElementById('btn-register-submit');

          if (errEl) errEl.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = true;

          const res = await licenseService.registerAccount({
            username,
            password,
            confirmPassword,
            licenseCode
          });

          if (submitBtn) submitBtn.disabled = false;

          if (!res.ok) {
            window.soundManager.playError();
            if (errEl) {
              errEl.textContent = `❌ ${res.error}`;
              errEl.classList.remove('hidden');
            }
            shakeGate();
            return;
          }

          window.soundManager.playSuccess();
          regForm.reset();
          this.applyAuthenticatedSession(res.session, true);
        });
      }

      // 3. ŞİFREMİ UNUTTUM FORMU
      if (forgotForm) {
        forgotForm.addEventListener('submit', async e => {
          e.preventDefault();
          const username = document.getElementById('forgot-username-input')?.value || '';
          const licenseCode = document.getElementById('forgot-license-input')?.value || '';
          const newPassword = document.getElementById('forgot-new-password-input')?.value || '';
          const errEl = document.getElementById('gate-forgot-error');
          const submitBtn = document.getElementById('btn-forgot-submit');

          if (errEl) errEl.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = true;

          const res = await licenseService.resetPasswordWithLicenseOrRecovery({
            username,
            licenseCode,
            newPassword
          });

          if (submitBtn) submitBtn.disabled = false;

          if (!res.ok) {
            window.soundManager.playError();
            if (errEl) {
              errEl.textContent = `❌ ${res.error}`;
              errEl.classList.remove('hidden');
            }
            shakeGate();
            return;
          }

          window.soundManager.playSuccess();
          forgotForm.reset();
          this.showToast(res.message || 'Şifreniz başarıyla sıfırlandı. Giriş yapabilirsiniz.', 'success');
          this.switchAuthGateTab('login');
          const loginUserInp = document.getElementById('login-username-input');
          if (loginUserInp) loginUserInp.value = username.trim();
        });
      }
    }

    applyAuthenticatedSession(session, isFreshLogin = false) {
      this.session = licenseService.refreshSessionRole(session) || session;
      document.body.classList.remove('gate-locked');

      const gateEl = document.getElementById('access-gate');
      if (gateEl) gateEl.classList.add('hidden');

      // Ekonomi ve kullanıcı profilini senkronize et
      economyService.getOrCreateAccount(this.session.username, this.session.role);
      this.applyUserThemePreference();

      // Oyuncu bazlı izole istatistikleri yükle
      if (window.mcQuizGame) {
        if (window.mcQuizGame.statsManager && typeof window.mcQuizGame.statsManager.setUserId === 'function') {
          window.mcQuizGame.statsManager.setUserId(this.session.userId || this.session.username);
          window.mcQuizGame.renderMenuStats();
        }
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

      // URL'de ?invite=MCM-XXXX varsa otomatik partiye katıl
      if (this.pendingInviteCodeFromUrl) {
        const code = this.pendingInviteCodeFromUrl;
        this.pendingInviteCodeFromUrl = null;
        try {
          const joined = partyService.joinPartyByInviteCode(this.session, code);
          this.selectedPartyId = joined.id;
          window.soundManager.playPartyJoin();
          this.showToast(`"${joined.name}" partisine başarıyla katıldınız!`, 'success');
          this.navigateToScreen('screen-party');
          return;
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }

      // Sayfa yenilendiğinde (F5) veya doğrudan #hash ile gelindiğinde ilgili ekranı geri yükle
      const restored = this.restoreRouteFromHash(false);
      if (!restored) {
        this.updateActiveDrawerHighlight('screen-menu');
      }

      if (isFreshLogin) {
        const effRole = authGuard.getEffectiveRole(this.session);
        if (effRole === 'ADMIN') {
          this.showToast(`Tekrar hoş geldin, ${this.session.username}! Admin Paneli aktif.`, 'info');
        } else if (effRole !== 'PLAYER') {
          this.showToast(`Hoş geldin, 👑 ${effRole} ${this.session.username}!`, 'success');
        } else {
          this.showToast(`Hoş geldin, ${this.session.username}!`, 'success');
        }
      }
    }

    handleLogout(clearRemembered = false) {
      licenseService.logout(clearRemembered);
      this.showToast('Çıkış yapıldı. Kayıtlı hesabınızla devam edebilir veya başka bir hesaba giriş yapabilirsiniz.', 'info');
      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-menu');
      }
      this.pushRouteHash('#home', true);
      this.lockWithLicenseGate(!clearRemembered);
    }

    // ==========================================
    // RGB KULLANICI ADI YARDIMCISI
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
    // ÜST BAR VE KOMPAKT SAĞ MENÜ KULLANICI PANELİ
    // ==========================================
    updateTopBarSessionUI() {
      const openDrawerBtn = document.getElementById('btn-open-main-drawer');
      const emeraldPill = document.getElementById('top-emerald-pill');
      const dailyBtn = document.getElementById('btn-daily-reward');
      const badge = document.getElementById('top-session-badge');
      const topAvatar = document.getElementById('top-session-avatar');
      const nameEl = document.getElementById('top-session-username');
      const roleEl = document.getElementById('top-session-role');
      const adminBtn = document.getElementById('btn-top-admin');
      const logoutBtn = document.getElementById('btn-top-logout');

      if (!this.session) {
        if (openDrawerBtn) openDrawerBtn.classList.add('hidden');
        if (emeraldPill) emeraldPill.classList.add('hidden');
        if (dailyBtn) dailyBtn.classList.add('hidden');
        if (badge) badge.classList.add('hidden');
        if (adminBtn) adminBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        return;
      }

      const effRole = authGuard.getEffectiveRole(this.session);
      this.session.role = effRole;
      const userObj = userService.getUserByUsername(this.session.username);
      const avatarUrl = avatarService.getUserAvatarUrl(userObj || this.session.username);
      const borderKey = userObj?.profileBorder || 'stone';

      if (openDrawerBtn) openDrawerBtn.classList.remove('hidden');
      if (emeraldPill) emeraldPill.classList.remove('hidden');
      if (dailyBtn) dailyBtn.classList.remove('hidden');
      if (badge) badge.classList.remove('hidden');
      if (topAvatar) {
        topAvatar.src = avatarUrl;
        topAvatar.className = `mc-avatar-img mc-avatar-xs avatar-border-${borderKey}`;
      }
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

      this.syncMainMenuDrawerUI();
    }

    syncEconomyHeaderUI() {
      if (!this.session) return;
      this.session = licenseService.refreshSessionRole(this.session) || this.session;
      const effRole = authGuard.getEffectiveRole(this.session);
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const rankSummary = leaderboardService.getPlayerRankAndSummary(this.session.username);
      const dailyStatus = dailyRewardService.canClaimDailyReward(this.session.username);
      const userObj = userService.getUserByUsername(this.session.username);
      const avatarUrl = avatarService.getUserAvatarUrl(userObj || this.session.username);
      const borderKey = userObj?.profileBorder || 'stone';

      const extraOwned =
        (profile.inventory?.extraLives || 0) + (profile.inventory?.secondChance || 0);

      // Üst Bar Zümrüt & Ekstra Can Göstergesi
      const topBal = document.getElementById('top-emerald-balance');
      const topExtra = document.getElementById('top-extralives-count');
      if (topBal) topBal.textContent = profile.emeraldCoins.toLocaleString('tr-TR');
      if (topExtra) topExtra.textContent = extraOwned;

      // Oyun Ekranı Ekstra Can Göstergesi
      const gameExtra = document.getElementById('game-extralife-count');
      if (gameExtra) gameExtra.textContent = extraOwned;

      // Ana Sayfa Karşılama & VIP Paneli
      const dashAvatarEl = document.getElementById('dash-welcome-avatar');
      const dashUserEl = document.getElementById('dash-welcome-username');
      const dashRoleBadge = document.getElementById('dash-welcome-role-badge');
      const dashRankBadge = document.getElementById('dash-welcome-rank-badge');
      const vipDashPanel = document.getElementById('vip-dashboard-panel');
      const vipDashExpiry = document.getElementById('vip-dash-expiry');

      if (dashAvatarEl) {
        dashAvatarEl.src = avatarUrl;
        dashAvatarEl.className = `mc-avatar-img mc-avatar-sm avatar-border-${borderKey}`;
      }
      if (dashUserEl) {
        dashUserEl.innerHTML = this.formatUsernameHtml(
          this.session.username,
          profile.rgbOwned && profile.rgbEnabled
        );
      }
      if (dashRoleBadge) {
        dashRoleBadge.textContent = effRole;
        dashRoleBadge.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (dashRankBadge) {
        dashRankBadge.textContent = profile.rankBadge || `⛏️ ${effRole}`;
      }

      const isVipOrAdmin = effRole !== 'PLAYER' || profile.isVip;
      if (vipDashPanel) {
        vipDashPanel.classList.toggle('hidden', !isVipOrAdmin);
      }
      if (vipDashExpiry && profile.vipStatus) {
        vipDashExpiry.textContent = profile.vipStatus.expiresAt
          ? `Bitiş: ${new Date(profile.vipStatus.expiresAt).toLocaleDateString('tr-TR')}`
          : 'Sınırsız VIP Erişimi';
      }

      // Günlük Ödül Butonu Durumu
      const dailyBtn = document.getElementById('btn-daily-reward');
      const dailyLabel = document.getElementById('daily-reward-label');
      const widgetDailyBtn = document.getElementById('btn-widget-claim-daily');
      if (dailyBtn && dailyLabel) {
        if (dailyStatus.canClaim) {
          dailyLabel.textContent = `GÜNLÜK (+${dailyStatus.rewardAmount} 💚)`;
          dailyBtn.disabled = false;
        } else {
          dailyLabel.textContent = `SERİ: ${dailyStatus.currentStreak} Gün`;
          dailyBtn.disabled = false;
        }
      }
      if (widgetDailyBtn) {
        if (dailyStatus.canClaim) {
          widgetDailyBtn.textContent = `🎁 Günlük Ödülü Al (+${dailyStatus.rewardAmount} 💚)`;
          widgetDailyBtn.disabled = false;
        } else {
          widgetDailyBtn.textContent = `✅ Alındı (Seri: ${dailyStatus.currentStreak} Gün)`;
          widgetDailyBtn.disabled = true;
        }
      }

      // Ana Sayfa Ekonomi Özeti
      const dRank = document.getElementById('dash-econ-rank');
      const dPoints = document.getElementById('dash-econ-points');
      const dEmeralds = document.getElementById('dash-econ-emeralds');
      const dGames = document.getElementById('dash-econ-games');
      const dWins = document.getElementById('dash-econ-wins');
      const dExtra = document.getElementById('dash-econ-extralives');

      if (dRank) dRank.textContent = `#${rankSummary.rank}`;
      if (dPoints) dPoints.textContent = `${profile.totalPoints.toLocaleString('tr-TR')}`;
      if (dEmeralds) {
        dEmeralds.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Zümrüt`;
      }
      if (dGames) dGames.textContent = profile.gamesPlayed.toLocaleString('tr-TR');
      if (dWins) dWins.textContent = profile.gamesWon.toLocaleString('tr-TR');
      if (dExtra) dExtra.textContent = `❤️ ${extraOwned}`;

      this.syncMainMenuDrawerUI();
    }

    getHashForScreen(screenId, options = {}) {
      if (screenId === 'screen-support') {
        if (options.supportTab === 'bug') return '#bug';
        if (options.supportTab === 'suggestion') return '#suggestion';
        return '#support';
      }
      const map = {
        'screen-menu': '#home',
        'screen-profile': '#profile',
        'screen-shop': '#shop',
        'screen-vip-shop': '#ranks',
        'screen-party': '#party',
        'screen-leaderboard': '#leaderboard',
        'screen-account-settings': '#settings',
        'screen-history': '#history',
        'screen-admin': '#admin'
      };
      return map[screenId] || '#home';
    }

    navigateToScreen(screenId, options = {}) {
      try {
        authGuard.verifySession(this.session);
      } catch (err) {
        this.showToast(err.message, 'error');
        if (!this.session) {
          this.lockWithLicenseGate(false);
        }
        return;
      }

      if (!options.skipHistory) {
        this.pushRouteHash(this.getHashForScreen(screenId, options));
      }

      if (screenId === 'screen-admin') {
        this.openAdminPanel();
        this.updateActiveDrawerHighlight('screen-admin', options);
        return;
      }
      if (screenId === 'screen-party') {
        this.openPartyLobby(Boolean(options.openCreateBox));
        this.updateActiveDrawerHighlight('screen-party', options);
        return;
      }

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen(screenId);
      }

      this.syncEconomyHeaderUI();
      if (screenId === 'screen-leaderboard') this.renderLeaderboard();
      if (screenId === 'screen-shop') this.renderEmeraldShop();
      if (screenId === 'screen-vip-shop') this.renderVipShop();
      if (screenId === 'screen-profile') this.renderPlayerProfile();
      if (screenId === 'screen-history') this.renderEmeraldHistory();
      if (screenId === 'screen-support') {
        if (options.supportTab) {
          this.switchSupportTab(options.supportTab);
        } else {
          this.renderSupportHub();
        }
      }
      if (screenId === 'screen-account-settings') this.renderAccountSettings();

      this.updateActiveDrawerHighlight(screenId, options);
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
          this.navigateToScreen('screen-support', { supportTab: tab });
        });
      });

      if (adminBtn) {
        adminBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-admin');
        });
      }

      if (heroPartyBtn) {
        heroPartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-party');
        });
      }

      if (vipCreatePartyBtn) {
        vipCreatePartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-party', { openCreateBox: true });
        });
      }

      if (vipManagePartyBtn) {
        vipManagePartyBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-party');
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
    // GÜNLÜK ZÜMRÜT ÖDÜLÜ (Normal +25 / VIP +50)
    // ==========================================
    claimDailyReward() {
      try {
        const res = dailyRewardService.claimDailyReward(this.session);
        window.soundManager.playEmeraldGain();
        if (window.mcQuizGame) {
          window.mcQuizGame.particles.spawnBurst(
            window.innerWidth / 2,
            window.innerHeight / 2,
            'emerald',
            50
          );
        }
        this.showToast(
          `🎁 +${res.rewardAmount} Zümrüt Coin Alındı! (Seri: ${res.streak} Gün)`,
          'success'
        );
        this.syncEconomyHeaderUI();
      } catch (err) {
        window.soundManager.playError();
        this.showToast(err.message, 'error');
      }
    }

    // ==========================================
    // EKSTRA CAN (EXTRA LIFE) DEVAM SİSTEMİ
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
            extraLifeService.useExtraLifeInGame(
              this.session,
              gameId,
              questionNumber,
              this.selectedPartyId
            );
            this.syncEconomyHeaderUI();
            this.showToast('❤️ EKSTRA CAN KULLANILDI — "Oyuna geri döndünüz!"', 'success');
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
    // OYUN SONUCU -> ZÜMRÜT & LİDERLİK ÖDÜLLERİ
    // ==========================================
    onGameFinished(outcome) {
      if (!this.session) return;
      try {
        const res = economyService.recordGameOutcome(this.session, outcome);
        this.syncEconomyHeaderUI();

        if (res.emeraldReward > 0 || res.pointsEarned > 0) {
          window.soundManager.playEmeraldGain();
          this.showToast(
            `🟩 +${res.emeraldReward} Zümrüt Coin & ⭐ +${res.pointsEarned} Liderlik Puanı kazanıldı!`,
            'success'
          );
        }

        if (res.newlyUnlocked && res.newlyUnlocked.length > 0) {
          window.soundManager.playAchievementUnlock();
          res.newlyUnlocked.forEach(ach => {
            this.showToast(`🎖️ Başarım Açıldı: ${ach.icon} ${ach.title}!`, 'info');
          });
        }
      } catch (err) {
        console.warn('Oyun sonucu ekonomi hatası:', err);
      }
    }

    // ==========================================
    // LİDERLİK TABLOSU EKRANI
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
          this.showToast('Liderlik tablosu yenilendi!', 'info');
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

      // 1. Mevcut Oyuncu Sıralama Bandı
      const bannerEl = document.getElementById('leaderboard-current-user-banner');
      if (bannerEl) {
        bannerEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
            ${this.getAvatarImgHtml(currentUserSummary.username, 'mc-avatar-xs')}
            <span>Senin Sıralaman: </span>
            <strong class="gold-text">#${currentUserSummary.rank} ${this.formatUsernameHtml(
              currentUserSummary.username,
              currentUserSummary.rgbOwned && currentUserSummary.rgbEnabled
            )}</strong>
            <span class="role-badge role-${currentUserSummary.role.toLowerCase()}" style="margin-left:0.25rem;">${currentUserSummary.rankBadge}</span>
          </div>
          <div style="display:flex; gap:1.1rem; flex-wrap:wrap;">
            <span>⭐ Puan: <strong>${currentUserSummary.totalPoints.toLocaleString('tr-TR')}</strong></span>
            <span>💚 Zümrüt: <strong class="emerald-text">${currentUserSummary.emeraldCoins.toLocaleString('tr-TR')}</strong></span>
            <span>🏆 Galibiyet: <strong>${currentUserSummary.gamesWon}</strong></span>
          </div>
        `;
      }

      // 2. İlk 3 Podyumu (2. Gümüş, 1. Altın, 3. Bronz)
      const podiumEl = document.getElementById('leaderboard-podium');
      if (podiumEl) {
        const top1 = allRanked[0];
        const top2 = allRanked[1];
        const top3 = allRanked[2];
        const podiumOrder = [
          { data: top2, rank: '2.', medal: '🥈', cls: 'podium-rank-2' },
          { data: top1, rank: '1.', medal: '🥇', cls: 'podium-rank-1' },
          { data: top3, rank: '3.', medal: '🥉', cls: 'podium-rank-3' }
        ];

        podiumEl.innerHTML = podiumOrder
          .filter(item => item.data)
          .map(
            item => `
            <div class="podium-card ${item.cls}">
              <div class="podium-medal">${item.medal} ${item.rank}</div>
              <div style="margin:0.35rem auto;">${this.getAvatarImgHtml(item.data.username, 'mc-avatar-sm')}</div>
              <div class="podium-username">${this.formatUsernameHtml(
                item.data.username,
                item.data.rgbOwned && item.data.rgbEnabled
              )}</div>
              <div style="margin:0.2rem 0;"><span class="role-badge role-${item.data.role.toLowerCase()}">${item.data.rankBadge}</span></div>
              <div class="podium-points">${item.data.totalPoints.toLocaleString('tr-TR')} Puan</div>
              <div class="podium-meta">
                <span class="emerald-text">💚 ${item.data.emeraldCoins.toLocaleString('tr-TR')}</span>
                <span>🏆 ${item.data.gamesWon} Galibiyet</span>
              </div>
            </div>
          `
          )
          .join('');
      }

      // 3. Liderlik Tablosu Satırları
      const tbody = document.getElementById('leaderboard-table-body');
      if (!tbody) return;

      if (filteredRanked.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">
              Eşleşen oyuncu bulunamadı.
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
              ? '🥇 1.'
              : row.rank === 2
              ? '🥈 2.'
              : row.rank === 3
              ? '🥉 3.'
              : `#${row.rank}`;

          return `
            <tr class="${isMe ? 'lb-current-user-row' : ''}">
              <td class="lb-rank-cell">${rankBadge}</td>
              <td>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  ${this.getAvatarImgHtml(row.username, 'mc-avatar-xs')}
                  <strong>${this.formatUsernameHtml(
                    row.username,
                    row.rgbOwned && row.rgbEnabled
                  )}</strong>
                  ${isMe ? '<span class="role-badge role-player" style="margin-left:0.25rem;">SEN</span>' : ''}
                </div>
              </td>
              <td><span class="role-badge role-${row.role.toLowerCase()}">${this.escapeHtml(row.rankBadge)}</span></td>
              <td><strong class="gold-text">${row.totalPoints.toLocaleString('tr-TR')} Puan</strong></td>
              <td><strong class="emerald-text">💚 ${row.emeraldCoins.toLocaleString('tr-TR')}</strong></td>
              <td>${row.gamesPlayed}</td>
              <td class="emerald-text">${row.gamesWon}</td>
              <td><strong>%${row.winRate}</strong></td>
              <td>❤️ ${row.extraLivesUsed}</td>
            </tr>
          `;
        })
        .join('');
    }

    // ==========================================
    // ZÜMRÜT MAĞAZASI, RÜTBE MAĞAZASI & STRIPE ÖDEME EKRANI
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

    getNetheriteIngotSvg(ingotCount = 1) {
      const countBadge =
        ingotCount > 1
          ? `<span class="netherite-stack-count">×${ingotCount}</span>`
          : '';
      return `
        <div class="netherite-ingot-badge" title="Netherite Külçesi (${ingotCount}x)">
          <svg viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">
            <rect x="3" y="5" width="10" height="6" fill="#3b343a"/>
            <rect x="2" y="6" width="12" height="4" fill="#4c434a"/>
            <rect x="4" y="4" width="8" height="2" fill="#655b63"/>
            <rect x="4" y="6" width="7" height="1" fill="#7c707a"/>
            <rect x="3" y="9" width="9" height="2" fill="#292328"/>
            <rect x="5" y="7" width="5" height="2" fill="#594f57"/>
          </svg>
          ${countBadge}
        </div>
      `;
    }

    renderEmeraldShop() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const items =
        this.selectedShopCategory === 'Emeralds'
          ? []
          : shopService.listShopItems(false, this.selectedShopCategory);
      const rawPackages = paymentService.listEmeraldPackages
        ? paymentService.listEmeraldPackages(false)
        : paymentService.getEmeraldPackages
        ? paymentService.getEmeraldPackages(false)
        : [];
      const emeraldPackages =
        this.selectedShopCategory === 'ALL' || this.selectedShopCategory === 'Emeralds'
          ? rawPackages
          : [];

      const balEl = document.getElementById('shop-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Zümrüt Coin`;
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
            ? 'Aktif 🌈'
            : 'Sahip (Kapalı)'
          : 'Kilitli';
      }

      const grid = document.getElementById('emerald-shop-grid');
      if (!grid) return;

      const packagesHtml = emeraldPackages
        .map(pkg => {
          const pkgTitle = pkg.name || pkg.title || `${pkg.emeralds} Zümrüt Paketi`;
          const ingotCount = Number(pkg.ingotCount) || 1;
          return `
            <div class="shop-item-card shop-netherite-card">
              <div>
                <div class="shop-item-top">
                  ${this.getNetheriteIngotSvg(ingotCount)}
                  <span class="shop-item-price-tag">${pkg.priceTL.toLocaleString('tr-TR')} TL</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; gap:0.4rem; flex-wrap:wrap;">
                  <h3 class="shop-item-title" style="margin:0;">${this.escapeHtml(pkgTitle)}</h3>
                  <span class="role-badge role-vip">${this.escapeHtml(pkg.badge || '5 💚 = 1 TL')}</span>
                </div>
                <p class="shop-item-desc">⬛ Netherite Külçesi Paketi: <strong>+${pkg.emeralds.toLocaleString('tr-TR')} Zümrüt Coin</strong> (${pkg.priceTL} TL).</p>
              </div>
              <div class="shop-item-footer">
                <span class="meta-muted">Stripe Doğrulanmış Webhook</span>
                <button
                  type="button"
                  class="mc-btn mc-btn-emerald mc-btn-small btn-buy-emerald-pkg"
                  data-pkg-id="${this.escapeHtml(pkg.id)}"
                >
                  <span class="btn-inner">Satın Al (${pkg.priceTL} TL)</span>
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      const itemsHtml = items
        .map(item => {
          const check = shopService.evaluateEligibility(this.session, item);
          const priceStr =
            item.currency === 'TRY'
              ? `${item.price} TL`
              : `💚 ${item.price.toLocaleString('tr-TR')} Zümrüt`;
          const reqBadge =
            item.requiredRole === 'VIP'
              ? '<span class="role-badge role-vip">VIP Gerekli</span>'
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
            if (res.item.effectType === 'GRANT_RANK') {
              window.soundManager.playRankUpgrade();
            } else {
              window.soundManager.playPurchase();
            }
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
              `✅ ${res.item.icon} ${res.item.name} satın alındı (-${res.item.price} Zümrüt)!`,
              'success'
            );
            this.syncEconomyHeaderUI();
            this.renderEmeraldShop();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    }

    // ==========================================
    // STRIPE CHECKOUT & WEBHOOK DOĞRULAMA MODALI
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
        window.soundManager.playError();
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

            window.soundManager.playPurchase();
            if (window.mcQuizGame) {
              window.mcQuizGame.particles.spawnBurst(
                window.innerWidth / 2,
                window.innerHeight / 2,
                'emerald',
                55
              );
            }
            this.showToast(
              `✅ Stripe Webhook Doğrulandı (${webhookRes.eventId}): ${webhookRes.payment.title} hesabınıza tanımlandı!`,
              'success'
            );
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (failBtn) {
        failBtn.addEventListener('click', () => {
          if (!this.activeCheckoutSession) return;
          window.soundManager.playError();
          try {
            paymentService.failCheckoutSession(
              this.activeCheckoutSession.id,
              'Stripe Test Modunda kart reddi simülasyonu'
            );
            this.activeCheckoutSession = null;
            if (modal) modal.classList.add('hidden');
            this.showToast(
              '❌ Stripe Test Modunda ödeme başarısız oldu. 0 Zümrüt tanımlandı.',
              'error'
            );
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }
    }

    // ==========================================
    // VIP MAĞAZASI & ÖDEME ENTEGRASYONU
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
            title: '👑 VIP Üyelik (200 TL)',
            priceTL: 200
          });
          this.activeCheckoutSession = res.intent;
          const statusBox = document.getElementById('payment-service-status-box');
          const statusMsg = document.getElementById('payment-service-status-msg');
          if (statusBox && statusMsg) {
            statusMsg.textContent = `${res.message} (Oturum ID: ${res.intent.id})`;
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
    // BÖLÜM 9, 10, 11 & 29: OYUNCU PROFİLİ, AVATAR KIRPMA & ÖZELLEŞTİRME
    // ==========================================
    bindProfileAndCosmetics() {
      const enableRgbBtn = document.getElementById('btn-profile-rgb-enable');
      const disableRgbBtn = document.getElementById('btn-profile-rgb-disable');
      const avatarFileInp = document.getElementById('inp-profile-avatar-file');
      const saveAvatarBtn = document.getElementById('btn-save-profile-avatar');
      const removeAvatarBtn = document.getElementById('btn-remove-profile-avatar');
      const saveCustBtn = document.getElementById('btn-save-profile-customization');

      // 1. Profil Fotoğrafı Seçimi + 160x160 Kare Canvas Kırpma + Önizleme
      if (avatarFileInp) {
        avatarFileInp.addEventListener('change', () => {
          const file = avatarFileInp.files && avatarFileInp.files[0];
          if (!file) return;

          const validation = avatarService.validateImageFile(file);
          if (!validation.ok) {
            window.soundManager.playError();
            this.showToast(validation.error, 'error');
            avatarFileInp.value = '';
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
              const sx = Math.floor((img.width - minSide) / 2);
              const sy = Math.floor((img.height - minSide) / 2);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 160, 160);

              const croppedDataUrl = canvas.toDataURL('image/png');
              this.pendingCroppedAvatarDataUrl = croppedDataUrl;

              const previewWrap = document.getElementById('profile-avatar-crop-preview-wrap');
              const previewImg = document.getElementById('profile-avatar-preview-img');
              if (previewImg) previewImg.src = croppedDataUrl;
              if (previewWrap) previewWrap.classList.remove('hidden');
              if (saveAvatarBtn) saveAvatarBtn.classList.remove('hidden');

              window.soundManager.playClick();
              this.showToast('Fotoğraf kare olarak kırpıldı. Kaydetmek için "Fotoğrafı Kaydet" butonuna basın.', 'info');
            };
            img.onerror = () => {
              this.showToast('Görsel dosyası okunamadı.', 'error');
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      // 2. Kırpılan Profil Fotoğrafını Kaydet
      if (saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', () => {
          if (!this.pendingCroppedAvatarDataUrl) return;
          try {
            userService.updateProfileAvatar(this.session, this.pendingCroppedAvatarDataUrl);
            this.pendingCroppedAvatarDataUrl = null;
            const previewWrap = document.getElementById('profile-avatar-crop-preview-wrap');
            if (previewWrap) previewWrap.classList.add('hidden');
            saveAvatarBtn.classList.add('hidden');
            if (avatarFileInp) avatarFileInp.value = '';

            window.soundManager.playSuccess();
            this.showToast('📸 Profil fotoğrafınız başarıyla güncellendi!', 'success');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderPlayerProfile();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      // 3. Profil Fotoğrafını Kaldır (Varsayılan Minecraft Avatarına Dön)
      if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.updateProfileAvatar(this.session, null);
            this.pendingCroppedAvatarDataUrl = null;
            const previewWrap = document.getElementById('profile-avatar-crop-preview-wrap');
            if (previewWrap) previewWrap.classList.add('hidden');
            if (saveAvatarBtn) saveAvatarBtn.classList.add('hidden');
            if (avatarFileInp) avatarFileInp.value = '';

            this.showToast('Profil fotoğrafı kaldırıldı. Minecraft piksel avatarı aktif.', 'info');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderPlayerProfile();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // 4. Profil Özelleştirme Kaydet (Çerçeve, Arka Plan, Tema, Gizlilik)
      if (saveCustBtn) {
        saveCustBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            const profileBorder = document.getElementById('sel-profile-border')?.value || 'stone';
            const profileBackground = document.getElementById('sel-profile-bg')?.value || 'overworld';
            const theme = document.getElementById('sel-profile-theme')?.value || 'dark';
            const profilePrivacy = document.getElementById('sel-profile-privacy')?.value || 'PUBLIC';

            userService.updateProfileCustomization(this.session, {
              profileBorder,
              profileBackground,
              theme,
              profilePrivacy
            });

            this.applyUserThemePreference();
            window.soundManager.playSuccess();
            this.showToast('🎨 Profil özelleştirmeleri kaydedildi!', 'success');
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderPlayerProfile();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      if (enableRgbBtn) {
        enableRgbBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            userService.setRgbUsernameEnabled(this.session, true);
            economyService._mutateAccount(this.session.username, acc => {
              acc.rgbOwned = true;
              acc.rgbEnabled = true;
            });
            this.showToast('🌈 RGB Kullanıcı Adı etkinleştirildi!', 'success');
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
            this.showToast('RGB Kullanıcı Adı kapatıldı.', 'info');
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
      const userObj = userService.getUserByUsername(this.session.username);

      const avatarImg = document.getElementById('profile-avatar-img');
      const heroBanner = document.getElementById('profile-hero-banner');
      const uName = document.getElementById('profile-username');
      const uRole = document.getElementById('profile-role-badge');
      const uRank = document.getElementById('profile-rank-badge');
      const uIdEl = document.getElementById('profile-immutable-id');
      const rgbPreview = document.getElementById('profile-rgb-preview');
      const rgbPill = document.getElementById('profile-rgb-status-pill');

      const borderKey = userObj?.profileBorder || 'stone';
      const bgKey = userObj?.profileBackground || 'overworld';

      if (avatarImg) {
        avatarImg.src = avatarService.getUserAvatarUrl(userObj || this.session.username);
        avatarImg.className = `mc-avatar-img mc-avatar-xl avatar-border-${borderKey}`;
      }
      if (heroBanner) {
        heroBanner.className = `profile-hero-card profile-bg-${bgKey}`;
      }

      // Özelleştirme seçim kutularını senkronize et
      const selBorder = document.getElementById('sel-profile-border');
      const selBg = document.getElementById('sel-profile-bg');
      const selTheme = document.getElementById('sel-profile-theme');
      const selPrivacy = document.getElementById('sel-profile-privacy');
      if (selBorder) selBorder.value = borderKey;
      if (selBg) selBg.value = bgKey;
      if (selTheme) selTheme.value = userObj?.settings?.theme || 'dark';
      if (selPrivacy) selPrivacy.value = userObj?.profilePrivacy || 'PUBLIC';

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
      if (uRank) uRank.textContent = `${summary.rankBadge} • Sıra #${summary.rank}`;
      if (uIdEl) uIdEl.textContent = `Sabit Hesap ID: ${summary.userId || this.session.userId}`;
      if (rgbPreview) rgbPreview.textContent = summary.username;
      if (rgbPill) {
        const statusStr = summary.rgbOwned
          ? summary.rgbEnabled
            ? 'AKTİF'
            : 'SAHİP (KAPALI)'
          : 'KİLİTLİ';
        rgbPill.textContent = statusStr;
        rgbPill.className = `status-pill status-${summary.rgbOwned && summary.rgbEnabled ? 'ACTIVE' : 'DISABLED'}`;
      }

      const extraOwned =
        (summary.inventory?.extraLives || 0) + (summary.inventory?.secondChance || 0);

      document.getElementById('prof-stat-rank').textContent = `#${summary.rank}`;
      document.getElementById('prof-stat-points').textContent =
        `${summary.totalPoints.toLocaleString('tr-TR')} Puan`;
      document.getElementById('prof-stat-emeralds').textContent =
        `💚 ${summary.emeraldCoins.toLocaleString('tr-TR')} Zümrüt Coin`;
      document.getElementById('prof-stat-games').textContent =
        summary.gamesPlayed.toLocaleString('tr-TR');
      document.getElementById('prof-stat-winloss').textContent =
        `${summary.gamesWon} G / ${summary.gamesLost} M`;
      document.getElementById('prof-stat-winrate').textContent = `%${summary.winRate}`;
      document.getElementById('prof-stat-extralives').textContent =
        `${extraOwned} Sahip / ${summary.extraLivesUsed} Kullanıldı`;
      document.getElementById('prof-stat-avgscore').textContent =
        `${summary.averageScore.toLocaleString('tr-TR')} Puan`;
      document.getElementById('prof-stat-bestscore').textContent =
        `${summary.bestScore.toLocaleString('tr-TR')} Zümrüt`;
      document.getElementById('prof-stat-earned').textContent =
        `+${summary.totalEmeraldsEarned.toLocaleString('tr-TR')} Zümrüt`;
      document.getElementById('prof-stat-spent').textContent =
        `-${summary.totalEmeraldsSpent.toLocaleString('tr-TR')} Zümrüt`;
      document.getElementById('prof-stat-streak').textContent =
        `${dailyStatus.currentStreak} Gün`;

      const unlockedCount = achievements.filter(a => a.unlocked).length;
      const counterEl = document.getElementById('prof-achievements-counter');
      if (counterEl) {
        counterEl.textContent = `${unlockedCount} / ${achievements.length} Açıldı`;
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
    // ZÜMRÜT İŞLEM GEÇMİŞİ EKRANI
    // ==========================================
    renderEmeraldHistory() {
      if (!this.session) return;
      const profile = economyService.getPlayerEconomyProfile(this.session.username);
      const txs = economyService.getTransactionHistory(this.session, this.session.username);

      const balEl = document.getElementById('history-emerald-balance');
      if (balEl) {
        balEl.textContent = `💚 ${profile.emeraldCoins.toLocaleString('tr-TR')} Zümrüt Coin`;
      }

      const listEl = document.getElementById('player-history-list');
      if (!listEl) return;

      if (txs.length === 0) {
        listEl.innerHTML =
          '<div class="empty-state-box">Henüz kayıtlı Zümrüt Coin işlemi bulunmuyor.</div>';
        return;
      }

      listEl.innerHTML = txs
        .map(tx => {
          const isNeg = tx.amount < 0;
          const sign = tx.amount > 0 ? '+' : '';
          const amountText =
            tx.amount === 0
              ? '❤️ 1 Ekstra Can Kullanıldı'
              : `${sign}${tx.amount.toLocaleString('tr-TR')} Zümrüt`;
          return `
            <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
              <div class="tx-main">
                <span class="tx-reason">${this.escapeHtml(tx.reason)} <span class="meta-muted">(${this.escapeHtml(tx.id)})</span></span>
                <span class="tx-meta">🕒 ${tx.dateFormatted} • Önceki: 💚 ${Number(tx.previousBalance || 0).toLocaleString('tr-TR')} → Yeni: 💚 ${tx.balanceAfter.toLocaleString('tr-TR')} • Kaynak: ${this.escapeHtml(tx.source || 'Sistem')}</span>
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
    // PARTİ SİSTEMİ (YETKİ KONTROLLÜ, LİSANSI ASLA SIFIRLAMAZ)
    // ==========================================
    openPartyLobby(openCreateBox = false) {
      if (!this.session) {
        this.lockWithLicenseGate(false);
        return;
      }

      if (window.mcQuizGame) {
        window.mcQuizGame.showScreen('screen-party');
      }

      this.syncEconomyHeaderUI();
      this.renderPartyLobby(openCreateBox);
    }

    bindPartyLobby() {
      const backMenuBtn = document.getElementById('btn-party-back-menu');
      const playSoloBtn = document.getElementById('btn-party-play-solo');
      const openCreateBtn = document.getElementById('btn-open-create-party');
      const rankLockViewBtn = document.getElementById('btn-rank-lock-view-ranks');
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
          window.soundManager.playGameStart();
          if (window.mcQuizGame) window.mcQuizGame.startNewGame();
        });
      }

      if (rankLockViewBtn) {
        rankLockViewBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.navigateToScreen('screen-vip-shop');
        });
      }

      if (openCreateBtn && createBox) {
        openCreateBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          const perms = authGuard.getUserPermissions(this.session);
          if (!perms.canCreateParty) {
            this.showToast('🔒 Bu özellik VIP veya daha yüksek rütbe gerektirir.', 'error');
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
              gameMode: modeSelect ? modeSelect.value : 'Klasik Milyoner (15 Soru)',
              description: descInput ? descInput.value : ''
            });
            nameInput.value = '';
            if (descInput) descInput.value = '';
            this.selectedPartyId = newParty.id;
            window.soundManager.playPartyJoin();
            this.showToast(`"${newParty.name}" partisi oluşturuldu! Davet Kodu: ${newParty.inviteCode}`, 'success');
            this.renderPartyLobby(false);
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Partiye Katıl — Lisansı veya hesabı ASLA sıfırlamaz!
      if (joinForm) {
        joinForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const codeInp = document.getElementById('input-join-invite-code');
            const joinedParty = partyService.joinPartyByInviteCode(this.session, codeInp.value);
            codeInp.value = '';
            this.selectedPartyId = joinedParty.id;
            window.soundManager.playPartyJoin();
            this.showToast(`BAŞARILI — "${joinedParty.name}" partisine başarıyla katıldınız.`, 'success');
            this.renderPartyLobby(false);
          } catch (err) {
            window.soundManager.playError();
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
      const lockCard = document.getElementById('player-party-create-lock-card');
      const maxSelect = document.getElementById('input-party-max');

      if (welcomeTitle) {
        welcomeTitle.innerHTML = `Hoş Geldin, ${this.formatUsernameHtml(this.session.username)}`;
      }
      if (roleBadge) {
        roleBadge.textContent = profile.rankBadge || effRole;
        roleBadge.className = `role-badge role-${effRole.toLowerCase()}`;
      }
      if (licName) licName.textContent = this.session.licenseName || 'Aktif Hesap';

      // Kullanıcının rütbe limitine göre maksimum oyuncu seçeneklerini doldur
      if (maxSelect && perms.canCreateParty) {
        const cap = Math.min(32, perms.maxPartySize || 4);
        const sizes = [2, 4, 6, 8, 10, 12, 14, 16, 20, 32].filter(n => n <= cap);
        if (!sizes.includes(cap)) sizes.push(cap);
        maxSelect.innerHTML = sizes
          .map(
            n =>
              `<option value="${n}" ${n === cap ? 'selected' : ''}>${n} Oyuncu ${
                n === cap ? `(${profile.rank || effRole} Maks)` : ''
              }</option>`
          )
          .join('');
      }

      // Normal PLAYER görsel kilit kartı (🔒) görür. Rütbeli ve ADMIN [ Parti Oluştur ] görür
      const canCreateParty = Boolean(perms.canCreateParty);
      if (createBtn) createBtn.classList.toggle('hidden', !canCreateParty);
      if (lockCard) lockCard.classList.toggle('hidden', canCreateParty);
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
            Aktif parti bulunamadı. Katılmak için yukarıya bir Davet Kodu (örn. <strong>MCM-8K2P</strong>) girin!
          </div>
        `;
        return;
      }

      listEl.innerHTML = parties
        .map(p => {
          const joinedCount = p.participants.filter(pt => pt.joinStatus === 'JOINED').length;
          const isSelected = p.id === this.selectedPartyId;
          const statusTr = PARTY_STATUS_LABELS_TR[p.status] || p.status;
          return `
            <div class="party-item-card ${isSelected ? 'selected' : ''}" data-party-id="${p.id}">
              <div class="party-item-top">
                <span class="party-item-title">${this.escapeHtml(p.name)}</span>
                <span class="status-pill status-${p.status}">${statusTr}</span>
              </div>
              <div class="party-item-meta">
                <span>👑 Kurucu: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                <span>🎮 Mod: <strong>${this.escapeHtml(p.gameMode || 'Klasik Milyoner')}</strong></span>
                <span>👥 Oyuncular: <strong>${joinedCount} / ${p.maxPlayers}</strong></span>
                <span>🎟️ Davet Kodu: <strong class="emerald-text">${p.inviteCode}</strong></span>
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
            Detayları görüntülemek için sol listeden bir parti seçin veya bir Davet Kodu girin.
          </div>
        `;
        return;
      }

      const effRole = authGuard.getEffectiveRole(this.session);
      const perms = authGuard.getUserPermissions(this.session);
      const isOwner = party.organizer.toLowerCase() === this.session.username.toLowerCase();
      const canManage = effRole === 'ADMIN' || (Boolean(perms.canInvitePlayers) && isOwner);
      const isParticipant = party.participants.some(
        pt => pt.username.toLowerCase() === this.session.username.toLowerCase() && pt.joinStatus === 'JOINED'
      );
      const joinedCount = party.participants.filter(pt => pt.joinStatus === 'JOINED').length;
      const createdDate = new Date(party.createdAt).toLocaleString('tr-TR');
      const statusTr = PARTY_STATUS_LABELS_TR[party.status] || party.status;

      const managementToolbarHtml = canManage
        ? `
          <div class="party-owner-toolbar">
            <div class="owner-toolbar-title">👑 RÜTBELİ KURUCU / ADMİN PARTİ YÖNETİMİ</div>
            <div class="inline-join-form">
              <input type="text" id="inp-invite-username" class="mc-input mc-input-sm" placeholder="Davet edilecek Minecraft kullanıcı adı..." />
              <button type="button" id="btn-detail-invite" class="mc-btn mc-btn-emerald mc-btn-small">
                <span class="btn-inner">✉️ Oyuncu Davet Et</span>
              </button>
              <button type="button" id="btn-detail-copy-code" class="mc-btn mc-btn-stone mc-btn-small">
                <span class="btn-inner">📋 Davet Kodunu Kopyala</span>
              </button>
            </div>

            <div class="owner-actions-wrap">
              <button type="button" id="btn-party-start" class="mc-btn mc-btn-emerald mc-btn-small" ${
                party.status === 'CANCELLED' ? 'disabled' : ''
              }>
                <span class="btn-inner">▶️ Parti Oyununu Başlat</span>
              </button>
              <select id="sel-party-status-change" class="mc-select mc-select-xs">
                ${PARTY_STATUSES.map(
                  st => `<option value="${st}" ${party.status === st ? 'selected' : ''}>Durum: ${PARTY_STATUS_LABELS_TR[st] || st}</option>`
                ).join('')}
              </select>
              <button type="button" id="btn-party-cancel" class="mc-btn mc-btn-danger mc-btn-small" ${
                party.status === 'CANCELLED' ? 'disabled' : ''
              }>
                <span class="btn-inner">✖ Partiyi İptal Et</span>
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
                   <span class="btn-inner">🎟️ Bu Partiye Katıl (${party.inviteCode})</span>
                 </button>`
              : ''
          }
          ${
            isParticipant
              ? `<button type="button" id="btn-detail-leave-party" class="mc-btn mc-btn-danger mc-btn-small">
                   <span class="btn-inner">🚪 Partiden Ayrıl</span>
                 </button>`
              : ''
          }
        </div>
      `;

      container.innerHTML = `
        <div class="party-detail-header">
          <div>
            <div class="party-detail-title">${this.escapeHtml(party.name)}</div>
            <div class="meta-muted">Parti ID: <strong>${party.id}</strong> • Oluşturulma: ${createdDate}</div>
            ${party.description ? `<p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(party.description)}</p>` : ''}
          </div>
          <span class="status-pill status-${party.status}">${statusTr}</span>
        </div>

        <div class="party-meta-grid">
          <div class="party-meta-box">
            <span>Kurucu</span>
            <strong class="gold-text">${this.formatUsernameHtml(party.organizer)}</strong>
          </div>
          <div class="party-meta-box">
            <span>Oyuncu / Maks</span>
            <strong>${joinedCount} / ${party.maxPlayers}</strong>
          </div>
          <div class="party-meta-box">
            <span>Oyun Modu</span>
            <strong>${this.escapeHtml(party.gameMode || 'Klasik Milyoner')}</strong>
          </div>
          <div class="party-meta-box">
            <span>Davet Kodu</span>
            <strong class="emerald-text">${party.inviteCode}</strong>
          </div>
        </div>

        ${participantActionBar}
        ${managementToolbarHtml}

        <h4 class="panel-sec-title">👥 Katılımcılar (${party.participants.length})</h4>
        <div class="participants-grid">
          ${party.participants
            .map(pt => {
              const joinedTime = new Date(pt.joinedAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              });
              const canRemoveThis =
                canManage && pt.username.toLowerCase() !== party.organizer.toLowerCase();
              const joinStatusTr = pt.joinStatus === 'JOINED' ? 'KATILDI' : pt.joinStatus === 'INVITED' ? 'DAVET EDİLDİ' : pt.joinStatus;
              return `
                <div class="participant-card">
                  <div class="participant-top">
                    <span class="participant-name" style="display:inline-flex; align-items:center; gap:0.4rem;">
                      ${this.getAvatarImgHtml(pt.username, 'mc-avatar-xs')}
                      ${this.formatUsernameHtml(pt.username)}
                    </span>
                    <span class="role-badge role-${pt.role.toLowerCase()}">${pt.role}</span>
                  </div>
                  <div class="participant-sub">
                    <span class="status-pill status-${pt.joinStatus}">${joinStatusTr}</span>
                    <span>Katılım: ${joinedTime}</span>
                  </div>
                  ${
                    canRemoveThis
                      ? `<button type="button" class="act-btn danger btn-remove-pt" data-username="${this.escapeHtml(
                          pt.username
                        )}">Oyuncuyu Çıkar</button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      `;

      // Hızlı Katıl / Partiden Ayrıl bağlantıları
      const quickJoinBtn = document.getElementById('btn-detail-quick-join');
      if (quickJoinBtn) {
        quickJoinBtn.addEventListener('click', () => {
          try {
            partyService.joinPartyByInviteCode(this.session, party.inviteCode);
            window.soundManager.playPartyJoin();
            this.showToast(`BAŞARILI — "${party.name}" partisine başarıyla katıldınız.`, 'success');
            this.renderPartyLobby(false);
          } catch (err) {
            window.soundManager.playError();
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
            this.showToast(`"${party.name}" partisinden ayrıldınız. Lisansınız ve hesabınız aktif kalmaya devam ediyor.`, 'info');
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
            const userInp = document.getElementById('inp-invite-username');
            const targetUser = userInp ? userInp.value.trim() : '';
            try {
              const invData = partyService.invitePlayer(this.session, party.id, targetUser);
              if (userInp) userInp.value = '';
              window.soundManager.playPartyInvite();
              this.openInvitationModal(invData);
              if (targetUser) {
                this.showToast(`${targetUser} oyuncusu başarıyla davet edildi.`, 'success');
              }
              this.renderPartyLobby(false);
            } catch (err) {
              window.soundManager.playError();
              this.showToast(err.message, 'error');
            }
          });
        }

        if (copyCodeBtn) {
          copyCodeBtn.addEventListener('click', () => {
            window.soundManager.playClick();
            this.copyToClipboard(
              party.inviteCode,
              `Davet kodu kopyalandı: ${party.inviteCode}`
            );
          });
        }

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            window.soundManager.playGameStart();
            try {
              partyService.setPartyStatus(this.session, party.id, 'ACTIVE');
              this.showToast('Parti oyunu başlatıldı!', 'success');
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
              this.showToast(`Parti durumu güncellendi: ${PARTY_STATUS_LABELS_TR[statusSel.value] || statusSel.value}`, 'info');
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
              '✖ Partiyi İptal Et',
              `"${party.name}" partisini iptal etmek istediğinize emin misiniz?`,
              'Partiyi İptal Et',
              () => {
                try {
                  partyService.setPartyStatus(this.session, party.id, 'CANCELLED');
                  this.showToast('Parti iptal edildi.', 'info');
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
              '👥 Katılımcıyı Çıkar',
              `"${targetUser}" oyuncusunu bu partiden çıkarmak istediğinize emin misiniz?`,
              'Oyuncuyu Çıkar',
              () => {
                try {
                  partyService.removeParticipant(this.session, party.id, targetUser);
                  this.showToast(`${targetUser} partiden çıkarıldı.`, 'info');
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
    // DAVET MODALI
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
            'Parti daveti panoya kopyalandı!'
          );
        });
      }
    }

    // ==========================================
    // BÖLÜM 23, 24 & 25: DESTEK, HATA BİLDİRİMİ & ÖNERİ MERKEZİ
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
            window.soundManager.playSuccess();
            const prioTr = supportService.formatPriorityTR(ticket.priority);
            this.showToast(
              `Destek talebi ${ticket.id} gönderildi (${prioTr} Öncelik)!`,
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
            const bug = bugService.createBugReport(this.session, {
              title,
              category,
              relatedParty,
              attachmentUrl,
              description
            });
            bugForm.reset();
            window.soundManager.playSuccess();
            const prioTr = supportService.formatPriorityTR(bug.priority);
            this.showToast(
              `Hata bildirimi ${bug.id} gönderildi (${prioTr} Öncelik)!`,
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
            const sug = suggestionService.createSuggestion(this.session, {
              title,
              category,
              description
            });
            sugForm.reset();
            window.soundManager.playSuccess();
            const prioTr = supportService.formatPriorityTR(sug.priority);
            this.showToast(
              `Öneri ${sug.id} gönderildi (${prioTr} Öncelik)!`,
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
          priority === 'VERY HIGH'
            ? '⚡ ÇOK YÜKSEK ÖNCELİK (VIP+/MVP)'
            : priority === 'HIGH'
            ? '🔥 YÜKSEK ÖNCELİK (VIP)'
            : priority === 'CRITICAL'
            ? '🛡️ KRİTİK ÖNCELİK (ADMIN)'
            : 'NORMAL ÖNCELİK';
        prioInd.className = `priority-pill priority-${priority.replace(/\s+/g, '_')}`;
      }

      // 1. Destek Talepleri
      const supListEl = document.getElementById('user-support-tickets-list');
      if (supListEl) {
        const tickets = supportService.listSupportTickets(this.session, true);
        supListEl.innerHTML =
          tickets.length === 0
            ? '<div class="empty-state-box">Henüz destek talebi göndermediniz.</div>'
            : tickets
                .map(t => {
                  const prioTr = supportService.formatPriorityTR(t.priority);
                  return `
                  <div class="tx-row">
                    <div class="tx-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <span class="tx-reason">${this.escapeHtml(t.title)}</span>
                        <span class="priority-pill priority-${t.priority.replace(/\s+/g, '_')}">${prioTr} Öncelik</span>
                        <span class="status-pill status-${t.status === 'RESOLVED' ? 'ACTIVE' : 'WAITING'}">${t.status}</span>
                      </div>
                      <span class="tx-meta">[${t.id}] • ${this.escapeHtml(t.category)} • ${new Date(t.createdAt).toLocaleString('tr-TR')}</span>
                      <p class="panel-sec-desc" style="margin-top:0.25rem;">${this.escapeHtml(t.description)}</p>
                      ${
                        t.adminReply
                          ? `<div class="emerald-text" style="font-size:0.84rem; margin-top:0.25rem;">🛡️ Admin Yanıtı: ${this.escapeHtml(t.adminReply)}</div>`
                          : ''
                      }
                    </div>
                  </div>
                `;
                })
                .join('');
      }

      // 2. Hata Bildirimleri
      const bugListEl = document.getElementById('user-bug-reports-list');
      if (bugListEl) {
        const bugs = bugService.listBugReports(this.session, false);
        bugListEl.innerHTML =
          bugs.length === 0
            ? '<div class="empty-state-box">Henüz hata bildirimi bulunmuyor.</div>'
            : bugs
                .map(b => {
                  const prioTr = supportService.formatPriorityTR(b.priority);
                  return `
                  <div class="tx-row">
                    <div class="tx-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <span class="tx-reason">${this.escapeHtml(b.title)}</span>
                        <span class="priority-pill priority-${b.priority.replace(/\s+/g, '_')}">${prioTr} Öncelik</span>
                        <span class="status-pill status-WAITING">${b.status}</span>
                      </div>
                      <span class="tx-meta">[${b.id}] • Gönderen: ${this.escapeHtml(b.username)} • ${this.escapeHtml(b.category)} ${b.relatedParty ? `• Parti: ${this.escapeHtml(b.relatedParty)}` : ''}</span>
                      <p class="panel-sec-desc" style="margin-top:0.25rem;">${this.escapeHtml(b.description)}</p>
                    </div>
                  </div>
                `;
                })
                .join('');
      }

      // 3. Topluluk Önerileri
      const sugListEl = document.getElementById('user-suggestions-list');
      const sortBy = document.getElementById('filter-user-suggestions-sort')?.value || 'PRIORITY';
      if (sugListEl) {
        const sugs = suggestionService.listSuggestions(this.session, sortBy);
        sugListEl.innerHTML =
          sugs.length === 0
            ? '<div class="empty-state-box">Henüz öneri gönderilmedi.</div>'
            : sugs
                .map(s => {
                  const voted = (s.votedBy || []).some(
                    u => u.toLowerCase() === this.session.username.toLowerCase()
                  );
                  const prioTr = supportService.formatPriorityTR(s.priority);
                  const statusTr = supportService.formatSuggestionStatusTR
                    ? supportService.formatSuggestionStatusTR(s.status)
                    : s.status;
                  return `
                  <div class="tx-row">
                    <div class="tx-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <span class="tx-reason">${this.escapeHtml(s.title)}</span>
                        <span class="priority-pill priority-${s.priority.replace(/\s+/g, '_')}">${prioTr} Öncelik</span>
                        <span class="status-pill status-ACTIVE">${this.escapeHtml(statusTr)}</span>
                      </div>
                      <span class="tx-meta">[${s.id}] • Gönderen: ${this.escapeHtml(s.username)} • ${this.escapeHtml(s.category)}</span>
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
            suggestionService.voteSuggestion(this.session, id);
            this.renderSupportHub();
          });
        });
      }
    }

    // ==========================================
    // HESAP AYARLARI EKRANI
    // ==========================================
    bindAccountSettings() {
      const unameForm = document.getElementById('form-acc-username');
      const pwdForm = document.getElementById('form-acc-password');
      const activateLicForm = document.getElementById('form-acc-activate-license');
      const rgbEnableBtn = document.getElementById('btn-acc-rgb-enable');
      const rgbDisableBtn = document.getElementById('btn-acc-rgb-disable');
      const notifChk = document.getElementById('chk-acc-notifications');
      const logoutBtn = document.getElementById('btn-acc-logout');

      if (activateLicForm) {
        activateLicForm.addEventListener('submit', async e => {
          e.preventDefault();
          const inp = document.getElementById('inp-acc-activate-license');
          const rawCode = inp ? inp.value.trim() : '';
          if (!rawCode) return;

          const res = await licenseService.activateLicenseOnAccount(this.session, rawCode);
          if (!res.ok) {
            window.soundManager.playError();
            this.showToast(res.error, 'error');
            return;
          }

          this.session = res.session;
          if (inp) inp.value = '';
          window.soundManager.playRankUpgrade();
          this.showToast(res.message || 'Lisans kodu hesabınıza başarıyla tanımlandı!', 'success');
          this.updateTopBarSessionUI();
          this.syncEconomyHeaderUI();
          this.renderAccountSettings();
        });
      }

      if (unameForm) {
        unameForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const inp = document.getElementById('inp-acc-new-username');
            const res = userService.changeUsername(this.session, inp.value);
            this.session = res.session;
            inp.value = '';
            window.soundManager.playSuccess();
            this.showToast(
              `Kullanıcı adı "${this.session.username}" olarak güncellendi (Hesap ID ${res.user.id} korundu)!`,
              'success'
            );
            this.updateTopBarSessionUI();
            this.syncEconomyHeaderUI();
            this.renderAccountSettings();
          } catch (err) {
            window.soundManager.playError();
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
            window.soundManager.playSuccess();
            this.showToast('Şifre güvenli bir şekilde güncellendi (tuzlanmış SHA-256).', 'success');
            this.renderAccountSettings();
          } catch (err) {
            window.soundManager.playError();
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
            this.showToast('🌈 RGB Kullanıcı Adı etkinleştirildi!', 'success');
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
            this.showToast('RGB Kullanıcı Adı kapatıldı.', 'info');
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
          this.showToast('Bildirim ayarları kaydedildi.', 'info');
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
        ? `👑 AKTİF (${user.vipStatus.expiresAt || 'Sınırsız'})`
        : 'Standart Oyuncu';
      document.getElementById('acc-info-license').textContent = `${user.licenseId} (${this.session.codeMasked || 'Doğrulandı'})`;
      document.getElementById('acc-info-pwd-status').textContent = user.hasPassword
        ? '🔒 Şifre Hash Ayarlı (SHA-256)'
        : 'Şifre Ayarlanmadı (Lisans Girişi)';
    }

    // ==========================================
    // BÖLÜM 26 & 27: ADMİN PANELİ — %100 TÜRKÇE (18 SAYFA)
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

      this.syncEconomyHeaderUI();
      this.renderAdminAll();
    }

    bindAdminPanel() {
      const sidebarNav = document.getElementById('admin-sidebar-nav');
      const openAdminDrawerBtn = document.getElementById('btn-open-admin-drawer');

      if (openAdminDrawerBtn && sidebarNav) {
        openAdminDrawerBtn.addEventListener('click', () => {
          window.soundManager.playMenuOpen();
          sidebarNav.classList.toggle('mobile-drawer-open');
          sidebarNav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }

      document.querySelectorAll('[data-admin-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const tab = btn.getAttribute('data-admin-tab');
          if (sidebarNav) sidebarNav.classList.remove('mobile-drawer-open');
          this.switchAdminTab(tab);
        });
      });

      const mobMoreBtn = document.getElementById('btn-admin-mob-more');
      if (mobMoreBtn && sidebarNav) {
        mobMoreBtn.addEventListener('click', () => {
          window.soundManager.playMenuOpen();
          sidebarNav.classList.toggle('mobile-drawer-open');
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

      // Oyuncu Arama & Filtre
      const searchUsers = document.getElementById('search-adm-users');
      const filterUsersRole = document.getElementById('filter-adm-users-role');
      if (searchUsers) searchUsers.addEventListener('input', () => this.renderAdminUsers());
      if (filterUsersRole) filterUsersRole.addEventListener('change', () => this.renderAdminUsers());

      // Rütbe Kaydetme Formu
      const saveRankForm = document.getElementById('form-admin-save-rank');
      if (saveRankForm) {
        saveRankForm.addEventListener('submit', e => {
          e.preventDefault();
          try {
            const id = document.getElementById('adm-rank-id')?.value.trim();
            const name = document.getElementById('adm-rank-name')?.value.trim();
            const badge = document.getElementById('adm-rank-icon')?.value.trim() || '⚡';
            const color = document.getElementById('adm-rank-color')?.value.trim() || '#fbbf24';
            const emeraldPrice = Number(document.getElementById('adm-rank-emerald-price')?.value || 0);
            const price = Number(document.getElementById('adm-rank-tl-price')?.value || 0);
            const maxPartySize = Number(document.getElementById('adm-rank-party-limit')?.value || 4);
            const emeraldMultiplier = Number(document.getElementById('adm-rank-multiplier')?.value || 1.0);
            const supportPriority = document.getElementById('adm-rank-priority')?.value || 'HIGH';
            const canCreateParty = document.getElementById('adm-rank-can-party')?.value === 'true';

            const saved = rankService.adminSaveRank(this.session, {
              id,
              name,
              badge,
              color,
              emeraldPrice,
              price,
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
            window.soundManager.playSuccess();
            this.showToast(`Rütbe "${saved.name}" (${saved.id}) kaydedildi!`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Lisans Oluştur & Filtrele
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
            window.soundManager.playSuccess();
            this.showToast(`Lisans oluşturuldu: ${created.code} (${created.role})`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      const searchLic = document.getElementById('search-adm-licenses');
      const filterLic = document.getElementById('filter-adm-licenses');
      if (searchLic) searchLic.addEventListener('input', () => this.renderAdminLicenses());
      if (filterLic) filterLic.addEventListener('change', () => this.renderAdminLicenses());

      // Partiler Arama & Filtre
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

      // Admin Liderlik Sıralaması
      const admLbSort = document.getElementById('adm-lb-sort');
      if (admLbSort) {
        admLbSort.addEventListener('change', () => this.renderAdminLeaderboard());
      }

      // Ekonomi Bakiye İşlemleri
      document.querySelectorAll('[data-adm-econ-op]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const op = btn.getAttribute('data-adm-econ-op');
          const targetUser = (document.getElementById('adm-econ-username')?.value || '').trim();
          const amountVal = Number(document.getElementById('adm-econ-amount')?.value || 0);
          const reasonVal = (document.getElementById('adm-econ-reason')?.value || '').trim();

          if (!targetUser) {
            this.showToast('Lütfen bir oyuncu kullanıcı adı girin.', 'error');
            return;
          }

          this.askConfirmation(
            `💚 Admin Ekonomi İşlemi (${op})`,
            `"${targetUser}" oyuncusu için ${op} (${amountVal} Zümrüt) işlemini uygulamak istediğinize emin misiniz?`,
            `Onayla (${op})`,
            () => {
              try {
                economyService.adminModifyBalance(this.session, {
                  username: targetUser,
                  operation: op,
                  amount: amountVal,
                  reason: reasonVal || `Admin ${op}`
                });
                window.soundManager.playEmeraldGain();
                this.showToast(`"${targetUser}" oyuncusunun Zümrüt bakiyesi güncellendi (${op}).`, 'success');
                this.syncEconomyHeaderUI();
                this.renderAdminAll();
              } catch (err) {
                window.soundManager.playError();
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      });

      // Ekonomi Yapılandırma Formu
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

            window.soundManager.playSuccess();
            this.showToast('Ekonomi, VIP Bonus ve Ekstra Can ayarları kaydedildi!', 'success');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin Mağaza Ürünü Oluştur
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
            window.soundManager.playSuccess();
            this.showToast(`Mağaza ürünü "${name}" başarıyla oluşturuldu!`, 'success');
            this.renderAdminAll();
          } catch (err) {
            window.soundManager.playError();
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin VIP / Rütbe Atama Formu
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
            window.soundManager.playRankUpgrade();
            this.showToast(`👑 ${targetRank} rütbesi ${uname} oyuncusuna atandı!`, 'success');
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
            this.showToast('Lütfen bir kullanıcı adı girin.', 'error');
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
            this.showToast(`${uname} oyuncusunun rütbesi PLAYER olarak sıfırlandı.`, 'info');
            this.syncEconomyHeaderUI();
            this.renderAdminAll();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // Admin Ödemeler Durum Filtresi
      const filterPayments = document.getElementById('filter-adm-payments-status');
      if (filterPayments) {
        filterPayments.addEventListener('change', () => this.renderAdminPaymentsTab());
      }

      // Admin Öneriler Sıralaması
      const admSugSort = document.getElementById('adm-suggestions-sort');
      if (admSugSort) {
        admSugSort.addEventListener('change', () => this.renderAdminSuggestions());
      }

      // Admin İşlemler Arama
      const searchTx = document.getElementById('search-adm-tx-history');
      if (searchTx) {
        searchTx.addEventListener('input', () => this.renderAdminTransactions());
      }

      // Admin Yedek Oluştur & İndir
      const createBackupBtn = document.getElementById('btn-adm-create-backup');
      if (createBackupBtn) {
        createBackupBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          try {
            const snap = backupService.createBackup(this.session, 'Manuel Admin Yedeği');
            window.soundManager.playSuccess();
            this.showToast(`Yedek ${snap.version} (${snap.id}) oluşturuldu!`, 'success');
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
            this.downloadJsonFile(`minecraft-milyoner-yedek-${Date.now()}.json`, jsonStr);
            this.showToast('Yedek JSON dosyası indirildi!', 'success');
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }

      // Aktivite Günlüğünü Temizle
      const clearLogsBtn = document.getElementById('btn-adm-clear-logs');
      if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.askConfirmation(
            '🗑️ Aktivite Günlüğünü Temizle',
            'Tüm sistem aktivite kayıtlarını temizlemek istediğinize emin misiniz?',
            'Günlüğü Temizle',
            () => {
              try {
                activityService.clearAll(this.session);
                this.showToast('Aktivite günlüğü temizlendi.', 'info');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          );
        });
      }

      // Ayarlar Butonları
      const admAudioBtn = document.getElementById('btn-adm-open-audio');
      if (admAudioBtn) {
        admAudioBtn.addEventListener('click', () => {
          window.soundManager.playMenuOpen();
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

    // 1. Admin Gösterge Paneli (12 Kart)
    renderAdminDashboard() {
      const users = userService.getAllUsers();
      const parties = partyService.listParties(this.session);
      const econProfiles = economyService.getAllProfiles();
      const tickets = supportService.listSupportTickets(this.session, false);
      const bugs = bugService.listBugReports(this.session, false);
      const sugs = suggestionService.listSuggestions(this.session, 'PRIORITY');
      const logs = activityService.getAll();
      const cfg = configService.getConfig();
      const revMetrics = paymentService.getRevenueMetrics
        ? paymentService.getRevenueMetrics()
        : { emeraldsSold: 0, totalRevenueTL: 0 };

      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status === 'ACTIVE').length;
      const vipUsers = users.filter(
        u =>
          ['VIP', 'VIP_PLUS'].includes(u.rank) ||
          (u.vipStatus?.isVip &&
            !['MVP', 'MVP_PLUS', 'ELITE', 'LEGEND', 'CHAMPION', 'MILLIONAIRE'].includes(u.rank))
      ).length;
      const mvpUsers = users.filter(u =>
        ['MVP', 'MVP_PLUS', 'ELITE', 'LEGEND', 'CHAMPION', 'MILLIONAIRE'].includes(u.rank)
      ).length;
      const totalParties = parties.length;
      const activeParties = parties.filter(p =>
        ['WAITING', 'READY', 'STARTING', 'ACTIVE'].includes(p.status)
      ).length;
      const totalEmeralds = econProfiles.reduce((sum, p) => sum + (p.emeraldCoins || 0), 0);
      const openTickets = tickets.filter(
        t => t.status === 'OPEN' || t.status === 'IN PROGRESS'
      ).length;
      const openBugs = bugs.filter(b => b.status !== 'RESOLVED' && b.status !== 'CLOSED').length;
      const openSuggestions = sugs.filter(
        s => s.status !== 'COMPLETED' && s.status !== 'DECLINED' && s.status !== 'REJECTED'
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
      setTxt('adm-card-total-emeralds', `${totalEmeralds.toLocaleString('tr-TR')} 💚`);
      setTxt('adm-card-emeralds-sold', `${(revMetrics.emeraldsSold || 0).toLocaleString('tr-TR')} 💚`);
      setTxt('adm-card-revenue', `${(revMetrics.totalRevenueTL || 0).toLocaleString('tr-TR')} TL`);
      setTxt('adm-card-open-tickets', openTickets);
      setTxt('adm-card-open-bugs', openBugs);
      setTxt('adm-card-open-suggestions', openSuggestions);

      const stEx = document.getElementById('adm-status-extralife');
      if (stEx) {
        stEx.textContent = cfg.extraLife.enabled ? 'AKTİF' : 'DEVRE DIŞI';
        stEx.className = cfg.extraLife.enabled ? 'emerald-text' : 'wrong-text';
      }

      const recentEl = document.getElementById('adm-dash-recent-activity');
      if (recentEl) {
        const recent = logs.slice(0, 8);
        recentEl.innerHTML =
          recent.length === 0
            ? '<div class="empty-state-box">Henüz sistem aktivitesi bulunmuyor.</div>'
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

    // 2. Admin Oyuncular Sayfası
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
          const createdStr = new Date(u.createdAt).toLocaleDateString('tr-TR');
          const loginStr = new Date(u.lastLogin).toLocaleString('tr-TR');
          const rankLabel = u.rank || u.role || 'PLAYER';

          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  ${this.getAvatarImgHtml(u.minecraftUsername, 'mc-avatar-xs')}
                  <strong>${this.formatUsernameHtml(u.minecraftUsername, prof.rgbOwned && prof.rgbEnabled)}</strong>
                  <span class="meta-muted">(${u.id})</span>
                  <span class="role-badge role-${u.role.toLowerCase()}">${this.escapeHtml(prof.rankBadge || rankLabel)}</span>
                  <span class="status-pill status-${u.status === 'ACTIVE' ? 'ACTIVE' : 'REVOKED'}">${u.status === 'ACTIVE' ? 'AKTİF' : 'ASKIYA ALINDI'}</span>
                </div>
                <div class="adm-row-sub">
                  <span>Rütbe: <strong class="gold-text">${this.escapeHtml(rankLabel)}</strong></span>
                  <span>⭐ Puan: <strong>${prof.totalPoints.toLocaleString('tr-TR')}</strong></span>
                  <span>💚 Zümrüt: <strong class="emerald-text">${prof.emeraldCoins.toLocaleString('tr-TR')}</strong></span>
                  <span>🎮 Oyun: <strong>${prof.gamesPlayed} (${prof.gamesWon}G / ${prof.gamesLost}M)</strong></span>
                  <span>📅 Kayıt: ${createdStr}</span>
                  <span>🕒 Son Giriş: ${loginStr}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn" data-usr-act="role" data-user="${this.escapeHtml(u.minecraftUsername)}" data-role="${u.rank || u.role}">Rütbe / Rol Ata</button>
                <button type="button" class="act-btn emerald" data-usr-act="econ" data-user="${this.escapeHtml(u.minecraftUsername)}">Zümrüt Düzenle</button>
                <button type="button" class="act-btn ${u.status === 'SUSPENDED' ? 'emerald' : 'danger'}" data-usr-act="suspend" data-user="${this.escapeHtml(u.minecraftUsername)}">${u.status === 'SUSPENDED' ? 'Askıyı Kaldır' : 'Askıya Al'}</button>
                <button type="button" class="act-btn danger" data-usr-act="reset" data-user="${this.escapeHtml(u.minecraftUsername)}">Hesabı Sıfırla</button>
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
              `${uname} için yeni Rütbe veya Rol girin (PLAYER, VIP, VIP+, MVP, MVP+, ELITE, LEGEND, CHAMPION, MILLIONAIRE veya ADMIN):`,
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
                this.showToast(`${uname} rütbesi ${nextRole.toUpperCase()} olarak güncellendi`, 'success');
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
              this.showToast(`${uname} durumu: ${updated.status}`, 'info');
              this.renderAdminAll();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          } else if (act === 'reset') {
            this.askConfirmation(
              '⚠️ Hesabı Sıfırla',
              `"${uname}" oyuncusunun Zümrüt, Puan ve Oyun istatistiklerini sıfırlamak istediğinize emin misiniz?`,
              'Hesabı Sıfırla',
              () => {
                try {
                  userService.adminResetUserAccount(this.session, uname);
                  this.showToast(`${uname} hesabı sıfırlandı.`, 'info');
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

    // 3. Admin Rütbeler Sayfası
    renderAdminRanksTab() {
      const wrap = document.getElementById('adm-ranks-list');
      if (!wrap) return;
      const ranks = rankService.getRanks ? rankService.getRanks(true) : [];

      wrap.innerHTML = ranks
        .map(r => {
          const p = r.permissions || {};
          const isProtected = ['PLAYER', 'VIP', 'ADMIN'].includes(r.id);
          const icon = r.badge || r.badgeIcon || '👑';
          const color = r.color || r.badgeColor || '#fbbf24';
          const tlPrice = r.price ?? r.tlPrice ?? 0;
          const prioTr = supportService.formatPriorityTR(p.supportPriority || 'NORMAL');
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span style="font-size:1.3rem;">${this.escapeHtml(icon)}</span>
                  <span class="adm-code-title" style="color:${this.escapeHtml(color)};">${this.escapeHtml(r.name)} (${this.escapeHtml(r.id)})</span>
                  <strong class="emerald-text">💚 ${(r.emeraldPrice || 0).toLocaleString('tr-TR')} Zümrüt</strong>
                  <strong class="gold-text">💳 ${tlPrice.toLocaleString('tr-TR')} TL</strong>
                </div>
                <div class="adm-row-sub">
                  <span>Parti Oluşturma: <strong>${p.canCreateParty ? 'EVET' : 'HAYIR'}</strong></span>
                  <span>Maks Parti Boyutu: <strong>${p.maxPartySize >= 999 ? 'Sınırsız' : p.maxPartySize}</strong></span>
                  <span>Zümrüt Çarpanı: <strong>${p.emeraldMultiplier || 1}x</strong></span>
                  <span>Öncelik: <strong>${this.escapeHtml(prioTr)}</strong></span>
                  <span>RGB İsim: <strong>${p.rgbName ? 'EVET' : 'HAYIR'}</strong></span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-rnk-act="edit" data-id="${this.escapeHtml(r.id)}">Düzenleyiciye Yükle</button>
                ${
                  !isProtected
                    ? `<button type="button" class="act-btn danger" data-rnk-act="delete" data-id="${this.escapeHtml(r.id)}">Sil</button>`
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
            document.getElementById('adm-rank-icon').value = r.badge || r.badgeIcon || '👑';
            document.getElementById('adm-rank-color').value = r.color || r.badgeColor || '#fbbf24';
            document.getElementById('adm-rank-emerald-price').value = r.emeraldPrice || 0;
            document.getElementById('adm-rank-tl-price').value = r.price ?? r.tlPrice ?? 0;
            document.getElementById('adm-rank-party-limit').value = r.permissions?.maxPartySize || 4;
            document.getElementById('adm-rank-multiplier').value = r.permissions?.emeraldMultiplier || 1;
            document.getElementById('adm-rank-priority').value = r.permissions?.supportPriority || 'HIGH';
            document.getElementById('adm-rank-can-party').value = String(Boolean(r.permissions?.canCreateParty));
            this.showToast(`${r.name} rütbesi düzenleyiciye yüklendi.`, 'info');
          } else if (act === 'delete') {
            try {
              rankService.adminDeleteRank(this.session, id);
              this.showToast(`${id} rütbesi silindi.`, 'info');
              this.renderAdminAll();
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          }
        });
      });
    }

    // 4. Admin Lisanslar Sayfası
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
        wrap.innerHTML = '<div class="empty-state-box">Eşleşen lisans bulunamadı.</div>';
        return;
      }

      wrap.innerHTML = list
        .map(l => {
          const createdStr = new Date(l.createdAt).toLocaleDateString('tr-TR');
          const expiresStr = l.expiresAt
            ? new Date(l.expiresAt).toLocaleDateString('tr-TR')
            : 'Süresiz';
          const sessionInfo = l.currentSessionUser
            ? `🟢 Aktif Kullanıcı: ${this.escapeHtml(l.currentSessionUser)}`
            : l.assignedUsername
            ? `👤 Atanan: ${this.escapeHtml(l.assignedUsername)}`
            : 'Atanmamış';

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
                  <span>📅 Oluşturulma: ${createdStr}</span>
                  <span>⏳ Bitiş: <strong>${expiresStr}</strong></span>
                  <span>${sessionInfo}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-lic-action="copy" data-code="${this.escapeHtml(l.code)}">Kopyala</button>
                <button type="button" class="act-btn" data-lic-action="role" data-id="${l.id}" data-role="${l.role}">Rol Ata</button>
                ${
                  l.effectiveStatus === 'ACTIVE'
                    ? `<button type="button" class="act-btn" data-lic-action="disable" data-id="${l.id}">Devre Dışı Bırak</button>`
                    : `<button type="button" class="act-btn emerald" data-lic-action="activate" data-id="${l.id}">Aktifleştir</button>`
                }
                ${
                  l.effectiveStatus !== 'REVOKED'
                    ? `<button type="button" class="act-btn danger" data-lic-action="revoke" data-id="${l.id}">İptal Et</button>`
                    : ''
                }
                <button type="button" class="act-btn danger" data-lic-action="delete" data-id="${l.id}">Sil</button>
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
            this.copyToClipboard(code, `Lisans kodu kopyalandı: ${code}`);
          } else if (action === 'role') {
            const nextRole = prompt(
              'Bu lisans için rol girin (PLAYER, VIP veya ADMIN):',
              currRole === 'PLAYER' ? 'VIP' : 'PLAYER'
            );
            if (nextRole) {
              licenseService.updateLicenseRoleOrExpiry(this.session, id, { role: nextRole });
              this.showToast('Lisans rolü güncellendi.', 'success');
              this.renderAdminAll();
            }
          } else if (action === 'disable') {
            licenseService.updateLicenseStatus(this.session, id, 'DISABLED');
            this.showToast('Lisans devre dışı bırakıldı.', 'info');
            this.renderAdminAll();
          } else if (action === 'activate') {
            licenseService.updateLicenseStatus(this.session, id, 'ACTIVE');
            this.showToast('Lisans yeniden aktifleştirildi.', 'success');
            this.renderAdminAll();
          } else if (action === 'revoke') {
            this.askConfirmation(
              '⚠️ Lisansı İptal Et',
              'Bu lisansı iptal etmek istediğinize emin misiniz?',
              'İptal Et',
              () => {
                licenseService.updateLicenseStatus(this.session, id, 'REVOKED');
                this.showToast('Lisans iptal edildi.', 'info');
                this.renderAdminAll();
              }
            );
          } else if (action === 'delete') {
            this.askConfirmation(
              '🗑️ Lisansı Sil',
              'Bu lisansı kalıcı olarak silmek istediğinize emin misiniz?',
              'Sil',
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

    // 5. Admin Partiler Sayfası
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
        wrap.innerHTML = '<div class="empty-state-box">Parti bulunamadı.</div>';
        return;
      }

      wrap.innerHTML = parties
        .map(p => {
          const joinedCount = p.participants.filter(pt => pt.joinStatus === 'JOINED').length;
          const statusTr = PARTY_STATUS_LABELS_TR[p.status] || p.status;
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span class="adm-code-title">${this.escapeHtml(p.name)}</span>
                  <span class="status-pill status-${p.status}">${statusTr}</span>
                  <span class="meta-muted">(${p.id})</span>
                </div>
                <div class="adm-row-sub">
                  <span>👑 Kurucu: <strong>${this.escapeHtml(p.organizer)}</strong></span>
                  <span>🎮 Mod: <strong>${this.escapeHtml(p.gameMode || 'Klasik')}</strong></span>
                  <span>👥 Oyuncular: <strong>${joinedCount} / ${p.maxPlayers}</strong></span>
                  <span>🎟️ Davet Kodu: <strong class="emerald-text">${p.inviteCode}</strong></span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn emerald" data-prt-action="inspect" data-id="${p.id}">İncele / Yönet</button>
                <button type="button" class="act-btn emerald" data-prt-action="forcestart" data-id="${p.id}">Zorla Başlat</button>
                <button type="button" class="act-btn" data-prt-action="transfer" data-id="${p.id}">Kurucu Devret</button>
                <button type="button" class="act-btn danger" data-prt-action="cancel" data-id="${p.id}">İptal Et</button>
                <button type="button" class="act-btn danger" data-prt-action="delete" data-id="${p.id}">Sil</button>
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
            this.showToast('Parti Admin tarafından başlatıldı.', 'success');
            this.renderAdminAll();
          } else if (act === 'transfer') {
            const newOwner = prompt('Yeni parti kurucusunun Minecraft kullanıcı adını girin:');
            if (newOwner && newOwner.trim()) {
              try {
                partyService.transferOwnership(this.session, id, newOwner.trim());
                this.showToast(`Parti kuruculuğu ${newOwner.trim()} oyuncusuna devredildi.`, 'success');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          } else if (act === 'cancel') {
            partyService.setPartyStatus(this.session, id, 'CANCELLED');
            this.showToast('Parti iptal edildi.', 'info');
            this.renderAdminAll();
          } else if (act === 'delete') {
            this.askConfirmation(
              '🗑️ Partiyi Sil',
              'Bu partiyi kalıcı olarak silmek istediğinize emin misiniz?',
              'Partiyi Sil',
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

    // 6. Admin Liderlik Tablosu Sayfası
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
                ${this.getAvatarImgHtml(r.username, 'mc-avatar-xs')}
                <strong>${this.formatUsernameHtml(r.username, r.rgbOwned && r.rgbEnabled)}</strong>
                <span class="role-badge role-${r.role.toLowerCase()}">${r.rankBadge}</span>
              </div>
              <div class="adm-row-sub">
                <span>⭐ Puan: <strong>${r.totalPoints.toLocaleString('tr-TR')}</strong></span>
                <span>💚 Zümrüt: <strong class="emerald-text">${r.emeraldCoins.toLocaleString('tr-TR')}</strong></span>
                <span>🏆 Galibiyet: <strong>${r.gamesWon} (%${r.winRate})</strong></span>
                <span>🎮 Oyun: <strong>${r.gamesPlayed}</strong></span>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }

    // 7. Admin Ekonomi Sayfası
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
              )} (💚 ${p.emeraldCoins} Zümrüt | ⭐ ${p.totalPoints} Puan)</option>`
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

      // Zümrüt Satın Alma Paketleri (500 - 10.000 💚)
      const pkgWrap = document.getElementById('adm-emerald-packages-list');
      if (pkgWrap) {
        const pkgs = paymentService.listEmeraldPackages
          ? paymentService.listEmeraldPackages(true)
          : paymentService.getEmeraldPackages
          ? paymentService.getEmeraldPackages(true)
          : [];
        pkgWrap.innerHTML = pkgs
          .map(pkg => {
            const pkgTitle = pkg.name || pkg.title || `${pkg.emeralds} Zümrüt Paketi`;
            return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                  <span>${this.escapeHtml(pkg.icon || '💚')}</span>
                  <strong>${this.escapeHtml(pkgTitle)}</strong>
                  <span class="emerald-text">💚 ${pkg.emeralds.toLocaleString('tr-TR')} Zümrüt</span>
                  <span class="gold-text">💳 ${pkg.priceTL.toLocaleString('tr-TR')} TL</span>
                  <span class="status-pill status-${pkg.enabled !== false ? 'ACTIVE' : 'DISABLED'}">${
                    pkg.enabled !== false ? 'AKTİF' : 'DEVRE DIŞI'
                  }</span>
                </div>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="act-btn" data-pkg-edit="${this.escapeHtml(pkg.id)}">TL Fiyatını Düzenle</button>
              </div>
            </div>
          `;
          })
          .join('');

        pkgWrap.querySelectorAll('[data-pkg-edit]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.soundManager.playClick();
            const id = btn.getAttribute('data-pkg-edit');
            const target = pkgs.find(x => x.id === id);
            if (!target) return;
            const pkgTitle = target.name || target.title || id;
            const rawPrice = prompt(
              `${pkgTitle} için yeni TL fiyatı girin (min 100 TL):`,
              String(target.priceTL)
            );
            if (rawPrice !== null && rawPrice.trim() !== '') {
              try {
                paymentService.adminSaveEmeraldPackage(this.session, {
                  ...target,
                  priceTL: Number(rawPrice)
                });
                this.showToast(`${pkgTitle} fiyatı ${rawPrice} TL olarak güncellendi.`, 'success');
                this.renderAdminAll();
              } catch (err) {
                this.showToast(err.message, 'error');
              }
            }
          });
        });
      }
    }

    // 8. Admin Zümrüt Mağazası Sayfası
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
                  item.enabled ? 'AKTİF' : 'DEVRE DIŞI'
                }</span>
                <span class="role-badge role-player">${this.escapeHtml(item.category)}</span>
                <strong class="emerald-text">💚 ${item.price.toLocaleString('tr-TR')} Zümrüt</strong>
              </div>
              <div class="adm-row-sub">
                <span>Etki: <strong>${item.effectType}</strong></span>
                <span>Gerekli Rol: <strong>${item.requiredRole}</strong></span>
                <span>Limit: <strong>${item.purchaseLimit}</strong></span>
                <span>"${this.escapeHtml(item.description)}"</span>
              </div>
            </div>
            <div class="adm-row-actions">
              <button type="button" class="act-btn" data-shop-adm="price" data-id="${this.escapeHtml(item.id)}">Fiyat Değiştir</button>
              <button type="button" class="act-btn ${item.enabled ? 'danger' : 'emerald'}" data-shop-adm="toggle" data-id="${this.escapeHtml(item.id)}">${item.enabled ? 'Devre Dışı Bırak' : 'Aktifleştir'}</button>
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
              `${target.name} durumu: ${!target.enabled ? 'AKTİF' : 'DEVRE DIŞI'}.`,
              'info'
            );
            this.renderAdminAll();
          } else if (act === 'price') {
            const rawNewPrice = prompt(
              `"${target.name}" için yeni Zümrüt Coin fiyatını girin:`,
              String(target.price)
            );
            if (rawNewPrice !== null && rawNewPrice.trim() !== '') {
              const parsed = Math.max(0, Math.floor(Number(rawNewPrice)));
              if (!Number.isNaN(parsed)) {
                shopService.adminSaveShopItem(this.session, {
                  ...target,
                  price: parsed
                });
                this.showToast(`${target.name} fiyatı ${parsed} Zümrüt olarak güncellendi.`, 'success');
                this.renderAdminAll();
              }
            }
          }
        });
      });
    }

    // 9. Admin VIP ve Rütbe Yönetimi Sayfası
    renderAdminVipTab() {
      const vipWrap = document.getElementById('adm-vip-users-list');
      if (!vipWrap) return;

      const rankedUsers = userService
        .getAllUsers()
        .filter(
          u =>
            u.role === 'VIP' ||
            u.role === 'ADMIN' ||
            u.vipStatus?.isVip ||
            (u.rank && u.rank !== 'PLAYER')
        );

      vipWrap.innerHTML =
        rankedUsers.length === 0
          ? '<div class="empty-state-box">Rütbeli üye bulunamadı.</div>'
          : rankedUsers
              .map(u => {
                const prof = economyService.getPlayerEconomyProfile(u.minecraftUsername);
                return `
                  <div class="adm-row-card">
                    <div class="adm-row-main">
                      <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        ${this.getAvatarImgHtml(u.minecraftUsername, 'mc-avatar-xs')}
                        <strong>👑 ${this.escapeHtml(u.minecraftUsername)}</strong>
                        <span class="role-badge role-${u.role.toLowerCase()}">${this.escapeHtml(prof.rankBadge || u.rank || u.role)}</span>
                      </div>
                      <div class="adm-row-sub">
                        <span>Rütbe Kademesi: <strong>${this.escapeHtml(u.rank || u.vipStatus?.tier || 'VIP')}</strong></span>
                        <span>Maks Parti Boyutu: <strong>${prof.permissions?.maxPartySize || 4}</strong></span>
                        <span>Bitiş: <strong>${u.rankExpiration || u.vipStatus?.expiresAt || 'Sınırsız'}</strong></span>
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('');
    }

    // 10. Admin Ödemeler Sayfası
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
          '<div class="empty-state-box">Bu filtre için kayıtlı Stripe ödeme oturumu bulunamadı.</div>';
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
                  <span>Ürün: <strong>${this.escapeHtml(p.title)}</strong></span>
                  <span>Tür: <strong>${this.escapeHtml(p.type || 'EMERALDS')}</strong></span>
                  ${p.webhookEventId ? `<span>Webhook Olayı: <code>${this.escapeHtml(p.webhookEventId)}</code></span>` : ''}
                  <span>Tarih: ${new Date(p.createdAt).toLocaleString('tr-TR')}</span>
                </div>
              </div>
              <div class="adm-row-actions">
                ${
                  p.status === 'PAID'
                    ? `<button type="button" class="act-btn danger" data-pay-act="refund" data-id="${this.escapeHtml(p.id)}">İade Et</button>`
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
            '💸 Ödemeyi İade Et',
            `${id} numaralı ödemeyi İADE EDİLDİ olarak işaretlemek ve tanımlanan Zümrütleri geri almak istediğinize emin misiniz?`,
            'İadeyi Onayla',
            () => {
              try {
                paymentService.adminRefundPayment(this.session, id, 'Admin Paneli İadesi');
                this.showToast(`Ödeme ${id} iade edildi.`, 'info');
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

    // 11. Admin Destek Talepleri Sayfası
    renderAdminSupport() {
      const wrap = document.getElementById('adm-support-list');
      if (!wrap) return;
      const tickets = supportService.listSupportTickets(this.session, false);

      wrap.innerHTML =
        tickets.length === 0
          ? '<div class="empty-state-box">Destek talebi bulunamadı.</div>'
          : tickets
              .map(t => {
                const prioTr = supportService.formatPriorityTR(t.priority);
                return `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${t.priority.replace(/\s+/g, '_')}">${prioTr} ÖNCELİK</span>
                    <strong>${this.escapeHtml(t.title)}</strong>
                    <span class="status-pill status-${t.status === 'RESOLVED' ? 'ACTIVE' : 'WAITING'}">${t.status}</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>Talep ID: <strong>${t.id}</strong></span>
                    <span>Oyuncu: <strong>${this.escapeHtml(t.username)} (${this.escapeHtml(t.rank || t.role)})</strong></span>
                    <span>Kategori: <strong>${this.escapeHtml(t.category)}</strong></span>
                    <span>Tarih: ${new Date(t.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(t.description)}</p>
                  ${t.adminReply ? `<div class="emerald-text" style="font-size:0.84rem; margin-top:0.2rem;">Yanıt: ${this.escapeHtml(t.adminReply)}</div>` : ''}
                </div>
                <div class="adm-row-actions">
                  <button type="button" class="act-btn emerald" data-adm-sup="reply" data-id="${t.id}">Yanıtla ve Çöz</button>
                  <button type="button" class="act-btn" data-adm-sup="close" data-id="${t.id}">Kapat</button>
                </div>
              </div>
            `;
              })
              .join('');

      wrap.querySelectorAll('[data-adm-sup]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const act = btn.getAttribute('data-adm-sup');
          const id = btn.getAttribute('data-id');
          if (act === 'reply') {
            const reply = prompt('Bu destek talebi için Admin yanıtını girin:');
            if (reply !== null) {
              supportService.adminUpdateSupportTicket(this.session, id, {
                status: 'RESOLVED',
                adminReply: reply.trim() || 'Admin tarafından çözüldü.'
              });
              this.showToast(`Talep ${id} çözüldü olarak işaretlendi.`, 'success');
              this.renderAdminAll();
            }
          } else if (act === 'close') {
            supportService.adminUpdateSupportTicket(this.session, id, { status: 'CLOSED' });
            this.showToast(`Talep ${id} kapatıldı.`, 'info');
            this.renderAdminAll();
          }
        });
      });
    }

    // 12. Admin Hata Bildirimleri Sayfası
    renderAdminBugs() {
      const wrap = document.getElementById('adm-bugs-list');
      if (!wrap) return;
      const bugs = bugService.listBugReports(this.session, false);
      const statuses = [
        { val: 'OPEN', label: 'AÇIK' },
        { val: 'IN PROGRESS', label: 'İNCELENİYOR' },
        { val: 'WAITING FOR USER', label: 'OYUNCU BEKLENİYOR' },
        { val: 'RESOLVED', label: 'ÇÖZÜLDÜ' },
        { val: 'CLOSED', label: 'KAPATILDI' }
      ];

      wrap.innerHTML =
        bugs.length === 0
          ? '<div class="empty-state-box">Hata bildirimi bulunamadı.</div>'
          : bugs
              .map(b => {
                const prioTr = supportService.formatPriorityTR(b.priority);
                return `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${b.priority.replace(/\s+/g, '_')}">${prioTr} ÖNCELİK</span>
                    <strong>${this.escapeHtml(b.title)}</strong>
                    <span class="status-pill status-WAITING">${b.status}</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>ID: <strong>${b.id}</strong></span>
                    <span>Oyuncu: <strong>${this.escapeHtml(b.username)} (${this.escapeHtml(b.rank || (b.isVip ? 'VIP' : 'PLAYER'))})</strong></span>
                    <span>Kategori: <strong>${this.escapeHtml(b.category)}</strong></span>
                    ${b.relatedParty ? `<span>Parti: <strong>${this.escapeHtml(b.relatedParty)}</strong></span>` : ''}
                    <span>Tarih: ${new Date(b.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(b.description)}</p>
                </div>
                <div class="adm-row-actions">
                  <select class="mc-select mc-select-xs adm-bug-status-sel" data-bug-id="${b.id}">
                    ${statuses
                      .map(
                        st => `<option value="${st.val}" ${b.status === st.val ? 'selected' : ''}>${st.label}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>
            `;
              })
              .join('');

      wrap.querySelectorAll('.adm-bug-status-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.getAttribute('data-bug-id');
          bugService.adminUpdateBugStatus(this.session, id, sel.value);
          this.showToast(`Hata bildirimi ${id} durumu güncellendi: ${sel.value}.`, 'success');
          this.renderAdminAll();
        });
      });
    }

    // 13. Admin Öneriler Sayfası (Bölüm 24: İnceleniyor, Planlandı, Geliştiriliyor, Tamamlandı, Reddedildi)
    renderAdminSuggestions() {
      const wrap = document.getElementById('adm-suggestions-list');
      if (!wrap) return;
      const sortBy = document.getElementById('adm-suggestions-sort')?.value || 'PRIORITY';
      const sugs = suggestionService.listSuggestions(this.session, sortBy);
      const statuses = [
        { val: 'REVIEWING', label: 'İnceleniyor' },
        { val: 'PLANNED', label: 'Planlandı' },
        { val: 'IN DEVELOPMENT', label: 'Geliştiriliyor' },
        { val: 'COMPLETED', label: 'Tamamlandı' },
        { val: 'DECLINED', label: 'Reddedildi' }
      ];

      wrap.innerHTML =
        sugs.length === 0
          ? '<div class="empty-state-box">Öneri bulunamadı.</div>'
          : sugs
              .map(s => {
                const prioTr = supportService.formatPriorityTR(s.priority);
                const statusTr = supportService.formatSuggestionStatusTR
                  ? supportService.formatSuggestionStatusTR(s.status)
                  : s.status;
                return `
              <div class="adm-row-card">
                <div class="adm-row-main">
                  <div style="display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap;">
                    <span class="priority-pill priority-${s.priority.replace(/\s+/g, '_')}">${prioTr} ÖNCELİK</span>
                    <strong>${this.escapeHtml(s.title)}</strong>
                    <span class="status-pill status-ACTIVE">${this.escapeHtml(statusTr)}</span>
                    <span class="gold-text">👍 ${s.votes || 0} Oy</span>
                  </div>
                  <div class="adm-row-sub">
                    <span>ID: <strong>${s.id}</strong></span>
                    <span>Oyuncu: <strong>${this.escapeHtml(s.username)} (${this.escapeHtml(s.rank || s.role)})</strong></span>
                    <span>Kategori: <strong>${this.escapeHtml(s.category)}</strong></span>
                    <span>Tarih: ${new Date(s.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <p class="panel-sec-desc" style="margin-top:0.3rem;">${this.escapeHtml(s.description)}</p>
                </div>
                <div class="adm-row-actions">
                  <select class="mc-select mc-select-xs adm-sug-status-sel" data-sug-id="${s.id}">
                    ${statuses
                      .map(
                        st => `<option value="${st.val}" ${s.status === st.val ? 'selected' : ''}>${st.label}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>
            `;
              })
              .join('');

      wrap.querySelectorAll('.adm-sug-status-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          const id = sel.getAttribute('data-sug-id');
          suggestionService.adminUpdateSuggestionStatus(this.session, id, sel.value);
          const statusTr = supportService.formatSuggestionStatusTR
            ? supportService.formatSuggestionStatusTR(sel.value)
            : sel.value;
          this.showToast(`Öneri ${id} durumu güncellendi: ${statusTr}.`, 'success');
          this.renderAdminAll();
        });
      });
    }

    // 14. Admin İşlemler Sayfası
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
          ? '<div class="empty-state-box">İşlem kaydı bulunamadı.</div>'
          : allTxs
              .slice(0, 100)
              .map(tx => {
                const isNeg = tx.amount < 0;
                const sign = tx.amount > 0 ? '+' : '';
                const amtStr =
                  tx.amount === 0
                    ? '❤️ 1 Ekstra Can Kullanıldı'
                    : `${sign}${tx.amount.toLocaleString('tr-TR')} Zümrüt`;
                return `
                  <div class="tx-row ${isNeg ? 'tx-negative' : ''}">
                    <div class="tx-main">
                      <span class="tx-reason"><strong>⛏️ ${this.escapeHtml(
                        tx.username
                      )}</strong> — ${this.escapeHtml(tx.reason)} <span class="meta-muted">[${tx.id}]</span></span>
                      <span class="tx-meta">[${tx.dateFormatted}] • Önceki Bakiye: 💚 ${Number(tx.previousBalance || 0).toLocaleString('tr-TR')} → Yeni Bakiye: 💚 ${tx.balanceAfter.toLocaleString('tr-TR')} • Kaynak: ${this.escapeHtml(tx.source || 'Sistem')}</span>
                    </div>
                    <div class="tx-amount ${isNeg ? 'wrong-text' : 'emerald-text'}">${amtStr}</div>
                  </div>
                `;
              })
              .join('');
    }

    // 15. Admin Başarımlar Sayfası
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

    // 16. Admin Yedekler Sayfası
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
                <span>📅 Tarih: ${new Date(b.createdAt).toLocaleString('tr-TR')}</span>
                <span>📁 <code>backup/users/</code> (${b.counts.users})</span>
                <span>📁 <code>backup/parties/</code> (${b.counts.parties})</span>
                <span>📁 <code>backup/licenses/</code> (${b.counts.licenses})</span>
                <span>📁 <code>backup/transactions/</code> (${b.counts.transactions})</span>
                <span>📁 <code>backup/payments/</code> (${b.counts.payments || 0})</span>
                <span>📁 <code>backup/settings/</code> (Hazır)</span>
              </div>
            </div>
            <div class="adm-row-actions">
              <button type="button" class="act-btn emerald" data-bkp-act="download" data-id="${b.id}">⬇️ Yedeği İndir</button>
              <button type="button" class="act-btn" data-bkp-act="export" data-id="${b.id}">JSON Kopyala</button>
              <button type="button" class="act-btn danger" data-bkp-act="restore" data-id="${b.id}">Yedeği Geri Yükle</button>
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
            this.showToast(`${target.id}.json indirildi!`, 'success');
          } else if (act === 'export') {
            this.copyToClipboard(
              JSON.stringify(target, null, 2),
              `Yedek ${target.id} JSON panoya kopyalandı!`
            );
          } else if (act === 'restore') {
            this.askConfirmation(
              '💾 Yedeği Geri Yükle',
              `Sistem durumunu ${target.id} (${target.version}) yedeğine geri yüklemek istediğinize emin misiniz?`,
              'Geri Yükle',
              () => {
                backupService.restoreBackup(this.session, id);
                this.showToast(`Yedek ${target.id} başarıyla geri yüklendi.`, 'success');
                this.renderAdminAll();
              }
            );
          }
        });
      });
    }

    // 17. Admin Aktivite Günlüğü
    renderAdminActivity() {
      const wrap = document.getElementById('adm-full-activity-list');
      if (!wrap) return;
      const logs = activityService.getAll();
      wrap.innerHTML =
        logs.length === 0
          ? '<div class="empty-state-box">Kayıtlı aktivite günlüğü bulunamadı.</div>'
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
    // YARDIMCI FONKSİYONLAR
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
        this.copyToClipboard(content, 'Yedek JSON panoya kopyalandı!');
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
