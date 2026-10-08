/**
 * Minecraft Milyoner - Platform Arayüz Kontrolcüsü (v6.0)
 *
 * Kapsam:
 * - Sağdan Açılır Kompakt 3 Çizgili Menü Çekmecesi (#5, #6)
 * - Bildirim Merkezi: Tekli "Okundu olarak işaretle" & "Toplu olarak okundu" (#7)
 * - Birleşik # MAĞAZA: Zümrüt, Rütbeler, Kozmetikler, Özel Ürünler (#8, #9, #10)
 * - 🎁 Arkadaşına Rütbe Hediye Et Akışı (#11)
 * - Stripe Hazırlık Modu: Sahte ödeme yok (#9, #12, #27)
 * - Günlük Netherite Ödülü (VIP+, MVIP, MVIP+) & +250 Başlangıç Netherite (#13, #14)
 * - İsteğe Bağlı Minecraft Oyuncu Adı ve Kare Skin Yüzü Avatarı (#4)
 * - Gerçek Liderlik Tablosu + Admin "Leaderboard'u Sıfırla" Onay Modalı (#17, #18, #19)
 * - 15 Bölümlü Tam Türkçe Yönetici Paneli (#21)
 */

(function (window) {
  'use strict';

  const state = {
    currentScreen: 'welcome',
    shopCategory: 'Ranks',
    notifFilter: 'ALL',
    leaderboardSort: 'points',
    leaderboardSearch: '',
    adminTab: 'dashboard',
    adminPlayerSearch: '',
    giftModal: {
      rankId: null,
      friendUsername: ''
    },
    dailyTimerInterval: null
  };

  function svc() {
    return window.MCMServices || {};
  }

  function getSession() {
    return svc().authService?.getActiveSession() || null;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTR(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '-';
    }
  }

  function formatCurrencyTRY(num) {
    return `${Number(num || 0).toLocaleString('tr-TR')} ₺`;
  }

  function showToast(message, type = 'info') {
    if (typeof window.showToastNotification === 'function') {
      window.showToastNotification(message, type);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `mc-toast mc-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3600);
  }

  // ==========================================
  // ÖZEL MINECRAFT SVG İKONLARINI YERLEŞTİR (#20)
  // ==========================================
  function injectCustomCurrencyIcons() {
    const { mcIconService } = svc();
    if (!mcIconService) return;

    document.querySelectorAll('[data-mc-icon="emerald"]').forEach(el => {
      const isLg = el.classList.contains('currency-svg-lg');
      el.innerHTML = mcIconService.getEmeraldSvg(isLg ? 26 : 18);
    });

    document.querySelectorAll('[data-mc-icon="netherite"]').forEach(el => {
      const isLg = el.classList.contains('currency-svg-lg');
      el.innerHTML = mcIconService.getNetheriteSvg(isLg ? 26 : 18);
    });
  }

  // ==========================================
  // KARE MINECRAFT SKIN YÜZÜ AVATAR YARDIMCISI (#4)
  // ==========================================
  function setAvatarImageWithFallback(imgEl, userObj) {
    if (!imgEl) return;
    const { avatarService } = svc();
    const username = userObj?.username || 'Steve';
    const fallbackDataUrl = avatarService
      ? avatarService.generatePixelAvatarDataUrl(username)
      : '';
    const primarySrc = avatarService
      ? avatarService.getAvatarForUser(userObj)
      : fallbackDataUrl;

    imgEl.onerror = function () {
      imgEl.onerror = null;
      if (fallbackDataUrl) imgEl.src = fallbackDataUrl;
    };
    imgEl.src = primarySrc || fallbackDataUrl;
  }

  function getRankBadgeClass(rankId) {
    const norm = String(rankId || 'MEMBER').toUpperCase();
    if (norm === 'ADMIN') return 'role-badge role-admin';
    if (norm === 'MODERATOR') return 'role-badge role-moderator';
    if (norm === 'MVIP_PLUS') return 'role-badge role-mvip-plus';
    if (norm === 'MVIP') return 'role-badge role-mvip';
    if (norm === 'VIP_PLUS') return 'role-badge role-vip-plus';
    if (norm === 'VIP') return 'role-badge role-vip';
    return 'role-badge role-member';
  }

  // ==========================================
  // ÜST BAR, ÇEKMECE VE GÜNLÜK NETHERITE SENKRONİZASYONU
  // ==========================================
  function syncHeaderAndDrawer() {
    injectCustomCurrencyIcons();

    const session = getSession();
    const { userService, rankService, economyService, netheriteService, notificationService, extraLifeService, partyService } =
      svc();

    const emeraldPill = document.getElementById('header-emerald-pill');
    const netheritePill = document.getElementById('header-netherite-pill');
    const userChip = document.getElementById('user-account-chip');
    const notifBtn = document.getElementById('btn-open-notifications');
    const drawerAdminBtn = document.getElementById('drawer-btn-admin');
    const drawerAdminLoginBtn = document.getElementById('btn-open-admin-login-modal');

    if (!session) {
      emeraldPill?.classList.add('hidden');
      netheritePill?.classList.add('hidden');
      userChip?.classList.add('hidden');
      notifBtn?.classList.add('hidden');
      drawerAdminBtn?.classList.add('hidden');
      drawerAdminLoginBtn?.classList.remove('hidden');
      return;
    }

    // İlk kez giriş yapan kullanıcının 250 Netherite başlangıç bonusunu garanti altına al (#14)
    netheriteService?.ensureInitialBonusOnce(session.username);

    const user = userService?.getUserByUsername(session.username) || session;
    const rank = rankService?.getUserRank(user.username) || {
      id: 'MEMBER',
      name: 'Üye',
      badge: '🌱'
    };
    const emeralds = economyService?.getBalance(user.username) ?? Number(user.emeraldBalance || 0);
    const netherites =
      netheriteService?.getBalance(user.username) ?? Number(user.netheriteBalance || 0);
    const extraLives = extraLifeService?.getUserExtraLives(user.username) ?? Number(user.extraLives || 0);
    const unreadNotifs = notificationService?.getUnreadCount(user.username) || 0;

    // Header pill'leri göster
    emeraldPill?.classList.remove('hidden');
    netheritePill?.classList.remove('hidden');
    userChip?.classList.remove('hidden');
    notifBtn?.classList.remove('hidden');

    const hEmerald = document.getElementById('header-emerald-count');
    if (hEmerald) hEmerald.textContent = emeralds.toLocaleString('tr-TR');

    const hNetherite = document.getElementById('header-netherite-count');
    if (hNetherite) hNetherite.textContent = netherites.toLocaleString('tr-TR');

    const hName = document.getElementById('header-user-name');
    if (hName) hName.textContent = user.username;

    const hRole = document.getElementById('header-user-role');
    if (hRole) {
      hRole.className = getRankBadgeClass(rank.id);
      hRole.textContent = `${rank.badge} ${rank.name}`;
    }

    setAvatarImageWithFallback(document.getElementById('header-user-avatar'), user);

    // Bildirim rozetleri (#7)
    const hNotifBadge = document.getElementById('header-notif-badge');
    const dNotifBadge = document.getElementById('drawer-notif-badge');
    if (hNotifBadge) {
      hNotifBadge.textContent = unreadNotifs > 99 ? '99+' : String(unreadNotifs);
      hNotifBadge.classList.toggle('hidden', unreadNotifs <= 0);
    }
    if (dNotifBadge) {
      dNotifBadge.textContent = unreadNotifs > 99 ? '99+' : String(unreadNotifs);
      dNotifBadge.classList.toggle('hidden', unreadNotifs <= 0);
    }

    // Çekmece (Drawer) üst özeti
    setAvatarImageWithFallback(document.getElementById('drawer-user-avatar'), user);
    const dName = document.getElementById('drawer-user-name');
    if (dName) dName.textContent = user.username;

    const dRank = document.getElementById('drawer-user-rank');
    if (dRank) {
      dRank.className = getRankBadgeClass(rank.id);
      dRank.textContent = `${rank.badge} ${rank.name}`;
    }

    const dMcName = document.getElementById('drawer-user-mcname');
    if (dMcName) {
      if (user.minecraftPlayerName) {
        dMcName.textContent = `🎮 MC: ${user.minecraftPlayerName}`;
        dMcName.classList.remove('hidden');
      } else {
        dMcName.classList.add('hidden');
      }
    }

    const dEmerald = document.getElementById('drawer-emerald-count');
    if (dEmerald) dEmerald.textContent = emeralds.toLocaleString('tr-TR');

    const dNetherite = document.getElementById('drawer-netherite-count');
    if (dNetherite) dNetherite.textContent = netherites.toLocaleString('tr-TR');

    // Admin butonu görünürlüğü (#2)
    const isAdmin = Boolean(session.isAdminSession || rank.id === 'ADMIN');
    if (drawerAdminBtn) drawerAdminBtn.classList.toggle('hidden', !isAdmin);
    if (drawerAdminLoginBtn) drawerAdminLoginBtn.classList.toggle('hidden', isAdmin);

    const lbResetBtn = document.getElementById('btn-leaderboard-admin-reset');
    if (lbResetBtn) lbResetBtn.classList.toggle('hidden', !isAdmin);

    // Ana Sayfa (Welcome) özet kutuları
    const stBest = document.getElementById('stat-best-score');
    if (stBest) stBest.textContent = formatCurrencyTRY(user.points || user.bestScore || 0);

    const stEm = document.getElementById('stat-emerald-balance');
    if (stEm) stEm.textContent = emeralds.toLocaleString('tr-TR');

    const stNe = document.getElementById('stat-netherite-balance');
    if (stNe) stNe.textContent = netherites.toLocaleString('tr-TR');

    const stLives = document.getElementById('stat-extra-lives');
    if (stLives) stLives.textContent = `${extraLives} / 5 ❤️`;

    // Aktif parti afişi
    const activeParty = partyService?.getActivePartyForUser(user.username);
    const partyBanner = document.getElementById('welcome-party-banner');
    if (partyBanner) {
      if (activeParty) {
        partyBanner.classList.remove('hidden');
        const pName = document.getElementById('welcome-party-name');
        const pCode = document.getElementById('welcome-party-code');
        if (pName) pName.textContent = activeParty.partyName;
        if (pCode) pCode.textContent = activeParty.partyCode;
      } else {
        partyBanner.classList.add('hidden');
      }
    }

    syncDailyNetheriteWidgets();
  }

  // ==========================================
  // #13: GÜNLÜK ZÜMRÜT & NETHERITE ÖDÜLÜ WIDGET SENKRONİZASYONU
  // ==========================================
  function syncDailyNetheriteWidgets() {
    const session = getSession();
    const { netheriteService } = svc();
    if (!session || !netheriteService) return;

    const status = netheriteService.getDailyNetheriteStatus(session.username);
    const hasNetherite = Number(status.dailyAmount || 0) > 0;
    const dailyEm = Number(status.dailyEmerald || 50);
    const dailyNe = Number(status.dailyAmount || 0);

    // 1. Ana Sayfa Günlük Ödül Kutusu
    const wTitle = document.getElementById('welcome-netherite-title');
    const wDesc = document.getElementById('welcome-netherite-desc');
    const wBtn = document.getElementById('btn-welcome-claim-netherite');

    if (wTitle && wDesc && wBtn) {
      if (status.canClaimNow) {
        if (hasNetherite) {
          wTitle.textContent = `⬛ ${status.rankName} Günlük Ödülünüz Hazır!`;
          wDesc.textContent = `Bugünkü +${dailyNe} Netherite ve +${dailyEm} Zümrüt ödülünüzü hemen talep edebilirsiniz!`;
          wBtn.textContent = `+${dailyNe} ⬛ & +${dailyEm} 🟢 Al`;
        } else {
          wTitle.textContent = `🟢 ${status.rankName} Günlük Zümrüt Ödülünüz Hazır!`;
          wDesc.textContent = `Bugünkü +${dailyEm} Zümrüt ödülünüzü hemen alın! (VIP+ ve üzeri ilk alımda +250 ⬛ ve günlük +25/50/100 ⬛ kazanır)`;
          wBtn.textContent = `+${dailyEm} Zümrüt Al`;
        }
        wBtn.disabled = false;
        wBtn.dataset.actionMode = 'claim';
      } else {
        wTitle.textContent = hasNetherite
          ? `⬛ ${status.rankName} Günlük Ödülü Alındı`
          : `🟢 ${status.rankName} Günlük Zümrüt Ödülü Alındı`;
        wDesc.textContent = hasNetherite
          ? `Yeni +${dailyNe} Netherite ve +${dailyEm} Zümrüt ödülü için kalan süre: ${status.remainingText}`
          : `Yeni +${dailyEm} Zümrüt ödülü için kalan süre: ${status.remainingText} (VIP+ ile günlük +25 ⬛ kazanın!)`;
        wBtn.textContent = status.remainingText;
        wBtn.disabled = true;
        wBtn.dataset.actionMode = 'wait';
      }
    }

    // 2. Mağaza Günlük Ödül Çubuğu
    const sText = document.getElementById('shop-daily-netherite-text');
    const sBtn = document.getElementById('btn-shop-claim-netherite');
    if (sText && sBtn) {
      if (status.canClaimNow) {
        if (hasNetherite) {
          sText.textContent = `${status.rankName} ayrıcalığınızla +${dailyNe} Netherite ve +${dailyEm} Zümrüt ödülünüz hazır!`;
          sBtn.textContent = `+${dailyNe} ⬛ & +${dailyEm} 🟢 Al`;
        } else {
          sText.textContent = `${status.rankName} günlük +${dailyEm} Zümrüt ödülünüz hazır! (En az VIP+ ilk alımda +250 ⬛ + günlük +25/50/100 ⬛ verir)`;
          sBtn.textContent = `+${dailyEm} Zümrüt Al`;
        }
        sBtn.disabled = false;
        sBtn.dataset.actionMode = 'claim';
      } else {
        sText.textContent = hasNetherite
          ? `Sonraki +${dailyNe} Netherite & +${dailyEm} Zümrüt ödülüne kalan süre: ${status.remainingText}`
          : `Sonraki +${dailyEm} Zümrüt ödülüne kalan süre: ${status.remainingText}`;
        sBtn.textContent = status.remainingText;
        sBtn.disabled = true;
        sBtn.dataset.actionMode = 'wait';
      }
    }

    // 3. Profil Günlük Ödül Kutusu
    const pStatus = document.getElementById('profile-daily-netherite-status');
    const pBtn = document.getElementById('btn-profile-claim-netherite');
    if (pStatus && pBtn) {
      if (status.canClaimNow) {
        pStatus.textContent = hasNetherite
          ? `+${dailyNe} Netherite ve +${dailyEm} Zümrüt hemen alınabilir!`
          : `+${dailyEm} Günlük Zümrüt hemen alınabilir!`;
        pBtn.textContent = hasNetherite
          ? `+${dailyNe} ⬛ & +${dailyEm} 🟢 Al`
          : `+${dailyEm} Zümrüt Al`;
        pBtn.disabled = false;
        pBtn.dataset.actionMode = 'claim';
      } else {
        pStatus.textContent = `Bekleme süresi: ${status.remainingText}`;
        pBtn.textContent = status.remainingText;
        pBtn.disabled = true;
        pBtn.dataset.actionMode = 'wait';
      }
    }
  }

  function handleDailyNetheriteClick(btn) {
    const mode = btn?.dataset?.actionMode;
    if (mode === 'upsell') {
      state.shopCategory = 'Ranks';
      navigateToScreen('shop');
      return;
    }
    const session = getSession();
    if (!session) return;
    try {
      const res = svc().netheriteService.claimDailyNetherite(session);
      if (res.added > 0) {
        showToast(
          `🎉 +${res.added} Günlük Netherite ve +${res.emeraldAdded} Günlük Zümrüt hesabınıza eklendi!`,
          'success'
        );
      } else {
        showToast(`🎉 +${res.emeraldAdded} Günlük Zümrüt hesabınıza eklendi!`, 'success');
      }
      syncHeaderAndDrawer();
      if (state.currentScreen === 'profile') renderProfile();
      if (state.currentScreen === 'shop') renderShop();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // SAĞDAN AÇILIR KOMPAKT MENÜ ÇEKMECESİ (#5 & #6)
  // ==========================================
  function openDrawer() {
    const drawer = document.getElementById('main-menu-drawer');
    const backdrop = document.getElementById('menu-drawer-backdrop');
    const toggleBtn = document.getElementById('btn-toggle-menu');
    if (!drawer || !backdrop) return;

    syncHeaderAndDrawer();
    drawer.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      drawer.classList.add('open');
      backdrop.classList.add('open');
    });
    if (toggleBtn) {
      toggleBtn.classList.add('is-open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById('main-menu-drawer');
    const backdrop = document.getElementById('menu-drawer-backdrop');
    const toggleBtn = document.getElementById('btn-toggle-menu');
    if (!drawer || !backdrop) return;

    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    if (toggleBtn) {
      toggleBtn.classList.remove('is-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
    setTimeout(() => {
      if (!drawer.classList.contains('open')) {
        drawer.classList.add('hidden');
        backdrop.classList.add('hidden');
      }
    }, 260);
  }

  function toggleDrawer() {
    const drawer = document.getElementById('main-menu-drawer');
    if (!drawer || drawer.classList.contains('hidden') || !drawer.classList.contains('open')) {
      openDrawer();
    } else {
      closeDrawer();
    }
  }

  // ==========================================
  // MERKEZİ EKRAN YÖNLENDİRİCİSİ (SPA ROUTER)
  // Hesap, bakiye, rütbe ve parti durumunu ASLA sıfırlamaz.
  // ==========================================
  function navigateToScreen(screenKey, options = {}) {
    closeDrawer();

    const session = getSession();
    if (!session) {
      const gate = document.getElementById('access-gate');
      gate?.classList.remove('hidden');
      return;
    }

    // Admin ekranı güvenlik kontrolü (#2)
    if (screenKey === 'admin') {
      const rankId = svc().authGuard?.getEffectiveRankId(session);
      if (!session.isAdminSession && rankId !== 'ADMIN') {
        showToast('Yönetici Paneline erişmek için Yönetici Girişi yapmalısınız!', 'error');
        openAdminLoginModal();
        return;
      }
    }

    const targetId = `screen-${screenKey}`;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) {
      return;
    }

    document.querySelectorAll('.screen').forEach(scr => {
      scr.classList.remove('active');
      scr.classList.add('hidden');
    });

    targetEl.classList.remove('hidden');
    targetEl.classList.add('active');
    state.currentScreen = screenKey;

    // Çekmecedeki aktif öğeyi işaretle
    document.querySelectorAll('.drawer-item[data-nav-screen]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-nav-screen') === screenKey);
    });

    if (!options.skipHistory && window.location.hash !== `#${screenKey}`) {
      try {
        history.pushState({ screen: screenKey }, '', `#${screenKey}`);
      } catch (e) {
        // ignore
      }
    }

    syncHeaderAndDrawer();

    // İlgili ekranın içeriğini tazele
    switch (screenKey) {
      case 'welcome':
        if (typeof window.refreshWelcomeScreen === 'function') {
          window.refreshWelcomeScreen();
        }
        break;
      case 'profile':
        renderProfile();
        break;
      case 'notifications':
        renderNotifications();
        break;
      case 'shop':
        renderShop();
        break;
      case 'party':
        renderParty();
        break;
      case 'stats':
        renderStats();
        break;
      case 'leaderboard':
        renderLeaderboard();
        break;
      case 'support':
        renderSupport();
        break;
      case 'bug-report':
        renderBugReports();
        break;
      case 'suggestions':
        renderSuggestions();
        break;
      case 'settings':
        renderSettings();
        break;
      case 'admin':
        renderAdmin();
        break;
      default:
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openAdminLoginModal() {
    closeDrawer();
    const gate = document.getElementById('access-gate');
    if (!gate) return;
    gate.classList.remove('hidden');
    const adminTabBtn = document.getElementById('tab-btn-admin');
    if (adminTabBtn) adminTabBtn.click();
  }

  // ==========================================
  // 4. EKRAN: PROFİL (renderProfile — #4, #13, #14)
  // ==========================================
  function renderProfile() {
    const session = getSession();
    if (!session) return;
    const {
      userService,
      rankService,
      economyService,
      netheriteService,
      shopService,
      achievementService
    } = svc();

    const user = userService.getUserByUsername(session.username);
    if (!user) return;

    const rank = rankService.getUserRank(user.username);
    const emeralds = economyService.getBalance(user.username);
    const netherites = netheriteService.getBalance(user.username);

    setAvatarImageWithFallback(document.getElementById('profile-avatar-img'), user);

    // Kozmetik çerçeve ve efektler
    const frameWrap = document.getElementById('profile-avatar-frame');
    const heroCard = document.getElementById('profile-hero-card');
    const allItems = shopService.getAllItems(true);
    const equipped = user.equippedCosmetics || {};

    if (frameWrap) {
      frameWrap.className = 'profile-avatar-wrapper';
      if (equipped.avatarFrame) {
        const frameItem = allItems.find(i => i.id === equipped.avatarFrame);
        if (frameItem?.cssValue) frameWrap.classList.add(frameItem.cssValue);
      }
    }

    if (heroCard) {
      heroCard.className = 'platform-card profile-hero-card';
      if (equipped.profileEffect) {
        const effItem = allItems.find(i => i.id === equipped.profileEffect);
        if (effItem?.cssValue) heroCard.classList.add(effItem.cssValue);
      }
    }

    const uNameEl = document.getElementById('profile-username-display');
    if (uNameEl) {
      uNameEl.textContent = user.username;
      uNameEl.className = '';
      uNameEl.style.color = '';
      if (equipped.nameColor) {
        const colorItem = allItems.find(i => i.id === equipped.nameColor);
        if (colorItem?.cssValue === 'rgb-rainbow') {
          uNameEl.classList.add('rgb-rainbow-text');
        } else if (colorItem?.cssValue) {
          uNameEl.style.color = colorItem.cssValue;
        }
      }
    }

    const rBadge = document.getElementById('profile-rank-badge');
    if (rBadge) {
      rBadge.className = getRankBadgeClass(rank.id);
      rBadge.textContent = `${rank.badge} ${rank.name}`;
    }

    const mcDisplay = document.getElementById('profile-mc-player-display');
    if (mcDisplay) {
      mcDisplay.textContent = user.minecraftPlayerName
        ? `🎮 Bağlı Minecraft Oyuncu Adı: ${user.minecraftPlayerName}`
        : '🎮 Bağlı Minecraft Oyuncu Adı: Belirtilmedi';
    }

    const mcInput = document.getElementById('profile-mcname-input');
    if (mcInput) mcInput.value = user.minecraftPlayerName || '';

    const customBadgeEl = document.getElementById('profile-custom-badge');
    if (customBadgeEl) {
      if (equipped.badge) {
        const badgeItem = allItems.find(i => i.id === equipped.badge);
        customBadgeEl.textContent = badgeItem ? badgeItem.cssValue || badgeItem.name : '';
      } else {
        customBadgeEl.textContent = '';
      }
    }

    const createdEl = document.getElementById('profile-created-at');
    if (createdEl) createdEl.textContent = formatDateTR(user.createdAt);

    const pEm = document.getElementById('profile-emerald-balance');
    if (pEm) pEm.textContent = `${emeralds.toLocaleString('tr-TR')} 🟢`;

    const pNe = document.getElementById('profile-netherite-balance');
    if (pNe) pNe.textContent = `${netherites.toLocaleString('tr-TR')} ⬛`;

    const pPts = document.getElementById('profile-total-points');
    if (pPts) pPts.textContent = formatCurrencyTRY(user.points || user.bestScore || 0);

    const pWin = document.getElementById('profile-win-ratio');
    if (pWin) {
      pWin.textContent = `${Number(user.gamesWon || 0)} / ${Number(user.gamesPlayed || 0)}`;
    }

    syncDailyNetheriteWidgets();

    // Kozmetik Envanteri
    const cosContainer = document.getElementById('profile-cosmetics-list');
    if (cosContainer) {
      const ownedIds = Array.isArray(user.ownedCosmetics) ? user.ownedCosmetics : [];
      if (ownedIds.length === 0) {
        cosContainer.innerHTML = `<div class="empty-state-box">Henüz kozmetik ürününüz yok. <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-nav-screen="shop"># MAĞAZA'ya Git</button></div>`;
      } else {
        cosContainer.innerHTML = ownedIds
          .map(id => {
            const item = allItems.find(i => i.id === id);
            if (!item) return '';
            const isEquipped = Object.values(equipped).includes(item.id);
            return `
              <div class="cosmetic-inv-card ${isEquipped ? 'equipped' : ''}">
                <span class="cos-icon">${escapeHtml(item.icon)}</span>
                <div class="cos-info">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span>${escapeHtml(item.subCategory || 'Kozmetik')}</span>
                </div>
                <button type="button" class="mc-btn mc-btn-sm ${
                  isEquipped ? 'mc-btn-secondary' : 'mc-btn-primary'
                }" data-equip-cosmetic="${escapeHtml(item.id)}">
                  ${isEquipped ? 'Çıkar' : 'Kuşan'}
                </button>
              </div>
            `;
          })
          .join('');
      }
    }

    // Başarımlar
    const achContainer = document.getElementById('profile-achievements-list');
    if (achContainer && achievementService) {
      const achs = achievementService.getUserAchievements(user.username);
      achContainer.innerHTML = achs
        .map(
          a => `
          <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}">
            <span class="ach-icon">${escapeHtml(a.icon)}</span>
            <div class="ach-meta">
              <strong>${escapeHtml(a.title)}</strong>
              <p>${escapeHtml(a.description)}</p>
              <span class="ach-reward">+${a.emeraldReward} 🟢 Ödül</span>
            </div>
            <span class="ach-status">${a.unlocked ? '✅ Kazanıldı' : '🔒 Kilitli'}</span>
          </div>
        `
        )
        .join('');
    }

    // Son Ekonomi İşlemleri (Zümrüt + Netherite birleşik)
    const txContainer = document.getElementById('profile-tx-list');
    if (txContainer) {
      const emTxs = (economyService.getTransactions(user.username) || []).map(t => ({
        ...t,
        currency: 'EMERALD'
      }));
      const neTxs = (netheriteService.getTransactions(user.username) || []).map(t => ({
        ...t,
        currency: 'NETHERITE'
      }));
      const combined = [...emTxs, ...neTxs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 15);

      if (combined.length === 0) {
        txContainer.innerHTML = `<div class="empty-state-box">Henüz işlem geçmişi bulunmuyor.</div>`;
      } else {
        txContainer.innerHTML = combined
          .map(tx => {
            const isPos = Number(tx.amount) >= 0;
            const unit = tx.currency === 'NETHERITE' ? '⬛ Netherite' : '🟢 Zümrüt';
            return `
              <div class="tx-row">
                <div>
                  <strong>${escapeHtml(tx.reason)}</strong>
                  <span class="tx-date">${formatDateTR(tx.createdAt)}</span>
                </div>
                <span class="tx-amount ${isPos ? 'pos' : 'neg'}">
                  ${isPos ? '+' : ''}${tx.amount} ${unit}
                </span>
              </div>
            `;
          })
          .join('');
      }
    }
  }

  // ==========================================
  // 5. EKRAN: BİLDİRİMLER MERKEZİ (renderNotifications — #7)
  // ==========================================
  function renderNotifications() {
    const session = getSession();
    if (!session) return;
    const { notificationService } = svc();
    if (!notificationService) return;

    const allNotifs = notificationService.getUserNotifications(session.username);
    const unreadNotifs = allNotifs.filter(n => !n.read);

    const totalEl = document.getElementById('notif-total-count');
    const unreadEl = document.getElementById('notif-unread-count');
    if (totalEl) totalEl.textContent = String(allNotifs.length);
    if (unreadEl) unreadEl.textContent = String(unreadNotifs.length);

    document.querySelectorAll('[data-notif-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-notif-filter') === state.notifFilter);
    });

    const displayed = state.notifFilter === 'UNREAD' ? unreadNotifs : allNotifs;
    const listEl = document.getElementById('notifications-list-container');
    if (!listEl) return;

    if (displayed.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Gösterilecek bildirim bulunmuyor.</div>`;
      return;
    }

    const { partyService } = svc();

    listEl.innerHTML = displayed
      .map(n => {
        const partyCode = n.meta?.partyCode || '';
        const invitationId = n.meta?.invitationId || '';
        const invObj =
          invitationId && partyService?.getInvitationById
            ? partyService.getInvitationById(invitationId)
            : null;
        const invStatus = invObj ? invObj.status : n.meta?.inviteStatus || '';

        let partyActionHtml = '';
        if (invitationId) {
          if (invStatus === 'PENDING') {
            partyActionHtml = `
              <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-accept-party-invite="${escapeHtml(
                invitationId
              )}" data-notif-id="${escapeHtml(n.id)}">Kabul Et</button>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-reject-party-invite="${escapeHtml(
                invitationId
              )}" data-notif-id="${escapeHtml(n.id)}">Reddet</button>
            `;
          } else if (invStatus === 'ACCEPTED') {
            partyActionHtml = `<span class="notif-read-label">✅ Kabul Edildi</span>`;
          } else if (invStatus === 'REJECTED') {
            partyActionHtml = `<span class="notif-read-label">❌ Reddedildi</span>`;
          }
        } else if (partyCode) {
          partyActionHtml = `<button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-notif-join-party="${escapeHtml(
            partyCode
          )}">🎉 Partiye Katıl (${escapeHtml(partyCode)})</button>`;
        }

        return `
          <div class="notification-card ${n.read ? 'is-read' : 'is-unread'}">
            <div class="notif-card-icon">${escapeHtml(n.icon || '🔔')}</div>
            <div class="notif-card-body">
              <div class="notif-card-top">
                <span class="notif-type-tag">${escapeHtml(n.typeLabel || 'Bildirim')}</span>
                <span class="notif-time">${formatDateTR(n.createdAt)}</span>
              </div>
              <h4 class="notif-title">${escapeHtml(n.title)}</h4>
              <p class="notif-message">${escapeHtml(n.message)}</p>
              <div class="notif-card-actions">
                ${
                  !n.read
                    ? `<button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-notif-mark-read="${escapeHtml(
                        n.id
                      )}">✓ Okundu olarak işaretle</button>`
                    : `<span class="notif-read-label">✓ Okundu</span>`
                }
                ${partyActionHtml}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================
  // 6. EKRAN: BİRLEŞİK # MAĞAZA (renderShop — #8, #9, #10, #11, #12, #20, #27)
  // Kategoriler: Ranks (Rütbeler), Emeralds (Zümrüt), Special (Özel Ürünler), Cosmetics (Kozmetikler)
  // ==========================================
  function renderShop() {
    const session = getSession();
    if (!session) return;
    const {
      userService,
      rankService,
      economyService,
      netheriteService,
      extraLifeService,
      shopService
    } = svc();

    const user = userService.getUserByUsername(session.username);
    if (!user) return;

    const emeralds = economyService.getBalance(user.username);
    const netherites = netheriteService.getBalance(user.username);
    const extraLives = extraLifeService.getUserExtraLives(user.username);
    const userRank = rankService.getUserRank(user.username);

    const sEm = document.getElementById('shop-emerald-balance');
    if (sEm) sEm.textContent = emeralds.toLocaleString('tr-TR');

    const sNe = document.getElementById('shop-netherite-balance');
    if (sNe) sNe.textContent = netherites.toLocaleString('tr-TR');

    const sLi = document.getElementById('shop-extra-lives');
    if (sLi) sLi.textContent = `${extraLives} / 5`;

    syncDailyNetheriteWidgets();

    // Sekme aktifliği
    document.querySelectorAll('#unified-shop-tabs [data-shop-cat]').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-shop-cat') === state.shopCategory);
    });

    const ranksSection = document.getElementById('shop-ranks-section');
    const itemsSection = document.getElementById('shop-items-section');

    if (state.shopCategory === 'Ranks') {
      ranksSection?.classList.remove('hidden');
      itemsSection?.classList.add('hidden');
      renderShopRanksGrid(user, userRank);
    } else {
      ranksSection?.classList.add('hidden');
      itemsSection?.classList.remove('hidden');
      renderShopItemsGrid(user, userRank, state.shopCategory);
    }

    injectCustomCurrencyIcons();
  }

  function renderShopRanksGrid(user, userRank) {
    const container = document.getElementById('ranks-grid-container');
    if (!container) return;

    const purchasableRanks = svc().rankService.getPurchasableRanks(); // VIP, VIP+, MVIP, MVIP+
    container.innerHTML = purchasableRanks
      .map(rank => {
        const isOwnedOrHigher = userRank.order >= rank.order;
        const isCurrent = userRank.id === rank.id;
        const dailyNetheriteText =
          rank.dailyNetherite > 0
            ? `<div class="rank-daily-netherite-pill">⬛ İlk Alımda +250 ⬛ • Günlük +${rank.dailyNetherite} ⬛ & +${rank.dailyEmerald || 200} 🟢</div>`
            : `<div class="rank-daily-netherite-pill muted">🟢 Günlük +${rank.dailyEmerald || 100} Zümrüt Ödülü</div>`;

        return `
          <div class="rank-card" style="border-top: 4px solid ${escapeHtml(rank.color)};">
            <div class="rank-card-header">
              <span class="rank-card-badge" style="color: ${escapeHtml(rank.color)}">${escapeHtml(
          rank.badge
        )} ${escapeHtml(rank.name)}</span>
              ${isCurrent ? `<span class="rank-current-tag">MEVCUT RÜTBENİZ</span>` : ''}
            </div>

            ${dailyNetheriteText}

            <div class="rank-pricing-box">
              <div class="rank-price-main">${rank.netheritePrice} ⬛ Netherite</div>
              <div class="rank-price-sub">veya ${rank.emeraldPrice.toLocaleString(
                'tr-TR'
              )} 🟢 Zümrüt • ${rank.priceTry.toLocaleString('tr-TR')} ₺</div>
            </div>

            <ul class="rank-features-list">
              ${(rank.features || []).map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
            </ul>

            <div class="rank-card-actions">
              ${
                isOwnedOrHigher
                  ? `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>✓ Bu Rütbeye Sahipsiniz</button>`
                  : `
                    <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-rank="${escapeHtml(
                      rank.id
                    )}" data-pay-method="NETHERITE">
                      ⬛ ${rank.netheritePrice} Netherite ile Satın Al
                    </button>
                    <button type="button" class="mc-btn mc-btn-primary mc-btn-block" data-buy-rank="${escapeHtml(
                      rank.id
                    )}" data-pay-method="EMERALD">
                      🟢 ${rank.emeraldPrice.toLocaleString('tr-TR')} Zümrüt ile Satın Al
                    </button>
                    <button type="button" class="mc-btn mc-btn-secondary mc-btn-block" data-buy-rank="${escapeHtml(
                      rank.id
                    )}" data-pay-method="STRIPE">
                      💳 Kart ile Al (${rank.priceTry.toLocaleString('tr-TR')} ₺)
                    </button>
                  `
              }
              <!-- #11: 🎁 Arkadaşına Hediye Et Butonu -->
              <button type="button" class="mc-btn mc-btn-gift mc-btn-block" data-gift-rank="${escapeHtml(
                rank.id
              )}">
                🎁 Arkadaşına Hediye Et
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderShopItemsGrid(user, userRank, category) {
    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    const { shopService, rankService } = svc();
    const items = shopService.getItemsByCategory(category);
    const ownedCosmetics = Array.isArray(user.ownedCosmetics) ? user.ownedCosmetics : [];

    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state-box">Bu kategoride henüz ürün bulunmuyor.</div>`;
      return;
    }

    grid.innerHTML = items
      .map(item => {
        const reqRank = rankService.getRankById(item.requiredRank || 'MEMBER');
        const rankLocked = userRank.order < reqRank.order;
        const alreadyOwned =
          item.category === 'Cosmetics' &&
          Number(item.maxPerUser) === 1 &&
          ownedCosmetics.includes(item.id);

        let actionButtonsHtml = '';
        if (alreadyOwned) {
          actionButtonsHtml = `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>✓ Envanterde Mevcut</button>`;
        } else if (rankLocked) {
          actionButtonsHtml = `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>🔒 ${escapeHtml(
            reqRank.name
          )} Gerekli</button>`;
        } else if (item.currency === 'STRIPE') {
          actionButtonsHtml = `
            <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
              item.id
            )}" data-item-currency="STRIPE">
              💳 ${Number(item.priceTry || item.price).toLocaleString('tr-TR')} ₺ — Satın Al (Stripe)
            </button>
          `;
        } else if (item.currency === 'NETHERITE') {
          const nPrice = Number(item.netheritePrice || item.price);
          const ePrice = Number(item.emeraldPrice || 0);
          actionButtonsHtml = `
            <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
              item.id
            )}" data-item-currency="NETHERITE">
              ⬛ ${nPrice} Netherite ile Satın Al
            </button>
            ${
              ePrice > 0
                ? `<button type="button" class="mc-btn mc-btn-primary mc-btn-block" data-buy-item="${escapeHtml(
                    item.id
                  )}" data-item-currency="EMERALD">
                    🟢 ${ePrice.toLocaleString('tr-TR')} Zümrüt ile Satın Al
                  </button>`
                : ''
            }
          `;
        } else {
          const ePrice = Number(item.emeraldPrice || item.price);
          const nPrice = Number(item.netheritePrice || 0);
          actionButtonsHtml = `
            <button type="button" class="mc-btn mc-btn-primary mc-btn-block" data-buy-item="${escapeHtml(
              item.id
            )}" data-item-currency="EMERALD">
              🟢 ${ePrice.toLocaleString('tr-TR')} Zümrüt ile Satın Al
            </button>
            ${
              nPrice > 0
                ? `<button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
                    item.id
                  )}" data-item-currency="NETHERITE">
                    ⬛ ${nPrice} Netherite ile Satın Al
                  </button>`
                : ''
            }
          `;
        }

        return `
          <div class="shop-item-card">
            <div class="shop-item-top">
              <span class="shop-item-icon">${escapeHtml(item.icon || '🛍️')}</span>
              <span class="shop-item-cat-tag">${escapeHtml(item.subCategory || item.category)}</span>
            </div>
            <h4 class="shop-item-title">${escapeHtml(item.name)}</h4>
            <p class="shop-item-desc">${escapeHtml(item.description)}</p>
            <div class="shop-item-actions">
              ${actionButtonsHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================
  // #11: "🎁 ARKADAŞINA HEDİYE ET" MODAL AKIŞI
  // ==========================================
  function openGiftRankModal(rankId) {
    const { rankService } = svc();
    const rank = rankService.getRankById(rankId);
    if (!rank || !rank.purchasable) return;

    state.giftModal.rankId = rank.id;
    state.giftModal.friendUsername = '';

    const modal = document.getElementById('modal-gift-rank');
    const summaryBox = document.getElementById('gift-rank-summary-box');
    const input = document.getElementById('gift-friend-username-input');
    const step1 = document.getElementById('gift-step-1');
    const step2 = document.getElementById('gift-step-2');
    const err1 = document.getElementById('gift-step1-error');
    const err2 = document.getElementById('gift-step2-error');

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="gift-rank-pill" style="border-left: 4px solid ${escapeHtml(rank.color)}">
          <strong>${escapeHtml(rank.badge)} ${escapeHtml(rank.name)} Rütbesi Hediye Paketi</strong>
          <span>${rank.netheritePrice} ⬛ Netherite veya ${rank.emeraldPrice.toLocaleString(
        'tr-TR'
      )} 🟢 Zümrüt</span>
        </div>
      `;
    }

    if (input) input.value = '';
    err1?.classList.add('hidden');
    err2?.classList.add('hidden');
    step1?.classList.remove('hidden');
    step2?.classList.add('hidden');
    modal?.classList.remove('hidden');
    input?.focus();
  }

  function closeGiftRankModal() {
    const modal = document.getElementById('modal-gift-rank');
    modal?.classList.add('hidden');
  }

  function proceedGiftRankStep2() {
    const session = getSession();
    if (!session) return;
    const { userService, rankService } = svc();

    const input = document.getElementById('gift-friend-username-input');
    const err1 = document.getElementById('gift-step1-error');
    const friendName = String(input?.value || '').trim();

    const showErr = msg => {
      if (err1) {
        err1.textContent = msg;
        err1.classList.remove('hidden');
      }
    };

    if (!friendName) {
      showErr('Lütfen arkadaşınızın kullanıcı adını girin.');
      return;
    }

    if (friendName.toLowerCase() === session.username.toLowerCase()) {
      showErr('Kendinize hediye gönderemezsiniz. Lütfen arkadaşınızın kullanıcı adını yazın.');
      return;
    }

    const recipient = userService.getUserByUsername(friendName);
    if (!recipient) {
      showErr(`"${friendName}" adında kayıtlı bir oyuncu bulunamadı!`);
      return;
    }

    const rank = rankService.getRankById(state.giftModal.rankId);
    const recipientRank = rankService.getUserRank(recipient.username);
    if (recipientRank.order >= rank.order) {
      showErr(`${recipient.username} zaten ${recipientRank.name} veya daha yüksek bir rütbeye sahip!`);
      return;
    }

    state.giftModal.friendUsername = recipient.username;
    err1?.classList.add('hidden');

    const recEl = document.getElementById('gift-confirmed-recipient');
    if (recEl) recEl.textContent = recipient.username;

    const cNe = document.getElementById('gift-cost-netherite');
    if (cNe) cNe.textContent = String(rank.netheritePrice);

    const cEm = document.getElementById('gift-cost-emerald');
    if (cEm) cEm.textContent = rank.emeraldPrice.toLocaleString('tr-TR');

    const cTry = document.getElementById('gift-cost-try');
    if (cTry) cTry.textContent = rank.priceTry.toLocaleString('tr-TR');

    document.getElementById('gift-step-1')?.classList.add('hidden');
    document.getElementById('gift-step-2')?.classList.remove('hidden');
  }

  function executeGiftRankPayment(paymentMethod) {
    const session = getSession();
    if (!session) return;
    const err2 = document.getElementById('gift-step2-error');
    err2?.classList.add('hidden');

    try {
      const res = svc().shopService.giftRankToFriend(session, {
        friendUsername: state.giftModal.friendUsername,
        rankId: state.giftModal.rankId,
        paymentMethod
      });

      closeGiftRankModal();
      if (res.stripePrepared) {
        showToast(res.message, 'info');
      } else {
        showToast(
          `🎁 ${res.recipientUsername} adlı arkadaşınıza ${res.rank.name} rütbesi başarıyla hediye edildi!`,
          'success'
        );
      }
      syncHeaderAndDrawer();
      renderShop();
    } catch (err) {
      if (err2) {
        err2.textContent = err.message;
        err2.classList.remove('hidden');
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  // ==========================================
  // 7. EKRAN: PARTİ SİSTEMİ (renderParty — #4, #5, #6, #9)
  // ==========================================
  function renderParty() {
    const session = getSession();
    if (!session) return;
    const { partyService, authGuard, rankService, userService, avatarService } = svc();

    // Bekleyen Parti Davetleri (#5)
    const pendingBox = document.getElementById('party-pending-invites-box');
    const pendingList = document.getElementById('party-pending-invites-list');
    const pendingInvites = partyService.getPendingInvitationsForUser
      ? partyService.getPendingInvitationsForUser(session.username)
      : [];

    if (pendingBox && pendingList) {
      if (pendingInvites.length === 0) {
        pendingBox.classList.add('hidden');
        pendingList.innerHTML = '';
      } else {
        pendingBox.classList.remove('hidden');
        pendingList.innerHTML = pendingInvites
          .map(
            inv => `
            <div class="notification-card is-unread">
              <div class="notif-card-icon">🎉</div>
              <div class="notif-card-body">
                <div class="notif-card-top">
                  <span class="notif-type-tag">Parti Daveti</span>
                  <span class="notif-time">${formatDateTR(inv.createdAt)}</span>
                </div>
                <h4 class="notif-title">Parti Daveti</h4>
                <p class="notif-message">${escapeHtml(
                  inv.fromUsername
                )} sizi bir partiye davet etti. (${escapeHtml(inv.partyName)} — Kod: <code>${escapeHtml(
              inv.partyCode
            )}</code>)</p>
                <div class="notif-card-actions">
                  <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-accept-party-invite="${escapeHtml(
                    inv.id
                  )}">Kabul Et</button>
                  <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-reject-party-invite="${escapeHtml(
                    inv.id
                  )}">Reddet</button>
                </div>
              </div>
            </div>
          `
          )
          .join('');
      }
    }

    const activeParty = partyService.getActivePartyForUser(session.username);
    const noActiveView = document.getElementById('party-no-active-view');
    const activeRoomView = document.getElementById('party-active-room-view');
    const createBtn = document.getElementById('btn-create-party-submit');
    const upsellBanner = document.getElementById('party-vip-upsell');

    const perms = authGuard.getUserPermissions(session);
    if (createBtn && upsellBanner) {
      if (!perms.canCreateParty) {
        createBtn.disabled = true;
        upsellBanner.classList.remove('hidden');
      } else {
        createBtn.disabled = false;
        upsellBanner.classList.add('hidden');
      }
    }

    if (!activeParty) {
      noActiveView?.classList.remove('hidden');
      activeRoomView?.classList.add('hidden');
    } else {
      noActiveView?.classList.add('hidden');
      activeRoomView?.classList.remove('hidden');

      const titleEl = document.getElementById('party-room-title');
      const codeEl = document.getElementById('party-room-code');
      const statusEl = document.getElementById('party-room-status');
      const countEl = document.getElementById('party-member-count');
      const startBtn = document.getElementById('btn-party-start-match');

      if (titleEl) titleEl.textContent = activeParty.partyName;
      if (codeEl) codeEl.textContent = activeParty.partyCode;
      if (statusEl) {
        statusEl.textContent =
          activeParty.status === 'IN_GAME' ? '⚔️ MAÇ DEVAM EDİYOR' : '⏳ LOBİDE BEKLİYOR';
      }
      if (countEl) {
        countEl.textContent = `${activeParty.members.length}/${activeParty.maxMembers || 8}`;
      }

      const isLeader =
        activeParty.leaderUsername.toLowerCase() === session.username.toLowerCase() ||
        session.isAdminSession;
      if (startBtn) {
        startBtn.disabled = !isLeader;
        startBtn.textContent = isLeader
          ? '⚔️ Parti Maçını Başlat'
          : '⏳ Parti Liderinin Başlatması Bekleniyor';
      }

      const membersList = document.getElementById('party-members-list');
      if (membersList) {
        membersList.innerHTML = activeParty.members
          .map(m => {
            const mUser = userService?.getUserByUsername(m.username) || { username: m.username };
            const mRank = rankService.getUserRank(m.username);
            const mAvatar = avatarService
              ? avatarService.getAvatarForUser(mUser)
              : '';
            const mFallback = avatarService
              ? avatarService.generatePixelAvatarDataUrl(m.username)
              : '';
            const canKick =
              isLeader && m.username.toLowerCase() !== activeParty.leaderUsername.toLowerCase();
            return `
              <div class="party-member-row">
                <div class="pm-left">
                  <img src="${escapeHtml(mAvatar)}" onerror="this.onerror=null;this.src='${escapeHtml(
              mFallback
            )}';" class="lb-avatar" alt="" />
                  <span class="${getRankBadgeClass(mRank.id)}">${escapeHtml(mRank.badge)} ${escapeHtml(
              mRank.name
            )}</span>
                  <strong>${escapeHtml(m.username)}</strong>
                  ${
                    m.username.toLowerCase() === activeParty.leaderUsername.toLowerCase()
                      ? '<span class="leader-crown">👑 Lider</span>'
                      : ''
                  }
                </div>
                <div class="pm-right">
                  <span class="pm-score">${formatCurrencyTRY(m.score || 0)}</span>
                  ${
                    canKick
                      ? `<button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-kick-party-member="${escapeHtml(
                          m.username
                        )}" data-party-id="${escapeHtml(activeParty.partyId)}">Çıkar</button>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    // Açık Partiler Listesi
    const publicList = document.getElementById('public-parties-list');
    if (publicList) {
      const openParties = partyService
        .getAllParties()
        .filter(p => p.status !== 'CLOSED' && p.members.length < (p.maxMembers || 8));

      if (openParties.length === 0) {
        publicList.innerHTML = `<div class="empty-state-box">Şu anda açık parti odası bulunmuyor.</div>`;
      } else {
        publicList.innerHTML = openParties
          .map(
            p => `
            <div class="public-party-card">
              <div>
                <strong>${escapeHtml(p.partyName)}</strong>
                <span>Lider: ${escapeHtml(p.leaderUsername)} • Oyuncular: ${p.members.length}/${
              p.maxMembers || 8
            }</span>
              </div>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-quick-join-party="${escapeHtml(
                p.partyCode
              )}">
                Katıl (${escapeHtml(p.partyCode)})
              </button>
            </div>
          `
          )
          .join('');
      }
    }
  }

  // ==========================================
  // 8. EKRAN: İSTATİSTİKLER (renderStats — #17)
  // ==========================================
  function renderStats() {
    const session = getSession();
    if (!session) return;
    const { userService, economyService, netheriteService, extraLifeService } = svc();
    const user = userService.getUserByUsername(session.username);
    if (!user) return;

    const gamesPlayed = Number(user.gamesPlayed || 0);
    const gamesWon = Number(user.gamesWon || 0);
    const gamesLost = Number(user.gamesLost ?? Math.max(0, gamesPlayed - gamesWon));
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const points = Number(user.points || 0);
    const bestScore = Number(user.bestScore || user.points || 0);
    const emeraldsSpent = Number(user.emeraldsSpentTotal || 0);
    const emeraldsEarned = Number(user.emeraldsEarnedTotal || user.emeraldBalance || 0);
    const netheriteBalance = netheriteService.getBalance(user.username);
    const extraLives = extraLifeService.getUserExtraLives(user.username);

    const kpiGrid = document.getElementById('stats-kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="stat-kpi-card">
          <span class="kpi-label">Oyun</span>
          <strong class="kpi-val">${gamesPlayed}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Galibiyet</span>
          <strong class="kpi-val emerald-text">${gamesWon}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Mağlubiyet</span>
          <strong class="kpi-val">${gamesLost}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Kazanma Oranı</span>
          <strong class="kpi-val gold-text">%${winRate}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Puan</span>
          <strong class="kpi-val gold-text">${formatCurrencyTRY(points)}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">En Yüksek Skor</span>
          <strong class="kpi-val gold-text">${formatCurrencyTRY(bestScore)}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Kullanılan Emerald</span>
          <strong class="kpi-val">${emeraldsSpent.toLocaleString('tr-TR')} 🟢</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Kazanılan Emerald</span>
          <strong class="kpi-val emerald-text">${emeraldsEarned.toLocaleString('tr-TR')} 🟢</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Netherite</span>
          <strong class="kpi-val netherite-text">${netheriteBalance.toLocaleString('tr-TR')} ⬛</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Extra Life</span>
          <strong class="kpi-val">${extraLives} / 5 ❤️</strong>
        </div>
      `;
    }

    const recentGamesEl = document.getElementById('stats-recent-games');
    if (recentGamesEl) {
      let localStats = null;
      try {
        localStats = JSON.parse(
          localStorage.getItem(`mc_millionaire_tr_stats_v5_${user.username.toLowerCase()}`) || 'null'
        );
      } catch (e) {
        localStats = null;
      }
      const history = Array.isArray(localStats?.recentMatches) ? localStats.recentMatches : [];
      if (history.length === 0) {
        recentGamesEl.innerHTML = `<div class="empty-state-box">Henüz tamamlanmış maç kaydınız bulunmuyor.</div>`;
      } else {
        recentGamesEl.innerHTML = history
          .slice(0, 10)
          .map(
            m => `
            <div class="tx-row">
              <div>
                <strong>${m.didWin ? '🏆 Milyoner Şampiyonu' : `🎯 ${m.reachedQuestion}. Soruya Ulaşıldı`}</strong>
                <span class="tx-date">${formatDateTR(m.date)}</span>
              </div>
              <span class="tx-amount pos">${formatCurrencyTRY(m.prizeWon || 0)}</span>
            </div>
          `
          )
          .join('');
      }
    }
  }

  // ==========================================
  // 9. EKRAN: GERÇEK LİDERLİK TABLOSU (renderLeaderboard — #17, #18, #19)
  // ==========================================
  function renderLeaderboard() {
    const { leaderboardService, avatarService } = svc();
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody || !leaderboardService) return;

    document.querySelectorAll('.lb-tab[data-lb-sort]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lb-sort') === state.leaderboardSort);
    });

    const rows = leaderboardService.getLeaderboard({
      sortBy: state.leaderboardSort,
      search: state.leaderboardSearch
    });

    // #17 & #19: Gerçek oyuncu yoksa "Henüz sıralama bulunmuyor." göster
    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-table-cell">Henüz sıralama bulunmuyor.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map(r => {
        const medal =
          r.position === 1
            ? '🥇 1'
            : r.position === 2
            ? '🥈 2'
            : r.position === 3
            ? '🥉 3'
            : `#${r.position}`;
        const avatarSrc = avatarService.getAvatarForUser(r);
        const fallbackSrc = avatarService.generatePixelAvatarDataUrl(r.username);

        return `
          <tr>
            <td><strong>${medal}</strong></td>
            <td>
              <div class="lb-player-cell">
                <img src="${escapeHtml(avatarSrc)}" onerror="this.onerror=null;this.src='${escapeHtml(
          fallbackSrc
        )}';" class="lb-avatar" alt="" />
                <div>
                  <strong>${escapeHtml(r.username)}</strong>
                  ${
                    r.minecraftPlayerName
                      ? `<span class="lb-mc-sub">🎮 ${escapeHtml(r.minecraftPlayerName)}</span>`
                      : ''
                  }
                </div>
              </div>
            </td>
            <td><span class="${getRankBadgeClass(r.rankId)}">${escapeHtml(r.rankBadge)} ${escapeHtml(
          r.rankName
        )}</span></td>
            <td><strong class="gold-text">${formatCurrencyTRY(r.points)}</strong></td>
            <td>${r.gamesWon}</td>
            <td>${r.gamesPlayed}</td>
            <td><strong class="emerald-text">${r.emeraldBalance.toLocaleString('tr-TR')} 🟢</strong></td>
          </tr>
        `;
      })
      .join('');
  }

  // #18: Leaderboard'u Sıfırla Onay Modalı
  function openResetLeaderboardModal() {
    const modal = document.getElementById('modal-reset-leaderboard');
    modal?.classList.remove('hidden');
  }

  function closeResetLeaderboardModal() {
    const modal = document.getElementById('modal-reset-leaderboard');
    modal?.classList.add('hidden');
  }

  function confirmResetLeaderboard() {
    const session = getSession();
    if (!session) return;
    try {
      svc().leaderboardService.adminResetLeaderboard(session);
      closeResetLeaderboardModal();
      showToast('Liderlik Tablosu başarıyla sıfırlandı!', 'success');
      if (state.currentScreen === 'leaderboard') renderLeaderboard();
      if (state.currentScreen === 'admin') renderAdmin();
      syncHeaderAndDrawer();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // 10. DESTEK SİSTEMİ (renderSupport)
  // ==========================================
  function renderSupport() {
    const session = getSession();
    if (!session) return;
    const listEl = document.getElementById('support-tickets-list');
    if (!listEl) return;

    const tickets = svc().supportService.getUserTickets(session.username);
    if (tickets.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Henüz destek talebiniz bulunmuyor.</div>`;
      return;
    }

    listEl.innerHTML = tickets
      .map(
        t => `
        <div class="ticket-card">
          <div class="ticket-header">
            <strong>#${escapeHtml(t.id)} — ${escapeHtml(t.subject)}</strong>
            <span class="status-pill status-${escapeHtml(t.status.toLowerCase())}">${escapeHtml(
          t.status
        )}</span>
          </div>
          <p class="ticket-meta">Kategori: ${escapeHtml(t.category)} • Öncelik: ${escapeHtml(
          t.priority
        )} • ${formatDateTR(t.createdAt)}</p>
          <div class="ticket-messages">
            ${(t.messages || [])
              .map(
                m => `
                <div class="ticket-msg ${m.senderRole === 'ADMIN' ? 'msg-admin' : 'msg-user'}">
                  <strong>${escapeHtml(m.sender)} (${m.senderRole === 'ADMIN' ? 'Yönetici' : 'Siz'}):</strong>
                  <p>${escapeHtml(m.text)}</p>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
      )
      .join('');
  }

  // ==========================================
  // 11. HATA BİLDİR (renderBugReports — #18)
  // ==========================================
  function renderBugReports() {
    const session = getSession();
    if (!session) return;
    const listEl = document.getElementById('user-bugs-list');
    if (!listEl) return;

    const bugs = svc().bugService.getUserBugs(session.username);
    if (bugs.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Henüz hata bildiriminiz bulunmuyor.</div>`;
      return;
    }

    listEl.innerHTML = bugs
      .map(
        b => `
        <div class="ticket-card">
          <div class="ticket-header">
            <strong>🐞 ${escapeHtml(b.title)}</strong>
            <span class="status-pill">${escapeHtml(b.status)}</span>
          </div>
          <p class="ticket-meta">${escapeHtml(b.category)} • Önem: ${escapeHtml(
          b.severity
        )} ${b.relatedParty ? `• Parti: <code>${escapeHtml(b.relatedParty)}</code>` : ''} • ${formatDateTR(
          b.createdAt
        )}</p>
          <p>${escapeHtml(b.description)}</p>
          ${
            b.screenshot
              ? `<p class="ticket-meta">📷 Ekran Görüntüsü: <a href="${escapeHtml(
                  b.screenshot
                )}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.screenshot)}</a></p>`
              : ''
          }
          ${
            b.adminNote
              ? `<div class="admin-reply-note">🛡️ <strong>Yönetici Notu:</strong> ${escapeHtml(
                  b.adminNote
                )}</div>`
              : ''
          }
        </div>
      `
      )
      .join('');
  }

  // ==========================================
  // 12. ÖNERİ GÖNDER (renderSuggestions)
  // ==========================================
  function renderSuggestions() {
    const session = getSession();
    if (!session) return;
    const listEl = document.getElementById('suggestions-list-container');
    if (!listEl) return;

    const suggestions = svc().suggestionService.getAllSuggestions();
    if (suggestions.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Henüz paylaşılmış öneri bulunmuyor. İlk öneriyi siz paylaşın!</div>`;
      return;
    }

    listEl.innerHTML = suggestions
      .map(s => {
        const upCount = Array.isArray(s.upvotes) ? s.upvotes.length : 0;
        const downCount = Array.isArray(s.downvotes) ? s.downvotes.length : 0;
        return `
          <div class="ticket-card">
            <div class="ticket-header">
              <strong>💡 ${escapeHtml(s.title)}</strong>
              <span class="status-pill">${escapeHtml(s.status)}</span>
            </div>
            <p class="ticket-meta">Gönderen: ${escapeHtml(s.username)} • Kategori: ${escapeHtml(
          s.category
        )} • ${formatDateTR(s.createdAt)}</p>
            <p>${escapeHtml(s.details)}</p>
            ${
              s.adminNote
                ? `<div class="admin-reply-note">🛡️ <strong>Yönetici Notu:</strong> ${escapeHtml(
                    s.adminNote
                  )}</div>`
                : ''
            }
            <div class="suggestion-votes">
              <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-vote-sug="${escapeHtml(
                s.id
              )}" data-vote-dir="UP">👍 Destekle (${upCount})</button>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-vote-sug="${escapeHtml(
                s.id
              )}" data-vote-dir="DOWN">👎 (${downCount})</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================
  // 14. AYARLAR (renderSettings)
  // ==========================================
  function renderSettings() {
    const session = getSession();
    if (!session) return;
    const user = svc().userService.getUserByUsername(session.username);
    const soundToggle = document.getElementById('setting-sound-toggle');
    if (soundToggle && user?.settings) {
      soundToggle.checked = user.settings.sound !== false;
    }
  }

  // ==========================================
  // 15. EKRAN: TAM TÜRKÇE 15 BÖLÜMLÜ YÖNETİCİ PANELİ (renderAdmin — #19)
  // ==========================================
  function renderAdmin() {
    const session = getSession();
    const { authGuard } = svc();
    if (!session || (!session.isAdminSession && authGuard?.getEffectiveRankId(session) !== 'ADMIN')) {
      navigateToScreen('welcome');
      return;
    }

    document.querySelectorAll('.admin-nav-btn[data-admin-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === state.adminTab);
    });

    const container = document.getElementById('admin-content-area');
    if (!container) return;

    const {
      userService,
      rankService,
      partyService,
      leaderboardService,
      economyService,
      netheriteService,
      shopService,
      paymentService,
      notificationService,
      supportService,
      bugService,
      suggestionService,
      backupService,
      activityService
    } = svc();

    // 1. GÖSTERGE PANELİ (dashboard)
    if (state.adminTab === 'dashboard') {
      const users = userService.getAllUsers();
      const parties = partyService.getAllParties().filter(p => p.status !== 'CLOSED');
      const tickets = supportService.getAllTickets().filter(t => t.status === 'OPEN');
      const bugs = bugService.getAllBugs().filter(b => b.status === 'OPEN');
      const suggestions = suggestionService.getAllSuggestions();
      const totalEmeralds = users.reduce((sum, u) => sum + Number(u.emeraldBalance || 0), 0);
      const totalNetherites = users.reduce((sum, u) => sum + Number(u.netheriteBalance || 0), 0);

      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>📊 Gösterge Paneli</h3>
          <div class="stats-kpi-grid">
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM OYUNCU</span><strong class="kpi-val">${
              users.length
            }</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">AKTİF PARTİLER</span><strong class="kpi-val">${
              parties.length
            }</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM ZÜMRÜT</span><strong class="kpi-val emerald-text">${totalEmeralds.toLocaleString(
              'tr-TR'
            )} 🟢</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM NETHERITE</span><strong class="kpi-val netherite-text">${totalNetherites.toLocaleString(
              'tr-TR'
            )} ⬛</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">AÇIK DESTEK / HATA</span><strong class="kpi-val">${
              tickets.length
            } / ${bugs.length}</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">TOPLULUK ÖNERİLERİ</span><strong class="kpi-val">${
              suggestions.length
            }</strong></div>
          </div>
        </div>
      `;
      return;
    }

    // 2. OYUNCULAR (players — Arama + Detaylar + 7 Rütbe + Moderator Verme/Kaldırma + Zümrüt & Netherite Yönetimi)
    if (state.adminTab === 'players') {
      const allUsers = userService.getAllUsers();
      const q = String(state.adminPlayerSearch || '').trim().toLowerCase();
      const users = q
        ? allUsers.filter(
            u =>
              u.username.toLowerCase().includes(q) ||
              (u.minecraftPlayerName && u.minecraftPlayerName.toLowerCase().includes(q)) ||
              String(u.userId || '').toLowerCase().includes(q)
          )
        : allUsers;
      const ranks = rankService.getAllRanks();

      container.innerHTML = `
        <div class="admin-panel-section">
          <div class="card-title-row">
            <h3>👥 Oyuncu Yönetimi (${users.length} / ${allUsers.length} Hesap)</h3>
            <div class="leaderboard-search-box">
              <input type="text" id="admin-player-search" placeholder="Kullanıcı adı veya MC adı ara..." value="${escapeHtml(
                state.adminPlayerSearch
              )}" />
            </div>
          </div>
          <div class="table-responsive">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>Kullanıcı / Detay</th>
                  <th>MC Hesabı</th>
                  <th>Rütbe</th>
                  <th>Zümrüt / Netherite</th>
                  <th>Moderator</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                ${users
                  .map(u => {
                    const uRank = rankService.getUserRank(u.username);
                    return `
                      <tr>
                        <td>
                          <strong>${escapeHtml(u.username)}</strong>
                          <div class="lb-mc-sub">Puan: ${formatCurrencyTRY(
                            u.points || 0
                          )} • Oyun: ${Number(u.gamesWon || 0)}/${Number(
                      u.gamesPlayed || 0
                    )} • Can: ${Number(u.extraLives || 0)}❤️</div>
                        </td>
                        <td>${escapeHtml(u.minecraftPlayerName || '-')}</td>
                        <td>
                          <select class="admin-inline-select" data-admin-set-rank="${escapeHtml(
                            u.username
                          )}">
                            ${ranks
                              .map(
                                r =>
                                  `<option value="${escapeHtml(r.id)}" ${
                                    uRank.id === r.id ? 'selected' : ''
                                  }>${escapeHtml(r.badge)} ${escapeHtml(r.name)}</option>`
                              )
                              .join('')}
                          </select>
                        </td>
                        <td>
                          <span class="emerald-text">${Number(u.emeraldBalance || 0)} 🟢</span> /
                          <span class="netherite-text">${Number(u.netheriteBalance || 0)} ⬛</span>
                        </td>
                        <td>
                          <button type="button" class="mc-btn mc-btn-sm ${
                            u.isModerator ? 'mc-btn-gold' : 'mc-btn-secondary'
                          }" data-admin-toggle-mod="${escapeHtml(u.username)}" data-mod-val="${
                      u.isModerator ? 'false' : 'true'
                    }">
                            ${u.isModerator ? '⚔️ Moderatör (Kaldır)' : '⚔️ Moderatör Yap'}
                          </button>
                        </td>
                        <td>
                          <div class="admin-action-btns">
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-give-emerald="${escapeHtml(
                              u.username
                            )}">+500 🟢</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-remove-emerald="${escapeHtml(
                              u.username
                            )}">-250 🟢</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-admin-give-netherite="${escapeHtml(
                              u.username
                            )}">+100 ⬛</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-remove-netherite="${escapeHtml(
                              u.username
                            )}">-50 ⬛</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-delete-user="${escapeHtml(
                              u.username
                            )}">Sil</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // 3. RÜTBELER (ranks — 7 Rütbe Yapılandırması & Moderator Yetkileri)
    if (state.adminTab === 'ranks') {
      const ranks = rankService.getAllRanks();
      const modPerms = authGuard.getModeratorPermissions();

      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>👑 7 Rütbe Hiyerarşisi (Üye, VIP, VIP+, MVIP, MVIP+, Moderator, ADMIN)</h3>
          <div class="table-responsive">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Rütbe</th>
                  <th>Fiyat (₺)</th>
                  <th>Zümrüt Fiyatı</th>
                  <th>Netherite Fiyatı</th>
                  <th>Günlük Netherite</th>
                  <th>Kaydet</th>
                </tr>
              </thead>
              <tbody>
                ${ranks
                  .map(
                    r => `
                    <tr>
                      <td>#${r.order}</td>
                      <td><strong>${escapeHtml(r.badge)} ${escapeHtml(r.name)}</strong> (<code>${escapeHtml(
                      r.id
                    )}</code>)</td>
                      <td><input type="number" step="0.1" id="adm-rk-try-${r.id}" value="${
                      r.priceTry
                    }" style="width:85px;" /></td>
                      <td><input type="number" id="adm-rk-em-${r.id}" value="${
                      r.emeraldPrice
                    }" style="width:95px;" /></td>
                      <td><input type="number" id="adm-rk-ne-${r.id}" value="${
                      r.netheritePrice
                    }" style="width:95px;" /></td>
                      <td><input type="number" id="adm-rk-daily-${r.id}" value="${
                      r.dailyNetherite
                    }" style="width:85px;" /></td>
                      <td>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-save-rank="${escapeHtml(
                          r.id
                        )}">Kaydet</button>
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <h4 style="margin-top:24px;">⚔️ Moderator Yetki Yapılandırması</h4>
          <div class="settings-toggle-list">
            <label class="setting-row">
              <span>Parti Odalarını Denetleme / Kapatma Yetkisi</span>
              <input type="checkbox" id="mod-perm-parties" ${
                modPerms.canModerateParties ? 'checked' : ''
              } />
            </label>
            <label class="setting-row">
              <span>Destek Taleplerini İnceleme Yetkisi</span>
              <input type="checkbox" id="mod-perm-tickets" ${
                modPerms.canReviewTickets ? 'checked' : ''
              } />
            </label>
            <label class="setting-row">
              <span>Hata Bildirimlerini İnceleme Yetkisi</span>
              <input type="checkbox" id="mod-perm-bugs" ${modPerms.canReviewBugs ? 'checked' : ''} />
            </label>
            <button type="button" id="btn-admin-save-mod-perms" class="mc-btn mc-btn-sm mc-btn-gold" style="margin-top:10px;">
              Moderatör Yetkilerini Kaydet
            </button>
          </div>
        </div>
      `;
      return;
    }

    // 4. PARTİLER (parties)
    if (state.adminTab === 'parties') {
      const parties = partyService.getAllParties();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🎉 Parti Odaları Yönetimi (${parties.length})</h3>
          ${
            parties.length === 0
              ? `<div class="empty-state-box">Kayıtlı parti odası bulunmuyor.</div>`
              : `
                <div class="table-responsive">
                  <table class="mc-table">
                    <thead>
                      <tr>
                        <th>Kod</th>
                        <th>Parti Adı</th>
                        <th>Lider</th>
                        <th>Durum</th>
                        <th>Üyeler</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${parties
                        .map(
                          p => `
                          <tr>
                            <td><code>${escapeHtml(p.partyCode)}</code></td>
                            <td><strong>${escapeHtml(p.partyName)}</strong></td>
                            <td>${escapeHtml(p.leaderUsername)}</td>
                            <td>${escapeHtml(p.status)}</td>
                            <td>${p.members.map(m => escapeHtml(m.username)).join(', ')}</td>
                            <td>
                              ${
                                p.status !== 'CLOSED'
                                  ? `<button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-close-party="${escapeHtml(
                                      p.partyId
                                    )}">Kapat</button>`
                                  : 'Kapalı'
                              }
                            </td>
                          </tr>
                        `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>
      `;
      return;
    }

    // 5. LİDERLİK TABLOSU (leaderboard — #16 Leaderboard'u Sıfırla)
    if (state.adminTab === 'leaderboard') {
      const rows = leaderboardService.getLeaderboard({ sortBy: 'points' });
      const meta = leaderboardService.getMeta();

      container.innerHTML = `
        <div class="admin-panel-section">
          <div class="card-title-row">
            <h3>🏆 Liderlik Tablosu Yönetimi</h3>
            <button type="button" id="btn-admin-tab-reset-lb" class="mc-btn mc-btn-danger">
              🗑️ Leaderboard'u Sıfırla
            </button>
          </div>
          <p class="card-sub">
            Son Sıfırlama: <strong>${meta.lastResetAt ? formatDateTR(meta.lastResetAt) : 'Henüz sıfırlanmadı'}</strong>
          </p>
          ${
            rows.length === 0
              ? `<div class="empty-state-box">Henüz sıralama bulunmuyor.</div>`
              : `
                <div class="table-responsive">
                  <table class="mc-table">
                    <thead>
                      <tr>
                        <th>Sıra</th>
                        <th>Oyuncu</th>
                        <th>Puan (₺)</th>
                        <th>Galibiyet</th>
                        <th>Oyun</th>
                        <th>Kaydet</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows
                        .map(
                          r => `
                          <tr>
                            <td>#${r.position}</td>
                            <td><strong>${escapeHtml(r.username)}</strong></td>
                            <td><input type="number" id="adm-lb-pts-${escapeHtml(
                              r.username
                            )}" value="${r.points}" style="width:110px;" /></td>
                            <td><input type="number" id="adm-lb-wins-${escapeHtml(
                              r.username
                            )}" value="${r.gamesWon}" style="width:80px;" /></td>
                            <td><input type="number" id="adm-lb-games-${escapeHtml(
                              r.username
                            )}" value="${r.gamesPlayed}" style="width:80px;" /></td>
                            <td>
                              <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-save-lb="${escapeHtml(
                                r.username
                              )}">Güncelle</button>
                            </td>
                          </tr>
                        `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>
      `;
      return;
    }

    // 6. EKONOMİ (economy — Özel Oyuncu Bakiye Yönetimi + Zümrüt & Netherite Ayarları)
    if (state.adminTab === 'economy') {
      const settings = economyService.getSettings();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>💎 Oyuncu Zümrüt &amp; Netherite Bakiye İşlemi</h3>
          <form id="admin-custom-currency-form" class="platform-form" style="margin-bottom:24px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>HEDEF OYUNCU KULLANICI ADI</label>
                <input type="text" id="adm-cur-username" placeholder="Örn: SteveMaster" required />
              </div>
              <div class="input-group">
                <label>PARA BİRİMİ</label>
                <select id="adm-cur-type">
                  <option value="EMERALD">🟢 Zümrüt (Emerald)</option>
                  <option value="NETHERITE">⬛ Netherite</option>
                </select>
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>İŞLEM TÜRÜ</label>
                <select id="adm-cur-mode">
                  <option value="ADD">Ekle (+)</option>
                  <option value="REMOVE">Çıkar (-)</option>
                  <option value="SET">Bakiye Sabitle (=)</option>
                </select>
              </div>
              <div class="input-group">
                <label>MİKTAR</label>
                <input type="number" id="adm-cur-amount" value="250" min="1" required />
              </div>
            </div>
            <button type="submit" class="mc-btn mc-btn-gold">Bakiyeyi Güncelle</button>
          </form>

          <h3>⚙️ Zümrüt &amp; Netherite Ekonomi Ayarları</h3>
          <form id="admin-economy-settings-form" class="platform-form">
            <div class="input-row-2">
              <div class="input-group">
                <label>Şampiyonluk Tamamlama Bonusu (Zümrüt)</label>
                <input type="number" id="adm-eco-win-bonus" value="${settings.winCompletionBonus}" />
              </div>
              <div class="input-group">
                <label>Parti Maçı Bonusu (Zümrüt)</label>
                <input type="number" id="adm-eco-party-bonus" value="${settings.partyMatchBonus}" />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>+1 Ekstra Can Fiyatı (Zümrüt)</label>
                <input type="number" id="adm-eco-life-price" value="${settings.extraLifeBasePrice}" />
              </div>
              <div class="input-group">
                <label>İlk Kayıt Tek Seferlik Netherite Ödülü</label>
                <input type="number" id="adm-eco-init-netherite" value="${
                  settings.initialNetheriteBonus || 250
                }" />
              </div>
            </div>
            <button type="submit" class="mc-btn mc-btn-primary">Ekonomi Ayarlarını Kaydet</button>
          </form>
        </div>
      `;
      return;
    }

    // 7. MAĞAZA (shop — Birleşik Mağaza Ürün Yönetimi + Yeni Ürün Ekleme)
    if (state.adminTab === 'shop') {
      const items = shopService.getAllItems(true);
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🛒 Yeni Mağaza Ürünü Ekle / Güncelle</h3>
          <form id="admin-shop-item-form" class="platform-form" style="margin-bottom: 24px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>ÜRÜN ADI</label>
                <input type="text" id="adm-shop-name" placeholder="Örn: Altın Kazma Rozeti" required />
              </div>
              <div class="input-group">
                <label>KATEGORİ</label>
                <select id="adm-shop-category">
                  <option value="Cosmetics">Kozmetikler (Cosmetics)</option>
                  <option value="Special">Özel Ürünler (Special)</option>
                  <option value="Emeralds">Zümrüt Paketleri (Emeralds)</option>
                </select>
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>ZÜMRÜT FİYATI</label>
                <input type="number" id="adm-shop-emerald" value="350" min="0" />
              </div>
              <div class="input-group">
                <label>NETHERITE FİYATI</label>
                <input type="number" id="adm-shop-netherite" value="50" min="0" />
              </div>
            </div>
            <div class="input-group">
              <label>AÇIKLAMA</label>
              <input type="text" id="adm-shop-desc" placeholder="Ürün açıklaması..." required />
            </div>
            <button type="submit" class="mc-btn mc-btn-gold">Ürünü Mağazaya Kaydet</button>
          </form>

          <h3>📦 Mevcut Mağaza Ürünleri (${items.length} Ürün)</h3>
          <div class="table-responsive">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>İkon &amp; Ad</th>
                  <th>Kategori</th>
                  <th>Birim</th>
                  <th>Zümrüt / Netherite</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    i => `
                    <tr>
                      <td><strong>${escapeHtml(i.icon)} ${escapeHtml(i.name)}</strong></td>
                      <td>${escapeHtml(i.category)}</td>
                      <td>${escapeHtml(i.currency)}</td>
                      <td>${i.emeraldPrice || 0} 🟢 / ${i.netheritePrice || 0} ⬛</td>
                      <td>${i.active !== false ? '✅ Aktif' : '⏸️ Pasif'}</td>
                      <td>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-delete-item="${escapeHtml(
                          i.id
                        )}">Sil</button>
                      </td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // 8. ÖDEMELER (payments — Stripe Hazırlık Yapılandırması & Hediye Kayıtları #9, #12, #27)
    if (state.adminTab === 'payments') {
      const stripeCfg = paymentService.getStripeConfig();
      const sessions = paymentService.getCheckoutSessions();
      const gifts = shopService.getGiftHistory();

      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>💳 Stripe Ödeme Altyapısı Hazırlık Ayarları</h3>
          <p class="card-sub">
            Sistem şu anda hazırlık modundadır ve sahte ödeme gerçekleştirmez. Kullanıcılara <em>"${escapeHtml(
              stripeCfg.statusMessage
            )}"</em> bilgisi gösterilir.
          </p>
          <form id="admin-stripe-config-form" class="platform-form">
            <div class="input-row-2">
              <div class="input-group">
                <label>Stripe Publishable Key (pk_test_... / pk_live_...)</label>
                <input type="text" id="adm-stripe-pk" value="${escapeHtml(
                  stripeCfg.publishableKey
                )}" placeholder="pk_test_..." />
              </div>
              <div class="input-group">
                <label>Çalışma Modu</label>
                <select id="adm-stripe-mode">
                  <option value="PREPARATION" ${
                    stripeCfg.mode === 'PREPARATION' ? 'selected' : ''
                  }>Hazırlık Modu (Yakında Aktif)</option>
                  <option value="TEST" ${
                    stripeCfg.mode === 'TEST' ? 'selected' : ''
                  }>Test Modu</option>
                </select>
              </div>
            </div>
            <button type="submit" class="mc-btn mc-btn-primary">Stripe Ayarlarını Kaydet</button>
          </form>

          <h4 style="margin-top:24px;">🎁 Gönderilen Rütbe Hediyeleri (${gifts.length})</h4>
          ${
            gifts.length === 0
              ? `<div class="empty-state-box">Henüz rütbe hediyesi kaydı bulunmuyor.</div>`
              : `
                <div class="table-responsive">
                  <table class="mc-table">
                    <thead>
                      <tr>
                        <th>Gönderen</th>
                        <th>Alıcı</th>
                        <th>Hediye Rütbe</th>
                        <th>Yöntem</th>
                        <th>Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${gifts
                        .map(
                          g => `
                          <tr>
                            <td><strong>${escapeHtml(g.fromUsername)}</strong></td>
                            <td><strong>${escapeHtml(g.toUsername)}</strong></td>
                            <td>${escapeHtml(g.rankName)}</td>
                            <td>${escapeHtml(g.paymentMethod)} (${g.cost})</td>
                            <td>${formatDateTR(g.createdAt)}</td>
                          </tr>
                        `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }

          <h4 style="margin-top:24px;">🧾 Hazırlanan Stripe Checkout Kayıtları (${sessions.length})</h4>
          ${
            sessions.length === 0
              ? `<div class="empty-state-box">Henüz Stripe ödeme talebi oluşturulmadı.</div>`
              : `
                <div class="table-responsive">
                  <table class="mc-table">
                    <thead>
                      <tr>
                        <th>Oturum Kodu</th>
                        <th>Kullanıcı</th>
                        <th>Ürün</th>
                        <th>Tutar</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sessions
                        .map(
                          s => `
                          <tr>
                            <td><code>${escapeHtml(s.id)}</code></td>
                            <td>${escapeHtml(s.username)}</td>
                            <td>${escapeHtml(s.productName)}</td>
                            <td>${formatCurrencyTRY(s.amountTry)}</td>
                            <td>${escapeHtml(s.status)}</td>
                          </tr>
                        `
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>
      `;
      return;
    }

    // 9. BİLDİRİMLER (notifications — Toplu veya Özel Bildirim Gönder)
    if (state.adminTab === 'notifications') {
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🔔 Bildirim &amp; Duyuru Gönderimi</h3>
          <form id="admin-send-notification-form" class="platform-form">
            <div class="input-row-2">
              <div class="input-group">
                <label>HEDEF KULLANICI ADI (TÜM OYUNCULAR İÇİN BOŞ BIRAKIN)</label>
                <input type="text" id="adm-notif-target" placeholder="Örn: DiamondKing veya boş (Tüm Oyuncular)" />
              </div>
              <div class="input-group">
                <label>BİLDİRİM TÜRÜ</label>
                <select id="adm-notif-type">
                  <option value="ADMIN_ANNOUNCEMENT">📣 Admin Duyurusu</option>
                  <option value="NEW_UPDATE">🚀 Yeni Güncelleme</option>
                  <option value="SYSTEM_NOTIFICATION">🔔 Sistem Bildirimi</option>
                </select>
              </div>
            </div>
            <div class="input-group">
              <label>BAŞLIK</label>
              <input type="text" id="adm-notif-title" placeholder="Duyuru başlığı..." required />
            </div>
            <div class="input-group">
              <label>MESAJ İÇERİĞİ</label>
              <textarea id="adm-notif-msg" rows="3" placeholder="Bildirim mesajınızı yazın..." required></textarea>
            </div>
            <button type="submit" class="mc-btn mc-btn-gold">📨 Bildirimi Gönder</button>
          </form>
        </div>
      `;
      return;
    }

    // 10. DESTEK (support)
    if (state.adminTab === 'support') {
      const tickets = supportService.getAllTickets();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🎧 Destek Talepleri (${tickets.length})</h3>
          ${
            tickets.length === 0
              ? `<div class="empty-state-box">Kayıtlı destek talebi bulunmuyor.</div>`
              : tickets
                  .map(
                    t => `
                    <div class="ticket-card">
                      <div class="ticket-header">
                        <strong>#${escapeHtml(t.id)} — ${escapeHtml(t.subject)} (${escapeHtml(
                      t.username
                    )} • ${escapeHtml(t.category)})</strong>
                        <span class="status-pill">${escapeHtml(t.status)}</span>
                      </div>
                      <div class="inline-form-row" style="margin-top:8px;">
                        <input type="text" id="adm-sup-reply-${escapeHtml(
                          t.id
                        )}" placeholder="Oyuncuya yanıt yazın..." />
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-reply-ticket="${escapeHtml(
                          t.id
                        )}">Yanıtla</button>
                      </div>
                    </div>
                  `
                  )
                  .join('')
          }
        </div>
      `;
      return;
    }

    // 11. HATALAR (bugs)
    if (state.adminTab === 'bugs') {
      const bugs = bugService.getAllBugs();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🐞 Hata Bildirimleri (${bugs.length})</h3>
          ${
            bugs.length === 0
              ? `<div class="empty-state-box">Hata bildirimi bulunmuyor.</div>`
              : bugs
                  .map(
                    b => `
                    <div class="ticket-card">
                      <div class="ticket-header">
                        <strong>${escapeHtml(b.title)} (${escapeHtml(b.username)})</strong>
                        <span class="status-pill">${escapeHtml(b.status)}</span>
                      </div>
                      <p class="ticket-meta">${escapeHtml(b.category)} • Önem: ${escapeHtml(
                      b.severity
                    )} ${
                      b.relatedParty ? `• İlgili Parti: <code>${escapeHtml(b.relatedParty)}</code>` : ''
                    }</p>
                      <p>${escapeHtml(b.description)}</p>
                      ${
                        b.screenshot
                          ? `<p class="ticket-meta">📷 Ekran Görüntüsü: <a href="${escapeHtml(
                              b.screenshot
                            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                              b.screenshot
                            )}</a></p>`
                          : ''
                      }
                      <div class="inline-form-row" style="margin-top:8px;">
                        <input type="text" id="adm-bug-note-${escapeHtml(
                          b.id
                        )}" placeholder="Çözüm notu..." value="${escapeHtml(b.adminNote || '')}" />
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-resolve-bug="${escapeHtml(
                          b.id
                        )}">Çözüldü İşaretle &amp; Bildir</button>
                      </div>
                    </div>
                  `
                  )
                  .join('')
          }
        </div>
      `;
      return;
    }

    // 12. ÖNERİLER (suggestions)
    if (state.adminTab === 'suggestions') {
      const suggestions = suggestionService.getAllSuggestions();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>💡 Topluluk Önerileri (${suggestions.length})</h3>
          ${
            suggestions.length === 0
              ? `<div class="empty-state-box">Öneri bulunmuyor.</div>`
              : suggestions
                  .map(
                    s => `
                    <div class="ticket-card">
                      <div class="ticket-header">
                        <strong>${escapeHtml(s.title)} (${escapeHtml(s.username)})</strong>
                        <span class="status-pill">${escapeHtml(s.status)}</span>
                      </div>
                      <p>${escapeHtml(s.details)}</p>
                      <div class="inline-form-row" style="margin-top:8px;">
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-sug-status="${escapeHtml(
                          s.id
                        )}" data-status="ONAYLANDI">Onayla</button>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-admin-sug-status="${escapeHtml(
                          s.id
                        )}" data-status="PLANLANDI">Planlandı</button>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-sug-status="${escapeHtml(
                          s.id
                        )}" data-status="REDDEDİLDİ">Reddet</button>
                      </div>
                    </div>
                  `
                  )
                  .join('')
          }
        </div>
      `;
      return;
    }

    // 13. YEDEKLER (backups)
    if (state.adminTab === 'backups') {
      const snapshots = backupService.getSnapshots();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>💾 Veri Yedekleme ve Geri Yükleme</h3>
          <div class="header-bar-actions" style="margin-bottom:16px;">
            <button type="button" id="btn-admin-create-snapshot" class="mc-btn mc-btn-primary">📸 Yeni Anlık Yedek Oluştur</button>
            <button type="button" id="btn-admin-export-json" class="mc-btn mc-btn-gold">⬇️ JSON Olarak İndir</button>
          </div>
          <div class="tickets-list">
            ${
              snapshots.length === 0
                ? `<div class="empty-state-box">Henüz kayıtlı anlık yedek bulunmuyor.</div>`
                : snapshots
                    .map(
                      sn => `
                      <div class="tx-row">
                        <div>
                          <strong>${escapeHtml(sn.label)}</strong>
                          <span class="tx-date">${formatDateTR(sn.createdAt)}</span>
                        </div>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-restore-snap="${escapeHtml(
                          sn.id
                        )}">Geri Yükle</button>
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        </div>
      `;
      return;
    }

    // 14. AKTİVİTELER (activities)
    if (state.adminTab === 'activities') {
      const logs = activityService.getAllLogs().slice(0, 60);
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>📜 Sistem Aktivite Kayıtları</h3>
          <div class="tx-history-list">
            ${
              logs.length === 0
                ? `<div class="empty-state-box">Aktivite kaydı yok.</div>`
                : logs
                    .map(
                      l => `
                      <div class="tx-row">
                        <div>
                          <strong>[${escapeHtml(l.type)}] ${escapeHtml(l.message)}</strong>
                          <span class="tx-date">Kullanıcı: ${escapeHtml(
                            l.username
                          )} • ${formatDateTR(l.timestamp)}</span>
                        </div>
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        </div>
      `;
      return;
    }

    // 15. AYARLAR (settings)
    if (state.adminTab === 'settings') {
      const pSettings = backupService.getPlatformSettings();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>⚙️ Platform Genel Ayarları</h3>
          <form id="admin-platform-settings-form" class="platform-form">
            <div class="input-group">
              <label>PLATFORM BAŞLIĞI</label>
              <input type="text" id="adm-set-title" value="${escapeHtml(pSettings.siteTitle)}" />
            </div>
            <div class="input-group">
              <label>DUYURU METNİ</label>
              <input type="text" id="adm-set-announcement" value="${escapeHtml(
                pSettings.announcementText
              )}" />
            </div>
            <button type="submit" class="mc-btn mc-btn-primary">Ayarları Kaydet</button>
          </form>
        </div>
      `;
    }
  }

  // ==========================================
  // OLAY DİNLEYİCİLERİ (EVENT DELEGATION & HANDLERS)
  // ==========================================
  function bindPlatformEvents() {
    // 1. Kompakt 3 Çizgili Menü Butonu & Backdrop
    document.getElementById('btn-toggle-menu')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleDrawer();
    });

    document.getElementById('btn-close-menu')?.addEventListener('click', () => {
      closeDrawer();
    });

    document.getElementById('menu-drawer-backdrop')?.addEventListener('click', () => {
      closeDrawer();
    });

    // ESC ile çekmece ve modalları kapat
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeDrawer();
        closeGiftRankModal();
        closeResetLeaderboardModal();
      }
    });

    // Marka logosuna tıklayınca Ana Sayfa
    document.getElementById('brand-home-trigger')?.addEventListener('click', () => {
      navigateToScreen('welcome');
    });

    // Yönetici Girişi butonu (çekmeceden)
    document.getElementById('btn-open-admin-login-modal')?.addEventListener('click', () => {
      openAdminLoginModal();
    });

    // Günlük Netherite Ödülü Butonları (#13)
    ['btn-welcome-claim-netherite', 'btn-shop-claim-netherite', 'btn-profile-claim-netherite'].forEach(
      id => {
        document.getElementById(id)?.addEventListener('click', function () {
          handleDailyNetheriteClick(this);
        });
      }
    );

    // Bildirim Merkezi: Toplu olarak okundu (#7)
    document.getElementById('btn-notif-mark-all-read')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      svc().notificationService.markAllAsRead(session.username);
      showToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
      syncHeaderAndDrawer();
      renderNotifications();
    });

    // Hediye Modalı (#11)
    document.getElementById('btn-close-gift-modal')?.addEventListener('click', closeGiftRankModal);
    document.getElementById('btn-gift-cancel-1')?.addEventListener('click', closeGiftRankModal);
    document.getElementById('btn-gift-continue')?.addEventListener('click', proceedGiftRankStep2);
    document.getElementById('btn-gift-back')?.addEventListener('click', () => {
      document.getElementById('gift-step-2')?.classList.add('hidden');
      document.getElementById('gift-step-1')?.classList.remove('hidden');
    });
    document
      .getElementById('btn-gift-pay-netherite')
      ?.addEventListener('click', () => executeGiftRankPayment('NETHERITE'));
    document
      .getElementById('btn-gift-pay-emerald')
      ?.addEventListener('click', () => executeGiftRankPayment('EMERALD'));
    document
      .getElementById('btn-gift-pay-stripe')
      ?.addEventListener('click', () => executeGiftRankPayment('STRIPE'));

    // Leaderboard Sıfırlama Modalı (#18)
    document
      .getElementById('btn-leaderboard-admin-reset')
      ?.addEventListener('click', openResetLeaderboardModal);
    document
      .getElementById('btn-admin-quick-reset-lb')
      ?.addEventListener('click', openResetLeaderboardModal);
    document
      .getElementById('btn-close-reset-lb-modal')
      ?.addEventListener('click', closeResetLeaderboardModal);
    document
      .getElementById('btn-cancel-reset-lb')
      ?.addEventListener('click', closeResetLeaderboardModal);
    document
      .getElementById('btn-confirm-reset-lb')
      ?.addEventListener('click', confirmResetLeaderboard);

    // Liderlik Tablosu Arama
    document.getElementById('leaderboard-search-input')?.addEventListener('input', function () {
      state.leaderboardSearch = this.value;
      renderLeaderboard();
    });

    // Profil: İsteğe bağlı Minecraft oyuncu adı kaydetme (#4)
    document.getElementById('profile-mcname-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const mcName = document.getElementById('profile-mcname-input')?.value || '';
      try {
        svc().userService.updateMinecraftPlayerName(session, mcName);
        showToast(
          mcName.trim()
            ? `Minecraft oyuncu adınız "${mcName.trim()}" olarak güncellendi ve skin yüzünüz yüklendi!`
            : 'Minecraft oyuncu adı bağlantısı kaldırıldı.',
          'success'
        );
        syncHeaderAndDrawer();
        renderProfile();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Profil: Özel Avatar Yükleme ve Sıfırlama
    document.getElementById('profile-avatar-input')?.addEventListener('change', async function () {
      const file = this.files?.[0];
      const session = getSession();
      if (!file || !session) return;
      try {
        const dataUrl = await svc().avatarService.processUploadedFile(file);
        svc().userService.updateAvatar(session, dataUrl);
        showToast('Profil fotoğrafınız güncellendi!', 'success');
        syncHeaderAndDrawer();
        renderProfile();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-reset-avatar')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      try {
        svc().userService.updateAvatar(session, '');
        showToast('Profil fotoğrafınız Minecraft skin yüzüne sıfırlandı.', 'info');
        syncHeaderAndDrawer();
        renderProfile();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Parti Formları
    document.getElementById('party-join-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const code = document.getElementById('party-join-code-input')?.value || '';
      try {
        const party = svc().partyService.joinPartyByCode(session, code);
        svc().achievementService?.checkAndUnlock(session.username, { joinedParty: true });
        showToast(`🎉 "${party.partyName}" partisine katıldınız!`, 'success');
        syncHeaderAndDrawer();
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('party-create-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const name = document.getElementById('party-name-input')?.value || '';
      try {
        const party = svc().partyService.createParty(session, name);
        svc().achievementService?.checkAndUnlock(session.username, { joinedParty: true });
        showToast(`👑 "${party.partyName}" partisi kuruldu! Kod: ${party.partyCode}`, 'success');
        syncHeaderAndDrawer();
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('party-invite-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      const targetUser = document.getElementById('party-invite-username')?.value || '';
      if (!activeParty) return;
      try {
        svc().partyService.invitePlayerToParty(session, activeParty.partyId, targetUser);
        showToast(`✉️ ${targetUser} oyuncusuna parti daveti gönderildi!`, 'success');
        document.getElementById('party-invite-username').value = '';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-copy-party-code')?.addEventListener('click', () => {
      const code = document.getElementById('party-room-code')?.textContent || '';
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code);
        showToast(`Parti kodu kopyalandı: ${code}`, 'success');
      }
    });

    document.getElementById('btn-party-leave')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      if (!activeParty) return;
      try {
        svc().partyService.leaveParty(session, activeParty.partyId);
        showToast('Partiden ayrıldınız.', 'info');
        syncHeaderAndDrawer();
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-party-start-match')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      if (!activeParty) return;
      try {
        svc().partyService.startPartyMatch(session, activeParty.partyId);
        showToast('⚔️ Parti maçı başlatıldı!', 'success');
        if (typeof window.startNewGameSession === 'function') {
          window.startNewGameSession(true);
        } else {
          document.getElementById('btn-start-game')?.click();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Destek, Hata ve Öneri Formları
    document.getElementById('support-create-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      try {
        svc().supportService.createTicket(session, {
          category: document.getElementById('support-category')?.value,
          subject: document.getElementById('support-subject')?.value,
          message: document.getElementById('support-message')?.value
        });
        e.target.reset();
        showToast('Destek talebiniz başarıyla oluşturuldu.', 'success');
        renderSupport();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('bug-report-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      try {
        svc().bugService.createBugReport(session, {
          title: document.getElementById('bug-title')?.value,
          category: document.getElementById('bug-category')?.value,
          severity: document.getElementById('bug-severity')?.value,
          screenshot: document.getElementById('bug-screenshot')?.value || '',
          relatedParty: document.getElementById('bug-related-party')?.value || '',
          description: document.getElementById('bug-description')?.value
        });
        e.target.reset();
        showToast('Hata bildiriminiz kaydedildi. Teşekkür ederiz!', 'success');
        renderBugReports();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('suggestion-create-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      try {
        svc().suggestionService.createSuggestion(session, {
          category: document.getElementById('sug-category')?.value,
          title: document.getElementById('sug-title')?.value,
          details: document.getElementById('sug-details')?.value
        });
        e.target.reset();
        showToast('Öneriniz toplulukla paylaşıldı!', 'success');
        renderSuggestions();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Ayarlar: Şifre Değiştirme
    document.getElementById('settings-password-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      try {
        await svc().authService.changePassword(
          session,
          document.getElementById('settings-current-pass')?.value,
          document.getElementById('settings-new-pass')?.value
        );
        e.target.reset();
        showToast('Şifreniz başarıyla güncellendi!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Genel Tıklama Delegasyonu (Navigasyon, Mağaza, Bildirimler, Parti Daveti, Admin İşlemleri)
    document.addEventListener('click', e => {
      // 1. Ekran Navigasyonu ([data-nav-screen])
      const navTrigger = e.target.closest('[data-nav-screen]');
      if (navTrigger) {
        e.preventDefault();
        const targetScreen = navTrigger.getAttribute('data-nav-screen');
        if (targetScreen) navigateToScreen(targetScreen);
        return;
      }

      // 2. Çıkış Yap ([data-nav-action="logout"])
      const logoutTrigger = e.target.closest('[data-nav-action="logout"]');
      if (logoutTrigger) {
        e.preventDefault();
        closeDrawer();
        if (typeof window.handleUserLogout === 'function') {
          window.handleUserLogout();
        } else {
          svc().authService?.logout();
          window.location.reload();
        }
        return;
      }

      // 3. Birleşik Mağaza Kategori Sekmeleri
      const shopTab = e.target.closest('[data-shop-cat]');
      if (shopTab) {
        state.shopCategory = shopTab.getAttribute('data-shop-cat');
        renderShop();
        return;
      }

      // 4. Rütbe Satın Alma ([data-buy-rank])
      const buyRankBtn = e.target.closest('[data-buy-rank]');
      if (buyRankBtn) {
        const session = getSession();
        if (!session) return;
        const rankId = buyRankBtn.getAttribute('data-buy-rank');
        const payMethod = buyRankBtn.getAttribute('data-pay-method') || 'NETHERITE';
        try {
          const res = svc().shopService.purchaseRankForSelf(session, rankId, payMethod);
          if (res.stripePrepared) {
            showToast(res.message, 'info');
          } else if (res.firstVipPlusBonusGranted) {
            showToast(
              `🎉 Tebrikler! ${res.rank.name} rütbesine yükseldiniz ve ilk VIP+ ve üzeri alımınıza özel +250 Netherite kazandınız!`,
              'success'
            );
          } else {
            showToast(`🎉 Tebrikler! ${res.rank.name} rütbesine yükseldiniz!`, 'success');
          }
          syncHeaderAndDrawer();
          renderShop();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 5. 🎁 Arkadaşına Rütbe Hediye Et ([data-gift-rank])
      const giftRankBtn = e.target.closest('[data-gift-rank]');
      if (giftRankBtn) {
        const rankId = giftRankBtn.getAttribute('data-gift-rank');
        openGiftRankModal(rankId);
        return;
      }

      // 6. Mağaza Ürünü Satın Alma ([data-buy-item])
      const buyItemBtn = e.target.closest('[data-buy-item]');
      if (buyItemBtn) {
        const session = getSession();
        if (!session) return;
        const itemId = buyItemBtn.getAttribute('data-buy-item');
        const itemCurrency = buyItemBtn.getAttribute('data-item-currency') || null;
        try {
          const res = svc().shopService.purchaseItem(session, itemId, itemCurrency);
          if (res.stripePrepared) {
            showToast(res.message, 'info');
          } else {
            showToast('🛍️ Satın alma işlemi başarıyla tamamlandı!', 'success');
          }
          syncHeaderAndDrawer();
          renderShop();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 7. Kozmetik Kuşan / Çıkar ([data-equip-cosmetic])
      const equipBtn = e.target.closest('[data-equip-cosmetic]');
      if (equipBtn) {
        const session = getSession();
        if (!session) return;
        try {
          svc().shopService.equipCosmetic(session, equipBtn.getAttribute('data-equip-cosmetic'));
          showToast('Kozmetik görünümünüz güncellendi!', 'success');
          renderProfile();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 8. Bildirim Filtre Sekmesi ([data-notif-filter])
      const notifFilterBtn = e.target.closest('[data-notif-filter]');
      if (notifFilterBtn) {
        state.notifFilter = notifFilterBtn.getAttribute('data-notif-filter');
        renderNotifications();
        return;
      }

      // 9. Tekli Bildirimi "Okundu olarak işaretle" ([data-notif-mark-read])
      const markReadBtn = e.target.closest('[data-notif-mark-read]');
      if (markReadBtn) {
        const session = getSession();
        if (!session) return;
        const notifId = markReadBtn.getAttribute('data-notif-mark-read');
        svc().notificationService.markAsRead(session.username, notifId);
        syncHeaderAndDrawer();
        renderNotifications();
        return;
      }

      // 10A. Parti Davetini Kabul Et ([data-accept-party-invite]) (#5)
      const acceptInviteBtn = e.target.closest('[data-accept-party-invite]');
      if (acceptInviteBtn) {
        const session = getSession();
        if (!session) return;
        const invitationId = acceptInviteBtn.getAttribute('data-accept-party-invite');
        const notifId = acceptInviteBtn.getAttribute('data-notif-id');
        try {
          const party = svc().partyService.acceptPartyInvitation(session, invitationId);
          if (notifId) {
            svc().notificationService?.markAsRead(session.username, notifId);
          }
          svc().achievementService?.checkAndUnlock(session.username, { joinedParty: true });
          showToast(`🎉 Parti daveti kabul edildi! "${party.partyName}" odasına katıldınız.`, 'success');
          syncHeaderAndDrawer();
          navigateToScreen('party');
        } catch (err) {
          showToast(err.message, 'error');
          renderNotifications();
          renderParty();
        }
        return;
      }

      // 10B. Parti Davetini Reddet ([data-reject-party-invite]) (#5)
      const rejectInviteBtn = e.target.closest('[data-reject-party-invite]');
      if (rejectInviteBtn) {
        const session = getSession();
        if (!session) return;
        const invitationId = rejectInviteBtn.getAttribute('data-reject-party-invite');
        const notifId = rejectInviteBtn.getAttribute('data-notif-id');
        try {
          svc().partyService.rejectPartyInvitation(session, invitationId);
          if (notifId) {
            svc().notificationService?.markAsRead(session.username, notifId);
          }
          showToast('Parti daveti reddedildi.', 'info');
          syncHeaderAndDrawer();
          if (state.currentScreen === 'notifications') renderNotifications();
          if (state.currentScreen === 'party') renderParty();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 10C. Bildirimden Partiye Katıl ([data-notif-join-party])
      const notifJoinBtn = e.target.closest('[data-notif-join-party]');
      if (notifJoinBtn) {
        const session = getSession();
        if (!session) return;
        const code = notifJoinBtn.getAttribute('data-notif-join-party');
        try {
          const party = svc().partyService.joinPartyByCode(session, code);
          showToast(`🎉 "${party.partyName}" partisine katıldınız!`, 'success');
          navigateToScreen('party');
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 11. Açık Partilerden Hızlı Katıl ([data-quick-join-party])
      const quickJoinBtn = e.target.closest('[data-quick-join-party]');
      if (quickJoinBtn) {
        const session = getSession();
        if (!session) return;
        const code = quickJoinBtn.getAttribute('data-quick-join-party');
        try {
          const party = svc().partyService.joinPartyByCode(session, code);
          showToast(`🎉 "${party.partyName}" partisine katıldınız!`, 'success');
          syncHeaderAndDrawer();
          renderParty();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 12. Partiden Üye Çıkar ([data-kick-party-member])
      const kickBtn = e.target.closest('[data-kick-party-member]');
      if (kickBtn) {
        const session = getSession();
        if (!session) return;
        try {
          svc().partyService.kickPartyMember(
            session,
            kickBtn.getAttribute('data-party-id'),
            kickBtn.getAttribute('data-kick-party-member')
          );
          showToast('Oyuncu partiden çıkarıldı.', 'info');
          renderParty();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 13. Liderlik Tablosu Sıralama Sekmeleri ([data-lb-sort])
      const lbSortBtn = e.target.closest('[data-lb-sort]');
      if (lbSortBtn) {
        state.leaderboardSort = lbSortBtn.getAttribute('data-lb-sort');
        renderLeaderboard();
        return;
      }

      // 14. Öneri Oylama ([data-vote-sug])
      const voteBtn = e.target.closest('[data-vote-sug]');
      if (voteBtn) {
        const session = getSession();
        if (!session) return;
        try {
          svc().suggestionService.voteSuggestion(
            session,
            voteBtn.getAttribute('data-vote-sug'),
            voteBtn.getAttribute('data-vote-dir')
          );
          renderSuggestions();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 15. Admin Paneli Sekme Geçişi ([data-admin-tab])
      const adminTabBtn = e.target.closest('[data-admin-tab]');
      if (adminTabBtn) {
        state.adminTab = adminTabBtn.getAttribute('data-admin-tab');
        renderAdmin();
        return;
      }

      // 16. Admin İşlemleri
      const session = getSession();
      if (!session) return;

      if (e.target.closest('#btn-admin-tab-reset-lb')) {
        openResetLeaderboardModal();
        return;
      }

      const modToggleBtn = e.target.closest('[data-admin-toggle-mod]');
      if (modToggleBtn) {
        const targetUser = modToggleBtn.getAttribute('data-admin-toggle-mod');
        const makeMod = modToggleBtn.getAttribute('data-mod-val') === 'true';
        try {
          svc().userService.adminToggleModerator(session, targetUser, makeMod);
          showToast(
            makeMod
              ? `${targetUser} oyuncusuna Moderator yetkisi verildi.`
              : `${targetUser} oyuncusunun Moderator yetkisi kaldırıldı.`,
            'success'
          );
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const giveEmBtn = e.target.closest('[data-admin-give-emerald]');
      if (giveEmBtn) {
        const targetUser = giveEmBtn.getAttribute('data-admin-give-emerald');
        try {
          svc().economyService.adminModifyEmeralds(session, targetUser, 500, 'ADD');
          showToast(`${targetUser} hesabına +500 Zümrüt eklendi.`, 'success');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const remEmBtn = e.target.closest('[data-admin-remove-emerald]');
      if (remEmBtn) {
        const targetUser = remEmBtn.getAttribute('data-admin-remove-emerald');
        try {
          svc().economyService.adminModifyEmeralds(session, targetUser, 250, 'REMOVE');
          showToast(`${targetUser} hesabından 250 Zümrüt düşüldü.`, 'info');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const giveNeBtn = e.target.closest('[data-admin-give-netherite]');
      if (giveNeBtn) {
        const targetUser = giveNeBtn.getAttribute('data-admin-give-netherite');
        try {
          svc().netheriteService.adminModifyNetherite(session, targetUser, 100, 'ADD');
          showToast(`${targetUser} hesabına +100 Netherite eklendi.`, 'success');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const remNeBtn = e.target.closest('[data-admin-remove-netherite]');
      if (remNeBtn) {
        const targetUser = remNeBtn.getAttribute('data-admin-remove-netherite');
        try {
          svc().netheriteService.adminModifyNetherite(session, targetUser, 50, 'REMOVE');
          showToast(`${targetUser} hesabından 50 Netherite düşüldü.`, 'info');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const delItemBtn = e.target.closest('[data-admin-delete-item]');
      if (delItemBtn) {
        const itemId = delItemBtn.getAttribute('data-admin-delete-item');
        try {
          svc().shopService.adminDeleteItem(session, itemId);
          showToast('Mağaza ürünü silindi.', 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const delUserBtn = e.target.closest('[data-admin-delete-user]');
      if (delUserBtn) {
        const targetUser = delUserBtn.getAttribute('data-admin-delete-user');
        try {
          svc().userService.adminDeleteUser(session, targetUser);
          showToast(`${targetUser} hesabı silindi.`, 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const saveRankBtn = e.target.closest('[data-admin-save-rank]');
      if (saveRankBtn) {
        const rId = saveRankBtn.getAttribute('data-admin-save-rank');
        try {
          svc().rankService.updateRankConfig(session, rId, {
            priceTry: Number(document.getElementById(`adm-rk-try-${rId}`)?.value || 0),
            emeraldPrice: Number(document.getElementById(`adm-rk-em-${rId}`)?.value || 0),
            netheritePrice: Number(document.getElementById(`adm-rk-ne-${rId}`)?.value || 0),
            dailyNetherite: Number(document.getElementById(`adm-rk-daily-${rId}`)?.value || 0)
          });
          showToast('Rütbe yapılandırması kaydedildi.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      if (e.target.closest('#btn-admin-save-mod-perms')) {
        try {
          svc().authGuard.updateModeratorPermissions(session, {
            canModerateParties: document.getElementById('mod-perm-parties')?.checked,
            canReviewTickets: document.getElementById('mod-perm-tickets')?.checked,
            canReviewBugs: document.getElementById('mod-perm-bugs')?.checked
          });
          showToast('Moderatör yetkileri güncellendi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const closePartyBtn = e.target.closest('[data-admin-close-party]');
      if (closePartyBtn) {
        try {
          svc().partyService.adminCloseParty(
            session,
            closePartyBtn.getAttribute('data-admin-close-party')
          );
          showToast('Parti odası kapatıldı.', 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const saveLbBtn = e.target.closest('[data-admin-save-lb]');
      if (saveLbBtn) {
        const uName = saveLbBtn.getAttribute('data-admin-save-lb');
        try {
          svc().leaderboardService.adminEditPlayerLeaderboard(session, uName, {
            points: document.getElementById(`adm-lb-pts-${uName}`)?.value,
            gamesWon: document.getElementById(`adm-lb-wins-${uName}`)?.value,
            gamesPlayed: document.getElementById(`adm-lb-games-${uName}`)?.value
          });
          showToast(`${uName} liderlik verileri güncellendi.`, 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const replyTicketBtn = e.target.closest('[data-admin-reply-ticket]');
      if (replyTicketBtn) {
        const tId = replyTicketBtn.getAttribute('data-admin-reply-ticket');
        const text = document.getElementById(`adm-sup-reply-${tId}`)?.value || '';
        try {
          svc().supportService.replyToTicket(session, tId, text);
          showToast('Destek talebine yanıt gönderildi ve oyuncuya bildirim iletildi.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const resolveBugBtn = e.target.closest('[data-admin-resolve-bug]');
      if (resolveBugBtn) {
        const bId = resolveBugBtn.getAttribute('data-admin-resolve-bug');
        const note = document.getElementById(`adm-bug-note-${bId}`)?.value || '';
        try {
          svc().bugService.adminUpdateBug(session, bId, {
            status: 'ÇÖZÜLDÜ',
            adminNote: note
          });
          showToast('Hata kaydı güncellendi ve oyuncuya bildirim gönderildi.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const sugStatusBtn = e.target.closest('[data-admin-sug-status]');
      if (sugStatusBtn) {
        try {
          svc().suggestionService.adminUpdateSuggestion(
            session,
            sugStatusBtn.getAttribute('data-admin-sug-status'),
            { status: sugStatusBtn.getAttribute('data-status') }
          );
          showToast('Öneri durumu güncellendi ve oyuncuya bildirim gönderildi.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      if (e.target.closest('#btn-admin-create-snapshot')) {
        try {
          svc().backupService.createManualSnapshot(session, 'Manuel Yönetici Yedeği');
          showToast('Anlık yedek başarıyla oluşturuldu.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      if (e.target.closest('#btn-admin-export-json')) {
        try {
          const data = svc().backupService.exportPlatformData(session);
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `minecraft-milyoner-yedek-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const restoreSnapBtn = e.target.closest('[data-admin-restore-snap]');
      if (restoreSnapBtn) {
        try {
          svc().backupService.restoreSnapshot(
            session,
            restoreSnapBtn.getAttribute('data-admin-restore-snap')
          );
          showToast('Yedek başarıyla geri yüklendi!', 'success');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Admin Oyuncu Arama
    document.addEventListener('input', e => {
      if (e.target.id === 'admin-player-search') {
        state.adminPlayerSearch = e.target.value;
        renderAdmin();
        const searchEl = document.getElementById('admin-player-search');
        if (searchEl) {
          searchEl.focus();
          searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
        }
      }
    });

    // Admin Rütbe Seçimi Değişikliği (Oyuncular Tablosu)
    document.addEventListener('change', e => {
      const rankSelect = e.target.closest('[data-admin-set-rank]');
      if (rankSelect) {
        const session = getSession();
        if (!session) return;
        const targetUser = rankSelect.getAttribute('data-admin-set-rank');
        const newRank = rankSelect.value;
        try {
          svc().rankService.assignRankToUser(session, targetUser, newRank);
          showToast(`${targetUser} oyuncusunun rütbesi güncellendi!`, 'success');
          renderAdmin();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Admin Form Gönderimleri (Özel Bakiye, Mağaza Ürünü, Ekonomi, Stripe, Bildirim, Genel Ayarlar)
    document.addEventListener('submit', e => {
      const session = getSession();
      if (!session) return;

      if (e.target.id === 'admin-custom-currency-form') {
        e.preventDefault();
        try {
          const targetUser = document.getElementById('adm-cur-username')?.value || '';
          const curType = document.getElementById('adm-cur-type')?.value || 'EMERALD';
          const mode = document.getElementById('adm-cur-mode')?.value || 'ADD';
          const amount = Number(document.getElementById('adm-cur-amount')?.value || 0);
          if (curType === 'NETHERITE') {
            svc().netheriteService.adminModifyNetherite(session, targetUser, amount, mode);
          } else {
            svc().economyService.adminModifyEmeralds(session, targetUser, amount, mode);
          }
          showToast(`${targetUser} oyuncusunun ${curType} bakiyesi güncellendi!`, 'success');
          syncHeaderAndDrawer();
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-shop-item-form') {
        e.preventDefault();
        try {
          const name = document.getElementById('adm-shop-name')?.value || '';
          const category = document.getElementById('adm-shop-category')?.value || 'Cosmetics';
          const emeraldPrice = Number(document.getElementById('adm-shop-emerald')?.value || 0);
          const netheritePrice = Number(document.getElementById('adm-shop-netherite')?.value || 0);
          const description = document.getElementById('adm-shop-desc')?.value || '';
          svc().shopService.adminSaveItem(session, {
            name,
            category,
            currency: emeraldPrice > 0 ? 'EMERALD' : 'NETHERITE',
            price: emeraldPrice > 0 ? emeraldPrice : netheritePrice,
            emeraldPrice,
            netheritePrice,
            description
          });
          showToast('Yeni mağaza ürünü kaydedildi!', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-economy-settings-form') {
        e.preventDefault();
        try {
          svc().economyService.updateSettings(session, {
            winCompletionBonus: Number(document.getElementById('adm-eco-win-bonus')?.value || 250),
            partyMatchBonus: Number(document.getElementById('adm-eco-party-bonus')?.value || 60),
            extraLifeBasePrice: Number(document.getElementById('adm-eco-life-price')?.value || 250),
            initialNetheriteBonus: Number(
              document.getElementById('adm-eco-init-netherite')?.value || 250
            )
          });
          showToast('Ekonomi ayarları kaydedildi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-stripe-config-form') {
        e.preventDefault();
        try {
          svc().paymentService.updateStripeConfig(session, {
            publishableKey: document.getElementById('adm-stripe-pk')?.value || '',
            mode: document.getElementById('adm-stripe-mode')?.value || 'PREPARATION'
          });
          showToast('Stripe hazırlık yapılandırması kaydedildi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-send-notification-form') {
        e.preventDefault();
        try {
          const target = String(document.getElementById('adm-notif-target')?.value || '').trim();
          const type = document.getElementById('adm-notif-type')?.value || 'ADMIN_ANNOUNCEMENT';
          const title = document.getElementById('adm-notif-title')?.value || '';
          const message = document.getElementById('adm-notif-msg')?.value || '';

          if (target) {
            svc().notificationService.notifyUser(target, { type, title, message });
            showToast(`${target} oyuncusuna bildirim gönderildi.`, 'success');
          } else {
            const res = svc().notificationService.broadcastNotification(session, {
              type,
              title,
              message
            });
            showToast(`Duyuru ${res.sentCount} oyuncuya başarıyla gönderildi!`, 'success');
          }
          e.target.reset();
          syncHeaderAndDrawer();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-platform-settings-form') {
        e.preventDefault();
        try {
          svc().backupService.updatePlatformSettings(session, {
            siteTitle: document.getElementById('adm-set-title')?.value || 'Minecraft Milyoner',
            announcementText: document.getElementById('adm-set-announcement')?.value || ''
          });
          showToast('Platform ayarları güncellendi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Tarayıcı geri/ileri butonları
    window.addEventListener('popstate', () => {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && document.getElementById(`screen-${hash}`)) {
        navigateToScreen(hash, { skipHistory: true });
      }
    });

    // Her 1 saniyede bir Günlük Netherite geri sayımını güncelle
    if (state.dailyTimerInterval) clearInterval(state.dailyTimerInterval);
    state.dailyTimerInterval = setInterval(() => {
      if (getSession()) {
        syncDailyNetheriteWidgets();
      }
    }, 1000);
  }

  // Başlatma
  function initPlatformUI() {
    injectCustomCurrencyIcons();
    bindPlatformEvents();
    syncHeaderAndDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlatformUI);
  } else {
    initPlatformUI();
  }

  window.MCMPlatform = {
    navigateToScreen,
    syncHeaderAndDrawer,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    renderProfile,
    renderNotifications,
    renderShop,
    renderParty,
    renderStats,
    renderLeaderboard,
    renderAdmin,
    showToast
  };
})(window);
