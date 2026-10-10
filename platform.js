/**
 * Minecraft Milyoner - Platform Arayüz Kontrolcüsü (v0.0.1)
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

  function copyDiagnosticsReport(errorInfo = {}) {
    const session = getSession();
    const timestamp = new Date().toLocaleString('tr-TR');
    const errText =
      typeof errorInfo === 'string'
        ? errorInfo
        : errorInfo?.message || JSON.stringify(errorInfo);

    const reportLines = [
      '==========================================',
      '⛏️ MC MİLYONER SİSTEM VE HATA RAPORU',
      '==========================================',
      `📅 Tarih / Saat: ${timestamp}`,
      `📱 Uygulama: MC Milyoner (v0.0.1)`,
      `👤 Kullanıcı: ${session ? session.username : 'Giriş Yapılmamış'}`,
      `📧 E-posta: ${session?.email || 'N/A'}`,
      `👑 Rütbe: ${session?.role || 'MEMBER'}`,
      `🖥️ Aktif Ekran: ${state.currentScreen || 'welcome'}`,
      `🌐 Platform/Tarayıcı: ${navigator.userAgent}`,
      `🔗 URL: ${window.location.href}`,
      `❌ Karşılaşılan Hata: ${errText}`,
      '==========================================',
      'Bu raporu geliştiriciye veya Bug/Öneri formuna doğrudan iletebilirsiniz.'
    ];

    const fullText = reportLines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(fullText)
        .then(() => {
          showToast(
            '📋 Hata detayları kopyalandı! Bug ve öneri kısmına veya geliştiriciye yapıştırabilirsiniz.',
            'success'
          );
        })
        .catch(() => {
          prompt('Lütfen aşağıdaki rapor metnini kopyalayın (Ctrl+C):', fullText);
        });
    } else {
      prompt('Lütfen aşağıdaki rapor metnini kopyalayın (Ctrl+C):', fullText);
    }
  }

  function showToast(message, type = 'info', options = {}) {
    if (typeof window.showToastNotification === 'function') {
      window.showToastNotification(message, type);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `mc-toast mc-toast-${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    const codeMatch = String(message).match(/\b\d{6}\b/);
    const copyTarget = options?.copyText || (codeMatch ? codeMatch[0] : null);

    if (copyTarget) {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mc-btn mc-btn-gold mc-btn-xs';
      copyBtn.style.cssText =
        'margin-left: 10px; padding: 3px 8px; font-size: 0.74rem; white-space: nowrap; vertical-align: middle; cursor: pointer; font-weight: bold; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
      copyBtn.innerHTML = options?.copyLabel || '📋 Kodu Kopyala';
      copyBtn.title = 'Kodu panoya kopyala';
      copyBtn.onclick = e => {
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(copyTarget).then(() => {
            copyBtn.innerHTML = '✅ Kopyalandı!';
            setTimeout(() => (copyBtn.innerHTML = options?.copyLabel || '📋 Kodu Kopyala'), 2500);
          }).catch(() => {
            prompt('Kodu kopyalayın:', copyTarget);
          });
        } else {
          prompt('Kodu kopyalayın:', copyTarget);
        }
      };
      toast.appendChild(copyBtn);
    } else if (type === 'error') {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mc-btn mc-btn-secondary mc-btn-xs';
      copyBtn.style.cssText =
        'margin-left: 8px; padding: 2px 6px; font-size: 0.72rem; white-space: nowrap; vertical-align: middle; cursor: pointer;';
      copyBtn.innerHTML = '📋 Hatayı Kopyala';
      copyBtn.title = 'Hata ve sistem detaylarını panoya kopyala';
      copyBtn.onclick = e => {
        e.stopPropagation();
        copyDiagnosticsReport(message);
      };
      toast.appendChild(copyBtn);
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, copyTarget || type === 'error' ? 8000 : 3600);
  }

  // ==========================================
  // ÖZEL MINECRAFT SVG İKONLARINI YERLEŞTİR (#20)
  // ==========================================
  function mcIcon(iconOrKey, size = 18) {
    const { mcIconService } = svc();
    if (!mcIconService) return escapeHtml(iconOrKey || '');
    return mcIconService.getIconSvg(iconOrKey, size);
  }

  function replaceEmojis(str, size = 16) {
    const { mcIconService } = svc();
    if (!mcIconService) return String(str || '');
    return mcIconService.replaceEmojisInHtml(str, size);
  }

  function injectCustomCurrencyIcons() {
    const { mcIconService } = svc();
    if (!mcIconService) return;

    document.querySelectorAll('[data-mc-icon]').forEach(el => {
      const iconType = el.getAttribute('data-mc-icon') || 'emerald';
      const isLg = el.classList.contains('currency-svg-lg');
      el.innerHTML = mcIconService.getIconSvg(iconType, isLg ? 26 : 18);
    });

    // Mağaza ve Liderlik Tablosu sekmelerindeki düz emojileri Minecraft SVG ikonlarına dönüştür
    document.querySelectorAll('#unified-shop-tabs .shop-tab, .leaderboard-sort-tabs .lb-tab').forEach(tab => {
      if (!tab.dataset.mcIconReplaced) {
        tab.innerHTML = mcIconService.replaceEmojisInHtml(tab.innerHTML, 16);
        tab.dataset.mcIconReplaced = '1';
      }
    });
  }

  function getUserCosmeticMeta(userObj) {
    const { shopService, userService } = svc();
    const fullUser =
      userObj?.equippedCosmetics !== undefined
        ? userObj
        : userService?.getUserByUsername(userObj?.username) || userObj || {};
    const equipped = fullUser?.equippedCosmetics || {};
    const allItems = shopService?.getAllItems ? shopService.getAllItems(true) : [];

    let frameClass = '';
    let nameClass = '';
    let nameColor = '';
    let nameCssText = '';
    let nameStyle = '';
    let badgeText = '';
    let badgeHtml = '';
    let effectClass = '';

    if (equipped.avatarFrame) {
      const frameItem = allItems.find(i => i.id === equipped.avatarFrame);
      if (frameItem?.cssValue) frameClass = frameItem.cssValue;
    }

    if (equipped.nameColor) {
      const colorItem = allItems.find(i => i.id === equipped.nameColor);
      if (colorItem?.cssValue === 'rgb-rainbow') {
        nameClass = 'rgb-rainbow-text';
      } else if (colorItem?.cssValue === '#fbbf24') {
        nameClass = 'name-color-gold';
        nameColor = colorItem.cssValue;
        nameCssText = `color: ${colorItem.cssValue};`;
        nameStyle = `style="color: ${escapeHtml(colorItem.cssValue)};"`;
      } else if (colorItem?.cssValue) {
        nameColor = colorItem.cssValue;
        nameCssText = `color: ${colorItem.cssValue};`;
        nameStyle = `style="color: ${escapeHtml(colorItem.cssValue)};"`;
      }
    }

    if (equipped.badge) {
      const badgeItem = allItems.find(i => i.id === equipped.badge);
      if (badgeItem) {
        badgeText = badgeItem.cssValue || badgeItem.name;
        const cleanLabel = String(badgeText).replace(/^[🧨⚡💎👑🔥🌟🐉🌱⛏️🏆]\s*/u, '');
        badgeHtml = `<span class="custom-cosmetic-badge-pill">${mcIcon(
          badgeItem.id || badgeItem.icon,
          14
        )} ${escapeHtml(cleanLabel)}</span>`;
      }
    }

    if (equipped.profileEffect) {
      const effItem = allItems.find(i => i.id === equipped.profileEffect);
      if (effItem?.cssValue) effectClass = effItem.cssValue;
    }

    return {
      frameClass,
      nameClass,
      nameColor,
      nameCssText,
      nameStyle,
      badgeText,
      badgeHtml,
      effectClass
    };
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
    if (norm !== 'MEMBER') return 'role-badge role-mvip-plus';
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

    if (!session) {
      emeraldPill?.classList.add('hidden');
      netheritePill?.classList.add('hidden');
      userChip?.classList.add('hidden');
      notifBtn?.classList.add('hidden');
      drawerAdminBtn?.classList.add('hidden');
      return;
    }

    // İlk kez en az VIP+ alan kullanıcının 250 Netherite bonusunu kontrol et
    netheriteService?.ensureInitialBonusOnce(session.username);

    const user = userService?.getUserByUsername(session.username) || session;
    const rank = rankService?.getUserRank(user.username) || {
      id: 'MEMBER',
      name: 'Üye',
      badge: '🌱'
    };
    const cosMeta = getUserCosmeticMeta(user);
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
    if (hName) {
      hName.textContent = user.username;
      hName.className = `user-chip-name ${cosMeta.nameClass}`.trim();
      hName.style.cssText = cosMeta.nameCssText || '';
    }

    const hRole = document.getElementById('header-user-role');
    if (hRole) {
      hRole.className = getRankBadgeClass(rank.id);
      hRole.innerHTML = `${mcIcon(rank.id, 14)} ${escapeHtml(rank.name)}`;
    }

    const hAvatar = document.getElementById('header-user-avatar');
    if (hAvatar) {
      hAvatar.className = `header-avatar ${cosMeta.frameClass}`.trim();
      setAvatarImageWithFallback(hAvatar, user);
    }

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
    const dAvatar = document.getElementById('drawer-user-avatar');
    if (dAvatar) {
      dAvatar.className = `drawer-avatar ${cosMeta.frameClass}`.trim();
      setAvatarImageWithFallback(dAvatar, user);
    }

    const dHeader = document.querySelector('.drawer-header');
    if (dHeader) {
      dHeader.className = `drawer-header ${cosMeta.effectClass}`.trim();
    }

    const dName = document.getElementById('drawer-user-name');
    if (dName) {
      dName.textContent = user.username;
      dName.className = cosMeta.nameClass || '';
      dName.style.cssText = cosMeta.nameCssText || '';
    }

    const dRank = document.getElementById('drawer-user-rank');
    if (dRank) {
      dRank.className = getRankBadgeClass(rank.id);
      dRank.innerHTML = `${mcIcon(rank.id, 14)} ${escapeHtml(rank.name)}`;
    }

    const dMcName = document.getElementById('drawer-user-mcname');
    if (dMcName) {
      if (user.minecraftPlayerName) {
        dMcName.innerHTML = `${mcIcon('GRASS', 12)} MC: ${escapeHtml(user.minecraftPlayerName)}`;
        dMcName.classList.remove('hidden');
      } else {
        dMcName.classList.add('hidden');
      }
    }

    const dEmerald = document.getElementById('drawer-emerald-count');
    if (dEmerald) dEmerald.textContent = emeralds.toLocaleString('tr-TR');

    const dNetherite = document.getElementById('drawer-netherite-count');
    if (dNetherite) dNetherite.textContent = netherites.toLocaleString('tr-TR');

    // Admin butonu görünürlüğü (Yalnızca codingdevelopia@gmail.com)
    const sessionEmail = String(session.email || '').trim().toLowerCase();
    const isAdmin = Boolean(
      (session.isAdminSession || rank.id === 'ADMIN') && sessionEmail === 'codingdevelopia@gmail.com'
    );
    if (drawerAdminBtn) drawerAdminBtn.classList.toggle('hidden', !isAdmin);

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
    if (stLives) stLives.innerHTML = `${extraLives} / 5 ${mcIcon('HEART', 16)}`;

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
    const emSvg = mcIcon('EMERALD', 16);
    const neSvg = mcIcon('NETHERITE', 16);

    // 1. Ana Sayfa Günlük Ödül Kutusu
    const wTitle = document.getElementById('welcome-netherite-title');
    const wDesc = document.getElementById('welcome-netherite-desc');
    const wBtn = document.getElementById('btn-welcome-claim-netherite');

    if (wTitle && wDesc && wBtn) {
      if (status.canClaimNow) {
        if (hasNetherite) {
          wTitle.innerHTML = `${neSvg} ${escapeHtml(status.rankName)} Günlük Ödülünüz Hazır!`;
          wDesc.innerHTML = `Bugünkü +${dailyNe} ${neSvg} Netherite ve +${dailyEm} ${emSvg} Zümrüt ödülünüzü hemen talep edebilirsiniz!`;
          wBtn.innerHTML = `+${dailyNe} ${neSvg} &amp; +${dailyEm} ${emSvg} Al`;
        } else {
          wTitle.innerHTML = `${emSvg} ${escapeHtml(status.rankName)} Günlük Zümrüt Ödülünüz Hazır!`;
          wDesc.innerHTML = `Bugünkü +${dailyEm} ${emSvg} Zümrüt ödülünüzü hemen alın! (VIP ilk alımda +50 ${neSvg}, VIP+ ve üzeri ilk alımda +250 ${neSvg} ve günlük +25/50/100 ${neSvg} kazanır)`;
          wBtn.innerHTML = `+${dailyEm} ${emSvg} Zümrüt Al`;
        }
        wBtn.disabled = false;
        wBtn.dataset.actionMode = 'claim';
      } else {
        wTitle.innerHTML = hasNetherite
          ? `${neSvg} ${escapeHtml(status.rankName)} Günlük Ödülü Alındı`
          : `${emSvg} ${escapeHtml(status.rankName)} Günlük Zümrüt Ödülü Alındı`;
        wDesc.innerHTML = hasNetherite
          ? `Yeni +${dailyNe} ${neSvg} Netherite ve +${dailyEm} ${emSvg} Zümrüt ödülü için kalan süre: ${escapeHtml(status.remainingText)}`
          : `Yeni +${dailyEm} ${emSvg} Zümrüt ödülü için kalan süre: ${escapeHtml(status.remainingText)} (VIP+ ile günlük +25 ${neSvg} kazanın!)`;
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
          sText.innerHTML = `${escapeHtml(status.rankName)} ayrıcalığınızla +${dailyNe} ${neSvg} Netherite ve +${dailyEm} ${emSvg} Zümrüt ödülünüz hazır!`;
          sBtn.innerHTML = `+${dailyNe} ${neSvg} &amp; +${dailyEm} ${emSvg} Al`;
        } else {
          sText.innerHTML = `${escapeHtml(status.rankName)} günlük +${dailyEm} ${emSvg} Zümrüt ödülünüz hazır! (VIP ilk alımda +50 ${neSvg}, en az VIP+ ilk alımda +250 ${neSvg} + günlük +25/50/100 ${neSvg} verir)`;
          sBtn.innerHTML = `+${dailyEm} ${emSvg} Zümrüt Al`;
        }
        sBtn.disabled = false;
        sBtn.dataset.actionMode = 'claim';
      } else {
        sText.innerHTML = hasNetherite
          ? `Sonraki +${dailyNe} ${neSvg} Netherite &amp; +${dailyEm} ${emSvg} Zümrüt ödülüne kalan süre: ${escapeHtml(status.remainingText)}`
          : `Sonraki +${dailyEm} ${emSvg} Zümrüt ödülüne kalan süre: ${escapeHtml(status.remainingText)}`;
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
        pStatus.innerHTML = hasNetherite
          ? `+${dailyNe} ${neSvg} Netherite ve +${dailyEm} ${emSvg} Zümrüt hemen alınabilir!`
          : `+${dailyEm} ${emSvg} Günlük Zümrüt hemen alınabilir!`;
        pBtn.innerHTML = hasNetherite
          ? `+${dailyNe} ${neSvg} &amp; +${dailyEm} ${emSvg} Al`
          : `+${dailyEm} ${emSvg} Zümrüt Al`;
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

    // Admin ekranı güvenlik kontrolü (Yalnızca codingdevelopia@gmail.com)
    if (screenKey === 'admin') {
      const email = String(session.email || '').trim().toLowerCase();
      const rankId = svc().authGuard?.getEffectiveRankId(session);
      const isVerifiedAdmin = Boolean(
        (session.isAdminSession || rankId === 'ADMIN') && email === 'codingdevelopia@gmail.com'
      );
      if (!isVerifiedAdmin) {
        showToast('Yönetici paneline yalnızca yetkili yönetici (codingdevelopia@gmail.com) erişebilir!', 'error');
        navigateToScreen('welcome');
        return;
      }
    }

    // Faz 6: BAKIM MODU KONTROLÜ
    // Kalıcı bayrak PLATFORM_SETTINGS altında tutulur.
    // Yalnızca ADMIN (codingdevelopia@gmail.com) ve MODERATOR rolleri hariç tüm kullanıcılar tam ekran bloklanır.
    const maintenanceStatus = svc().maintenanceService?.getMaintenanceStatus?.() || { enabled: false };
    const maintenanceOverlay = document.getElementById('maintenance-overlay');
    const sessionEmail = String(session.email || '').trim().toLowerCase();
    const isMaintenanceExempt = Boolean(
      (session.isAdminSession || session.role === 'ADMIN' || session.rank === 'ADMIN') &&
      sessionEmail === 'codingdevelopia@gmail.com'
    ) || Boolean(session.isModerator || session.role === 'MODERATOR' || session.rank === 'MODERATOR');

    if (maintenanceStatus.enabled && !isMaintenanceExempt) {
      if (maintenanceOverlay) {
        maintenanceOverlay.classList.remove('hidden');
        const descEl = document.getElementById('maintenance-desc-text');
        if (descEl && maintenanceStatus.message) {
          descEl.textContent = maintenanceStatus.message;
        }
      }
      return;
    } else {
      if (maintenanceOverlay) {
        maintenanceOverlay.classList.add('hidden');
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

    if (screenKey === 'game') {
      document.body.classList.add('screen-game-active');
    } else {
      document.body.classList.remove('screen-game-active');
    }

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

    // Bulut senkronizasyonu: farklı bilgisayarlardaki profilleri, partileri ve liderlik tablosunu anında çek
    if (
      ['profile', 'party', 'leaderboard', 'notifications', 'admin', 'stats'].includes(screenKey)
    ) {
      try {
        svc().cloudSyncService?.syncNow();
      } catch (e) {
        // ignore
      }
    }

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
    const loginTabBtn = document.getElementById('tab-btn-login');
    if (loginTabBtn) loginTabBtn.click();
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

    const user =
      (userService?.ensureSessionUser
        ? userService.ensureSessionUser(session)
        : userService?.getUserByUsername(session.username)) || session;
    if (!user || !user.username) return;

    const rank = rankService.getUserRank(user.username);
    const emeralds = economyService.getBalance(user.username);
    const netherites = netheriteService.getBalance(user.username);

    setAvatarImageWithFallback(document.getElementById('profile-avatar-img'), user);

    // Kozmetik çerçeve, efektler, ad rengi ve rozet (TÜM KOZMETİKLER AKTİF)
    const cosMeta = getUserCosmeticMeta(user);
    const frameWrap = document.getElementById('profile-avatar-frame');
    const heroCard = document.getElementById('profile-hero-card');
    const allItems = shopService.getAllItems(true);
    const equipped = user.equippedCosmetics || {};

    if (frameWrap) {
      frameWrap.className = 'profile-avatar-wrapper';
      if (cosMeta.frameClass) frameWrap.classList.add(cosMeta.frameClass);
    }

    if (heroCard) {
      heroCard.className = 'platform-card profile-hero-card';
      if (cosMeta.effectClass) heroCard.classList.add(cosMeta.effectClass);
    }

    const uNameEl = document.getElementById('profile-username-display');
    if (uNameEl) {
      uNameEl.textContent = user.username;
      uNameEl.className = cosMeta.nameClass || '';
      uNameEl.style.color = cosMeta.nameColor || '';
    }

    const rBadge = document.getElementById('profile-rank-badge');
    if (rBadge) {
      rBadge.className = getRankBadgeClass(rank.id);
      rBadge.innerHTML = `${mcIcon(rank.badge, 14)} ${escapeHtml(rank.name)}`;
    }

    const emailValEl = document.getElementById('profile-email-val');
    if (emailValEl) {
      emailValEl.textContent = user.email || 'Belirtilmedi';
    }

    const verifiedTagEl = document.getElementById('profile-email-verified-tag');
    if (verifiedTagEl) {
      verifiedTagEl.textContent = user.emailVerified ? '✓ Doğrulandı' : '⚠️ Doğrulanmadı';
      verifiedTagEl.className = user.emailVerified ? 'role-badge role-member' : 'role-badge role-muted';
    }

    const usernameInputEl = document.getElementById('profile-username-input');
    if (usernameInputEl) {
      usernameInputEl.value = user.username || '';
    }

    const mcDisplay = document.getElementById('profile-mc-player-display');
    if (mcDisplay) {
      mcDisplay.innerHTML = user.minecraftPlayerName
        ? `${mcIcon('GRASS', 14)} Bağlı Minecraft Oyuncu Adı: <strong>${escapeHtml(user.minecraftPlayerName)}</strong>`
        : `${mcIcon('GRASS', 14)} Bağlı Minecraft Oyuncu Adı: Belirtilmedi`;
    }

    const mcInput = document.getElementById('profile-mcname-input');
    if (mcInput) mcInput.value = user.minecraftPlayerName || '';

    const customBadgeEl = document.getElementById('profile-custom-badge');
    if (customBadgeEl) {
      if (cosMeta.badgeText) {
        customBadgeEl.className = 'custom-cosmetic-badge-pill';
        customBadgeEl.innerHTML = replaceEmojis(escapeHtml(cosMeta.badgeText), 14);
      } else {
        customBadgeEl.className = '';
        customBadgeEl.innerHTML = '';
      }
    }

    const createdEl = document.getElementById('profile-created-at');
    if (createdEl) createdEl.textContent = formatDateTR(user.createdAt);

    const pEm = document.getElementById('profile-emerald-balance');
    if (pEm) pEm.innerHTML = `${emeralds.toLocaleString('tr-TR')} ${mcIcon('EMERALD', 16)}`;

    const pNe = document.getElementById('profile-netherite-balance');
    if (pNe) pNe.innerHTML = `${netherites.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 16)}`;

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
        const subCatMap = {
          'Avatar Frames': 'Avatar Çerçevesi',
          'Name Colors': 'İsim Rengi',
          'Badges': 'Özel Rozet',
          'Profile Effects': 'Profil Efekti'
        };
        cosContainer.innerHTML = ownedIds
          .map(id => {
            const item = allItems.find(i => i.id === id);
            if (!item) return '';
            const isEquipped = Object.values(equipped).includes(item.id);
            const subLabel = subCatMap[item.subCategory] || item.subCategory || 'Kozmetik';
            return `
              <div class="cosmetic-inv-card ${isEquipped ? 'equipped' : ''}">
                <span class="cos-icon">${mcIcon(item.id || item.icon, 26)}</span>
                <div class="cos-info">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span>${escapeHtml(subLabel)} ${isEquipped ? '• ✓ Kuşanıldı' : ''}</span>
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
            <span class="ach-icon">${mcIcon(a.icon, 26)}</span>
            <div class="ach-meta">
              <strong>${escapeHtml(a.title)}</strong>
              <p>${escapeHtml(a.description)}</p>
              <span class="ach-reward">+${a.emeraldReward} ${mcIcon('EMERALD', 14)} Ödül</span>
            </div>
            <span class="ach-status">${a.unlocked ? '✓ Kazanıldı' : 'Kilitli'}</span>
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
            const unitHtml =
              tx.currency === 'NETHERITE'
                ? `${mcIcon('NETHERITE', 14)} Netherite`
                : `${mcIcon('EMERALD', 14)} Zümrüt`;
            return `
              <div class="tx-row">
                <div>
                  <strong>${escapeHtml(tx.reason)}</strong>
                  <span class="tx-date">${formatDateTR(tx.createdAt)}</span>
                </div>
                <span class="tx-amount ${isPos ? 'pos' : 'neg'}">
                  ${isPos ? '+' : ''}${tx.amount} ${unitHtml}
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
        const invStatus = invObj
          ? invObj.status
          : n.meta?.invitationStatus || n.meta?.inviteStatus || 'PENDING';

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
            partyActionHtml = `<span class="notif-read-label">✓ Kabul Edildi</span>`;
          } else if (invStatus === 'REJECTED') {
            partyActionHtml = `<span class="notif-read-label">✗ Reddedildi</span>`;
          }
        } else if (partyCode) {
          partyActionHtml = `<button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-notif-join-party="${escapeHtml(
            partyCode
          )}">${mcIcon('SWORD', 14)} Partiye Katıl (${escapeHtml(partyCode)})</button>`;
        }

        return `
          <div class="notification-card ${n.read ? 'is-read' : 'is-unread'}">
            <div class="notif-card-icon">${mcIcon(n.icon || 'STAR', 22)}</div>
            <div class="notif-card-body">
              <div class="notif-card-top">
                <span class="notif-type-tag">${escapeHtml(n.typeLabel || 'Bildirim')}</span>
                <span class="notif-time">${formatDateTR(n.createdAt)}</span>
              </div>
              <h4 class="notif-title">${replaceEmojis(escapeHtml(n.title), 15)}</h4>
              <p class="notif-message">${replaceEmojis(escapeHtml(n.message), 14)}</p>
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
      extraLifeService
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

    const purchasableRanks = svc().rankService.getPurchasableRanks(); // VIP, VIP+, MVIP, MVIP+ ve özel rütbeler
    container.innerHTML = purchasableRanks
      .map(rank => {
        const isOwnedOrHigher = userRank.order >= rank.order;
        const isCurrent = userRank.id === rank.id;
        const nPrice = Math.max(500, Number(rank.netheritePrice || 500));
        const dailyNetheriteText =
          rank.id === 'VIP'
            ? `<div class="rank-daily-netherite-pill">${mcIcon('NETHERITE', 14)} İlk Alımda +50 ${mcIcon('NETHERITE', 14)} &bull; Günlük +${rank.dailyEmerald || 100} ${mcIcon('EMERALD', 14)}</div>`
            : rank.dailyNetherite > 0
            ? `<div class="rank-daily-netherite-pill">${mcIcon('NETHERITE', 14)} İlk Alımda +250 ${mcIcon('NETHERITE', 14)} • Günlük +${rank.dailyNetherite} ${mcIcon('NETHERITE', 14)} &amp; +${rank.dailyEmerald || 200} ${mcIcon('EMERALD', 14)}</div>`
            : `<div class="rank-daily-netherite-pill muted">${mcIcon('EMERALD', 14)} Günlük +${rank.dailyEmerald || 50} Zümrüt Ödülü</div>`;

        return `
          <div class="rank-card" style="border-top: 4px solid ${escapeHtml(rank.color)};">
            <div class="rank-card-header">
              <span class="rank-card-badge" style="color: ${escapeHtml(rank.color)}">${mcIcon(
          rank.badge || rank.id,
          18
        )} ${escapeHtml(rank.name)}</span>
              ${isCurrent ? `<span class="rank-current-tag">MEVCUT RÜTBENİZ</span>` : ''}
            </div>

            ${dailyNetheriteText}

            <div class="rank-pricing-box">
              <div class="rank-price-main">${nPrice.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 18)} Netherite</div>
              <div class="rank-price-sub">Yalnızca Netherite Bakiyesi ile satın alınır (En az 500 ${mcIcon('NETHERITE', 13)})</div>
            </div>

            <ul class="rank-features-list">
              ${(rank.features || []).map(f => `<li>✓ ${replaceEmojis(escapeHtml(f), 14)}</li>`).join('')}
            </ul>

            <div class="rank-card-actions">
              ${
                isOwnedOrHigher
                  ? `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>✓ Bu Rütbeye Sahipsiniz</button>`
                  : `
                    <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-rank="${escapeHtml(
                      rank.id
                    )}" data-pay-method="NETHERITE">
                      ${mcIcon('NETHERITE', 15)} ${nPrice.toLocaleString('tr-TR')} Netherite ile Satın Al
                    </button>
                    <button type="button" class="mc-btn mc-btn-secondary mc-btn-block" data-shop-cat="Netherite">
                      💳 Netherite Bakiye Yükle
                    </button>
                  `
              }
              <!-- #11: Arkadaşına Hediye Et Butonu (Sadece Netherite ile) -->
              <button type="button" class="mc-btn mc-btn-gift mc-btn-block" data-gift-rank="${escapeHtml(
                rank.id
              )}">
                🎁 Arkadaşına Hediye Et (${nPrice.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 13)})
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

    const { shopService, rankService, avatarService } = svc();
    const items = shopService.getItemsByCategory(category);
    const ownedCosmetics = Array.isArray(user.ownedCosmetics) ? user.ownedCosmetics : [];
    const equipped = user.equippedCosmetics || {};
    const avatarSrc = avatarService ? avatarService.getAvatarForUser(user) : '';
    const fallbackAvatarSrc = avatarService
      ? avatarService.generatePixelAvatarDataUrl(user.username || 'Steve')
      : '';

    const catTagMap = {
      'Avatar Frames': 'Avatar Çerçevesi',
      'Avatar Çerçevesi': 'Avatar Çerçevesi',
      'Name Colors': 'İsim Rengi',
      'Ad Rengi': 'İsim Rengi',
      'İsim Rengi': 'İsim Rengi',
      'Badges': 'Özel Rozet',
      'Özel Rozet': 'Özel Rozet',
      'Profile Effects': 'Profil Efekti',
      'Profil Efekti': 'Profil Efekti',
      'Special': 'Özel Ürün',
      'Netherite': 'Netherite Bakiye Paketi',
      'Netherite Bakiye': 'Netherite Bakiye Paketi',
      'Emeralds': 'Zümrüt Bakiye Paketi',
      'Zümrüt Bakiye': 'Zümrüt Bakiye Paketi',
      'Cosmetics': 'Kozmetik'
    };

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
        const isEquipped = Object.values(equipped).includes(item.id);
        const rawSub = String(item.subCategory || item.category || '').trim();
        const displayCatTag = catTagMap[rawSub] || catTagMap[item.category] || rawSub;

        // Bakiye Paketleri Önizleme Etiketi (Kart ile Bakiye Satın Alma)
        let balanceGrantPillHtml = '';
        if (Number(item.grantNetherite || 0) > 0) {
          balanceGrantPillHtml = `
            <div class="rank-daily-netherite-pill" style="margin-bottom:10px;">
              ${mcIcon('NETHERITE', 16)} <strong>+${Number(item.grantNetherite).toLocaleString('tr-TR')} Netherite Bakiye</strong> (Kart ile Bakiye Yükleme)
            </div>
          `;
        } else if (Number(item.grantEmerald || 0) > 0 && item.currency === 'STRIPE') {
          balanceGrantPillHtml = `
            <div class="rank-daily-netherite-pill muted" style="margin-bottom:10px;">
              ${mcIcon('EMERALD', 16)} <strong>+${Number(item.grantEmerald).toLocaleString('tr-TR')} Zümrüt Bakiye</strong> (Kart ile Bakiye Yükleme)
            </div>
          `;
        }

        // Kozmetik Canlı Önizleme Kutusu
        let previewHtml = '';
        if (item.category === 'Cosmetics') {
          const cssVal = item.cssValue || '';
          const isFrame =
            rawSub === 'Avatar Frames' ||
            rawSub === 'Avatar Çerçevesi' ||
            String(item.id || '').startsWith('FRAME_');
          const isEffect =
            rawSub === 'Profile Effects' ||
            rawSub === 'Profil Efekti' ||
            String(item.id || '').startsWith('EFFECT_');
          const isColor =
            rawSub === 'Name Colors' ||
            rawSub === 'Ad Rengi' ||
            rawSub === 'İsim Rengi' ||
            String(item.id || '').startsWith('NAME_COLOR_');
          const isBadge = !isFrame && !isEffect && !isColor;

          const previewFrameClass = isFrame ? cssVal : '';
          const previewEffectClass = isEffect ? cssVal : '';
          const previewNameClass =
            isColor && cssVal === 'rgb-rainbow'
              ? 'rgb-rainbow-text'
              : isColor && cssVal === '#fbbf24'
              ? 'name-color-gold'
              : '';
          const previewInlineColor =
            isColor && cssVal && cssVal !== 'rgb-rainbow' ? `color:${escapeHtml(cssVal)};` : '';
          const previewBadgeHtml = isBadge
            ? `<span class="custom-cosmetic-badge-pill">${mcIcon(item.id || item.icon, 13)} ${replaceEmojis(
                escapeHtml(String(cssVal || item.name).replace(/^[🧨⚡💎👑🔥🌟🐉🌱⛏️🏆🛡️]\s*/u, '')),
                12
              )}</span>`
            : '';

          previewHtml = `
            <div class="cosmetic-live-preview ${escapeHtml(previewEffectClass)}">
              <div class="cosmetic-preview-avatar ${escapeHtml(previewFrameClass)}">
                <img src="${escapeHtml(avatarSrc)}" onerror="this.onerror=null;this.src='${escapeHtml(
            fallbackAvatarSrc
          )}';" alt="" />
              </div>
              <div class="cosmetic-preview-info">
                <strong class="cosmetic-preview-username ${escapeHtml(
                  previewNameClass
                )}" style="font-size:0.86rem;${previewInlineColor}">${escapeHtml(user.username)}</strong>
                ${previewBadgeHtml || `<span class="cosmetic-preview-sub">Canlı Önizleme</span>`}
              </div>
            </div>
          `;
        }

        let actionButtonsHtml = '';
        if (alreadyOwned) {
          actionButtonsHtml = `
            <button type="button" class="mc-btn ${
              isEquipped ? 'mc-btn-secondary' : 'mc-btn-primary'
            } mc-btn-block" data-equip-cosmetic="${escapeHtml(item.id)}">
              ${isEquipped ? '✓ Kuşanıldı (Çıkarmak İçin Tıkla)' : '✨ Hemen Kuşan'}
            </button>
          `;
        } else if (rankLocked) {
          actionButtonsHtml = `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>🔒 ${escapeHtml(
            reqRank.name
          )} Rütbesi Gerekli</button>`;
        } else if (item.currency === 'STRIPE') {
          actionButtonsHtml = `
            <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
              item.id
            )}" data-item-currency="STRIPE">
              💳 Kart ile Bakiye Satın Al (${Number(item.priceTry || item.price).toLocaleString('tr-TR')} ₺)
            </button>
          `;
        } else if (item.currency === 'NETHERITE') {
          const nPrice = Number(item.netheritePrice || item.price);
          const ePrice = Number(item.emeraldPrice || 0);
          actionButtonsHtml = `
            <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
              item.id
            )}" data-item-currency="NETHERITE">
              ${mcIcon('NETHERITE', 15)} ${nPrice.toLocaleString('tr-TR')} Netherite ile Satın Al
            </button>
            ${
              ePrice > 0
                ? `<button type="button" class="mc-btn mc-btn-primary mc-btn-block" data-buy-item="${escapeHtml(
                    item.id
                  )}" data-item-currency="EMERALD">
                    ${mcIcon('EMERALD', 15)} ${ePrice.toLocaleString('tr-TR')} Zümrüt ile Satın Al
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
              ${mcIcon('EMERALD', 15)} ${ePrice.toLocaleString('tr-TR')} Zümrüt ile Satın Al
            </button>
            ${
              nPrice > 0
                ? `<button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-buy-item="${escapeHtml(
                    item.id
                  )}" data-item-currency="NETHERITE">
                    ${mcIcon('NETHERITE', 15)} ${nPrice.toLocaleString('tr-TR')} Netherite ile Satın Al
                  </button>`
                : ''
            }
          `;
        }

        return `
          <div class="shop-item-card">
            <div class="shop-item-top">
              <span class="shop-item-icon">${mcIcon(item.id || item.icon, 28)}</span>
              <span class="shop-item-cat-tag">${escapeHtml(displayCatTag)}</span>
            </div>
            <h4 class="shop-item-title">${escapeHtml(item.name)}</h4>
            <p class="shop-item-desc">${escapeHtml(item.description)}</p>
            ${balanceGrantPillHtml}
            ${previewHtml}
            <div class="shop-item-actions">
              ${actionButtonsHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ==========================================
  // #11: "🎁 ARKADAŞINA HEDİYE ET" MODAL AKIŞI (Sadece Netherite ile)
  // ==========================================
  function openGiftRankModal(rankId, prefillFriendUsername = '') {
    const { rankService } = svc();
    const rank = rankService.getRankById(rankId) || rankService.getRankById('VIP');
    if (!rank || !rank.purchasable) return;

    state.giftModal.rankId = rank.id;
    state.giftModal.friendUsername = prefillFriendUsername || '';

    const modal = document.getElementById('modal-gift-rank');
    const summaryBox = document.getElementById('gift-rank-summary-box');
    const input = document.getElementById('gift-friend-username-input');
    const step1 = document.getElementById('gift-step-1');
    const step2 = document.getElementById('gift-step-2');
    const err1 = document.getElementById('gift-step1-error');
    const err2 = document.getElementById('gift-step2-error');
    const nPrice = Math.max(500, Number(rank.netheritePrice || 500));

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="gift-rank-pill" style="border-left: 4px solid ${escapeHtml(rank.color)}">
          <strong>${mcIcon(rank.badge || rank.id, 16)} ${escapeHtml(rank.name)} Rütbesi Hediye Paketi</strong>
          <span>Yalnızca ${nPrice.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 14)} Netherite ile hediye edilir</span>
        </div>
      `;
    }

    if (input) input.value = prefillFriendUsername || '';
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

  // ==========================================
  // OYUNCU PROFİL KARTI MODALI (Liderlik, Parti, Admin ve Önerilerden Tıklanabilir)
  // ==========================================
  function openPlayerProfileModal(username, _isRetry = false) {
    if (!username) return;
    const session = getSession();
    const {
      userService,
      rankService,
      economyService,
      netheriteService,
      achievementService
    } = svc();

    const modal = document.getElementById('modal-player-profile');
    if (!modal) return;

    const modalBody = document.getElementById('modal-player-profile-body');
    if (modalBody && !document.getElementById('modal-player-profile-hero')) {
      modalBody.innerHTML = `
        <div class="profile-hero-card" id="modal-player-profile-hero" style="margin-bottom: 12px;">
          <div class="profile-avatar-wrapper" id="modal-player-profile-frame">
            <img id="modal-player-profile-avatar" src="" alt="Oyuncu Avatarı" class="profile-avatar-lg" />
          </div>
          <div class="profile-identity-info">
            <div class="profile-name-row">
              <h3 id="modal-player-profile-username">Oyuncu</h3>
              <span id="modal-player-profile-rank" class="role-badge role-member">Üye</span>
              <span id="modal-player-profile-badge"></span>
            </div>
            <p class="profile-mc-sub" id="modal-player-profile-mcname">Minecraft Hesabı: -</p>
            <p class="profile-joined-sub" id="modal-player-profile-joined">Katılım Tarihi: -</p>
          </div>
        </div>
        <div id="modal-player-profile-drive-alert"></div>
        <div class="stats-kpi-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
          <div class="stat-kpi-card">
            <span class="kpi-label">TOPLAM PUAN</span>
            <strong class="kpi-val gold-text" id="modal-player-profile-points">₺0</strong>
          </div>
          <div class="stat-kpi-card">
            <span class="kpi-label">KAZANILAN / OYNANAN</span>
            <strong class="kpi-val" id="modal-player-profile-wins">0 / 0</strong>
          </div>
          <div class="stat-kpi-card">
            <span class="kpi-label">ZÜMRÜT BAKİYESİ</span>
            <strong class="kpi-val emerald-text" id="modal-player-profile-emeralds">0</strong>
          </div>
          <div class="stat-kpi-card">
            <span class="kpi-label">NETHERITE BAKİYESİ</span>
            <strong class="kpi-val netherite-text" id="modal-player-profile-netherite">0</strong>
          </div>
        </div>
        <div class="mc-card" style="padding: 12px; margin-bottom: 16px;">
          <h4 style="margin-bottom: 8px; font-size: 0.9rem;">🏆 Açılan Başarım Rozetleri</h4>
          <div id="modal-player-profile-achievements" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
        </div>
        <div class="modal-actions-row" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
          <button type="button" id="btn-modal-invite-to-party" class="mc-btn mc-btn-primary mc-btn-sm">⚔️ Partiye Davet Et</button>
          <button type="button" id="btn-modal-gift-rank-player" class="mc-btn mc-btn-gold mc-btn-sm">🎁 Rütbe Hediye Et</button>
          <button type="button" id="btn-close-player-profile-footer" class="mc-btn mc-btn-secondary mc-btn-sm">Kapat</button>
        </div>
      `;
    }

    const isSelf = Boolean(
      session && session.username && session.username.toLowerCase() === String(username).toLowerCase()
    );

    let user = userService?.getUserPublicProfile
      ? userService.getUserPublicProfile(username, session)
      : userService?.getUserByUsername(username);

    if (!user) {
      if (!_isRetry && svc().cloudSyncService?.syncNow) {
        svc()
          .cloudSyncService.syncNow()
          .then(() => {
            if (!modal.classList.contains('hidden') && userService?.getUserByUsername(username)) {
              openPlayerProfileModal(username, true);
            }
          })
          .catch(() => {});
      }
      user = userService?.getUserPublicProfile
        ? userService.getUserPublicProfile(username, session)
        : null;
      if (!user) {
        user = {
          username: String(username).trim(),
          rank: 'MEMBER',
          emeraldBalance: 100,
          netheriteBalance: 0,
          points: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          createdAt: new Date().toISOString(),
          _isRestricted: false
        };
      }
    }

    const isRestricted = Boolean(user._isRestricted);
    const alertEl = document.getElementById('modal-player-profile-drive-alert');
    if (alertEl) {
      if (isRestricted) {
        alertEl.innerHTML = `
          <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:0.85rem; color:#fca5a5; display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">🔒</span>
            <span>Bu oyuncu Google Drive izin onayını henüz vermediği için ayrıntılı bakiye, puan ve başarım verileri gizlenmiştir.</span>
          </div>
        `;
      } else if (isSelf && !session.drivePermissionGranted) {
        alertEl.innerHTML = `
          <div style="background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); border-radius:8px; padding:12px; margin-bottom:14px;">
            <p style="margin:0 0 8px 0; font-size:0.85rem; color:#93c5fd;">
              ℹ️ Google Drive izniniz henüz verilmedi. Profil verilerinizin liderlik tablosunda herkese açık görünmesi ve buluta senkronize olması için Drive izni verin.
            </p>
            <button type="button" id="btn-modal-grant-drive" class="mc-btn mc-btn-primary mc-btn-sm" style="width:100%;">
              🔄 Google Drive İzni Ver / Tam Profili Aç
            </button>
          </div>
        `;
        const grantBtn = document.getElementById('btn-modal-grant-drive');
        if (grantBtn) {
          grantBtn.onclick = async () => {
            try {
              grantBtn.disabled = true;
              grantBtn.textContent = 'Drive İzni Alınıyor...';
              await svc().authService.refreshDrivePermission();
              showToast('Google Drive izni başarıyla verildi!', 'success');
              openPlayerProfileModal(session.username);
              if (state.currentScreen === 'leaderboard') renderLeaderboard();
            } catch (err) {
              showToast(err.message || 'Drive izni alınamadı.', 'error');
              grantBtn.disabled = false;
              grantBtn.textContent = '🔄 Google Drive İzni Ver / Tam Profili Aç';
            }
          };
        }
      } else if (user.drivePermissionGranted) {
        alertEl.innerHTML = `
          <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:6px; padding:6px 12px; margin-bottom:12px; font-size:0.8rem; color:#86efac; display:inline-flex; align-items:center; gap:6px;">
            <span>✓</span> <span>Google Drive Senkronizasyonu Doğrulandı</span>
          </div>
        `;
      } else {
        alertEl.innerHTML = '';
      }
    }

    const rank = rankService.getUserRank(user.username);
    const cosMeta = getUserCosmeticMeta(user);
    const emeralds = isRestricted
      ? null
      : Number(user.emeraldBalance ?? economyService?.getBalance(user.username) ?? 0);
    const netherites = isRestricted
      ? null
      : Number(user.netheriteBalance ?? netheriteService?.getBalance(user.username) ?? 0);

    const heroEl = document.getElementById('modal-player-profile-hero');
    if (heroEl) {
      heroEl.className = 'profile-hero-card';
      if (cosMeta.effectClass) heroEl.classList.add(cosMeta.effectClass);
    }

    const frameEl = document.getElementById('modal-player-profile-frame');
    if (frameEl) {
      frameEl.className = 'profile-avatar-wrapper';
      if (cosMeta.frameClass) frameEl.classList.add(cosMeta.frameClass);
    }

    setAvatarImageWithFallback(document.getElementById('modal-player-profile-avatar'), user);

    const uNameEl = document.getElementById('modal-player-profile-username');
    if (uNameEl) {
      uNameEl.textContent = user.username;
      uNameEl.className = cosMeta.nameClass || '';
      uNameEl.style.color = cosMeta.nameColor || '';
    }

    const rankEl = document.getElementById('modal-player-profile-rank');
    if (rankEl) {
      rankEl.className = getRankBadgeClass(rank.id);
      rankEl.innerHTML = `${mcIcon(rank.badge, 14)} ${escapeHtml(rank.name)}`;
    }

    const badgeEl = document.getElementById('modal-player-profile-badge');
    if (badgeEl) {
      if (cosMeta.badgeText) {
        badgeEl.className = 'custom-cosmetic-badge-pill';
        badgeEl.innerHTML = replaceEmojis(escapeHtml(cosMeta.badgeText), 13);
      } else {
        badgeEl.className = '';
        badgeEl.innerHTML = '';
      }
    }

    const mcEl = document.getElementById('modal-player-profile-mcname');
    if (mcEl) {
      mcEl.innerHTML = user.minecraftPlayerName
        ? `${mcIcon('GRASS', 14)} Minecraft Hesabı: <strong>${escapeHtml(user.minecraftPlayerName)}</strong>`
        : `${mcIcon('GRASS', 14)} Minecraft Hesabı: <strong>${escapeHtml(user.username)}</strong>`;
    }

    const joinedEl = document.getElementById('modal-player-profile-joined');
    if (joinedEl) {
      joinedEl.textContent = `Katılım Tarihi: ${formatDateTR(user.createdAt)}`;
    }

    const ptsEl = document.getElementById('modal-player-profile-points');
    if (ptsEl) {
      ptsEl.innerHTML = isRestricted
        ? `<span style="color:#94a3b8;font-size:0.95rem;">🔒 Gizli</span>`
        : formatCurrencyTRY(user.points || user.bestScore || 0);
    }

    const winsEl = document.getElementById('modal-player-profile-wins');
    if (winsEl) {
      winsEl.innerHTML = isRestricted
        ? `<span style="color:#94a3b8;font-size:0.95rem;">🔒 Gizli</span>`
        : `${Number(user.gamesWon || 0)} / ${Number(user.gamesPlayed || 0)}`;
    }

    const emEl = document.getElementById('modal-player-profile-emeralds');
    if (emEl) {
      emEl.innerHTML = isRestricted
        ? `<span style="color:#94a3b8;font-size:0.95rem;">🔒 Gizli</span>`
        : `${emeralds.toLocaleString('tr-TR')} ${mcIcon('EMERALD', 15)}`;
    }

    const neEl = document.getElementById('modal-player-profile-netherite');
    if (neEl) {
      neEl.innerHTML = isRestricted
        ? `<span style="color:#94a3b8;font-size:0.95rem;">🔒 Gizli</span>`
        : `${netherites.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 15)}`;
    }

    const achBox = document.getElementById('modal-player-profile-achievements');
    if (achBox) {
      if (isRestricted) {
        achBox.innerHTML = `<div class="empty-state-box" style="padding:10px; color:#94a3b8;">🔒 Google Drive izni verilmediği için başarımlar gizlidir.</div>`;
      } else if (achievementService) {
        const achs = achievementService.getUserAchievements(user.username).filter(a => a.unlocked);
        if (achs.length === 0) {
          achBox.innerHTML = `<div class="empty-state-box" style="padding:10px;">Henüz kazanılmış başarım rozeti bulunmuyor.</div>`;
        } else {
          achBox.innerHTML = achs
            .map(
              a => `
              <span class="custom-cosmetic-badge-pill" style="padding:5px 10px;">
                ${mcIcon(a.icon, 14)} ${escapeHtml(a.title)}
              </span>
            `
            )
            .join('');
        }
      }
    }

    const inviteBtn = document.getElementById('btn-modal-invite-to-party');
    const giftBtn = document.getElementById('btn-modal-gift-rank-player');

    if (inviteBtn) {
      inviteBtn.setAttribute('data-modal-invite-user', user.username);
      inviteBtn.classList.toggle('hidden', Boolean(isSelf));
    }
    if (giftBtn) {
      giftBtn.setAttribute('data-modal-gift-user', user.username);
      giftBtn.classList.toggle('hidden', Boolean(isSelf));
    }

    modal.classList.remove('hidden');
  }

  function closePlayerProfileModal() {
    document.getElementById('modal-player-profile')?.classList.add('hidden');
  }

  async function proceedGiftRankStep2() {
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

    let recipient = userService.getUserByUsername(friendName);
    if (!recipient && svc().cloudSyncService?.syncNow) {
      try {
        await svc().cloudSyncService.syncNow();
        recipient = userService.getUserByUsername(friendName);
      } catch (e) {
        // ignore
      }
    }
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

    const nPrice = Math.max(500, Number(rank.netheritePrice || 500));
    const cNe = document.getElementById('gift-cost-netherite');
    if (cNe) cNe.textContent = nPrice.toLocaleString('tr-TR');

    document.getElementById('gift-step-1')?.classList.add('hidden');
    document.getElementById('gift-step-2')?.classList.remove('hidden');
  }

  function executeGiftRankPayment(paymentMethod = 'NETHERITE') {
    const session = getSession();
    if (!session) return;
    const err2 = document.getElementById('gift-step2-error');
    err2?.classList.add('hidden');

    try {
      const res = svc().shopService.giftRankToFriend(session, {
        friendUsername: state.giftModal.friendUsername,
        rankId: state.giftModal.rankId,
        paymentMethod: 'NETHERITE'
      });

      svc().cloudSyncService?.pushNow();
      closeGiftRankModal();
      showToast(
        `${res.recipientUsername} adlı arkadaşınıza ${res.rank.name} rütbesi başarıyla hediye edildi!`,
        'success'
      );
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
          .map(inv => {
            const senderName = inv.inviterUsername || inv.fromUsername || 'Bir oyuncu';
            return `
            <div class="notification-card is-unread">
              <div class="notif-card-icon">${mcIcon('SWORD', 22)}</div>
              <div class="notif-card-body">
                <div class="notif-card-top">
                  <span class="notif-type-tag">Parti Daveti</span>
                  <span class="notif-time">${formatDateTR(inv.createdAt)}</span>
                </div>
                <h4 class="notif-title">Parti Daveti</h4>
                <p class="notif-message"><strong class="clickable-player-name" data-view-profile="${escapeHtml(
                  senderName
                )}">${escapeHtml(
              senderName
            )}</strong> sizi bir partiye davet etti. (${escapeHtml(
              inv.partyName
            )} — Kod: <code>${escapeHtml(inv.partyCode)}</code>)</p>
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
          `;
          })
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
        statusEl.innerHTML =
          activeParty.status === 'IN_GAME'
            ? `${mcIcon('SWORD', 14)} MAÇ DEVAM EDİYOR`
            : `⏳ LOBİDE BEKLİYOR`;
      }
      if (countEl) {
        countEl.textContent = `${activeParty.members.length}/${activeParty.maxMembers || 8}`;
      }

      const isLeader =
        activeParty.leaderUsername.toLowerCase() === session.username.toLowerCase() ||
        session.isAdminSession;
      if (startBtn) {
        startBtn.disabled = !isLeader;
        startBtn.innerHTML = isLeader
          ? `${mcIcon('SWORD', 16)} Parti Maçını Başlat`
          : '⏳ Parti Liderinin Başlatması Bekleniyor';
      }

      // Rol toggle butonu: Yalnızca lider görür
      const roleToggleRow = document.getElementById('party-host-role-toggle-row');
      const roleToggleBtn = document.getElementById('btn-toggle-host-role');
      if (roleToggleRow) {
        if (isLeader) {
          roleToggleRow.classList.remove('hidden');
          roleToggleRow.style.display = 'flex';
        } else {
          roleToggleRow.classList.add('hidden');
          roleToggleRow.style.display = 'none';
        }
      }
      const currentHostRole = activeParty.hostRole || 'JUDGE';
      if (roleToggleBtn) {
        if (currentHostRole === 'JUDGE') {
          roleToggleBtn.innerHTML = '⚖️ Şu an Jüri Modundasın — Katılımcı Ol';
          roleToggleBtn.title = 'Katılımcı olarak maça gir';
        } else {
          roleToggleBtn.innerHTML = '🎮 Şu an Katılımcısın — Jüri Ol';
          roleToggleBtn.title = 'Jüri/hakem moduna geç (doğru cevapları görürsün)';
        }
      }

      const membersList = document.getElementById('party-members-list');
      if (membersList) {
        membersList.innerHTML = activeParty.members
          .map(m => {
            const mUser = userService?.getUserByUsername(m.username) || { username: m.username };
            const mRank = rankService.getUserRank(m.username);
            const mCos = getUserCosmeticMeta(mUser);
            const mAvatar = avatarService
              ? avatarService.getAvatarForUser(mUser)
              : '';
            const mFallback = avatarService
              ? avatarService.generatePixelAvatarDataUrl(m.username)
              : '';
            const canKick =
              isLeader && m.username.toLowerCase() !== activeParty.leaderUsername.toLowerCase();
            return `
              <div class="party-member-row ${escapeHtml(mCos.effectClass)}">
                <div class="pm-left clickable-player-trigger" data-view-profile="${escapeHtml(m.username)}" title="Profili Görüntüle">
                  <img src="${escapeHtml(mAvatar)}" onerror="this.onerror=null;this.src='${escapeHtml(
              mFallback
            )}';" class="lb-avatar ${escapeHtml(mCos.frameClass)}" alt="" />
                  <span class="${getRankBadgeClass(mRank.id)}">${mcIcon(mRank.badge, 13)} ${escapeHtml(
              mRank.name
            )}</span>
                  <strong class="clickable-player-name ${escapeHtml(mCos.nameClass)}" ${mCos.nameStyle}>${escapeHtml(m.username)}</strong>
                  ${
                    mCos.badgeText
                      ? `<span class="custom-cosmetic-badge-pill">${replaceEmojis(escapeHtml(mCos.badgeText), 12)}</span>`
                      : ''
                  }
                  ${
                    m.username.toLowerCase() === activeParty.leaderUsername.toLowerCase()
                      ? `<span class="leader-crown">${mcIcon('CROWN', 14)} Lider</span>`
                      : ''
                  }
                </div>
                <div class="pm-right">
                  <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-view-profile="${escapeHtml(
                    m.username
                  )}">👤 Profil</button>
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
                <span>Lider: <strong class="clickable-player-name" data-view-profile="${escapeHtml(
                  p.leaderUsername
                )}">${escapeHtml(p.leaderUsername)}</strong> • Oyuncular: ${p.members.length}/${
              p.maxMembers || 8
            }</span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-view-profile="${escapeHtml(
                  p.leaderUsername
                )}">👤 Lider Profili</button>
                <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-quick-join-party="${escapeHtml(
                  p.partyCode
                )}">
                  Katıl (${escapeHtml(p.partyCode)})
                </button>
              </div>
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
    const { userService, netheriteService, extraLifeService } = svc();
    const user =
      (userService?.ensureSessionUser
        ? userService.ensureSessionUser(session)
        : userService?.getUserByUsername(session.username)) || session;
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
          <span class="kpi-label">Kullanılan Zümrüt</span>
          <strong class="kpi-val">${emeraldsSpent.toLocaleString('tr-TR')} ${mcIcon('EMERALD', 16)}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Kazanılan Zümrüt</span>
          <strong class="kpi-val emerald-text">${emeraldsEarned.toLocaleString('tr-TR')} ${mcIcon('EMERALD', 16)}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Netherite</span>
          <strong class="kpi-val netherite-text">${netheriteBalance.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 16)}</strong>
        </div>
        <div class="stat-kpi-card">
          <span class="kpi-label">Ekstra Can</span>
          <strong class="kpi-val">${extraLives} / 5 ${mcIcon('HEART', 16)}</strong>
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
                <strong>${
                  m.didWin
                    ? `${mcIcon('TROPHY', 15)} Milyoner Şampiyonu`
                    : `${mcIcon('SWORD', 15)} ${m.reachedQuestion}. Soruya Ulaşıldı`
                }</strong>
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
    const { leaderboardService, avatarService, userService } = svc();
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
            ? `${mcIcon('TROPHY', 16)} 1`
            : r.position === 2
            ? `🥈 2`
            : r.position === 3
            ? `🥉 3`
            : `#${r.position}`;
        const rUser = userService?.getUserByUsername(r.username) || r;
        const rCos = getUserCosmeticMeta(rUser);
        const avatarSrc = avatarService.getAvatarForUser(rUser);
        const fallbackSrc = avatarService.generatePixelAvatarDataUrl(r.username);

        const isRestricted = Boolean(r._isRestricted);
        const ptsHtml = isRestricted
          ? `<span class="restricted-badge" style="color:#94a3b8;font-size:0.85rem;" title="Google Drive izni verilmediği için gizli">🔒 Gizli</span>`
          : `<strong class="gold-text">${formatCurrencyTRY(r.points)}</strong>`;
        const winsHtml = isRestricted ? `<span style="color:#94a3b8;">🔒</span>` : `${r.gamesWon ?? 0}`;
        const playedHtml = isRestricted ? `<span style="color:#94a3b8;">🔒</span>` : `${r.gamesPlayed ?? 0}`;
        const emeraldHtml = isRestricted
          ? `<span class="restricted-badge" style="color:#94a3b8;font-size:0.85rem;" title="Google Drive izni verilmediği için gizli">🔒 Gizli</span>`
          : `<strong class="emerald-text">${Number(r.emeraldBalance || 0).toLocaleString('tr-TR')} ${mcIcon('EMERALD', 15)}</strong>`;
        const driveStatusTag = isRestricted
          ? `<span class="profile-mini-tag" style="background:rgba(239,68,68,0.18);color:#fca5a5;border:1px solid rgba(239,68,68,0.4);" title="Google Drive izni onaylanmadı — Ayrıntılı veriler gizlidir">🔒 Drive İzni Yok</span>`
          : `<span class="profile-mini-tag" style="background:rgba(34,197,94,0.18);color:#86efac;border:1px solid rgba(34,197,94,0.4);" title="Google Drive senkronizasyonu aktif">✓ Drive Senkron</span>`;

        return `
          <tr>
            <td><strong>${medal}</strong></td>
            <td>
              <div class="lb-player-cell clickable-player-trigger" data-view-profile="${escapeHtml(
                r.username
              )}" title="${escapeHtml(r.username)} profilini görüntüle">
                <img src="${escapeHtml(avatarSrc)}" onerror="this.onerror=null;this.src='${escapeHtml(
          fallbackSrc
        )}';" class="lb-avatar ${escapeHtml(rCos.frameClass)}" alt="" />
                <div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <strong class="clickable-player-name ${escapeHtml(rCos.nameClass)}" ${
          rCos.nameStyle
        }>${escapeHtml(r.username)}</strong>
                    ${
                      rCos.badgeText
                        ? `<span class="custom-cosmetic-badge-pill">${replaceEmojis(escapeHtml(rCos.badgeText), 12)}</span>`
                        : ''
                    }
                    <span class="profile-mini-tag">👤 Profil</span>
                    ${driveStatusTag}
                  </div>
                  ${
                    r.minecraftPlayerName
                      ? `<span class="lb-mc-sub">${mcIcon('GRASS', 12)} ${escapeHtml(r.minecraftPlayerName)}</span>`
                      : ''
                  }
                </div>
              </div>
            </td>
            <td><span class="${getRankBadgeClass(r.rankId)}">${mcIcon(r.rankBadge, 14)} ${escapeHtml(
          r.rankName
        )}</span></td>
            <td>${ptsHtml}</td>
            <td>${winsHtml}</td>
            <td>${playedHtml}</td>
            <td>${emeraldHtml}</td>
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

    // Eğer oyuncu aktif bir partideyse, ilgili parti kodu alanını otomatik doldur
    const partyInput = document.getElementById('bug-related-party');
    if (partyInput && !partyInput.value) {
      const activeParty = svc().partyService?.getActivePartyForUser(session.username);
      if (activeParty?.partyCode) {
        partyInput.value = activeParty.partyCode;
      }
    }

    const bugs = svc().bugService.getUserBugs(session.username);
    if (bugs.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Henüz hata bildiriminiz bulunmuyor. Karşılaştığınız hataları yukarıdaki formdan detaylıca bildirebilirsiniz.</div>`;
      return;
    }

    listEl.innerHTML = bugs
      .map(b => {
        const stLower = String(b.status || 'OPEN').toLowerCase();
        const isResolved = stLower.includes('çözüldü') || stLower === 'resolved';
        return `
        <div class="ticket-card">
          <div class="ticket-header">
            <strong>${mcIcon('REDSTONE', 16)} #${escapeHtml(b.id)} — ${escapeHtml(b.title)}</strong>
            <span class="status-pill ${isResolved ? 'status-resolved' : 'status-open'}">${escapeHtml(
          b.status
        )}</span>
          </div>
          <p class="ticket-meta">Kategori: <strong>${escapeHtml(b.category)}</strong> • Önem: <strong>${escapeHtml(
          b.severity
        )}</strong> ${
          b.relatedParty ? `• Parti: <code>${escapeHtml(b.relatedParty)}</code>` : ''
        } • ${formatDateTR(b.createdAt)}</p>
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
              ? `<div class="admin-reply-note">${mcIcon('SHIELD', 14)} <strong>Yönetici Notu:</strong> ${replaceEmojis(
                  escapeHtml(b.adminNote),
                  14
                )}</div>`
              : ''
          }
        </div>
      `;
      })
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

    const uLower = session.username.toLowerCase();
    const rawSuggestions = svc().suggestionService.getAllSuggestions();
    const suggestions = [...rawSuggestions].sort((a, b) => {
      const scoreA = (Array.isArray(a.upvotes) ? a.upvotes.length : 0) - (Array.isArray(a.downvotes) ? a.downvotes.length : 0);
      const scoreB = (Array.isArray(b.upvotes) ? b.upvotes.length : 0) - (Array.isArray(b.downvotes) ? b.downvotes.length : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (suggestions.length === 0) {
      listEl.innerHTML = `<div class="empty-state-box">Henüz paylaşılmış öneri bulunmuyor. İlk öneriyi siz paylaşın!</div>`;
      return;
    }

    listEl.innerHTML = suggestions
      .map(s => {
        const upvotes = Array.isArray(s.upvotes) ? s.upvotes : [];
        const downvotes = Array.isArray(s.downvotes) ? s.downvotes : [];
        const upCount = upvotes.length;
        const downCount = downvotes.length;
        const netScore = upCount - downCount;
        const hasVotedUp = upvotes.includes(uLower);
        const hasVotedDown = downvotes.includes(uLower);

        return `
          <div class="ticket-card">
            <div class="ticket-header">
              <strong>${mcIcon('STAR', 16)} #${escapeHtml(s.id)} — ${escapeHtml(s.title)}</strong>
              <span class="status-pill">${escapeHtml(s.status)}</span>
            </div>
            <p class="ticket-meta">Gönderen: <strong class="clickable-player-name" data-view-profile="${escapeHtml(
              s.username
            )}">${escapeHtml(s.username)}</strong> • Kategori: <strong>${escapeHtml(
          s.category
        )}</strong> • Net Skor: <strong>${netScore >= 0 ? `+${netScore}` : netScore}</strong> • ${formatDateTR(
          s.createdAt
        )}</p>
            <p>${escapeHtml(s.details)}</p>
            ${
              s.adminNote
                ? `<div class="admin-reply-note">${mcIcon('SHIELD', 14)} <strong>Yönetici Notu:</strong> ${replaceEmojis(
                    escapeHtml(s.adminNote),
                    14
                  )}</div>`
                : ''
            }
            <div class="suggestion-votes">
              <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary suggestion-vote-btn ${
                hasVotedUp ? 'voted-up' : ''
              }" data-vote-sug="${escapeHtml(
          s.id
        )}" data-vote-dir="UP">▲ Destekle (${upCount})</button>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary suggestion-vote-btn ${
                hasVotedDown ? 'voted-down' : ''
              }" data-vote-sug="${escapeHtml(
          s.id
        )}" data-vote-dir="DOWN">▼ Katılmıyorum (${downCount})</button>
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
      activityService,
      aiQuestionService,
      cloudSyncService
    } = svc();

    // 1. GÖSTERGE PANELİ (dashboard)
    if (state.adminTab === 'dashboard') {
      const users = userService.getAllUsers();
      const parties = partyService.getAllParties().filter(p => p.status !== 'CLOSED');
      const tickets = supportService.getAllTickets().filter(t => t.status === 'OPEN');
      const bugs = bugService.getAllBugs().filter(b => b.status === 'OPEN' || b.status === 'AÇIK');
      const suggestions = suggestionService.getAllSuggestions();
      const totalEmeralds = users.reduce((sum, u) => sum + Number(u.emeraldBalance || 0), 0);
      const totalNetherites = users.reduce((sum, u) => sum + Number(u.netheriteBalance || 0), 0);
      const aiPoolCount = aiQuestionService ? aiQuestionService.getAiQuestionPool().length : 0;
      const hasAiKey = aiQuestionService ? aiQuestionService.hasConfiguredApiKey() : false;

      container.innerHTML = `
        <div class="admin-panel-section">
          <div class="card-title-row">
            <h3>📊 Gösterge Paneli</h3>
            <div class="header-bar-actions">
              <button type="button" id="btn-admin-cloud-sync-now" class="mc-btn mc-btn-sm mc-btn-primary">
                ☁️ Şimdi Bulut İle Senkronize Et
              </button>
              <button type="button" id="btn-admin-reset-all-data" class="mc-btn mc-btn-sm mc-btn-danger">
                🧨 Tüm Bilgileri Sıfırla
              </button>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-admin-tab="settings">
                🤖 Gemini API &amp; Soru Üretici (${aiPoolCount} AI Soru)
              </button>
              <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-tab="ranks">
                ➕ Rütbe Ekle / Yönet
              </button>
            </div>
          </div>
          <div class="stats-kpi-grid">
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM OYUNCU (BULUT)</span><strong class="kpi-val">${
              users.length
            }</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">AKTİF PARTİLER</span><strong class="kpi-val">${
              parties.length
            }</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM ZÜMRÜT</span><strong class="kpi-val emerald-text">${totalEmeralds.toLocaleString(
              'tr-TR'
            )} ${mcIcon('EMERALD', 16)}</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">TOPLAM NETHERITE</span><strong class="kpi-val netherite-text">${totalNetherites.toLocaleString(
              'tr-TR'
            )} ${mcIcon('NETHERITE', 16)}</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">GEMINI AI SORU HAVUZU</span><strong class="kpi-val gold-text">${aiPoolCount} Soru (${
        hasAiKey ? 'API Aktif' : 'API Yok'
      })</strong></div>
            <div class="stat-kpi-card"><span class="kpi-label">AÇIK DESTEK / HATA / ÖNERİ</span><strong class="kpi-val">${
              tickets.length
            } / ${bugs.length} / ${suggestions.length}</strong></div>
          </div>
        </div>
      `;
      return;
    }

    // 2. OYUNCULAR (players — Arama + Detaylar + Rütbeler + Moderator Verme/Kaldırma + Zümrüt & Netherite Yönetimi)
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
      const { avatarService } = svc();

      container.innerHTML = `
        <div class="admin-panel-section">
          <div class="card-title-row">
            <h3>👥 Oyuncu Yönetimi (${users.length} / ${allUsers.length} Hesap — Bulut Senkronize)</h3>
            <div class="header-bar-actions" style="display:flex;gap:8px;align-items:center;">
              <button type="button" id="btn-admin-cloud-sync-now" class="mc-btn mc-btn-sm mc-btn-secondary">
                🔄 Buluttan Yenile
              </button>
              <div class="leaderboard-search-box">
                <input type="text" id="admin-player-search" placeholder="Kullanıcı adı veya MC adı ara..." value="${escapeHtml(
                  state.adminPlayerSearch
                )}" />
              </div>
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
                    const uCos = getUserCosmeticMeta(u);
                    const uAvatar = avatarService ? avatarService.getAvatarForUser(u) : '';
                    const uFallback = avatarService
                      ? avatarService.generatePixelAvatarDataUrl(u.username)
                      : '';
                    return `
                      <tr>
                        <td>
                          <div class="lb-player-cell clickable-player-trigger" data-view-profile="${escapeHtml(
                            u.username
                          )}" title="${escapeHtml(u.username)} profilini görüntüle">
                            <img src="${escapeHtml(uAvatar)}" onerror="this.onerror=null;this.src='${escapeHtml(
                      uFallback
                    )}';" class="lb-avatar ${escapeHtml(uCos.frameClass)}" alt="" />
                            <div>
                              <strong class="clickable-player-name ${escapeHtml(uCos.nameClass)}" ${
                      uCos.nameStyle
                    }>${escapeHtml(u.username)}</strong>
                              <div class="lb-mc-sub">Puan: ${formatCurrencyTRY(
                                u.points || 0
                              )} • Oyun: ${Number(u.gamesWon || 0)}/${Number(
                      u.gamesPlayed || 0
                    )} • Can: ${Number(u.extraLives || 0)} ${mcIcon('HEART', 12)}</div>
                            </div>
                          </div>
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
                                  }>${escapeHtml(r.name)}</option>`
                              )
                              .join('')}
                          </select>
                        </td>
                        <td>
                          <span class="emerald-text">${Number(u.emeraldBalance || 0)} ${mcIcon('EMERALD', 14)}</span> /
                          <span class="netherite-text">${Number(u.netheriteBalance || 0)} ${mcIcon('NETHERITE', 14)}</span>
                        </td>
                        <td>
                          <button type="button" class="mc-btn mc-btn-sm ${
                            u.isModerator ? 'mc-btn-gold' : 'mc-btn-secondary'
                          }" data-admin-toggle-mod="${escapeHtml(u.username)}" data-mod-val="${
                      u.isModerator ? 'false' : 'true'
                    }">
                            ${mcIcon('SWORD', 13)} ${u.isModerator ? 'Moderatör (Kaldır)' : 'Moderatör Yap'}
                          </button>
                        </td>
                        <td>
                          <div class="admin-action-btns">
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-view-profile="${escapeHtml(
                              u.username
                            )}">👤 Profil</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-give-emerald="${escapeHtml(
                              u.username
                            )}">+500 ${mcIcon('EMERALD', 13)}</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-remove-emerald="${escapeHtml(
                              u.username
                            )}">-250 ${mcIcon('EMERALD', 13)}</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-admin-give-netherite="${escapeHtml(
                              u.username
                            )}">+100 ${mcIcon('NETHERITE', 13)}</button>
                            <button type="button" class="mc-btn mc-btn-sm mc-btn-secondary" data-admin-remove-netherite="${escapeHtml(
                              u.username
                            )}">-50 ${mcIcon('NETHERITE', 13)}</button>
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

    // 3. RÜTBELER (ranks — Yeni Rütbe Ekleme Sistemi + Rütbe Yapılandırması & Moderator Yetkileri)
    if (state.adminTab === 'ranks') {
      const ranks = rankService.getAllRanks();
      const modPerms = authGuard.getModeratorPermissions();
      const builtInIds = ['MEMBER', 'VIP', 'VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'MODERATOR', 'ADMIN'];

      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>➕ Yeni Rütbe Ekle (Özel Rütbe Oluşturma Sistemi)</h3>
          <p class="card-sub">
            Mağazada yalnızca <strong>Netherite (en az 500 ⬛)</strong> ile satılacak veya özel olarak atanacak yeni bir rütbe oluşturun. Oluşturulan rütbeler tüm bilgisayarlarda anında görünür.
          </p>
          <form id="admin-create-rank-form" class="platform-form" style="margin-bottom:28px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>RÜTBE KODU (ID)</label>
                <input type="text" id="adm-new-rank-id" placeholder="Örn: UVIP veya EFSANE" maxlength="20" required />
              </div>
              <div class="input-group">
                <label>RÜTBE GÖRÜNEN ADI</label>
                <input type="text" id="adm-new-rank-name" placeholder="Örn: Ultra VIP" maxlength="28" required />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>NETHERITE FİYATI (EN AZ 500 ⬛)</label>
                <input type="number" id="adm-new-rank-netherite" value="5000" min="500" required />
              </div>
              <div class="input-group">
                <label>RÜTBE SIRASI (ORDER — MVIP+=5, MOD=6)</label>
                <input type="number" id="adm-new-rank-order" value="5" min="2" max="90" required />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>GÜNLÜK ZÜMRÜT ÖDÜLÜ</label>
                <input type="number" id="adm-new-rank-daily-em" value="650" min="0" required />
              </div>
              <div class="input-group">
                <label>GÜNLÜK NETHERITE ÖDÜLÜ</label>
                <input type="number" id="adm-new-rank-daily-ne" value="150" min="0" required />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>RENK (HEX) &amp; ROZET İKONU</label>
                <div class="inline-form-row">
                  <input type="color" id="adm-new-rank-color" value="#f43f5e" style="width:56px;height:40px;padding:2px;" />
                  <select id="adm-new-rank-badge" style="flex:1;">
                    <option value="👑">👑 Kral Tacı</option>
                    <option value="🐉">🐉 Ejderha</option>
                    <option value="💎">💎 Elmas</option>
                    <option value="🌟">🌟 Parlayan Yıldız</option>
                    <option value="🔥">🔥 Alev</option>
                    <option value="⚡">⚡ Yıldırım</option>
                  </select>
                </div>
              </div>
              <div class="input-group">
                <label>PARTİ KAPASİTESİ &amp; ZÜMRÜT ÇARPANI</label>
                <div class="inline-form-row">
                  <input type="number" id="adm-new-rank-party-size" value="10" min="4" max="24" placeholder="Parti Kişi" title="Maksimum Parti Üyesi" />
                  <input type="number" step="0.05" id="adm-new-rank-multiplier" value="1.75" min="1" max="5" placeholder="Çarpan" title="Zümrüt Çarpanı" />
                </div>
              </div>
            </div>
            <div class="input-group">
              <label>RÜTBE ÖZELLİKLERİ (VİRGÜL İLE AYIRIN)</label>
              <input type="text" id="adm-new-rank-features" placeholder="Örn: Özel Parti Odası (10 Kişi), +650 Günlük Zümrüt, +150 Günlük Netherite, %75 Zümrüt Bonusu" />
            </div>
            <label class="setting-row" style="margin-bottom:12px;">
              <span>🛒 Mağazada Oyuncular Tarafından Netherite İle Satın Alınabilsin</span>
              <input type="checkbox" id="adm-new-rank-purchasable" checked />
            </label>
            <button type="submit" class="mc-btn mc-btn-gold">➕ Yeni Rütbeyi Oluştur ve Kaydet</button>
          </form>

          <h3>${mcIcon('CROWN', 18)} Mevcut Rütbe Hiyerarşisi (${ranks.length} Rütbe — Sadece Netherite İle Alım)</h3>
          <div class="table-responsive">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Rütbe</th>
                  <th>Netherite Fiyatı (Min 500)</th>
                  <th>Günlük Zümrüt</th>
                  <th>Günlük Netherite</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${ranks
                  .map(r => {
                    const isCustom = !builtInIds.includes(r.id);
                    return `
                    <tr>
                      <td>#${r.order}</td>
                      <td>
                        <strong style="color:${escapeHtml(r.color || '#fff')}">${mcIcon(
                      r.badge || r.id,
                      15
                    )} ${escapeHtml(r.name)}</strong>
                        (<code>${escapeHtml(r.id)}</code>)
                      </td>
                      <td>
                        <input type="number" id="adm-rk-ne-${escapeHtml(r.id)}" value="${
                      r.netheritePrice
                    }" min="${r.purchasable ? 500 : 0}" style="width:105px;" />
                      </td>
                      <td>
                        <input type="number" id="adm-rk-daily-em-${escapeHtml(r.id)}" value="${
                      r.dailyEmerald ?? 50
                    }" min="0" style="width:95px;" />
                      </td>
                      <td>
                        <input type="number" id="adm-rk-daily-${escapeHtml(r.id)}" value="${
                      r.dailyNetherite
                    }" min="0" style="width:95px;" />
                      </td>
                      <td>
                        <div class="admin-action-btns">
                          <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-save-rank="${escapeHtml(
                            r.id
                          )}">Kaydet</button>
                          ${
                            isCustom
                              ? `<button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-delete-rank="${escapeHtml(
                                  r.id
                                )}">Sil</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>

          <h4 style="margin-top:24px;">${mcIcon('SWORD', 16)} Moderator Yetki Yapılandırması</h4>
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
          <h3>${mcIcon('SWORD', 18)} Parti Odaları Yönetimi (${parties.length})</h3>
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
            <h3>${mcIcon('TROPHY', 18)} Liderlik Tablosu Yönetimi</h3>
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
          <h3>${mcIcon('DIAMOND', 18)} Oyuncu Zümrüt &amp; Netherite Bakiye İşlemi</h3>
          <form id="admin-custom-currency-form" class="platform-form" style="margin-bottom:24px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>HEDEF OYUNCU KULLANICI ADI</label>
                <input type="text" id="adm-cur-username" placeholder="Örn: SteveMaster" required />
              </div>
              <div class="input-group">
                <label>PARA BİRİMİ</label>
                <select id="adm-cur-type">
                  <option value="EMERALD">Zümrüt (Emerald)</option>
                  <option value="NETHERITE">Netherite</option>
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
                <label>İlk VIP+ ve Üzeri Alım Tek Seferlik Netherite Ödülü</label>
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
          <h3>${mcIcon('CHEST', 18)} Yeni Mağaza Ürünü Ekle / Güncelle</h3>
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
                  <option value="Netherite">Netherite Bakiye (Netherite)</option>
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
                      <td><strong>${mcIcon(i.id || i.icon, 18)} ${escapeHtml(i.name)}</strong></td>
                      <td>${escapeHtml(i.category)} ${i.subCategory ? `(${escapeHtml(i.subCategory)})` : ''}</td>
                      <td>${escapeHtml(i.currency)}</td>
                      <td>${i.emeraldPrice || 0} ${mcIcon('EMERALD', 13)} / ${i.netheritePrice || 0} ${mcIcon('NETHERITE', 13)}</td>
                      <td>${i.active !== false ? '✓ Aktif' : 'Pasif'}</td>
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
          <h3>${mcIcon('CHEST', 18)} Stripe Ödeme Altyapısı Hazırlık Ayarları</h3>
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

          <h4 style="margin-top:24px;">${mcIcon('CHEST', 16)} Gönderilen Rütbe Hediyeleri (${gifts.length})</h4>
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
          <h3>${mcIcon('REDSTONE', 18)} Hata Bildirimleri (${bugs.length})</h3>
          ${
            bugs.length === 0
              ? `<div class="empty-state-box">Hata bildirimi bulunmuyor.</div>`
              : bugs
                  .map(
                    b => `
                    <div class="ticket-card">
                      <div class="ticket-header">
                        <strong>#${escapeHtml(b.id)} — ${escapeHtml(b.title)} (${escapeHtml(b.username)})</strong>
                        <span class="status-pill">${escapeHtml(b.status)}</span>
                      </div>
                      <p class="ticket-meta">Kategori: <strong>${escapeHtml(b.category)}</strong> • Önem: <strong>${escapeHtml(
                      b.severity
                    )}</strong> ${
                      b.relatedParty ? `• İlgili Parti: <code>${escapeHtml(b.relatedParty)}</code>` : ''
                    } • ${formatDateTR(b.createdAt)}</p>
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
                      <div class="inline-form-row" style="margin-top:10px;flex-wrap:wrap;gap:8px;">
                        <select id="adm-bug-status-${escapeHtml(b.id)}" class="admin-inline-select">
                          <option value="İNCELENİYOR" ${b.status === 'İNCELENİYOR' ? 'selected' : ''}>İNCELENİYOR</option>
                          <option value="ÇÖZÜLDÜ" ${b.status === 'ÇÖZÜLDÜ' ? 'selected' : ''}>ÇÖZÜLDÜ</option>
                          <option value="GEÇERSİZ / KAPATILDI" ${b.status === 'GEÇERSİZ / KAPATILDI' ? 'selected' : ''}>GEÇERSİZ / KAPATILDI</option>
                        </select>
                        <input type="text" id="adm-bug-note-${escapeHtml(
                          b.id
                        )}" placeholder="Oyuncuya çözüm / inceleme notu..." value="${escapeHtml(
                      b.adminNote || ''
                    )}" style="flex:1;min-width:200px;" />
                        <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:var(--mc-emerald);">
                          <input type="checkbox" id="adm-bug-reward-${escapeHtml(b.id)}" />
                          +100 ${mcIcon('EMERALD', 13)} Ödül Ver
                        </label>
                        <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-resolve-bug="${escapeHtml(
                          b.id
                        )}">Kaydet &amp; Bildir</button>
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
          <h3>${mcIcon('STAR', 18)} Topluluk Önerileri (${suggestions.length})</h3>
          ${
            suggestions.length === 0
              ? `<div class="empty-state-box">Öneri bulunmuyor.</div>`
              : suggestions
                  .map(s => {
                    const upC = Array.isArray(s.upvotes) ? s.upvotes.length : 0;
                    const downC = Array.isArray(s.downvotes) ? s.downvotes.length : 0;
                    return `
                    <div class="ticket-card">
                      <div class="ticket-header">
                        <strong>#${escapeHtml(s.id)} — ${escapeHtml(s.title)} (${escapeHtml(s.username)})</strong>
                        <span class="status-pill">${escapeHtml(s.status)}</span>
                      </div>
                      <p class="ticket-meta">Kategori: <strong>${escapeHtml(s.category)}</strong> • Oylar: <strong>▲ ${upC} / ▼ ${downC}</strong> • ${formatDateTR(
                      s.createdAt
                    )}</p>
                      <p>${escapeHtml(s.details)}</p>
                      <div class="inline-form-row" style="margin-top:10px;flex-wrap:wrap;gap:8px;">
                        <input type="text" id="adm-sug-note-${escapeHtml(
                          s.id
                        )}" placeholder="Yönetici yanıtı / değerlendirme notu..." value="${escapeHtml(
                      s.adminNote || ''
                    )}" style="flex:1;min-width:200px;" />
                        <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:var(--mc-emerald);">
                          <input type="checkbox" id="adm-sug-reward-${escapeHtml(s.id)}" />
                          +100 ${mcIcon('EMERALD', 13)} Ödül Ver
                        </label>
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
                  `;
                  })
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

    // 15. AYARLAR (settings — Gemini API Key & Otomatik Soru Üretici + Bulut Senkronizasyonu + Genel Ayarlar)
    if (state.adminTab === 'settings') {
      const pSettings = backupService.getPlatformSettings();
      const aiCfg = aiQuestionService
        ? aiQuestionService.getAdminViewConfig(session)
        : { apiKey: '', enabled: true, autoGenerateBeforeMatch: true, model: 'gemini-2.5-flash', batchSize: 15, poolCount: 0 };

      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🤖 Yapay Zeka (Gemini API) &amp; Otomatik Soru Üretici</h3>
          <p class="card-sub">
            Buraya <strong>yalnızca kendi Gemini API Anahtarınızı</strong> girmeniz yeterlidir. Normal oyuncuların hiçbir API anahtarı girmesine gerek yoktur; sistem sizin anahtarınızla her maçta farklı ve tekrarsız Minecraft soruları üretip ortak bulut havuzuna kaydeder.
          </p>
          <form id="admin-ai-config-form" class="platform-form" style="margin-bottom: 24px;">
            <div class="input-group">
              <label>YÖNETİCİ GEMINI API KEY (SADECE YÖNETİCİ GÖRÜR, OYUNCULAR GİRMEZ)</label>
              <input type="password" id="adm-ai-api-key" value="${escapeHtml(
                aiCfg.apiKey || ''
              )}" placeholder="AIzaSy..." autocomplete="off" />
              <span class="input-hint">Durum: <strong>${
                aiCfg.hasKey ? '✓ API Anahtarı Kayıtlı ve Aktif' : '⚠️ Henüz API Anahtarı Girilmedi'
              }</strong> • Havuzdaki AI Soru Sayısı: <strong>${aiCfg.poolCount || 0}</strong></span>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>GEMINI MODELİ</label>
                <select id="adm-ai-model">
                  <option value="gemini-3.8-flash" ${
                    aiCfg.model === 'gemini-3.8-flash' ? 'selected' : ''
                  }>gemini-3.8-flash (Önerilen En Yeni &amp; Hızlı)</option>
                  <option value="gemini-2.5-flash" ${
                    aiCfg.model === 'gemini-2.5-flash' ? 'selected' : ''
                  }>gemini-2.5-flash</option>
                  <option value="gemini-2.0-flash" ${
                    aiCfg.model === 'gemini-2.0-flash' ? 'selected' : ''
                  }>gemini-2.0-flash</option>
                </select>
              </div>
              <div class="input-group">
                <label>TEK SEFERDE ÜRETİLECEK SORU SAYISI</label>
                <input type="number" id="adm-ai-batch-size" value="${
                  aiCfg.batchSize || 15
                }" min="5" max="30" />
              </div>
            </div>
            <div class="settings-toggle-list" style="margin-bottom: 14px;">
              <label class="setting-row">
                <span>🤖 Gemini AI Soru Havuzunu Yarışmalarda Aktif Kullan</span>
                <input type="checkbox" id="adm-ai-enabled" ${aiCfg.enabled !== false ? 'checked' : ''} />
              </label>
              <label class="setting-row">
                <span>⚡ Oyuncular Yarışmaya Başladığında Otomatik Yeni Soru Üret</span>
                <input type="checkbox" id="adm-ai-auto-match" ${
                  aiCfg.autoGenerateBeforeMatch !== false ? 'checked' : ''
                } />
              </label>
            </div>
            <div class="header-bar-actions" style="display:flex;flex-wrap:wrap;gap:10px;">
              <button type="submit" class="mc-btn mc-btn-primary">💾 Gemini API Ayarlarını Kaydet</button>
              <button type="button" id="btn-admin-generate-ai-questions" class="mc-btn mc-btn-gold">
                ⚡ Şimdi Yapay Zeka İle Yeni Sorular Üret
              </button>
              <button type="button" id="btn-admin-clear-ai-questions" class="mc-btn mc-btn-danger">
                🗑️ AI Soru Havuzunu Temizle (${aiCfg.poolCount || 0})
              </button>
            </div>
          </form>

          <h3>☁️ Çoklu Bilgisayar Bulut Senkronizasyonu &amp; Tam Sıfırlama</h3>
          <p class="card-sub">
            Farklı bilgisayarlardan veya tarayıcılardan açılan hesaplar (Zümrüt, Netherite, rütbe, kozmetik, başarım, ayarlar, satın alımlar, partiler, bildirimler, destek/hata/öneri kayıtları, liderlik tablosu ve AI soruları) otomatik olarak ortak bulut veritabanı ile senkronize edilir.
          </p>
          <div class="header-bar-actions" style="margin-bottom: 24px; display:flex; flex-wrap:wrap; gap:10px;">
            <button type="button" id="btn-admin-cloud-sync-now" class="mc-btn mc-btn-primary">
              🔄 Şimdi Bulut İle Senkronize Et
            </button>
            <button type="button" id="btn-admin-reset-all-data" class="mc-btn mc-btn-danger">
              🧨 Tüm Hesapları, Verileri ve Bulutu Sıfırla
            </button>
          </div>

          <h3>⚙️ Platform Genel Ayarları &amp; Bakım Modu (Faz 6)</h3>
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
            <div class="settings-toggle-list" style="margin: 12px 0 16px;">
              <label class="setting-row" style="border: 2px solid #ef4444; background: rgba(127, 29, 29, 0.25); padding: 12px; border-radius: 6px;">
                <div>
                  <strong style="color: #fca5a5;">🚨 BAKIM MODU (TÜM OYUNCULARI BLOKLAR)</strong>
                  <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #cbd5e1;">
                    Aktif edildiğinde sadece Admin (codingdevelopia@gmail.com) ve Moderatörler girebilir, diğer oyuncular kırmızı piksel sanatlı bakım ekranıyla kilitlenir.
                  </p>
                </div>
                <input type="checkbox" id="adm-set-maintenance" ${
                  pSettings.maintenanceMode ? 'checked' : ''
                } style="transform: scale(1.4); cursor: pointer;" />
              </label>
            </div>
            <button type="submit" class="mc-btn mc-btn-primary">Ayarları &amp; Bakım Modunu Kaydet</button>
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
        closePlayerProfileModal();
      }
    });

    // Oyuncu Profil Kartı Modalı Kapatma & Hızlı Aksiyonlar
    document
      .getElementById('btn-close-player-profile-modal')
      ?.addEventListener('click', closePlayerProfileModal);
    document
      .getElementById('btn-close-player-profile-footer')
      ?.addEventListener('click', closePlayerProfileModal);
    document.getElementById('modal-player-profile')?.addEventListener('click', e => {
      if (e.target.id === 'modal-player-profile') {
        closePlayerProfileModal();
      }
    });

    document.getElementById('btn-modal-invite-to-party')?.addEventListener('click', function () {
      const targetUser = this.getAttribute('data-modal-invite-user');
      const session = getSession();
      if (!session || !targetUser) return;
      try {
        let activeParty = svc().partyService.getActivePartyForUser(session.username);
        if (!activeParty) {
          activeParty = svc().partyService.createParty(
            session,
            `${session.username} Milyoner Partisi`
          );
        }
        svc().partyService.invitePlayerToParty(session, activeParty.partyId, targetUser);
        svc().cloudSyncService?.pushNow();
        closePlayerProfileModal();
        showToast(
          `🎉 "${targetUser}" oyuncusuna "${activeParty.partyName}" (${activeParty.partyCode}) partisi için davet gönderildi!`,
          'success'
        );
        syncHeaderAndDrawer();
        navigateToScreen('party');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-modal-gift-rank-player')?.addEventListener('click', function () {
      const targetUser = this.getAttribute('data-modal-gift-user') || '';
      closePlayerProfileModal();
      openGiftRankModal('VIP', targetUser);
    });

    // Marka logosuna tıklayınca Ana Sayfa
    document.getElementById('brand-home-trigger')?.addEventListener('click', () => {
      navigateToScreen('welcome');
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

    // Hediye Modalı (#11 — Sadece Netherite ile Hediye)
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
      .getElementById('btn-gift-open-netherite-store')
      ?.addEventListener('click', () => {
        closeGiftRankModal();
        state.shopCategory = 'Netherite';
        navigateToScreen('shop');
        renderShop();
      });

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

    // Profil: Kullanıcı Adı Değiştirme (Faz 2)
    document.getElementById('profile-change-username-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const newName = document.getElementById('profile-username-input')?.value || '';
      try {
        await svc().userService.changeUsername(session, newName);
        showToast(`✓ Kullanıcı adınız "${newName.trim()}" olarak başarıyla güncellendi!`, 'success');
        syncHeaderAndDrawer();
        renderProfile();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Profil: Güvenli Çıkış Yap Butonu
    document.getElementById('btn-profile-signout')?.addEventListener('click', () => {
      if (typeof window.handleUserLogout === 'function') {
        window.handleUserLogout();
      }
    });

    // Bakım Modu: Yönetici Girişi Butonu
    document.getElementById('btn-maintenance-admin-login')?.addEventListener('click', () => {
      document.getElementById('maintenance-overlay')?.classList.add('hidden');
      const gate = document.getElementById('access-gate');
      if (gate) {
        gate.classList.remove('hidden');
        document.getElementById('tab-btn-login')?.click();
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

    // Parti Formları (Bulut Senkronizasyonlu)
    document.getElementById('party-join-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const code = document.getElementById('party-join-code-input')?.value || '';
      try {
        // Önce buluttan açık partileri çekmeyi dene (başka bilgisayarda açılmış olabilir)
        try {
          await svc().cloudSyncService?.syncNow();
        } catch (syncErr) {
          // ignore
        }
        const party = svc().partyService.joinPartyByCode(session, code);
        svc().achievementService?.checkAndUnlock(session.username, { joinedParty: true });
        svc().cloudSyncService?.pushNow();
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
        svc().cloudSyncService?.pushNow();
        showToast(`👑 "${party.partyName}" partisi kuruldu! Kod: ${party.partyCode}`, 'success');
        syncHeaderAndDrawer();
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('party-invite-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      const targetUser = document.getElementById('party-invite-username')?.value || '';
      if (!activeParty) return;
      try {
        try {
          await svc().cloudSyncService?.syncNow();
        } catch (syncErr) {
          // ignore
        }
        svc().partyService.invitePlayerToParty(session, activeParty.partyId, targetUser);
        svc().cloudSyncService?.pushNow();
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
        svc().cloudSyncService?.pushNow();
        showToast('Partiden ayrıldınız.', 'info');
        syncHeaderAndDrawer();
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Lider: Katılımcı Ol / Jüri Ol Geçiş Butonu
    document.addEventListener('click', e => {
      const btn = e.target.closest('#btn-toggle-host-role');
      if (!btn) return;
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      if (!activeParty) return;
      const isLeader =
        activeParty.leaderUsername.toLowerCase() === session.username.toLowerCase() ||
        session.isAdminSession;
      if (!isLeader) return;
      const currentRole = activeParty.hostRole || 'JUDGE';
      const newRole = currentRole === 'JUDGE' ? 'PLAYER' : 'JUDGE';
      try {
        svc().partyService.setPartyHostRole(session, activeParty.partyId, newRole);
        svc().cloudSyncService?.pushNow();
        showToast(
          newRole === 'JUDGE'
            ? '⚖️ Jüri moduna geçildi. Doğru cevapları göreceksiniz.'
            : '🎮 Katılımcı moduna geçildi. Diğer oyuncular gibi yarışacaksınız.',
          'success'
        );
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Oyun sırasında: Jüri modundan Katılımcı moduna geç butonu
    document.addEventListener('click', e => {
      if (e.target.closest('#btn-judge-become-player')) {
        const session = getSession();
        if (!session) return;
        const activeParty = svc().partyService.getActivePartyForUser(session.username);
        if (!activeParty) return;
        try {
          svc().partyService.setPartyHostRole(session, activeParty.partyId, 'PLAYER');
          svc().cloudSyncService?.pushNow();
          // Jüri rozetini gizle
          document.getElementById('judge-hud-badge')?.classList.add('hidden');
          // Cevap butonlarını tekrar etkinleştir
          for (let i = 0; i < 4; i++) {
            const ab = document.getElementById(`ans-${i}`);
            if (ab) {
              ab.disabled = false;
              ab.classList.remove('judge-correct-ans');
            }
          }
          showToast('🎮 Artık katılımcı olarak oynuyorsunuz!', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    document.getElementById('btn-party-start-match')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      const activeParty = svc().partyService.getActivePartyForUser(session.username);
      if (!activeParty) return;
      try {
        // Soruları üret ve servise ilet
        const questions = typeof window.buildMatchQuestions === 'function'
          ? window.buildMatchQuestions()
          : null;
        svc().partyService.startPartyMatch(session, activeParty.partyId, { questions: questions || [] });
        svc().cloudSyncService?.pushNow();
        showToast('⚔️ Parti maçı başlatıldı!', 'success');

        // Lider jüri modunda mı, yoksa katılımcı olarak mı?
        const updatedParty = svc().partyService.getActivePartyForUser(session.username);
        const hostRole = updatedParty?.hostRole || 'JUDGE';
        if (hostRole === 'JUDGE') {
          // Jüri modu: sorular açık, lider cevap veremez
          if (typeof window.startPartyJudgeSession === 'function') {
            window.startPartyJudgeSession(updatedParty);
          } else if (typeof window.startNewGameSession === 'function') {
            window.startNewGameSession(true);
          }
        } else {
          // Katılımcı modu: normal oyun gibi başlat
          if (typeof window.startNewGameSession === 'function') {
            window.startNewGameSession(true);
          }
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

    // Genel Tıklama Delegasyonu (Navigasyon, Oyuncu Profili, Mağaza, Bildirimler, Parti Daveti, Admin İşlemleri)
    document.addEventListener('click', async e => {
      // 0. Oyuncu Profili Görüntüle ([data-view-profile])
      const viewProfileTrigger = e.target.closest('[data-view-profile]');
      if (viewProfileTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const targetUsername = viewProfileTrigger.getAttribute('data-view-profile');
        if (targetUsername) {
          openPlayerProfileModal(targetUsername);
        }
        return;
      }

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

      // 4. Rütbe Satın Alma ([data-buy-rank] — Sadece Netherite)
      const buyRankBtn = e.target.closest('[data-buy-rank]');
      if (buyRankBtn) {
        const session = getSession();
        if (!session) return;
        const rankId = buyRankBtn.getAttribute('data-buy-rank');
        try {
          const res = svc().shopService.purchaseRankForSelf(session, rankId, 'NETHERITE');
          if (res.firstVipPlusBonusGranted) {
            const bonusMsg = res.rank.id === 'VIP' ? '+50 Netherite' : '+250 Netherite';
            showToast(
              `🎉 Tebrikler! ${res.rank.name} rütbesine yükseldiniz ve ilk alımınıza özel ${bonusMsg} kazandınız!`,
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
          showToast('Kozmetik görünümünüz tüm platformda güncellendi!', 'success');
          syncHeaderAndDrawer();
          if (state.currentScreen === 'profile') renderProfile();
          if (state.currentScreen === 'shop') renderShop();
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
          try {
            await svc().cloudSyncService?.syncNow();
          } catch (syncErr) {
            // ignore
          }
          const party = svc().partyService.acceptPartyInvitation(session, invitationId);
          if (notifId) {
            svc().notificationService?.markAsRead(session.username, notifId);
          }
          svc().achievementService?.checkAndUnlock(session.username, { joinedParty: true });
          svc().cloudSyncService?.pushNow();
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
          svc().cloudSyncService?.pushNow();
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
          try {
            await svc().cloudSyncService?.syncNow();
          } catch (syncErr) {
            // ignore
          }
          const party = svc().partyService.joinPartyByCode(session, code);
          svc().cloudSyncService?.pushNow();
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
          try {
            await svc().cloudSyncService?.syncNow();
          } catch (syncErr) {
            // ignore
          }
          const party = svc().partyService.joinPartyByCode(session, code);
          svc().cloudSyncService?.pushNow();
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
          svc().cloudSyncService?.pushNow();
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

      if (e.target.closest('#btn-admin-cloud-sync-now')) {
        showToast('☁️ Bulut veritabanı ile senkronize ediliyor...', 'info');
        try {
          await svc().cloudSyncService?.pushNow();
          await svc().cloudSyncService?.pullAndMerge(true);
          showToast('✓ Tüm hesap bilgileri, liderlik tablosu ve veriler bulutla senkronize edildi!', 'success');
          syncHeaderAndDrawer();
          renderAdmin();
        } catch (err) {
          showToast('Bulut senkronizasyonu sırasında hata oluştu.', 'error');
        }
        return;
      }

      if (e.target.closest('#btn-admin-reset-all-data')) {
        const resetBtn = e.target.closest('#btn-admin-reset-all-data');
        if (resetBtn) resetBtn.disabled = true;
        showToast('🧨 Tüm hesaplar, geçmişler ve bulut veritabanı sıfırlanıyor...', 'info');
        try {
          await svc().cloudSyncService?.resetAllPlatformData(session);
          showToast('✓ Tüm hesaplar, skorlar, partiler ve bulut verileri tamamen sıfırlandı!', 'success');
          syncHeaderAndDrawer();
          renderAdmin();
        } catch (err) {
          showToast(err.message || 'Sıfırlama sırasında hata oluştu.', 'error');
        } finally {
          if (resetBtn) resetBtn.disabled = false;
        }
        return;
      }

      if (e.target.closest('#btn-admin-generate-ai-questions')) {
        const genBtn = e.target.closest('#btn-admin-generate-ai-questions');
        try {
          const keyInput = document.getElementById('adm-ai-api-key');
          if (keyInput && keyInput.value.trim()) {
            svc().aiQuestionService.updateConfig(session, {
              apiKey: keyInput.value.trim(),
              model: document.getElementById('adm-ai-model')?.value || 'gemini-2.5-flash',
              batchSize: Number(document.getElementById('adm-ai-batch-size')?.value || 15),
              enabled: document.getElementById('adm-ai-enabled')?.checked !== false,
              autoGenerateBeforeMatch: document.getElementById('adm-ai-auto-match')?.checked !== false
            });
          }
          if (genBtn) genBtn.disabled = true;
          showToast('🤖 Gemini AI ile yeni ve benzersiz Minecraft soruları üretiliyor...', 'info');
          const batchCount = Number(document.getElementById('adm-ai-batch-size')?.value || 15);
          const res = await svc().aiQuestionService.generateQuestionsBatch({ count: batchCount });
          showToast(
            `🎉 ${res.addedCount} yeni AI sorusu üretildi! (Toplam AI Havuzu: ${res.totalPool})`,
            'success'
          );
          renderAdmin();
        } catch (err) {
          showToast(err.message || 'AI soru üretimi başarısız oldu.', 'error');
        } finally {
          if (genBtn) genBtn.disabled = false;
        }
        return;
      }

      if (e.target.closest('#btn-admin-clear-ai-questions')) {
        try {
          svc().aiQuestionService.clearAiQuestions(session);
          showToast('AI soru havuzu temizlendi.', 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
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
            netheritePrice: Number(document.getElementById(`adm-rk-ne-${rId}`)?.value || 500),
            dailyEmerald: Number(document.getElementById(`adm-rk-daily-em-${rId}`)?.value || 50),
            dailyNetherite: Number(document.getElementById(`adm-rk-daily-${rId}`)?.value || 0)
          });
          showToast('Rütbe yapılandırması kaydedildi.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const delRankBtn = e.target.closest('[data-admin-delete-rank]');
      if (delRankBtn) {
        const rId = delRankBtn.getAttribute('data-admin-delete-rank');
        try {
          svc().rankService.adminDeleteRank(session, rId);
          showToast(`${rId} rütbesi silindi.`, 'info');
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
        const statusVal = document.getElementById(`adm-bug-status-${bId}`)?.value || 'ÇÖZÜLDÜ';
        const note = document.getElementById(`adm-bug-note-${bId}`)?.value || '';
        const rewardEm = document.getElementById(`adm-bug-reward-${bId}`)?.checked ? 100 : 0;
        try {
          svc().bugService.adminUpdateBug(session, bId, {
            status: statusVal,
            adminNote: note,
            rewardEmerald: rewardEm
          });
          showToast(
            rewardEm > 0
              ? 'Hata kaydı güncellendi, oyuncuya +100 Zümrüt ödülü ve bildirim gönderildi!'
              : 'Hata kaydı güncellendi ve oyuncuya bildirim gönderildi.',
            'success'
          );
          syncHeaderAndDrawer();
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const sugStatusBtn = e.target.closest('[data-admin-sug-status]');
      if (sugStatusBtn) {
        const sId = sugStatusBtn.getAttribute('data-admin-sug-status');
        const statusVal = sugStatusBtn.getAttribute('data-status');
        const note = document.getElementById(`adm-sug-note-${sId}`)?.value || '';
        const rewardEm = document.getElementById(`adm-sug-reward-${sId}`)?.checked ? 100 : 0;
        try {
          svc().suggestionService.adminUpdateSuggestion(session, sId, {
            status: statusVal,
            adminNote: note,
            rewardEmerald: rewardEm
          });
          showToast(
            rewardEm > 0
              ? 'Öneri durumu güncellendi, oyuncuya +100 Zümrüt ödülü ve bildirim gönderildi!'
              : 'Öneri durumu güncellendi ve oyuncuya bildirim gönderildi.',
            'success'
          );
          syncHeaderAndDrawer();
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

    // Admin Form Gönderimleri (Yeni Rütbe, Gemini AI, Özel Bakiye, Mağaza Ürünü, Ekonomi, Stripe, Bildirim, Genel Ayarlar)
    document.addEventListener('submit', e => {
      const session = getSession();
      if (!session) return;

      if (e.target.id === 'admin-create-rank-form') {
        e.preventDefault();
        try {
          const featuresRaw = document.getElementById('adm-new-rank-features')?.value || '';
          const features = featuresRaw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          const created = svc().rankService.adminCreateRank(session, {
            id: document.getElementById('adm-new-rank-id')?.value || '',
            name: document.getElementById('adm-new-rank-name')?.value || '',
            netheritePrice: Number(document.getElementById('adm-new-rank-netherite')?.value || 500),
            order: Number(document.getElementById('adm-new-rank-order')?.value || 5),
            dailyEmerald: Number(document.getElementById('adm-new-rank-daily-em')?.value || 250),
            dailyNetherite: Number(document.getElementById('adm-new-rank-daily-ne')?.value || 50),
            color: document.getElementById('adm-new-rank-color')?.value || '#f43f5e',
            badge: document.getElementById('adm-new-rank-badge')?.value || '👑',
            maxPartySize: Number(document.getElementById('adm-new-rank-party-size')?.value || 8),
            emeraldMultiplier: Number(document.getElementById('adm-new-rank-multiplier')?.value || 1.5),
            purchasable: document.getElementById('adm-new-rank-purchasable')?.checked !== false,
            features
          });
          showToast(`👑 "${created.name}" (${created.id}) rütbesi başarıyla oluşturuldu!`, 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-ai-config-form') {
        e.preventDefault();
        try {
          svc().aiQuestionService.updateConfig(session, {
            apiKey: document.getElementById('adm-ai-api-key')?.value || '',
            model: document.getElementById('adm-ai-model')?.value || 'gemini-2.5-flash',
            batchSize: Number(document.getElementById('adm-ai-batch-size')?.value || 15),
            enabled: document.getElementById('adm-ai-enabled')?.checked !== false,
            autoGenerateBeforeMatch: document.getElementById('adm-ai-auto-match')?.checked !== false
          });
          showToast('🤖 Gemini API Anahtarı ve Soru Üretici ayarları kaydedildi!', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-custom-currency-form') {
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
          const maintenanceActive = document.getElementById('adm-set-maintenance')?.checked || false;
          svc().backupService.updatePlatformSettings(session, {
            siteTitle: document.getElementById('adm-set-title')?.value || 'Minecraft Milyoner',
            announcementText: document.getElementById('adm-set-announcement')?.value || '',
            maintenanceMode: Boolean(maintenanceActive)
          });
          if (svc().maintenanceService) {
            svc().maintenanceService.setMaintenanceMode(session, maintenanceActive);
          }
          showToast('Platform ayarları ve Bakım Modu başarıyla güncellendi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Çoklu Bilgisayar Bulut Senkronizasyonu geldiğinde ekranı canlı yenile
    window.addEventListener('mcm:cloud-synced', () => {
      const currentSess = getSession();
      if (!currentSess) {
        const gate = document.getElementById('access-gate');
        if (gate) gate.classList.remove('hidden');
      }
      syncHeaderAndDrawer();
      if (state.currentScreen === 'leaderboard') renderLeaderboard();
      else if (state.currentScreen === 'shop') renderShop();
      else if (state.currentScreen === 'profile') renderProfile();
      else if (state.currentScreen === 'party') renderParty();
      else if (state.currentScreen === 'notifications') renderNotifications();
      else if (state.currentScreen === 'support') renderSupport();
      else if (state.currentScreen === 'bug-report') renderBugReports();
      else if (state.currentScreen === 'suggestions') renderSuggestions();
      else if (state.currentScreen === 'stats') renderStats();
      else if (state.currentScreen === 'admin') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          renderAdmin();
        }
      }

      // ======================================================
      // PARTİ MAÇ SENKRONİZASYONU: Lider maçı başlattığında
      // diğer oyuncuların ekranında da otomatik başlat
      // ======================================================
      if (!currentSess) return;
      try {
        const activeParty = svc().partyService?.getActivePartyForUser(currentSess.username);
        if (activeParty && activeParty.status === 'IN_GAME' && activeParty.matchId) {
          const isLeader =
            activeParty.leaderUsername.toLowerCase() === currentSess.username.toLowerCase() ||
            currentSess.isAdminSession;

          // Şu an bir oyun oynuyor mu kontrol et
          const gameAlreadyActive = window.MCMGameState?.active === true;
          const lastStartedMatchId = window._lastStartedMatchId || '';

          if (!gameAlreadyActive && lastStartedMatchId !== activeParty.matchId) {
            // Bu maç henüz başlatılmamış
            window._lastStartedMatchId = activeParty.matchId;

            if (isLeader && activeParty.hostRole === 'JUDGE') {
              // Lider + Jüri modu: Jüri oturumu başlat
              if (typeof window.startPartyJudgeSession === 'function') {
                window.startPartyJudgeSession(activeParty);
              } else if (typeof window.startNewGameSession === 'function') {
                window.startNewGameSession(true);
              }
            } else if (!isLeader) {
              // Katılımcı: Parti sorularını kullanarak oyunu başlat
              if (typeof window.startPartyGameSession === 'function') {
                window.startPartyGameSession(activeParty);
              } else if (typeof window.startNewGameSession === 'function') {
                showToast('⚔️ Parti maçı başladı! Oyuna giriyorsunuz...', 'success', 2000);
                setTimeout(() => {
                  window.startNewGameSession(true);
                }, 800);
              }
            } else if (isLeader && activeParty.hostRole === 'PLAYER') {
              // Lider + Katılımcı modu
              if (typeof window.startNewGameSession === 'function') {
                window.startNewGameSession(true);
              }
            }
          }
        }
      } catch (_e) {
        // Senkronizasyon hatası sessizce yutulur
      }
    });

    // Tarayıcı ve Android Donanım Geri/İleri butonları (FreeWebToAPK desteği)
    window.addEventListener('popstate', () => {
      // 1. Çekmece açıksa önce çekmeceyi kapat
      const drawer = document.getElementById('side-drawer');
      if (drawer && drawer.classList.contains('open')) {
        closeDrawer();
        return;
      }

      // 2. Açık modal pencere varsa önce onu kapat
      const openModal = document.querySelector('.mc-modal:not(.hidden)');
      if (openModal) {
        openModal.classList.add('hidden');
        return;
      }

      // 3. Ekrana geçiş yap
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && document.getElementById(`screen-${hash}`)) {
        navigateToScreen(hash, { skipHistory: true });
      } else {
        navigateToScreen('welcome', { skipHistory: true });
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
    showToast,
    copyDiagnosticsReport
  };
})(window);
