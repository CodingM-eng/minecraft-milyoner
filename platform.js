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
      // İkili Kopyalama Eylemleri (#4): Kullanıcı dostu mesaj ve temizlenmiş teknik hata kodu
      const btnWrap = document.createElement('span');
      btnWrap.style.cssText = 'display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle;';

      const copyMsgBtn = document.createElement('button');
      copyMsgBtn.type = 'button';
      copyMsgBtn.className = 'mc-btn mc-btn-secondary mc-btn-xs';
      copyMsgBtn.style.cssText = 'padding: 2px 6px; font-size: 0.72rem; white-space: nowrap; cursor: pointer;';
      copyMsgBtn.innerHTML = '📋 Mesajı Kopyala';
      copyMsgBtn.title = 'Kullanıcı dostu hata mesajını kopyala';
      copyMsgBtn.onclick = e => {
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(String(message)).then(() => {
            copyMsgBtn.innerHTML = '✅ Kopyalandı!';
            setTimeout(() => (copyMsgBtn.innerHTML = '📋 Mesajı Kopyala'), 2000);
          });
        }
      };

      const copyTechBtn = document.createElement('button');
      copyTechBtn.type = 'button';
      copyTechBtn.className = 'mc-btn mc-btn-secondary mc-btn-xs';
      copyTechBtn.style.cssText = 'padding: 2px 6px; font-size: 0.72rem; white-space: nowrap; cursor: pointer;';
      copyTechBtn.innerHTML = '⚙️ Hata Kodunu Kopyala';
      copyTechBtn.title = 'Teknik hata ve tanı kodunu kopyala';
      copyTechBtn.onclick = e => {
        e.stopPropagation();
        const techCode = options?.errorCode || `ERR_${String(message).toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 24)}_${Date.now().toString(36)}`;
        copyDiagnosticsReport(techCode);
        copyTechBtn.innerHTML = '✅ Kopyalandı!';
        setTimeout(() => (copyTechBtn.innerHTML = '⚙️ Hata Kodunu Kopyala'), 2000);
      };

      btnWrap.appendChild(copyMsgBtn);
      btnWrap.appendChild(copyTechBtn);
      toast.appendChild(btnWrap);
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

    // Moderatör ve Destek Butonu Görünürlüğü
    const effectiveRole = svc().authGuard?.getEffectiveRole(session);
    const drawerModBtn = document.getElementById('drawer-btn-moderator');
    const drawerTicketBtn = document.getElementById('drawer-btn-ticket');
    if (drawerModBtn) {
      drawerModBtn.classList.toggle('hidden', !(effectiveRole === 'MODERATOR' || effectiveRole === 'ADMIN'));
    }
    if (drawerTicketBtn) {
      drawerTicketBtn.classList.toggle('hidden', !(effectiveRole === 'TICKET' || effectiveRole === 'MODERATOR' || effectiveRole === 'ADMIN'));
    }

    // MVP / MVIP Bilge Asistan Yüzen Butonu Görünürlüğü (order >= 4 veya staff)
    const floatingAiBtn = document.getElementById('floating-ai-btn');
    if (floatingAiBtn) {
      const userRank = svc().rankService?.getUserRank(user.username);
      const canAccessAi = (userRank && userRank.order >= 4) || effectiveRole === 'ADMIN' || effectiveRole === 'MODERATOR';
      floatingAiBtn.classList.toggle('hidden', !canAccessAi);
    }

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

    // Moderatör ekranı güvenlik kontrolü
    if (screenKey === 'moderator') {
      const effRole = svc().authGuard?.getEffectiveRole(session);
      if (effRole !== 'MODERATOR' && effRole !== 'ADMIN') {
        showToast('Moderatör paneline yalnızca yetkili moderatör veya yöneticiler erişebilir!', 'error');
        navigateToScreen('welcome');
        return;
      }
    }

    // Destek Yetkili ekranı güvenlik kontrolü
    if (screenKey === 'ticket') {
      const effRole = svc().authGuard?.getEffectiveRole(session);
      if (effRole !== 'TICKET' && effRole !== 'MODERATOR' && effRole !== 'ADMIN') {
        showToast('Destek yetkili paneline yalnızca yetkili personel erişebilir!', 'error');
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
      case 'sponsors':
        renderSponsors();
        break;
      case 'admin':
        renderAdmin();
        break;
      case 'moderator':
        renderModerator();
        break;
      case 'ticket':
        renderTicket();
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
      const hasEmail = Boolean(user.email && String(user.email).trim().includes('@'));
      const isVerified = Boolean(
        user.emailVerified ||
        session.emailVerified ||
        (hasEmail && (user.firebaseUid || user.drivePermissionGranted || String(user.email).toLowerCase() === 'codingdevelopia@gmail.com' || hasEmail))
      );
      verifiedTagEl.textContent = isVerified ? '✓ Doğrulandı' : '⚠️ Doğrulanmadı';
      verifiedTagEl.className = isVerified ? 'role-badge role-member' : 'role-badge role-muted';
      verifiedTagEl.title = isVerified ? 'E-posta adresi OTP onay kodu ile doğrulanmıştır.' : 'E-posta henüz doğrulanmamış.';
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
        cosContainer.innerHTML = `<div class="empty-state-box">Henüz kozmetik ürününüz yok. <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-nav-screen="shop">Mağaza'ya Git</button></div>`;
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
    // Telegram Bağlantı Durumu
    const telegramStatusText = document.getElementById('profile-telegram-status-text');
    const telegramToggleBtn = document.getElementById('btn-profile-toggle-telegram');
    if (telegramStatusText && telegramToggleBtn) {
      if (user.telegramId || user.telegramUsername) {
        const tgName = user.telegramUsername ? `@${user.telegramUsername}` : user.telegramId;
        telegramStatusText.innerHTML = `Telegram: <strong style="color:#229ED9;">${escapeHtml(tgName)}</strong> (Bağlı)`;
        telegramToggleBtn.textContent = 'Bağlantıyı Kaldır';
        telegramToggleBtn.className = 'mc-btn mc-btn-sm mc-btn-danger';
        telegramToggleBtn.dataset.telegramAction = 'unlink';
      } else {
        telegramStatusText.textContent = 'Telegram: Bağlı Değil';
        telegramToggleBtn.textContent = 'Hesabı Bağla';
        telegramToggleBtn.className = 'mc-btn mc-btn-sm mc-btn-primary';
        telegramToggleBtn.dataset.telegramAction = 'link';
      }
    }

    // Discord Bağlantı Durumu (#2)
    const discordStatusText = document.getElementById('profile-discord-status-text');
    const discordToggleBtn = document.getElementById('btn-profile-toggle-discord');
    if (discordStatusText && discordToggleBtn) {
      const discId = user.discord?.id || user.discordId;
      const discTag = user.discord?.username || user.discordTag || user.discordUsername || discId;
      if (discId) {
        discordStatusText.innerHTML = `Discord: <strong style="color:#5865F2;">${escapeHtml(discTag)}</strong> (Bağlı)`;
        discordToggleBtn.textContent = 'Bağlantıyı Kaldır';
        discordToggleBtn.className = 'mc-btn mc-btn-sm mc-btn-danger';
        discordToggleBtn.dataset.discordAction = 'unlink';
      } else {
        discordStatusText.textContent = 'Discord: Bağlı Değil';
        discordToggleBtn.textContent = 'Hesabı Bağla';
        discordToggleBtn.className = 'mc-btn mc-btn-sm mc-btn-primary';
        discordToggleBtn.dataset.discordAction = 'link';
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

  function renderRankComparisonModal() {
    const container = document.getElementById('dynamic-rank-comp-container');
    if (!container) return;

    const ranks = svc().rankService.getAllRanks();
    const displayRanks = ranks.filter(r => ['MEMBER', 'VIP', 'VIP_PLUS', 'MVIP', 'MVIP_PLUS'].includes(r.id));
    const session = getSession();
    const userRank = session ? (svc().rankService?.getUserRank(session.username) || { id: 'MEMBER', order: 1 }) : { id: 'MEMBER', order: 1 };

    const tableHtml = `
      <div class="rank-comp-card-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
        <table class="mc-table rank-comp-table" style="width:100%;min-width:680px;font-size:0.86rem;border-collapse:collapse;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="text-align:left;min-width:140px;position:sticky;left:0;background:#0f172a;z-index:2;padding:10px;">Özellik / Ayrıcalık</th>
              ${displayRanks
                .map(
                  r => `
                <th style="color:${r.color};text-align:center;padding:10px;border-left:1px solid #334155;">
                  <div style="font-size:1.2rem;">${r.badge || ''}</div>
                  <div style="font-weight:bold;margin-top:2px;">${r.name}</div>
                  ${userRank.id === r.id ? `<span style="display:inline-block;margin-top:4px;font-size:0.7rem;padding:2px 6px;background:#10b981;color:#fff;border-radius:4px;">MEVCUT</span>` : ''}
                </th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Fiyat (Stripe / TRY)</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.priceTry ? `<strong style="color:#22c55e;">${Number(r.priceTry).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</strong>` : '<span style="color:#94a3b8;">Ücretsiz</span>'}</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Netherite Fiyatı</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.netheritePrice ? `<strong style="color:#f8fafc;">${Number(r.netheritePrice).toLocaleString('tr-TR')} ⬛</strong>` : '-'}</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>İlk Satın Alma Bonusu</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.id === 'VIP' ? '<span style="color:#facc15;font-weight:bold;">+50 ⬛ Netherite</span>' : ['VIP_PLUS', 'MVIP', 'MVIP_PLUS'].includes(r.id) ? '<span style="color:#facc15;font-weight:bold;">+250 ⬛ Netherite</span>' : '-'}</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Günlük Zümrüt Ödülü</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;"><strong style="color:#10b981;">+${r.dailyEmerald || 50} 🟢</strong></td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Günlük Netherite Ödülü</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.dailyNetherite > 0 ? `<strong style="color:#94a3b8;">+${r.dailyNetherite} ⬛</strong>` : '-'}</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Zümrüt Çarpanı</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.permissions?.emeraldMultiplier || '1.0'}x</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Maksimum Parti Kapasitesi</strong></td>
              ${displayRanks
                .map(r => `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${r.permissions?.maxPartySize || 4} Kişi</td>`)
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Destek / Hata Önceliği</strong></td>
              ${displayRanks
                .map(r => {
                  const prioMap = { NORMAL: 'Normal', HIGH: 'Yüksek', VERY_HIGH: 'Çok Yüksek', CRITICAL: 'Kritik / Anında' };
                  return `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">${prioMap[r.permissions?.supportPriority || 'NORMAL'] || 'Normal'}</td>`;
                })
                .join('')}
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Sohbet & İsim Efektleri</strong></td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Standart Beyaz</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;color:#38bdf8;">VIP Gökyüzü Mavisi</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;color:#c084fc;">VIP+ Eflatun Işıltı</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;color:#facc15;">MVIP Altın Gradyan</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;color:#ec4899;">MVIP+ RGB Gökkuşağı</td>
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Özel Çerçeveler & Rozetler</strong></td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Standart Çerçeve</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Altın Muhafız</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Elmas Kristal</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Antik Netherite</td>
              <td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">Ender Ejderhası & Ametist</td>
            </tr>
            <tr>
              <td style="position:sticky;left:0;background:#1e293b;z-index:1;padding:8px 10px;"><strong>Satın Al / Yükselt</strong></td>
              ${displayRanks
                .map(r => {
                  if (r.id === 'MEMBER') return '<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">-</td>';
                  const isOwnedOrHigher = userRank.order >= r.order;
                  if (isOwnedOrHigher) {
                    return `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;"><span style="color:#10b981;font-weight:bold;">✓ Sahipsiniz</span></td>`;
                  }
                  return `<td style="text-align:center;padding:8px 10px;border-left:1px solid #334155;">
                    <button type="button" class="mc-btn mc-btn-xs mc-btn-gold" data-stripe-buy-rank="${r.id}">
                      Satın Al
                    </button>
                  </td>`;
                })
                .join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHtml;
  }
  window.MCMPlatform = window.MCMPlatform || {};
  window.MCMPlatform.renderRankComparisonModal = renderRankComparisonModal;

  function renderShopRanksGrid(user, userRank) {
    const container = document.getElementById('ranks-grid-container');
    if (!container) return;

    const rankPricesTry = { VIP: 89.90, VIP_PLUS: 159.90, MVIP: 299.90, MVIP_PLUS: 449.90 };
    const purchasableRanks = svc().rankService.getPurchasableRanks(); // VIP, VIP+, MVIP, MVIP+ ve özel rütbeler

    const compHeaderHtml = `
      <div class="ranks-compare-banner" style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center; background:rgba(30, 41, 59, 0.7); border:1px solid #38bdf8; border-radius:6px; padding:10px 14px; margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:1.2rem;">👑</span>
          <span style="font-size:0.9rem;color:#f8fafc;">Tüm rütbelerin günlük ödüllerini, kozmetiklerini ve ayrıcalıklarını inceleyin:</span>
        </div>
        <button type="button" id="btn-open-rank-comparison" class="mc-btn mc-btn-sm mc-btn-gold">
          👑 Rütbe Karşılaştırma Tablosu
        </button>
      </div>
    `;

    container.innerHTML = compHeaderHtml + purchasableRanks
      .map(rank => {
        const isOwnedOrHigher = userRank.order >= rank.order;
        const isCurrent = userRank.id === rank.id;
        const nPrice = Math.max(500, Number(rank.netheritePrice || 500));
        const tryPrice = Number(rankPricesTry[rank.id] || 89.90);
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
              <div class="rank-price-main">${tryPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ <span style="font-size:0.85rem;color:#94a3b8;">/ Stripe</span></div>
              <div class="rank-price-sub">${nPrice.toLocaleString('tr-TR')} ${mcIcon('NETHERITE', 13)} Netherite ile de alınabilir</div>
            </div>

            <ul class="rank-features-list">
              ${(rank.features || []).map(f => `<li>✓ ${replaceEmojis(escapeHtml(f), 14)}</li>`).join('')}
            </ul>

            <div class="rank-card-actions">
              ${
                isOwnedOrHigher
                  ? `<button type="button" class="mc-btn mc-btn-secondary mc-btn-block" disabled>✓ Bu Rütbeye Sahipsiniz</button>`
                  : `
                    <!-- Gerçek Para Stripe Checkout (#2) -->
                    <button type="button" class="mc-btn mc-btn-gold mc-btn-block" data-stripe-buy-rank="${escapeHtml(
                      rank.id
                    )}">
                      💳 Stripe ile Satın Al (${tryPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺)
                    </button>
                    <!-- Netherite Bakiyesi İle Satın Al -->
                    <button type="button" class="mc-btn mc-btn-primary mc-btn-block" data-buy-rank="${escapeHtml(
                      rank.id
                    )}" data-pay-method="NETHERITE">
                      ${mcIcon('NETHERITE', 15)} ${nPrice.toLocaleString('tr-TR')} Netherite ile Satın Al
                    </button>
                  `
              }
              <!-- Arkadaşına Hediye Et Butonu -->
              <button type="button" class="mc-btn mc-btn-gift mc-btn-block" data-gift-rank="${escapeHtml(
                rank.id
              )}">
                🎁 Arkadaşına Hediye Et (${tryPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ / ${nPrice.toLocaleString('tr-TR')} N)
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

    const { shopService, rankService, avatarService, sponsorService } = svc();
    const searchQuery = String(document.getElementById('shop-search-input')?.value || '').trim().toLowerCase();

    // Özel Sekme 1: Sponsor Ürünleri
    if (category === 'Sponsors') {
      const activeSponsors = sponsorService ? sponsorService.getActiveSponsors() : [];
      if (activeSponsors.length === 0) {
        grid.innerHTML = `<div class="empty-state-box" style="grid-column:1/-1;">Şu anda aktif bir sponsorluk kampanyası bulunmamaktadır.</div>`;
        return;
      }
      grid.innerHTML = activeSponsors
        .map(sp => {
          const typeNames = {
            TYPE_A: 'Geçici Sponsor Rütbesi',
            TYPE_B: 'Kalıcı Ödül & Kozmetik',
            TYPE_C: 'Sponsor Rütbesi + Kalıcı Ödül Paketi'
          };
          return `
            <div class="shop-item-card" style="border-top: 4px solid #f59e0b;">
              <div class="shop-item-top">
                <span class="shop-item-icon">${sp.logo || '🤝'}</span>
                <span class="shop-item-cat-tag">Resmi Sponsor</span>
              </div>
              <h4 class="shop-item-title">${escapeHtml(sp.name)}</h4>
              <p class="shop-item-desc">${escapeHtml(sp.description || '')}</p>
              <div class="rank-daily-netherite-pill" style="margin-bottom:10px;">
                🎁 <strong>Model:</strong> ${typeNames[sp.type] || sp.type}
              </div>
              <div class="rank-daily-netherite-pill muted" style="margin-bottom:10px;">
                ✨ <strong>Özel Eşya:</strong> ${escapeHtml(sp.sponsoredCosmeticName || 'Özel Çerçeve')}
              </div>
              <div class="shop-item-actions">
                <button type="button" class="mc-btn mc-btn-gold mc-btn-block" disabled>
                  ✓ Aktif Sponsorluk Ortaklığı
                </button>
              </div>
            </div>
          `;
        })
        .join('');
      return;
    }

    // Özel Sekme 2: Hediye Gönder
    if (category === 'Gift') {
      grid.innerHTML = `
        <div class="shop-item-card" style="grid-column: 1 / -1; max-width: 600px; margin: 0 auto; text-align: center; padding: 24px;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🎁</div>
          <h3 style="color:#facc15;margin-bottom:8px;">Arkadaşına Rütbe veya Kozmetik Hediye Et</h3>
          <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px;">
            Arkadaşlarınızın bilgi yarışması yolculuğuna destek olun! Rütbeler sekmesinden herhangi bir rütbenin altındaki <strong>"🎁 Arkadaşına Hediye Et"</strong> butonuna tıklayarak doğrudan arkadaşınızın adına hediye satın alabilirsiniz.
          </p>
          <button type="button" class="mc-btn mc-btn-gold" onclick="document.querySelector('[data-shop-cat=Ranks]')?.click()">
            👑 Rütbeleri İncele ve Hediye Gönder
          </button>
        </div>
      `;
      return;
    }

    // Özel Sekme 3: Satın Aldıklarım (Envanter)
    if (category === 'Inventory') {
      const ownedList = Array.isArray(user.ownedCosmetics) ? user.ownedCosmetics : [];
      const purchases = shopService.getUserPurchases(user.username);
      if (ownedList.length === 0 && purchases.length === 0) {
        grid.innerHTML = `<div class="empty-state-box" style="grid-column:1/-1;">Henüz satın aldığınız bir eşya veya kozmetik bulunmuyor.</div>`;
        return;
      }
      const allCatalogItems = shopService.getAllItems(true);
      const userItems = allCatalogItems.filter(i => ownedList.includes(i.id));

      grid.innerHTML = userItems
        .map(item => {
          const isEquipped = Object.values(user.equippedCosmetics || {}).includes(item.id);
          return `
            <div class="shop-item-card">
              <div class="shop-item-top">
                <span class="shop-item-icon">${mcIcon(item.id || item.icon, 28)}</span>
                <span class="shop-item-cat-tag">Envanterinizde</span>
              </div>
              <h4 class="shop-item-title">${escapeHtml(item.name)}</h4>
              <p class="shop-item-desc">${escapeHtml(item.description)}</p>
              <div class="rank-daily-netherite-pill" style="margin-bottom:10px;">
                🛡️ <strong>Kalıcı Sahiplik:</strong> Hesabınıza tanımlıdır.
              </div>
              <div class="shop-item-actions">
                <button type="button" class="mc-btn ${
                  isEquipped ? 'mc-btn-secondary' : 'mc-btn-primary'
                } mc-btn-block" data-equip-cosmetic="${escapeHtml(item.id)}">
                  ${isEquipped ? '✓ Kuşanıldı (Çıkarmak İçin Tıkla)' : '✨ Hemen Kuşan'}
                </button>
              </div>
            </div>
          `;
        })
        .join('');
      return;
    }

    let items = shopService.getItemsByCategory(category);
    if (searchQuery) {
      items = items.filter(
        i =>
          String(i.name || '').toLowerCase().includes(searchQuery) ||
          String(i.description || '').toLowerCase().includes(searchQuery)
      );
    }

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
      grid.innerHTML = `<div class="empty-state-box" style="grid-column:1/-1;">Bu kriterlere uygun ürün bulunamadı.</div>`;
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
            const vState = activeParty.voiceStates?.[m.username.toLowerCase()] || {};
            let voiceBadgeHtml = '';
            if (vState.isSpeaking) {
              voiceBadgeHtml = `<span class="party-voice-badge speaking" title="Şu an konuşuyor">🎙️ Konuşuyor</span>`;
            } else if (vState.isMuted === false) {
              voiceBadgeHtml = `<span class="party-voice-badge" style="background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.4);" title="Mikrofon açık">🎙️ Açık</span>`;
            } else {
              voiceBadgeHtml = `<span class="party-voice-badge muted" title="Mikrofon kapalı">🔇 Sessiz</span>`;
            }

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
                  ${voiceBadgeHtml}
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

      // Parti Mesaj ve Reaksiyon Akışını Güncelle
      const chatBox = document.getElementById('party-chat-messages');
      if (chatBox) {
        const msgs = Array.isArray(activeParty.chatMessages) ? activeParty.chatMessages : [];
        if (msgs.length === 0) {
          chatBox.innerHTML = `<div class="party-chat-msg-row" style="color:#64748b;font-style:italic;">Parti içi sesli ve yazılı reaksiyonlar burada görünür...</div>`;
        } else {
          chatBox.innerHTML = msgs
            .map(msg => {
              const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit'
              });
              return `
                <div class="party-chat-msg-row">
                  <span style="color:#64748b;font-size:0.72rem;">[${timeStr}]</span>
                  <strong>${escapeHtml(msg.username)}:</strong>
                  <span>${escapeHtml(msg.text)}</span>
                </div>
              `;
            })
            .join('');
          chatBox.scrollTop = chatBox.scrollHeight;
        }
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

    try {
      partyVoiceEngine?.populateDeviceSelector?.();
    } catch (_e) {}
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
  // 10. DESTEK SİSTEMİ (renderSupport & Floating Modal Widget)
  // ==========================================
  let activeSelectedSupportTicketId = null;

  function renderSupport() {
    const session = getSession();
    if (!session) return;
    const listEl = document.getElementById('support-tickets-list');
    const widgetHistoryEl = document.getElementById('support-tickets-history');

    const tickets = svc().supportService.getUserTickets(session.username);

    // 1. Ekrandaki destek listesi (#support-tickets-list)
    if (listEl) {
      if (tickets.length === 0) {
        listEl.innerHTML = `<div class="empty-state-box">Henüz destek talebiniz bulunmuyor. Sağ alttaki 🎧 butonundan veya formdan talep oluşturabilirsiniz.</div>`;
      } else {
        listEl.innerHTML = tickets
          .map(
            t => `
            <div class="ticket-card" style="cursor:pointer;" onclick="window.MCMPlatform?.openSupportWidgetWithTicket?.('${escapeHtml(t.id)}')">
              <div class="ticket-header">
                <strong>#${escapeHtml(t.id)} — ${escapeHtml(t.subject)}</strong>
                <span class="status-pill status-${escapeHtml(t.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(
              t.status
            )}</span>
              </div>
              <p class="ticket-meta">Kategori: ${escapeHtml(t.category)} • ${t.claimedBy ? `Yetkili: <strong>${escapeHtml(t.claimedBy)}</strong> • ` : ''}${formatDateTR(t.createdAt)}</p>
              <div class="ticket-messages">
                ${(t.messages || [])
                  .slice(-2)
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
    }

    // 2. Yüzen Destek Modalı (#support-tickets-history)
    if (widgetHistoryEl) {
      if (tickets.length === 0) {
        widgetHistoryEl.innerHTML = `
          <div class="empty-state-box" style="padding: 20px; text-align: center; color: #94a3b8;">
            Henüz açık bir destek talebiniz yok.<br />
            Yukarıdaki <strong>"➕ Yeni Talep Aç"</strong> butonuna tıklayarak ilk talebinizi oluşturabilirsiniz.
          </div>
        `;
        const replyBox = document.getElementById('support-reply-box');
        if (replyBox) replyBox.classList.add('hidden');
      } else {
        // Eğer seçili bilet yoksa ilk bileti varsayılan yap
        if (!activeSelectedSupportTicketId || !tickets.find(t => t.id === activeSelectedSupportTicketId)) {
          activeSelectedSupportTicketId = tickets[0].id;
        }

        const selectedTicket = tickets.find(t => t.id === activeSelectedSupportTicketId) || tickets[0];
        const replyBox = document.getElementById('support-reply-box');
        if (replyBox) replyBox.classList.remove('hidden');

        let ticketSelectorHtml = `
          <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1);">
            ${tickets
              .map(
                t => `
              <button type="button" class="mc-btn mc-btn-xs ${t.id === selectedTicket.id ? 'mc-btn-primary' : 'mc-btn-secondary'}" data-select-ticket="${escapeHtml(t.id)}" style="white-space:nowrap;">
                #${escapeHtml(t.id)} (${escapeHtml(t.status)})
              </button>
            `
              )
              .join('')}
          </div>
        `;

        let convoHeader = `
          <div style="background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:6px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#6ee7b7; font-size:0.88rem;">#${escapeHtml(selectedTicket.id)}: ${escapeHtml(selectedTicket.subject)}</strong>
              <span class="status-pill status-${escapeHtml(selectedTicket.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(selectedTicket.status)}</span>
            </div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">
              Kategori: <strong>${escapeHtml(selectedTicket.category)}</strong> ${selectedTicket.claimedBy ? `• Yetkili: <strong style="color:#fde047;">${escapeHtml(selectedTicket.claimedBy)}</strong>` : '• <em>Yetkili atanması bekleniyor</em>'}
            </div>
          </div>
        `;

        let messagesHtml = (selectedTicket.messages || [])
          .map(m => {
            const isAdmin = m.senderRole === 'ADMIN';
            return `
              <div class="chat-bubble ${isAdmin ? 'bubble-admin' : 'bubble-user'}" style="margin-bottom:8px; max-width:85%; align-self:${isAdmin ? 'flex-start' : 'flex-end'}; background:${isAdmin ? 'rgba(30,58,138,0.7)' : 'rgba(5,150,105,0.7)'}; border:1px solid ${isAdmin ? '#3b82f6' : '#10b981'}; border-radius:8px; padding:8px 12px;">
                <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px; font-size:0.75rem; color:${isAdmin ? '#93c5fd' : '#a7f3d0'};">
                  <strong>${escapeHtml(m.sender)} ${isAdmin ? '🛡️ (Yetkili)' : '👤'}</strong>
                  <span>${formatDateTR(m.timestamp || m.createdAt)}</span>
                </div>
                <div style="font-size:0.86rem; color:#f8fafc; line-height:1.4; word-break:break-word;">
                  ${escapeHtml(m.text)}
                </div>
              </div>
            `;
          })
          .join('');

        widgetHistoryEl.innerHTML = ticketSelectorHtml + convoHeader + messagesHtml;
        widgetHistoryEl.scrollTop = widgetHistoryEl.scrollHeight;
      }
    }
  }

  function openSupportWidgetWithTicket(ticketId) {
    activeSelectedSupportTicketId = ticketId;
    const modal = document.getElementById('modal-support-widget');
    if (modal) {
      modal.classList.remove('hidden');
      const tabList = document.getElementById('tab-support-list');
      if (tabList) tabList.click();
      renderSupport();
    }
  }

  // ==========================================
  // SPONSORLAR VE KOZMETİKLER (renderSponsors)
  // ==========================================
  function renderSponsors() {
    const container = document.getElementById('sponsors-grid-container');
    if (!container) return;

    const sponsors = svc().sponsorService?.getActiveSponsors?.() || [];
    if (sponsors.length === 0) {
      container.innerHTML = `
        <div class="platform-card" style="grid-column: 1 / -1; text-align: center; padding: 30px 20px;">
          <h3 style="color: #cbd5e1; margin-bottom: 8px;">💎 Aktif Sponsor Bulunmuyor</h3>
          <p style="color: #94a3b8; font-size: 0.88rem; margin: 0;">
            Şu anda süresi devam eden resmi sponsorluk bulunmamaktadır. Yeni turnuva sponsorlukları için destek ekibimizle iletişime geçebilirsiniz.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = sponsors
      .map(sp => {
        const cosmeticList = (sp.cosmetics || []).map(c => `
          <li style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>✨</span> <strong>${escapeHtml(c.name || c.id)}</strong> (${escapeHtml(c.type || 'Kozmetik')})
          </li>
        `).join('');

        return `
          <div class="platform-card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(56, 189, 248, 0.35); background: linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.7) 100%);">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.8rem;">💎</span>
                  <div>
                    <h3 style="margin: 0; color: #38bdf8; font-size: 1.15rem;">${escapeHtml(sp.name)}</h3>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Resmi Platform Destekçisi</span>
                  </div>
                </div>
                <span class="status-pill status-open" style="background: rgba(34,197,94,0.2); color: #86efac; border: 1px solid rgba(34,197,94,0.4);">✓ Aktif</span>
              </div>
              <p style="font-size: 0.86rem; color: #e2e8f0; line-height: 1.5; margin-bottom: 14px;">
                ${escapeHtml(sp.description || '')}
              </p>
              ${sp.cosmetics && sp.cosmetics.length > 0 ? `
                <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px 12px; margin-bottom: 14px;">
                  <span style="display: block; font-size: 0.78rem; color: #fde047; font-weight: bold; margin-bottom: 6px;">🎁 ÖZEL SPONSORLUK KOZMETİKLERİ:</span>
                  <ul style="margin: 0; padding-left: 14px; font-size: 0.82rem; color: #cbd5e1;">
                    ${cosmeticList}
                  </ul>
                </div>
              ` : ''}
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; color: #94a3b8;">
              <span>🗓️ Başlangıç: ${formatDateTR(sp.startDate)}</span>
              <span>⏳ Bitiş: ${formatDateTR(sp.endDate)}</span>
            </div>
          </div>
        `;
      })
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
          <form id="admin-economy-settings-form" class="platform-form" style="margin-bottom:24px;">
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

          <h3>📊 Platform Ekonomi ve Dolaşım Denetimi (#6)</h3>
          <div class="stats-kpi-grid" style="margin-bottom:20px;">
            <div class="kpi-card">
              <span class="kpi-val">${userService.getAllUsers().reduce((s, u) => s + Number(u.emeraldBalance || 0), 0).toLocaleString('tr-TR')} 🟢</span>
              <span class="kpi-label">Toplam Dolaşımdaki Zümrüt</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-val">${userService.getAllUsers().reduce((s, u) => s + Number(u.netheriteBalance || 0), 0).toLocaleString('tr-TR')} ⬛</span>
              <span class="kpi-label">Toplam Dolaşımdaki Netherite</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-val">1.000 🟢</span>
              <span class="kpi-label">Günlük Zümrüt Limiti (Kişi Başı)</span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 7. MAĞAZA (shop — Birleşik Mağaza Ürün Yönetimi + Yeni Ürün Ekleme + Özel Emojiler #3)
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

            <!-- Özel Emojiler & Canlı Önizleme (#3) -->
            <div class="input-group" style="margin-bottom:12px;">
              <label>ÖZEL İKON &amp; EMOJİ SEÇİCİ</label>
              <div class="emoji-picker-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                ${['💎', '🟢', '🛡️', '⚔️', '👑', '💥', '🔮', '🧚', '⛏️', '🏆', '🔥', '🌟', '🐉', '🏹', '🍎', '⚡'].map(em => `
                  <button type="button" class="mc-btn mc-btn-secondary mc-btn-xs btn-pick-emoji" data-emoji="${em}" style="font-size:1.1rem;padding:4px 8px;">${em}</button>
                `).join('')}
              </div>
              <div class="input-row-2">
                <input type="text" id="adm-shop-custom-emoji" placeholder="Örn: 💎 veya herhangi bir Unicode karakteri" value="💎" />
                <input type="text" id="adm-shop-custom-img" placeholder="Özel Piksel Resim URL (opsiyonel)" />
              </div>
              <div style="margin-top:6px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:0.82rem;color:#94a3b8;">Canlı Önizleme:</span>
                <span id="adm-shop-emoji-preview" style="font-size:1.4rem;display:inline-block;vertical-align:middle;">💎</span>
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

    // 8.1 İNDİRİMLER & KUPONLAR (discounts — İndirim & Kupon Yönetimi #15)
    if (state.adminTab === 'discounts') {
      const discounts = svc().discountService.getAllDiscounts();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🎟️ Yeni İndirim Kuponu Oluştur</h3>
          <form id="admin-create-discount-form" class="platform-form" style="margin-bottom:24px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>KUPON KODU</label>
                <input type="text" id="adm-disc-code" placeholder="Örn: YAZ2026, VIP10" style="text-transform:uppercase;" required />
              </div>
              <div class="input-group">
                <label>İNDİRİM YÜZDESİ (%)</label>
                <input type="number" id="adm-disc-percent" value="15" min="1" max="90" required />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>GEÇERLİ OLDUĞU RÜTBE / KAPSAM</label>
                <select id="adm-disc-applies">
                  <option value="ALL">Tüm Rütbeler &amp; Ürünler</option>
                  <option value="VIP">Yalnızca VIP</option>
                  <option value="VIP_PLUS">Yalnızca VIP+</option>
                  <option value="MVIP">Yalnızca MVIP</option>
                  <option value="MVIP_PLUS">Yalnızca MVIP+</option>
                </select>
              </div>
              <div class="input-group">
                <label>MAKSİMUM KULLANIM SAYISI</label>
                <input type="number" id="adm-disc-max-uses" value="100" min="1" />
              </div>
            </div>
            <button type="submit" class="mc-btn mc-btn-gold">🎟️ Kuponu Oluştur ve Yayınla</button>
          </form>

          <h3>📋 Aktif İndirim Kuponları (${discounts.length} Kupon)</h3>
          <div class="table-responsive">
            <table class="mc-table">
              <thead>
                <tr>
                  <th>Kupon Kodu</th>
                  <th>İndirim</th>
                  <th>Kapsam</th>
                  <th>Kullanım</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${discounts.length === 0 ? `<tr><td colspan="6" style="text-align:center;">Henüz indirim kuponu oluşturulmadı.</td></tr>` : discounts.map(d => `
                  <tr>
                    <td><strong><code>${escapeHtml(d.code)}</code></strong></td>
                    <td><span style="color:#22c55e;font-weight:bold;">%${d.discountPercent}</span></td>
                    <td>${escapeHtml(d.appliesTo || 'Tümü')}</td>
                    <td>${d.usedCount || 0} / ${d.maxUses || '∞'}</td>
                    <td>${d.active !== false ? '✓ Aktif' : 'Pasif'}</td>
                    <td>
                      <button type="button" class="mc-btn mc-btn-sm mc-btn-danger" data-admin-delete-discount="${escapeHtml(d.code)}">Sil</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    // 8.1.1 SPONSORLAR YÖNETİMİ (sponsors — Sponsorlar, Sözleşmeler, Fesih ve Delil Yönetimi)
    if (state.adminTab === 'sponsors') {
      const sponsorSvc = svc().sponsorService || { getAllSponsors: () => [] };
      const allSponsors = sponsorSvc.getAllSponsors ? sponsorSvc.getAllSponsors() : [];
      const activeTab = state.sponsorSubTab || 'list'; // 'list' veya 'builder'

      container.innerHTML = `
        <div class="admin-panel-section">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
            <div>
              <h3 style="margin:0;">💎 Sponsorluk ve İş Birliği Yönetim Sistemi</h3>
              <p class="card-sub" style="margin:4px 0 0 0;">
                Resmi sponsorluk sözleşmeleri, dijital imzalar, süre uzatma, fesih süreçleri ve kanıt yönetimi.
              </p>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="button" id="btn-admin-sponsor-subtab-list" class="mc-btn ${activeTab === 'list' ? 'mc-btn-primary' : 'mc-btn-secondary'} mc-btn-sm">
                📋 Mevcut Sponsorlar (${allSponsors.length})
              </button>
              <button type="button" id="btn-admin-sponsor-subtab-builder" class="mc-btn ${activeTab === 'builder' ? 'mc-btn-gold' : 'mc-btn-secondary'} mc-btn-sm">
                ✍️ Sponsorluk Sözleşmesi Oluştur
              </button>
            </div>
          </div>

          ${activeTab === 'builder' ? `
            <!-- SPONSORLUK SÖZLEŞMESİ OLUŞTURUCU (Gemini Destekli Şablon Taslağı) -->
            <div style="background:rgba(15,23,42,0.9);border:1px solid #3b82f6;border-radius:8px;padding:20px;margin-bottom:24px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
                <h4 style="margin:0;color:#fde047;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                  <span>📜</span> <span>Sponsorluk Sözleşmesi Oluştur &amp; Düzenle</span>
                </h4>
                <span class="role-badge role-vip" style="font-size:0.75rem;">Sürüm 1.0 (Değiştirilemez Hükümler Korumalı)</span>
              </div>

              <!-- Politika Uyarısı -->
              <div style="margin-bottom:16px;padding:12px 14px;background:rgba(234,179,8,0.12);border:1px solid #eab308;border-radius:6px;font-size:0.83rem;color:#fef08a;line-height:1.45;">
                ⚠️ <strong>SPONSORLUK POLİTİKASI VE KULLANICI HAKLARI GÜVENCESİ:</strong><br/>
                Sponsorluk süresi sona erdiğinde geçici sponsor rütbesi geri alınır; ancak oyuncuların önceden sahip olduğu veya satın aldığı asıl rütbeleri, Zümrüt/Netherite bakiyeleri ve kazanılmış hakları ASLA silinmez ve sıfırlanmaz.
              </div>

              <form id="admin-contract-builder-form" class="platform-form">
                <div class="input-row-2">
                  <div class="input-group">
                    <label>SPONSOR VEYA ŞİRKET ADI *</label>
                    <input type="text" id="adm-c-name" placeholder="Örn: CraftTurk Bilişim ve Sunucu Hizmetleri" required />
                  </div>
                  <div class="input-group">
                    <label>YETKİLİ TEMSİLCİ ADI VE SOYADI *</label>
                    <input type="text" id="adm-c-rep" placeholder="Örn: Ahmet Yılmaz" required />
                  </div>
                </div>

                <div class="input-row-2">
                  <div class="input-group">
                    <label>İLETİŞİM E-POSTA ADRESİ *</label>
                    <input type="email" id="adm-c-email" placeholder="iletisim@sponsor.com" required />
                  </div>
                  <div class="input-group">
                    <label>SPONSOR LOGOSU VEYA İKONU</label>
                    <input type="text" id="adm-c-logo" value="💎" placeholder="Emoji veya logo görseli (örn: 💎)" />
                  </div>
                </div>

                <div class="input-row-2">
                  <div class="input-group">
                    <label>SPONSORLUK PAKETİ</label>
                    <select id="adm-c-package">
                      <option value="Resmi Turnuva Ana Sponsorluğu">Resmi Turnuva Ana Sponsorluğu</option>
                      <option value="Özel Sunucu &amp; Topluluk Sponsorluğu">Özel Sunucu &amp; Topluluk Sponsorluğu</option>
                      <option value="Kozmetik &amp; Ödül Sponsorluğu">Kozmetik &amp; Ödül Sponsorluğu</option>
                      <option value="Özel Ortaklık">Özel Ortaklık</option>
                    </select>
                  </div>
                  <div class="input-group">
                    <label>SPONSORLUK TÜRÜ &amp; RÜTBE MODELİ</label>
                    <select id="adm-c-type">
                      <option value="TYPE_A">TYPE_A: Geçici Sponsor Rütbesi (Süre bitince rütbe sona erer)</option>
                      <option value="TYPE_B">TYPE_B: Kalıcı Ödül (Kozmetik/Rozet kalıcı tanımlanır)</option>
                      <option value="TYPE_C" selected>TYPE_C: Geçici Rütbe + Kalıcı Kozmetik (Kombine Paket)</option>
                    </select>
                  </div>
                </div>

                <div class="input-row-2">
                  <div class="input-group">
                    <label>TANIMLANACAK SPONSOR RÜTBESİ</label>
                    <select id="adm-c-rank">
                      <option value="VIP">VIP</option>
                      <option value="VIP_PLUS">VIP+</option>
                      <option value="MVIP">MVIP</option>
                      <option value="MVIP_PLUS">MVIP+</option>
                      <option value="">Rütbe Tanımlama (Yalnızca Kozmetik)</option>
                    </select>
                  </div>
                  <div class="input-group">
                    <label>ÖZEL KOZMETİK EŞYA ADI</label>
                    <input type="text" id="adm-c-cosmetic-name" placeholder="Örn: Altın Muhafız Parıltılı Çerçevesi" />
                  </div>
                </div>

                <!-- Tarih ve Süre Seçicileri (Zorunlu Türkçe Etiketler) -->
                <div class="input-row-2">
                  <div class="input-group">
                    <label>BAŞLANGIÇ TARİHİ *</label>
                    <input type="datetime-local" id="adm-c-start-date" required />
                  </div>
                  <div class="input-group">
                    <label>BİTİŞ TARİHİ *</label>
                    <input type="datetime-local" id="adm-c-end-date" required />
                  </div>
                </div>

                <div class="input-row-2">
                  <div class="input-group">
                    <label>SPONSORLUK SÜRESİ (GÜN)</label>
                    <input type="number" id="adm-c-duration" value="30" min="1" max="730" required />
                  </div>
                  <div class="input-group">
                    <label>SPONSORLUK AVANTAJLARI (ÖZET)</label>
                    <input type="text" id="adm-c-benefits" placeholder="Turnuva ana sayfa logosu, özel rozet ve sunucu duyuruları..." />
                  </div>
                </div>

                <div class="input-group">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <label style="margin:0;">SÖZLEŞME METNİ VE HÜKÜMLERİ (DÜZENLENEBİLİR ŞABLON) *</label>
                    <button type="button" id="btn-admin-gemini-draft-contract" class="mc-btn mc-btn-secondary mc-btn-xs" style="color:#38bdf8;">
                      🤖 Gemini ile Hükümleri İyileştir
                    </button>
                  </div>
                  <textarea id="adm-c-agreement-text" rows="10" style="font-family:monospace;font-size:0.83rem;line-height:1.45;" placeholder="Sözleşme hükümleri hazırlanıyor..." required></textarea>
                  <span class="input-hint">Tarih, taraf isimleri ve haklar kaydedilen sözleşme verilerinden dinamik olarak oluşturulur.</span>
                </div>

                <div class="input-row-2">
                  <div class="input-group">
                    <label>ÖZEL FESİH KOŞULLARI</label>
                    <textarea id="adm-c-termination-cond" rows="2" placeholder="Taraflar 7 takvim günü önceden yazılı bildirim ile haklı fesih hakkını kullanabilir."></textarea>
                  </div>
                  <div class="input-group">
                    <label>DELİL VE UYUŞMAZLIK KOŞULLARI</label>
                    <textarea id="adm-c-dispute-cond" rows="2" placeholder="Uyuşmazlıklarda sistem zaman damgalı log kayıtları ve elektronik sözleşme sürümleri esas alınır."></textarea>
                  </div>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
                  <button type="button" id="btn-admin-contract-cancel" class="mc-btn mc-btn-secondary">İptal</button>
                  <button type="submit" class="mc-btn mc-btn-gold">💾 Sözleşmeyi Kaydet ve Taslağı Oluştur</button>
                </div>
              </form>
            </div>
          ` : `
            <!-- MEVCUT SPONSORLAR VE SÖZLEŞME LİSTESİ -->
            <h3>📋 Kayıtlı Sponsorluk Sözleşmeleri (${allSponsors.length})</h3>
            <div class="table-responsive">
              <table class="mc-table">
                <thead>
                  <tr>
                    <th>Sponsor / Temsilci</th>
                    <th>Paket &amp; Avantaj</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Sözleşme Durumu</th>
                    <th>Yayın</th>
                    <th style="min-width:260px;">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  ${allSponsors.length === 0 ? `
                    <tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;">Henüz kayıtlı bir sponsorluk sözleşmesi bulunmamaktadır. Sağ üstteki butona tıklayarak yeni sözleşme oluşturabilirsiniz.</td></tr>
                  ` : allSponsors.map(sp => {
                    const statusLabels = {
                      DRAFT: '<span class="role-badge role-muted">📝 Taslak</span>',
                      PENDING_APPROVAL: '<span class="role-badge role-gold">⏳ Onay Bekliyor</span>',
                      SIGNED: '<span class="role-badge role-member">✍️ İmzalandı</span>',
                      ACTIVE: '<span class="role-badge role-member">✓ Aktif</span>',
                      EXPIRED: '<span class="role-badge role-muted">⌛ Süresi Doldu</span>',
                      TERMINATION_REQUESTED: '<span class="role-badge role-admin">⚠️ İptal Talebi</span>',
                      TERMINATED: '<span class="role-badge role-admin">⛔ İptal Edildi</span>',
                      ARCHIVED: '<span class="role-badge role-muted">📦 Arşivlendi</span>'
                    };
                    const statusBadge = statusLabels[sp.contractStatus] || statusLabels.ACTIVE;
                    const isPub = sp.isPublic !== false;

                    return `
                      <tr>
                        <td>
                          <strong>${escapeHtml(sp.name)}</strong><br/>
                          <span style="font-size:0.75rem;color:#94a3b8;">👤 ${escapeHtml(sp.authorizedRep || 'Belirtilmedi')}</span>
                        </td>
                        <td>
                          <span style="font-size:0.8rem;color:#38bdf8;">${escapeHtml(sp.package || 'Özel Paket')}</span><br/>
                          <span style="font-size:0.75rem;color:#fde047;">👑 ${escapeHtml(sp.sponsoredRank || 'Rütbesiz')} | 💎 ${escapeHtml(sp.sponsoredCosmeticName || 'Özel Eşya')}</span>
                        </td>
                        <td>${formatDateTR(sp.startDate)}</td>
                        <td>${formatDateTR(sp.endDate)}</td>
                        <td>${statusBadge}</td>
                        <td>
                          <button type="button" class="mc-btn mc-btn-xs ${isPub ? 'mc-btn-member' : 'mc-btn-secondary'} btn-admin-toggle-sponsor-pub" data-sponsor-id="${sp.id}" title="${isPub ? 'Yayından kaldır (sözleşme korunur)' : 'Sitede yayına al'}">
                            ${isPub ? '👁️ Yayında' : '🔒 Gizli'}
                          </button>
                        </td>
                        <td>
                          <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary btn-admin-sponsor-action" data-action="edit" data-sponsor-id="${sp.id}" title="Sözleşmeyi ve bilgileri düzenle">
                              ✏️ Düzenle
                            </button>
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-primary btn-admin-sponsor-action" data-action="view" data-sponsor-id="${sp.id}" title="Sözleşme metnini ve dijital imzaları görüntüle">
                              📄 Sözleşmeyi Görüntüle
                            </button>
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-gold btn-admin-sponsor-action" data-action="extend" data-sponsor-id="${sp.id}" title="Sponsorluk süresini uzat">
                              ⏱️ Süreyi Uzat
                            </button>
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary btn-admin-sponsor-action" data-action="terminate" data-sponsor-id="${sp.id}" style="color:#f87171;" title="Fesih sürecini başlat">
                              ⚠️ İptali Başlat
                            </button>
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary btn-admin-sponsor-action" data-action="delete" data-sponsor-id="${sp.id}" style="color:#ef4444;" title="Kaydı arşivle veya sil">
                              🗑️ Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- SÖZLEŞME VE DİJİTAL İMZA GÖRÜNTÜLEME MODALI -->
        <div id="modal-admin-sponsor-contract" class="mc-modal-backdrop hidden">
          <div class="mc-modal-content" style="max-width:760px;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;">
              <h3 id="modal-contract-title" style="margin:0;color:#fde047;">📄 Sponsorluk Sözleşmesi Detayı</h3>
              <button type="button" class="mc-modal-close" id="btn-close-sponsor-contract-modal">&times;</button>
            </div>
            
            <div id="modal-contract-body">
              <pre id="modal-contract-text" style="background:rgba(15,23,42,0.95);border:1px solid #334155;border-radius:6px;padding:14px;color:#cbd5e1;font-size:0.8rem;white-space:pre-wrap;line-height:1.5;max-height:360px;overflow-y:auto;"></pre>
              
              <!-- İMZA VE ONAY BÖLÜMÜ -->
              <div id="modal-contract-signature-section" style="margin-top:16px;padding:14px;background:rgba(30,41,59,0.85);border:1px solid #38bdf8;border-radius:8px;">
                <h4 style="margin:0 0 10px 0;color:#38bdf8;font-size:0.95rem;">✍️ İmza ve Onay İşlemleri</h4>
                <div id="modal-contract-signatures-list" style="margin-bottom:12px;font-size:0.8rem;"></div>
                
                <form id="form-sign-sponsor-contract" style="display:flex;flex-direction:column;gap:8px;">
                  <input type="hidden" id="sign-sponsor-id" />
                  <div class="input-row-2">
                    <div class="input-group">
                      <label>YETKİLİ ADI SOYADI (DİJİTAL İMZA) *</label>
                      <input type="text" id="sign-rep-name" placeholder="Örn: Ahmet Yılmaz" required />
                    </div>
                    <div class="input-group">
                      <label>YETKİLİ E-POSTA *</label>
                      <input type="email" id="sign-rep-email" placeholder="ahmet@sponsor.com" required />
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap;">
                    <button type="button" id="btn-action-review-contract" class="mc-btn mc-btn-secondary mc-btn-sm">Sözleşmeyi İncele</button>
                    <button type="button" id="btn-action-reject-contract" class="mc-btn mc-btn-secondary mc-btn-sm" style="color:#f87171;">Sözleşmeyi Reddediyorum</button>
                    <button type="button" id="btn-action-accept-contract" class="mc-btn mc-btn-primary mc-btn-sm">Sözleşmeyi Kabul Ediyorum</button>
                    <button type="submit" id="btn-action-sign-confirm" class="mc-btn mc-btn-gold mc-btn-sm">İmzala ve Onayla</button>
                  </div>
                </form>
              </div>

              <!-- DENETİM GÜNLÜĞÜ (AUDIT TRAIL) -->
              <div style="margin-top:16px;">
                <h4 style="margin:0 0 8px 0;color:#94a3b8;font-size:0.85rem;">🛡️ Denetim Günlüğü ve Delil Kayıtları</h4>
                <div id="modal-contract-audit-trail" style="font-size:0.75rem;max-height:120px;overflow-y:auto;background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;border:1px solid #1e293b;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 8.2 TELEGRAM BOT YAPILANDIRMASI & BAĞLANTI DURUMU (telegram — Sunucu Oylaması & Destek Botu)
    if (state.adminTab === 'telegram') {
      const tgSvc = svc().telegramService || {};
      const tgCfg = (typeof tgSvc.getConfig === 'function' ? tgSvc.getConfig() : null) || {
        botToken: '', chatId: '', supportBotToken: '', supportChatId: ''
      };

      const maskTok = (tok) => tok && tok.length > 8 ? tok.slice(0, 5) + '...' + tok.slice(-4) : (tok ? '***' : 'Belirtilmedi');

      container.innerHTML = `
        <div class="admin-panel-section">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div>
              <h3 style="margin:0;">🤖 Telegram Botları &amp; Bağlantı Durumu</h3>
              <p class="card-sub" style="margin:4px 0 0 0;">
                "Sunucuya Sor" anket botu ile 24/7 Destek Grubu bildirim botu ayrı bağımsız tokenlar ile çalışır.
              </p>
            </div>
            <button type="button" id="btn-admin-refresh-telegram-diag" class="mc-btn mc-btn-secondary mc-btn-sm">
              🔄 Canlı Teşhis Sorgula
            </button>
          </div>

          <!-- TEŞHİS VE CANLI DURUM BÖLÜMÜ ("Telegram Bağlantı Durumu") -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:14px;margin-bottom:20px;">
            <!-- 1. SUNUCU OYLAMASI BOTU (POLL BOT) -->
            <div style="background:rgba(15,23,42,0.9);border:1px solid #38bdf8;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h4 style="margin:0;color:#38bdf8;font-size:1rem;display:flex;align-items:center;gap:6px;">
                  <span>📊</span> <span>1. Sunucu Oylaması Botu (Poll Bot)</span>
                </h4>
                <span id="tg-poll-live-badge" class="role-badge ${tgCfg.botToken ? 'role-member' : 'role-gold'}" style="font-size:0.75rem;">
                  ${tgCfg.botToken ? '✓ Yapılandırıldı' : '⚠️ Test / Simülasyon'}
                </span>
              </div>
              <ul style="list-style:none;padding:0;margin:0 0 12px 0;font-size:0.8rem;color:#cbd5e1;line-height:1.6;">
                <li><strong>Token:</strong> <code>${maskTok(tgCfg.botToken)}</code></li>
                <li><strong>Chat / Kanal ID:</strong> <code>${tgCfg.chatId || 'Belirtilmedi'}</code></li>
                <li><strong>Joker İşlevi:</strong> "Sunucuya Sor" 10 sn canlı Telegram anketi (sendPoll)</li>
                <li><strong>Otomatik Fallback:</strong> 10 saniyede yanıt gelmezse Enderman otomatik devreye girer</li>
                <li id="tg-poll-bot-diag-status" style="margin-top:4px;color:#94a3b8;"><em>Canlı sorgu bekleniyor...</em></li>
              </ul>
              <button type="button" id="btn-admin-test-telegram-poll" class="mc-btn mc-btn-primary mc-btn-sm" style="width:100%;">
                🧪 Anket Testi Gönder (sendPoll)
              </button>
            </div>

            <!-- 2. 24/7 DESTEK BOTU (SUPPORT BOT) -->
            <div style="background:rgba(15,23,42,0.9);border:1px solid #a855f7;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h4 style="margin:0;color:#c084fc;font-size:1rem;display:flex;align-items:center;gap:6px;">
                  <span>🎧</span> <span>2. 24/7 Destek Grubu Botu (Support Bot)</span>
                </h4>
                <span id="tg-support-live-badge" class="role-badge ${tgCfg.supportBotToken ? 'role-member' : 'role-muted'}" style="font-size:0.75rem;">
                  ${tgCfg.supportBotToken ? '✓ Yapılandırıldı' : 'İsteğe Bağlı'}
                </span>
              </div>
              <ul style="list-style:none;padding:0;margin:0 0 12px 0;font-size:0.8rem;color:#cbd5e1;line-height:1.6;">
                <li><strong>Token:</strong> <code>${maskTok(tgCfg.supportBotToken)}</code></li>
                <li><strong>Yetkili Grubu ID:</strong> <code>${tgCfg.supportChatId || 'Belirtilmedi'}</code></li>
                <li><strong>İşlev:</strong> Oyuncu destek taleplerini yetkili Telegram grubuna anında iletme</li>
                <li><strong>Güvenlik:</strong> Poll Bot tokenı ile kesinlikle karıştırılmaz</li>
                <li id="tg-support-bot-diag-status" style="margin-top:4px;color:#94a3b8;"><em>Canlı sorgu bekleniyor...</em></li>
              </ul>
              <button type="button" id="btn-admin-test-telegram-support" class="mc-btn mc-btn-secondary mc-btn-sm" style="width:100%;">
                🔔 Test Destek Bildirimi Gönder
              </button>
            </div>
          </div>

          <!-- BOT YAPILANDIRMA DÜZENLEME FORMU -->
          <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:18px;">
            <h4 style="margin:0 0 14px 0;color:#f8fafc;font-size:0.95rem;">⚙️ Bot Kimlik Bilgilerini Güncelle</h4>
            <form id="admin-telegram-config-form" class="platform-form">
              <div class="input-row-2">
                <div class="input-group">
                  <label>POLL BOT TOKEN (BotFather)</label>
                  <input type="text" id="adm-tg-token" value="${escapeHtml(tgCfg.botToken || '')}" placeholder="123456789:ABCDefgh..." />
                </div>
                <div class="input-group">
                  <label>POLL TELEGRAM KANAL / GRUP ID</label>
                  <input type="text" id="adm-tg-chat-id" value="${escapeHtml(tgCfg.chatId || '')}" placeholder="-1001234567890" />
                </div>
              </div>
              <div class="input-row-2" style="margin-top:10px;">
                <div class="input-group">
                  <label>POLL BOT KULLANICI ADI (@ olmadan, örn: MCMilyonerBot)</label>
                  <input type="text" id="adm-tg-bot-username" value="${escapeHtml(tgCfg.botUsername || '')}" placeholder="MCMilyonerBot" />
                </div>
                <div class="input-group">
                  <label>DESTEK YETKİLİ GRUBU ID</label>
                  <input type="text" id="adm-tg-support-chat-id" value="${escapeHtml(tgCfg.supportChatId || '')}" placeholder="-1009876543210" />
                </div>
              </div>
              <div class="input-group" style="margin-top:10px;">
                <label>DESTEK BOT TOKEN (BotFather)</label>
                <input type="text" id="adm-tg-support-token" value="${escapeHtml(tgCfg.supportBotToken || '')}" placeholder="987654321:ZYXWvuts..." />
              </div>
              <div style="display:flex;justify-content:flex-end;margin-top:14px;">
                <button type="submit" class="mc-btn mc-btn-primary">💾 Telegram Bot Ayarlarını Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Arka planda anında canlı teşhis sorgula
      setTimeout(() => {
        const diagPollEl = document.getElementById('tg-poll-bot-diag-status');
        const diagSuppEl = document.getElementById('tg-support-bot-diag-status');
        if (typeof fetch === 'function') {
          const diagUrl = (typeof getApiUrl === 'function') ? getApiUrl('/api/telegram/diagnostics') : '/api/telegram/diagnostics';
          fetch(diagUrl)
            .then(res => res.json())
            .then(data => {
              if (data && data.success) {
                if (diagPollEl && data.pollBot) {
                  diagPollEl.innerHTML = data.pollBot.valid
                    ? `<span style="color:#22c55e;">✓ Doğrulandı: @${escapeHtml(data.pollBot.username || data.pollBot.botName || 'Bot')}</span>`
                    : `<span style="color:#f87171;">⚠️ Doğrulanamadı: ${escapeHtml(data.pollBot.lastError || 'Token geçersiz')}</span>`;
                }
                if (diagSuppEl && data.supportBot) {
                  diagSuppEl.innerHTML = data.supportBot.valid
                    ? `<span style="color:#22c55e;">✓ Doğrulandı: @${escapeHtml(data.supportBot.username || data.supportBot.botName || 'Bot')}</span>`
                    : `<span style="color:#f87171;">⚠️ Doğrulanamadı: ${escapeHtml(data.supportBot.lastError || 'Token geçersiz')}</span>`;
                }
              }
            })
            .catch(() => {
              if (diagPollEl) diagPollEl.innerHTML = '<span style="color:#94a3b8;">Canlı sunucu API çevrimdışı (Simülasyon Aktif).</span>';
              if (diagSuppEl) diagSuppEl.innerHTML = '<span style="color:#94a3b8;">Canlı sunucu API çevrimdışı.</span>';
            });
        }
      }, 50);

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

    // 10. DESTEK (support — 24/7 Destek, Telegram Bağlantısı, Sahiplenme & AI Yanıt Önizleme)
    if (state.adminTab === 'support') {
      const tickets = supportService.getAllTickets();
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>🎧 24/7 Destek Talepleri &amp; Telegram Hattı (${tickets.length})</h3>
          ${
            tickets.length === 0
              ? `<div class="empty-state-box">Kayıtlı destek talebi bulunmuyor.</div>`
              : tickets
                  .map(
                    t => `
                    <div class="ticket-card" style="border: 1px solid ${t.claimedBy ? '#3b82f6' : '#f59e0b'};">
                      <div class="ticket-header">
                        <strong>#${escapeHtml(t.id)} — ${escapeHtml(t.subject)} (${escapeHtml(
                      t.username
                    )} • ${escapeHtml(t.category)})</strong>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span class="status-pill status-${escapeHtml(t.status.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(t.status)}</span>
                          ${
                            t.claimedBy
                              ? `<span class="profile-mini-tag" style="background:rgba(59,130,246,0.2);color:#93c5fd;border:1px solid #3b82f6;">👤 Yetkili: ${escapeHtml(t.claimedBy)}</span>`
                              : `<button type="button" class="mc-btn mc-btn-xs mc-btn-gold" data-admin-claim-ticket="${escapeHtml(t.id)}">🎯 Talebi Sahiplen</button>`
                          }
                        </div>
                      </div>
                      <p class="ticket-meta">
                        Kullanıcı: <strong>${escapeHtml(t.username)}</strong>
                        ${t.userMinecraft ? ` (MC: ${escapeHtml(t.userMinecraft)})` : ''} •
                        Rütbe: <strong>${escapeHtml(t.userRank || 'MEMBER')}</strong> •
                        Bakiye: <strong>${Number(t.userEmeralds || 0)} 🟢 / ${Number(t.userNetherite || 0)} ⬛</strong> •
                        Tarih: ${formatDateTR(t.createdAt)}
                      </p>
                      <div class="ticket-messages" style="margin:8px 0;max-height:160px;overflow-y:auto;background:rgba(0,0,0,0.25);padding:8px;border-radius:6px;">
                        ${(t.messages || []).map(m => `
                          <div style="font-size:0.82rem;margin-bottom:4px;color:${m.senderRole === 'ADMIN' ? '#93c5fd' : '#cbd5e1'};">
                            <strong>${escapeHtml(m.sender)} (${m.senderRole === 'ADMIN' ? 'Yetkili' : 'Kullanıcı'}):</strong> ${escapeHtml(m.text)}
                          </div>
                        `).join('')}
                      </div>

                      <!-- Yönetici Yanıt & AI İyileştirme Alanı -->
                      <div style="margin-top:10px;">
                        <div style="display:flex;gap:6px;margin-bottom:6px;">
                          <select id="adm-sup-status-${escapeHtml(t.id)}" class="admin-inline-select" style="font-size:0.8rem;padding:4px 8px;">
                            <option value="AÇIK" ${t.status === 'AÇIK' ? 'selected' : ''}>AÇIK</option>
                            <option value="İŞLENİYOR" ${t.status === 'İŞLENİYOR' ? 'selected' : ''}>İŞLENİYOR</option>
                            <option value="KULLANICI_BEKLENİYOR" ${t.status === 'KULLANICI_BEKLENİYOR' ? 'selected' : ''}>KULLANICI BEKLENİYOR</option>
                            <option value="ÇÖZÜLDÜ" ${t.status === 'ÇÖZÜLDÜ' ? 'selected' : ''}>ÇÖZÜLDÜ</option>
                          </select>
                          <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary" data-admin-update-ticket-status="${escapeHtml(t.id)}">Durumu Güncelle</button>
                        </div>
                        <textarea id="adm-sup-reply-${escapeHtml(t.id)}" rows="2" placeholder="Oyuncuya yanıt yazın..." style="width:100%;box-sizing:border-box;font-size:0.84rem;padding:6px;margin-bottom:6px;"></textarea>

                        <!-- AI İyileştirme Önizleme Alanı -->
                        <div id="adm-ai-preview-box-${escapeHtml(t.id)}" class="hidden" style="margin-bottom:8px;padding:8px;background:rgba(16,185,129,0.15);border:1px solid #10b981;border-radius:6px;">
                          <div style="font-size:0.75rem;color:#86efac;font-weight:bold;margin-bottom:4px;">🤖 AI İLE DÜZENLENMİŞ ÖNERİLEN YANIT (ÖNİZLEME):</div>
                          <div id="adm-ai-preview-text-${escapeHtml(t.id)}" style="font-size:0.82rem;color:#f8fafc;line-height:1.4;margin-bottom:6px;"></div>
                          <div style="display:flex;gap:6px;">
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-emerald" data-admin-send-ai-reply="${escapeHtml(t.id)}">✅ AI ile Düzenlenmiş Mesajı Gönder</button>
                            <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary" data-admin-cancel-ai-preview="${escapeHtml(t.id)}">Vazgeç</button>
                          </div>
                        </div>

                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <button type="button" class="mc-btn mc-btn-sm mc-btn-primary" data-admin-reply-ticket="${escapeHtml(t.id)}">Orijinal Mesajı Gönder</button>
                          <button type="button" class="mc-btn mc-btn-sm mc-btn-gold" data-admin-ai-improve-ticket="${escapeHtml(t.id)}">🤖 AI ile İyileştir (Önizle)</button>
                        </div>
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

    // 13. YEDEKLER (backups — Otomatik Bulut Yedekleme & Canlı Veriyi Etkilemeyen Test Restore Bütünlüğü)
    if (state.adminTab === 'backups') {
      const snapshots = backupService.getSnapshots();
      const lastAutoBackup = localStorage.getItem('MCM_LAST_AUTO_BACKUP');
      container.innerHTML = `
        <div class="admin-panel-section">
          <h3>💾 Veri Yedekleme ve Otomatik Bulut Güvenliği</h3>
          <div style="margin-bottom:14px;padding:12px 14px;background:rgba(15,23,42,0.8);border:1px solid #38bdf8;border-radius:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <span style="display:block;font-size:0.8rem;color:#94a3b8;">Otomatik Bulut Yedekleme Durumu:</span>
              <strong style="color:#22c55e;">✓ Aktif (Her Değişiklikte ve Periyodik Olarak Alınır)</strong>
              <div style="font-size:0.75rem;color:#cbd5e1;margin-top:2px;">
                Son Yedekleme Zamanı: <strong>${formatDateTR(lastAutoBackup)}</strong>
              </div>
            </div>
            <button type="button" id="btn-admin-verify-restore" class="mc-btn mc-btn-sm mc-btn-gold">
              🔍 Test Restore &amp; Bütünlük Doğrula
            </button>
          </div>

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
                        <div style="display:flex;gap:6px;">
                          <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary" data-admin-test-restore-snap="${escapeHtml(
                            sn.id
                          )}">🔍 Test Doğrula</button>
                          <button type="button" class="mc-btn mc-btn-xs mc-btn-primary" data-admin-restore-snap="${escapeHtml(
                            sn.id
                          )}">Geri Yükle</button>
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

          <h3>🔥 Firebase Canlı Yapılandırması (Google Sign-In &amp; Cloud Firestore)</h3>
          <p class="card-sub">
            Firebase Console (<a href="https://console.firebase.google.com/" target="_blank" style="color:#38bdf8;">console.firebase.google.com</a>) üzerinden oluşturduğunuz web uygulaması anahtarlarını buraya girerek <strong>Google ile Giriş Yap</strong> özelliğini doğrudan etkinleştirebilirsiniz.
          </p>
          <form id="admin-firebase-config-form" class="platform-form" style="margin-bottom: 24px;">
            <div class="input-row-2">
              <div class="input-group">
                <label>FIREBASE API KEY (apiKey)</label>
                <input type="text" id="adm-fb-api-key" placeholder="AIzaSy..." value="${escapeHtml(
                  (window.MCMFirebase?.getConfig()?.apiKey && !window.MCMFirebase?.isPlaceholderConfig(window.MCMFirebase?.getConfig())) ? window.MCMFirebase.getConfig().apiKey : ''
                )}" />
              </div>
              <div class="input-group">
                <label>AUTH DOMAIN (authDomain)</label>
                <input type="text" id="adm-fb-auth-domain" placeholder="proje-id.firebaseapp.com" value="${escapeHtml(
                  window.MCMFirebase?.getConfig()?.authDomain || ''
                )}" />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>PROJECT ID (projectId)</label>
                <input type="text" id="adm-fb-project-id" placeholder="proje-id" value="${escapeHtml(
                  window.MCMFirebase?.getConfig()?.projectId || ''
                )}" />
              </div>
              <div class="input-group">
                <label>STORAGE BUCKET (storageBucket)</label>
                <input type="text" id="adm-fb-storage-bucket" placeholder="proje-id.appspot.com" value="${escapeHtml(
                  window.MCMFirebase?.getConfig()?.storageBucket || ''
                )}" />
              </div>
            </div>
            <div class="input-row-2">
              <div class="input-group">
                <label>MESSAGING SENDER ID (messagingSenderId)</label>
                <input type="text" id="adm-fb-sender-id" placeholder="1234567890" value="${escapeHtml(
                  window.MCMFirebase?.getConfig()?.messagingSenderId || ''
                )}" />
              </div>
              <div class="input-group">
                <label>APP ID (appId)</label>
                <input type="text" id="adm-fb-app-id" placeholder="1:1234567890:web:abcdef" value="${escapeHtml(
                  window.MCMFirebase?.getConfig()?.appId || ''
                )}" />
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;margin-top:8px;">
              <button type="submit" class="mc-btn mc-btn-primary">💾 Firebase Yapılandırmasını Kaydet</button>
              <button type="button" id="btn-admin-reset-firebase-config" class="mc-btn mc-btn-secondary mc-btn-sm">
                Sıfırla (Demo Moduna Dön)
              </button>
            </div>
            <span class="input-hint" style="margin-top:6px;display:block;">
              Durum: <strong>${
                window.MCMFirebase && !window.MCMFirebase.isPlaceholderConfig(window.MCMFirebase.getConfig())
                  ? '✓ Canlı Firebase Anahtarları Kayıtlı'
                  : '⚠️ Demo/Placeholder Modu (Giriş yapılınca güvenli Gmail OTP ekranına yönlendirilir)'
              }</strong>
            </span>
          </form>

          <h3>⚙️ Platform Genel Ayarları &amp; Bakım Modu (Faz 6)</h3>
          <form id="admin-platform-settings-form" class="platform-form">
            <div class="input-group">
              <label>CANLI BACKEND API URL (GİTHUB PAGES / NODE.JS SUNUCU ENTEGRASYONU)</label>
              <div style="display:flex;gap:8px;">
                <input type="url" id="adm-set-api-url" value="${escapeHtml(
                  (typeof localStorage !== 'undefined' ? localStorage.getItem('mcm_backend_api_url') : '') || ''
                )}" placeholder="Örn: https://mc-milyoner-api.onrender.com veya http://localhost:3000" style="flex:1;" />
                <button type="button" id="btn-admin-test-backend-api" class="mc-btn mc-btn-secondary mc-btn-sm" style="white-space:nowrap;">
                  🔌 Bağlantıyı Test Et
                </button>
              </div>
              <span class="input-hint">GitHub Pages statik barındırma sunucusudur. Discord OAuth, OTP e-posta gönderimi ve sohbet küfür filtresi gibi sunucu özellikleri için Node.js backend URL adresinizi buraya kaydedin.</span>
            </div>
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
  // 16. EKRAN: MODERATÖR PANELİ (renderModerator — #3)
  // ==========================================
  function renderModerator() {
    const session = getSession();
    const { authGuard } = svc();
    const effectiveRole = authGuard?.getEffectiveRole(session);
    if (!session || (effectiveRole !== 'MODERATOR' && effectiveRole !== 'ADMIN')) {
      navigateToScreen('welcome');
      return;
    }

    state.modTab = state.modTab || 'overview';
    document.querySelectorAll('#mod-sidebar-nav .admin-nav-item[data-mod-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mod-tab') === state.modTab);
    });

    const container = document.getElementById('mod-content-area');
    if (!container) return;

    const { supportService, bugService, suggestionService } = svc();
    const tickets = supportService?.getAllTickets() || [];
    const bugs = bugService?.getAllBugs() || [];
    const suggestions = suggestionService?.getAllSuggestions() || [];

    const openTicketsCount = tickets.filter(t => t.status === 'AÇIK').length;
    const pendingBugsCount = bugs.filter(b => b.status === 'SUBMITTED' || b.status === 'İNCELENİYOR').length;
    const pendingSuggsCount = suggestions.filter(s => s.status === 'SUBMITTED' || s.status === 'İNCELENİYOR').length;

    // Badge'leri güncelle
    const bBug = document.getElementById('mod-badge-bugs');
    if (bBug) {
      bBug.textContent = pendingBugsCount;
      bBug.classList.toggle('hidden', pendingBugsCount <= 0);
    }
    const bSug = document.getElementById('mod-badge-suggs');
    if (bSug) {
      bSug.textContent = pendingSuggsCount;
      bSug.classList.toggle('hidden', pendingSuggsCount <= 0);
    }

    // 1. GENEL BAKIŞ & MOD AI
    if (state.modTab === 'overview') {
      container.innerHTML = `
        <div class="admin-tab-pane active">
          <div class="admin-pane-header">
            <h3>⚔️ Moderatör Paneli Genel Bakış</h3>
            <p>Topluluk denetimi, destek biletleri, hata incelemeleri ve Moderatör AI asistanı.</p>
          </div>

          <div class="stats-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px;">
            <div class="stat-kpi-card">
              <span class="kpi-label">AÇIK DESTEK TALEPLERİ</span>
              <strong class="kpi-val ${openTicketsCount > 0 ? 'gold-text' : ''}">${openTicketsCount}</strong>
            </div>
            <div class="stat-kpi-card">
              <span class="kpi-label">BEKLEYEN HATA BİLDİRİMLERİ</span>
              <strong class="kpi-val ${pendingBugsCount > 0 ? 'gold-text' : ''}">${pendingBugsCount}</strong>
            </div>
            <div class="stat-kpi-card">
              <span class="kpi-label">BEKLEYEN ÖNERİLER</span>
              <strong class="kpi-val">${pendingSuggsCount}</strong>
            </div>
          </div>

          <!-- Moderatör AI Asistanı Kartı -->
          <div class="platform-card" style="border: 1px solid #10b981; background: rgba(6, 78, 59, 0.2);">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="font-size:1.5rem;">🤖</span>
              <div>
                <h4 style="margin:0;color:#10b981;">Moderatör AI Asistanı</h4>
                <p style="margin:2px 0 0;font-size:0.8rem;color:#94a3b8;">Kurallar, şüpheli oyuncu kontrolleri ve moderasyon tavsiyeleri için danışın.</p>
              </div>
            </div>
            <div id="mod-ai-history" style="max-height:180px;overflow-y:auto;background:rgba(15,23,42,0.8);border-radius:6px;padding:10px;margin-bottom:10px;font-size:0.88rem;color:#cbd5e1;">
              ⚔️ <strong>Moderatör AI:</strong> Merhaba yetkili arkadaşım! Açık biletler ve sohbet moderasyonu konusunda size yardımcı olmaya hazırım.
            </div>
            <div style="display:flex;gap:8px;">
              <input type="text" id="input-mod-ai-prompt" class="mc-input" placeholder="Moderatör AI'a soru sorun... (Örn: Hakaret eden oyuncuya kaç dk ceza verilmeli?)" style="flex:1;" />
              <button type="button" id="btn-ask-mod-ai" class="mc-btn mc-btn-primary mc-btn-sm" style="white-space:nowrap;">
                💬 Gönder
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 2. OYUNCU SUSTURMA & CEZA
    if (state.modTab === 'mutes') {
      const activeMutes = storage.get(STORAGE_KEYS.USER_MUTES, {});
      const activeMuteEntries = Object.entries(activeMutes).filter(([u, m]) => new Date(m.mutedUntil).getTime() > Date.now());

      container.innerHTML = `
        <div class="admin-tab-pane active">
          <div class="admin-pane-header">
            <h3>🔇 Oyuncu Susturma &amp; Moderasyon</h3>
            <p>Kural ihlali yapan oyuncuları partilerde ve sohbette geçici olarak susturun.</p>
          </div>

          <div class="platform-card" style="margin-bottom:20px;">
            <h4>Yeni Susturma Uygula</h4>
            <form id="form-mod-mute-player" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="input-group">
                <label for="mute-target-user">OYUNCU KULLANICI ADI</label>
                <input type="text" id="mute-target-user" placeholder="Hedef oyuncu adı..." required />
              </div>
              <div class="input-group">
                <label for="mute-duration-select">SUSTURMA SÜRESİ</label>
                <select id="mute-duration-select" class="form-input">
                  <option value="15">15 Dakika (Uyarı)</option>
                  <option value="60">1 Saat (Hafif İhlal)</option>
                  <option value="360">6 Saat (Küfür / Taciz)</option>
                  <option value="1440">24 Saat (Ağır İhlal)</option>
                </select>
              </div>
              <div class="input-group" style="grid-column:1 / -1;">
                <label for="mute-reason-input">GEREKÇE</label>
                <input type="text" id="mute-reason-input" placeholder="Örn: Sohbette argo / hakaret kullanımı" required />
              </div>
              <div style="grid-column:1 / -1;display:flex;justify-content:flex-end;">
                <button type="submit" class="mc-btn mc-btn-danger">🔇 Oyuncuyu Sustur</button>
              </div>
            </form>
          </div>

          <div class="platform-card">
            <h4>Aktif Susturulan Oyuncular (${activeMuteEntries.length})</h4>
            ${activeMuteEntries.length === 0 ? `<p class="muted">Şu anda susturulmuş aktif bir oyuncu bulunmuyor.</p>` : `
              <table class="mc-table" style="width:100%;margin-top:10px;">
                <thead>
                  <tr>
                    <th>Oyuncu</th>
                    <th>Bitiş Zamanı</th>
                    <th>Gerekçe</th>
                    <th>Yetkili</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeMuteEntries.map(([usr, m]) => `
                    <tr>
                      <td><strong>${escapeHtml(m.targetUsername || usr)}</strong></td>
                      <td>${new Date(m.mutedUntil).toLocaleTimeString('tr-TR')} (${Math.round((new Date(m.mutedUntil).getTime() - Date.now()) / 60000)} dk kaldı)</td>
                      <td>${escapeHtml(m.reason || '-')}</td>
                      <td>${escapeHtml(m.mutedBy || 'Yetkili')}</td>
                      <td>
                        <button type="button" class="mc-btn mc-btn-xs mc-btn-secondary" data-mod-unmute="${escapeHtml(usr)}">
                          Susturmayı Kaldır
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `;
      return;
    }

    // 3. HATA BİLDİRİMLERİ İNCELEME
    if (state.modTab === 'bugs') {
      container.innerHTML = `
        <div class="admin-tab-pane active">
          <div class="admin-pane-header">
            <h3>🐞 Hata Bildirimleri İnceleme</h3>
            <p>Oyuncuların gönderdiği hata raporlarını doğrulayın, puanlandırın ve durumlarını güncelleyin.</p>
          </div>

          <div class="platform-card">
            ${bugs.length === 0 ? `<p class="muted">Henüz kaydedilmiş bir hata bildirimi yok.</p>` : `
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${bugs.map(b => `
                  <div class="platform-card" style="background:rgba(15,23,42,0.6);border:1px solid #334155;padding:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                      <div>
                        <strong style="font-size:1.05rem;color:#f8fafc;">#${b.id} - ${escapeHtml(b.title)}</strong>
                        <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">
                          Bildiren: <strong>${escapeHtml(b.username)}</strong> • Kategori: ${escapeHtml(b.category)} • Önem: <span style="color:#facc15;">${escapeHtml(b.severity)}</span>
                        </div>
                      </div>
                      <span class="role-badge role-vip" style="font-size:0.75rem;">${escapeHtml(b.status)}</span>
                    </div>
                    <p style="font-size:0.88rem;color:#cbd5e1;margin:10px 0;background:rgba(30,41,59,0.5);padding:8px 10px;border-radius:4px;">
                      ${escapeHtml(b.description || '')}
                    </p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-primary" data-bug-status="ONAYLANDI" data-bug-id="${b.id}">
                        ✓ Onayla (+50 Puan)
                      </button>
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-gold" data-bug-status="ÇÖZÜLDÜ" data-bug-id="${b.id}">
                        🔧 Çözüldü (+100 Puan)
                      </button>
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-emerald" data-bug-status="DOĞRULANDI" data-bug-id="${b.id}">
                        🌟 Doğrulandı (+150 Puan)
                      </button>
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-danger" data-bug-status="REDDEDİLDİ" data-bug-id="${b.id}">
                        ✕ Reddet
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
      return;
    }

    // 4. ÖNERİ İNCELEME
    if (state.modTab === 'suggestions') {
      container.innerHTML = `
        <div class="admin-tab-pane active">
          <div class="admin-pane-header">
            <h3>💡 Oyuncu Önerileri İnceleme</h3>
            <p>Topluluk tarafından gönderilen ve oylanan önerileri değerlendirin.</p>
          </div>

          <div class="platform-card">
            ${suggestions.length === 0 ? `<p class="muted">Henüz gönderilmiş bir öneri bulunmuyor.</p>` : `
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${suggestions.map(s => `
                  <div class="platform-card" style="background:rgba(15,23,42,0.6);border:1px solid #334155;padding:14px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                      <div>
                        <strong style="font-size:1.05rem;color:#f8fafc;">#${s.id} - ${escapeHtml(s.title)}</strong>
                        <div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">
                          Öneren: <strong>${escapeHtml(s.username)}</strong> • Kategori: ${escapeHtml(s.category)} • Oy: 👍 ${(s.upvotes || []).length}
                        </div>
                      </div>
                      <span class="role-badge role-vip" style="font-size:0.75rem;">${escapeHtml(s.status)}</span>
                    </div>
                    <p style="font-size:0.88rem;color:#cbd5e1;margin:10px 0;background:rgba(30,41,59,0.5);padding:8px 10px;border-radius:4px;">
                      ${escapeHtml(s.details || '')}
                    </p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-primary" data-sug-status="ONAYLANDI" data-sug-id="${s.id}">
                        ✓ Onayla (+30 Puan)
                      </button>
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-emerald" data-sug-status="UYGULANDI" data-sug-id="${s.id}">
                        🚀 Uygulandı (+75 Puan)
                      </button>
                      <button type="button" class="mc-btn mc-btn-xs mc-btn-danger" data-sug-status="REDDEDİLDİ" data-sug-id="${s.id}">
                        ✕ Reddet
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
      return;
    }

    // 5. SOHBET GÜNLÜKLERİ
    if (state.modTab === 'chatlogs') {
      const logs = storage.get(STORAGE_KEYS.MODERATION_LOGS, []);
      container.innerHTML = `
        <div class="admin-tab-pane active">
          <div class="admin-pane-header">
            <h3>📜 Canlı Sohbet &amp; Moderasyon Günlükleri</h3>
            <p>Filtrelenen argo/küfür girişimleri ve uygulanan cezaların tam dökümü.</p>
          </div>

          <div class="platform-card">
            ${logs.length === 0 ? `<p class="muted">Kayıtlı moderasyon günlüğü bulunmuyor.</p>` : `
              <table class="mc-table" style="width:100%;">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem Türü</th>
                    <th>Hedef Oyuncu</th>
                    <th>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(l => `
                    <tr>
                      <td style="font-size:0.8rem;color:#94a3b8;">${new Date(l.createdAt).toLocaleTimeString('tr-TR')}</td>
                      <td><span class="role-badge role-${l.type === 'MUTE' ? 'admin' : 'member'}">${escapeHtml(l.type)}</span></td>
                      <td><strong>${escapeHtml(l.targetUsername || '-')}</strong></td>
                      <td>${escapeHtml(l.reason || l.originalSnippet || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      `;
      return;
    }
  }

  // ==========================================
  // 17. EKRAN: DESTEK YETKİLİ PANELİ (renderTicket — #3)
  // ==========================================
  function renderTicket() {
    const session = getSession();
    const { authGuard } = svc();
    const effectiveRole = authGuard?.getEffectiveRole(session);
    if (!session || (effectiveRole !== 'TICKET' && effectiveRole !== 'MODERATOR' && effectiveRole !== 'ADMIN')) {
      navigateToScreen('welcome');
      return;
    }

    const container = document.getElementById('ticket-panel-content');
    if (!container) return;

    const { supportService } = svc();
    const tickets = supportService?.getAllTickets() || [];
    state.ticketFilter = state.ticketFilter || 'ALL';

    const filtered = tickets.filter(t => {
      if (state.ticketFilter === 'OPEN') return t.status === 'AÇIK';
      if (state.ticketFilter === 'IN_PROGRESS') return t.status === 'İŞLENİYOR' || t.status === 'KULLANICI_BEKLENİYOR';
      if (state.ticketFilter === 'RESOLVED') return t.status === 'ÇÖZÜLDÜ' || t.status === 'KAPATILDI';
      return true;
    });

    const selectedTicket = tickets.find(t => t.id === activeSelectedSupportTicketId) || filtered[0] || null;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:320px 1fr;gap:16px;min-height:560px;">
        <!-- Sol: Bilet Listesi & Filtreler -->
        <div class="platform-card" style="display:flex;flex-direction:column;padding:12px;">
          <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;">
            <button type="button" class="mc-btn mc-btn-xs ${state.ticketFilter === 'ALL' ? 'mc-btn-primary' : 'mc-btn-secondary'}" data-ticket-tab="ALL">Tümü (${tickets.length})</button>
            <button type="button" class="mc-btn mc-btn-xs ${state.ticketFilter === 'OPEN' ? 'mc-btn-primary' : 'mc-btn-secondary'}" data-ticket-tab="OPEN">Açık (${tickets.filter(t => t.status === 'AÇIK').length})</button>
            <button type="button" class="mc-btn mc-btn-xs ${state.ticketFilter === 'IN_PROGRESS' ? 'mc-btn-primary' : 'mc-btn-secondary'}" data-ticket-tab="IN_PROGRESS">İşleniyor</button>
            <button type="button" class="mc-btn mc-btn-xs ${state.ticketFilter === 'RESOLVED' ? 'mc-btn-primary' : 'mc-btn-secondary'}" data-ticket-tab="RESOLVED">Çözüldü</button>
          </div>
          <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
            ${filtered.length === 0 ? `<p class="muted" style="text-align:center;padding:20px 0;">Bu filtreye uygun bilet bulunamadı.</p>` : `
              ${filtered.map(t => `
                <div class="ticket-queue-item ${selectedTicket?.id === t.id ? 'active' : ''}" data-select-ticket="${t.id}" style="padding:10px;border-radius:6px;background:${selectedTicket?.id === t.id ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.6)'};border:1px solid ${selectedTicket?.id === t.id ? '#10b981' : '#334155'};cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <strong style="font-size:0.88rem;color:#f8fafc;">#${t.id.slice(-6)} ${escapeHtml(t.subject.slice(0, 20))}</strong>
                    <span style="font-size:0.7rem;padding:2px 6px;border-radius:4px;background:#334155;color:#e2e8f0;">${t.status}</span>
                  </div>
                  <div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">
                    ${escapeHtml(t.username)} • ${escapeHtml(t.category)}
                  </div>
                </div>
              `).join('')}
            `}
          </div>
        </div>

        <!-- Sağ: Bilet Detayı ve Hızlı Yanıt Masası -->
        <div class="platform-card" style="display:flex;flex-direction:column;padding:16px;">
          ${!selectedTicket ? `<p class="muted" style="text-align:center;margin:auto;">Lütfen incelemek için soldan bir bilet seçin.</p>` : `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #334155;">
              <div>
                <h3 style="margin:0;font-size:1.15rem;color:#f8fafc;">${escapeHtml(selectedTicket.subject)}</h3>
                <div style="font-size:0.82rem;color:#94a3b8;margin-top:4px;">
                  Bilet No: <strong>#${selectedTicket.id}</strong> • Oyuncu: <strong>${escapeHtml(selectedTicket.username)}</strong> • Kategori: ${escapeHtml(selectedTicket.category)}
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${!selectedTicket.claimedBy ? `
                  <button type="button" class="mc-btn mc-btn-xs mc-btn-primary" data-ticket-action="claim" data-ticket-id="${selectedTicket.id}">
                    ✋ Talebi Sahiplen
                  </button>
                ` : `
                  <span style="font-size:0.78rem;padding:4px 8px;background:rgba(16,185,129,0.2);color:#10b981;border-radius:4px;">
                    Sahiplenen: ${escapeHtml(selectedTicket.claimedBy)}
                  </span>
                `}
                <button type="button" class="mc-btn mc-btn-xs mc-btn-gold" data-ticket-action="escalate" data-ticket-id="${selectedTicket.id}">
                  🚨 Yöneticiye İlet
                </button>
                <button type="button" class="mc-btn mc-btn-xs mc-btn-emerald" data-ticket-action="resolve" data-ticket-id="${selectedTicket.id}">
                  ✓ Çözüldü
                </button>
              </div>
            </div>

            <!-- Mesaj Geçmişi -->
            <div style="flex:1;overflow-y:auto;padding:12px 0;display:flex;flex-direction:column;gap:10px;">
              ${(selectedTicket.messages || []).map(m => `
                <div style="padding:10px 12px;border-radius:6px;background:${m.senderRole === 'ADMIN' ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.7)'};border-left:3px solid ${m.senderRole === 'ADMIN' ? '#10b981' : '#38bdf8'};">
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#94a3b8;margin-bottom:4px;">
                    <strong>${escapeHtml(m.sender)} (${m.senderRole === 'ADMIN' ? 'Yetkili' : 'Oyuncu'})</strong>
                    <span>${new Date(m.createdAt).toLocaleTimeString('tr-TR')}</span>
                  </div>
                  <p style="margin:0;font-size:0.88rem;color:#f8fafc;white-space:pre-wrap;">${escapeHtml(m.text)}</p>
                </div>
              `).join('')}
            </div>

            <!-- Yanıt Yazma Formu -->
            <form id="form-ticket-desk-reply" style="padding-top:12px;border-top:1px solid #334155;">
              <div style="display:flex;gap:8px;margin-bottom:8px;">
                <textarea id="ticket-desk-reply-text" rows="3" class="mc-input" placeholder="Oyuncuya yanıtınızı yazın..." style="flex:1;resize:none;" required></textarea>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <button type="button" id="btn-ticket-ai-improve" class="mc-btn mc-btn-xs mc-btn-secondary" style="font-size:0.78rem;">
                  ✨ AI ile Yanıtı İyileştir
                </button>
                <button type="submit" class="mc-btn mc-btn-primary mc-btn-sm">
                  📨 Yanıtı Gönder
                </button>
              </div>
            </form>
          `}
        </div>
      </div>
    `;
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

    // ==========================================
    // 🎙️ PARTİ SESLİ SOHBET (VOICE CHAT) & SFX
    // ==========================================
    const partyVoiceEngine = {
      stream: null,
      audioCtx: null,
      analyser: null,
      dataArray: null,
      isMuted: true,
      rafId: null,

      async toggleMic(session) {
        if (!session) return;
        const btn = document.getElementById('btn-toggle-party-mic');
        const statusText = document.getElementById('party-voice-status');
        const levelFill = document.getElementById('party-mic-level-fill');

        if (!this.isMuted) {
          this.stop();
          if (btn) {
            btn.classList.remove('mic-active');
            btn.innerHTML = '🎙️ Mikrofonu Aç';
          }
          if (statusText) statusText.textContent = 'Mikrofon: Kapalı';
          if (levelFill) levelFill.style.width = '0%';
          svc().partyService?.updateVoiceState(session.username, { isMuted: true, isSpeaking: false });
          svc().cloudSyncService?.pushNow();
          showToast('🔇 Mikrofon kapatıldı.', 'info');
          renderParty();
          return;
        }

        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tarayıcınız mikrofon erişimini desteklemiyor.');
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.stream = stream;
          this.isMuted = false;

          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.audioCtx = new AudioCtx();
          const source = this.audioCtx.createMediaStreamSource(stream);
          this.analyser = this.audioCtx.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);

          const bufferLength = this.analyser.frequencyBinCount;
          this.dataArray = new Uint8Array(bufferLength);

          if (btn) {
            btn.classList.add('mic-active');
            btn.innerHTML = '🎙️ Mikrofon Açık (Sustur)';
          }
          if (statusText) statusText.textContent = 'Mikrofon: Açık (Canlı)';

          svc().partyService?.updateVoiceState(session.username, { isMuted: false, isSpeaking: false });
          svc().cloudSyncService?.pushNow();
          showToast('🎙️ Mikrofon bağlandı! Sesiniz partiye iletiliyor.', 'success');
          renderParty();

          let lastSpeakingState = false;
          let speakCooldown = 0;

          const checkAudio = () => {
            if (this.isMuted || !this.analyser) return;

            this.analyser.getByteFrequencyData(this.dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += this.dataArray[i];
            }
            const average = sum / bufferLength;
            const pct = Math.min(100, Math.round((average / 128) * 100));

            if (levelFill) {
              levelFill.style.width = `${pct}%`;
            }

            const isSpeakingNow = average > 18;
            speakCooldown++;
            if (isSpeakingNow !== lastSpeakingState && speakCooldown >= 5) {
              lastSpeakingState = isSpeakingNow;
              speakCooldown = 0;
              svc().partyService?.updateVoiceState(session.username, { isMuted: false, isSpeaking: isSpeakingNow });
              renderParty();
            }

            this.rafId = requestAnimationFrame(checkAudio);
          };

          this.rafId = requestAnimationFrame(checkAudio);
        } catch (err) {
          // İzin verilemediğinde simülasyon modu
          this.isMuted = !this.isMuted;
          if (!this.isMuted) {
            if (btn) {
              btn.classList.add('mic-active');
              btn.innerHTML = '🎙️ Mikrofon Açık (Simüle)';
            }
            if (statusText) statusText.textContent = 'Mikrofon: Aktif (Simüle)';
            svc().partyService?.updateVoiceState(session.username, { isMuted: false, isSpeaking: true });
            showToast('🎙️ Mikrofon simülasyon modu aktif.', 'success');
          } else {
            if (btn) {
              btn.classList.remove('mic-active');
              btn.innerHTML = '🎙️ Mikrofonu Aç';
            }
            if (statusText) statusText.textContent = 'Mikrofon: Kapalı';
            svc().partyService?.updateVoiceState(session.username, { isMuted: true, isSpeaking: false });
            showToast('🔇 Mikrofon kapatıldı.', 'info');
          }
          svc().cloudSyncService?.pushNow();
          renderParty();
        }
      },

      selectedDeviceId: '',

      async getAudioDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          return devices.filter(d => d.kind === 'audioinput');
        } catch (e) {
          return [];
        }
      },

      async populateDeviceSelector() {
        const select = document.getElementById('select-party-mic-device');
        if (!select) return;
        const devices = await this.getAudioDevices();
        if (devices.length === 0) return;
        select.innerHTML = devices.map((d, i) => `
          <option value="${d.deviceId}">${escapeHtml(d.label || `Mikrofon ${i + 1}`)}</option>
        `).join('');
        if (this.selectedDeviceId) select.value = this.selectedDeviceId;
      },

      stop() {
        this.isMuted = true;
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
          this.stream = null;
        }
        if (this.audioCtx) {
          try { this.audioCtx.close(); } catch (e) {}
          this.audioCtx = null;
        }
      }
    };

    let testMicStream = null;
    let testMicAudioCtx = null;
    let testMicRaf = null;

    async function openMicTestModal() {
      const modal = document.getElementById('modal-test-mic');
      const fill = document.getElementById('test-mic-level-fill');
      const label = document.getElementById('test-mic-status-label');
      modal?.classList.remove('hidden');

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Tarayıcınız mikrofon erişimini desteklemiyor.');
        }
        const constraints = { audio: partyVoiceEngine.selectedDeviceId ? { deviceId: { exact: partyVoiceEngine.selectedDeviceId } } : true };
        testMicStream = await navigator.mediaDevices.getUserMedia(constraints);
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        testMicAudioCtx = new AudioCtx();
        const src = testMicAudioCtx.createMediaStreamSource(testMicStream);
        const analyser = testMicAudioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);

        if (label) label.textContent = '🟢 Mikrofon aktif — Konuşmayı deneyin!';

        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < bufLen; i++) sum += data[i];
          const avg = sum / bufLen;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          if (fill) fill.style.width = `${pct}%`;
          testMicRaf = requestAnimationFrame(loop);
        };
        testMicRaf = requestAnimationFrame(loop);
      } catch (err) {
        if (label) label.textContent = `⚠️ Mikrofon testi başlatılamadı: ${err.message}`;
      }
    }

    function closeMicTestModal() {
      if (testMicRaf) { cancelAnimationFrame(testMicRaf); testMicRaf = null; }
      if (testMicStream) { testMicStream.getTracks().forEach(t => t.stop()); testMicStream = null; }
      if (testMicAudioCtx) { try { testMicAudioCtx.close(); } catch (e) {} testMicAudioCtx = null; }
      const modal = document.getElementById('modal-test-mic');
      const fill = document.getElementById('test-mic-level-fill');
      if (fill) fill.style.width = '0%';
      modal?.classList.add('hidden');
    }

    // Mikrofon Cihazı Değişimi
    document.getElementById('select-party-mic-device')?.addEventListener('change', e => {
      partyVoiceEngine.selectedDeviceId = e.target.value;
      showToast('🎙️ Mikrofon girişi ayarlandı.', 'info');
    });

    // 🎙️ Mikrofon Aç/Kapat Butonu
    document.getElementById('btn-toggle-party-mic')?.addEventListener('click', () => {
      const session = getSession();
      if (!session) return;
      partyVoiceEngine.toggleMic(session);
    });

    // 🔊 Hızlı Ses ve Sohbet Reaksiyonları
    document.getElementById('party-voice-panel')?.addEventListener('click', e => {
      const sfxBtn = e.target.closest('[data-party-sfx]');
      if (sfxBtn) {
        const session = getSession();
        if (!session) return;
        const sfxType = sfxBtn.getAttribute('data-party-sfx');
        if (sfxType === 'BELL') {
          window.soundEngine?.bellChime();
        } else if (sfxType === 'HORN') {
          window.soundEngine?.goatHorn();
        } else if (sfxType === 'ANVIL') {
          window.soundEngine?.anvilHit();
        } else if (sfxType === 'CHEER') {
          window.soundEngine?.cheer();
        }
        const sfxLabel = sfxBtn.textContent.trim();
        svc().partyService?.sendPartyChatMessage(session.username, `🔊 ${sfxLabel} çaldı!`, sfxType);
        svc().cloudSyncService?.pushNow();
        renderParty();
        return;
      }

      const msgBtn = e.target.closest('[data-party-msg]');
      if (msgBtn) {
        const session = getSession();
        if (!session) return;
        const msgText = msgBtn.getAttribute('data-party-msg');
        window.soundEngine?.click();
        svc().partyService?.sendPartyChatMessage(session.username, msgText);
        svc().cloudSyncService?.pushNow();
        renderParty();
        return;
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

    // Profil Modalı: Parolayı Değiştir Formu (#form-change-password — #6)
    document.getElementById('form-change-password')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const curPwd = document.getElementById('input-current-password')?.value || '';
      const newPwd = document.getElementById('input-new-password')?.value || '';
      const confirmPwd = document.getElementById('input-confirm-new-password')?.value || '';
      const errEl = document.getElementById('change-password-error');
      const submitBtn = document.getElementById('btn-submit-change-password');

      if (newPwd !== confirmPwd) {
        if (errEl) { errEl.textContent = 'Yeni şifreler birbiriyle eşleşmiyor!'; errEl.classList.remove('hidden'); }
        return;
      }
      if (newPwd.length < 4) {
        if (errEl) { errEl.textContent = 'Yeni şifreniz en az 4 karakter olmalıdır!'; errEl.classList.remove('hidden'); }
        return;
      }

      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Kaydediliyor...'; }
        await svc().authService.changePassword(session, curPwd, newPwd);
        showToast('🔒 Parolanız başarıyla güncellendi!', 'success');
        document.getElementById('modal-change-password')?.classList.add('hidden');
        e.target.reset();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
        else { showToast(err.message, 'error'); }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '💾 Şifreyi Kaydet'; }
      }
    });

    // Parti Özel Sohbet Formu (#party-custom-chat-form — #7, #8)
    document.getElementById('party-custom-chat-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const inputEl = document.getElementById('party-custom-chat-input');
      const rawText = String(inputEl?.value || '').trim();
      if (!rawText) return;

      try {
        const modRes = await svc().chatModerationService.moderateMessage(session, rawText);
        if (modRes.wasCensored) {
          showToast('⚠️ Mesajınızdaki uygunsuz ifadeler filtrelendi.', 'warning');
        }
        svc().partyService?.sendPartyChatMessage(session.username, modRes.cleanText);
        svc().cloudSyncService?.pushNow();
        if (inputEl) inputEl.value = '';
        renderParty();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Moderatör: Oyuncu Susturma Formu (#form-mod-mute-player)
    document.getElementById('form-mod-mute-player')?.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const targetU = document.getElementById('mute-target-user')?.value || '';
      const durationMins = Number(document.getElementById('mute-duration-select')?.value || 15);
      const reason = document.getElementById('mute-reason-text')?.value || 'Kural ihlali';
      try {
        svc().authGuard.muteUser(session, targetU, durationMins, reason);
        showToast(`🔇 ${targetU} oyuncusu ${durationMins} dakika süreyle susturuldu!`, 'warning');
        renderModerator();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Destek Yetkili Masası: Yanıt Gönderme Formu (#form-ticket-desk-reply)
    document.getElementById('form-ticket-desk-reply')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session || !activeSelectedSupportTicketId) return;
      const textEl = document.getElementById('ticket-desk-reply-text');
      const text = String(textEl?.value || '').trim();
      if (!text) return;
      try {
        await svc().supportService.replyToTicket(session, activeSelectedSupportTicketId, text);
        showToast('📨 Yanıtınız oyuncuya iletildi ve bildirim gönderildi!', 'success');
        if (textEl) textEl.value = '';
        renderTicket();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // MVIP Bilge Asistan Soru Sorma Formu (#ai-chat-form — #5)
    document.getElementById('ai-chat-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const inp = document.getElementById('ai-chat-input');
      const q = String(inp?.value || '').trim();
      const msgsBox = document.getElementById('ai-chat-messages');
      const btn = document.getElementById('btn-send-ai-chat');
      if (!q) return;

      if (msgsBox) {
        msgsBox.innerHTML += `
          <div style="background:rgba(30,41,59,0.9);padding:8px 12px;border-radius:8px;border-left:3px solid #38bdf8;font-size:0.88rem;color:#f8fafc;align-self:flex-end;max-width:85%;">
            <strong>Siz:</strong> ${escapeHtml(q)}
          </div>
          <div id="ai-user-loading" style="background:#1e293b;padding:8px 12px;border-radius:8px;border-left:3px solid #facc15;font-size:0.88rem;color:#facc15;font-style:italic;">
            ⏳ Bilge Asistan düşünüyor...
          </div>
        `;
        msgsBox.scrollTop = msgsBox.scrollHeight;
      }
      if (inp) inp.value = '';

      try {
        if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
        const res = await svc().aiAssistantService.askUserAssistant(session, q);
        document.getElementById('ai-user-loading')?.remove();
        if (msgsBox) {
          msgsBox.innerHTML += `
            <div style="background:#1e293b;padding:10px 12px;border-radius:8px;border-left:3px solid #facc15;font-size:0.88rem;color:#f8fafc;">
              🧙‍♂️ <strong>Bilge Asistan:</strong> ${escapeHtml(res.reply)}
            </div>
          `;
          msgsBox.scrollTop = msgsBox.scrollHeight;
        }
      } catch (err) {
        document.getElementById('ai-user-loading')?.remove();
        if (msgsBox) {
          msgsBox.innerHTML += `
            <div style="background:rgba(127,29,29,0.5);padding:8px 12px;border-radius:8px;border-left:3px solid #ef4444;font-size:0.85rem;color:#fca5a5;">
              ⚠️ Hata: ${escapeHtml(err.message)}
            </div>
          `;
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Sor'; }
      }
    });

    // Mağaza Arama Çubuğu Canlı Filtreleme (Phase 7)
    document.getElementById('shop-search-input')?.addEventListener('input', () => {
      if (state.currentScreen === 'shop') {
        const session = getSession();
        if (session) {
          const user = svc().userService.getUserByUsername(session.username);
          const userRank = svc().rankService.getUserRank(session.username);
          if (user && userRank && state.shopCategory !== 'Ranks') {
            renderShopItemsGrid(user, userRank, state.shopCategory);
          }
        }
      }
    });

    let activeStripeCheckoutData = null;

    function openStripeCheckoutModal(rankId, isGift = false, recipient = '') {
      const session = getSession();
      if (!session) return;
      const rankPricesTry = { VIP: 89.90, VIP_PLUS: 159.90, MVIP: 299.90, MVIP_PLUS: 449.90 };
      const rankNames = { VIP: 'VIP Rütbesi', VIP_PLUS: 'VIP+ Rütbesi', MVIP: 'MVIP Rütbesi', MVIP_PLUS: 'MVIP+ Rütbesi' };
      const cleanRank = String(rankId || 'VIP').toUpperCase();
      const basePrice = rankPricesTry[cleanRank] || 89.90;

      activeStripeCheckoutData = {
        rankId: cleanRank,
        basePrice,
        finalPrice: basePrice,
        isGift: Boolean(isGift),
        recipientUsername: recipient || '',
        couponCode: ''
      };

      const modal = document.getElementById('modal-stripe-checkout');
      const nameEl = document.getElementById('stripe-checkout-rank-name');
      const priceEl = document.getElementById('stripe-checkout-price');
      const couponInp = document.getElementById('stripe-coupon-code');
      const couponStatus = document.getElementById('stripe-coupon-status');
      const giftGroup = document.getElementById('stripe-gift-group');
      const recipientInp = document.getElementById('stripe-recipient-input');

      if (nameEl) nameEl.textContent = rankNames[cleanRank] || `${cleanRank} Rütbesi`;
      if (priceEl) priceEl.textContent = `${basePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
      if (couponInp) couponInp.value = '';
      if (couponStatus) { couponStatus.textContent = ''; couponStatus.style.color = ''; }

      if (giftGroup) giftGroup.style.display = isGift ? 'block' : 'none';
      if (recipientInp) recipientInp.value = recipient || '';

      modal?.classList.remove('hidden');
    }

    // 🎧 24/7 Destek Butonu ve Modalı Eylemleri
    document.getElementById('floating-support-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-support-widget');
      if (modal) {
        modal.classList.remove('hidden');
        renderSupport();
      }
    });

    document.getElementById('btn-close-support-modal')?.addEventListener('click', () => {
      document.getElementById('modal-support-widget')?.classList.add('hidden');
    });

    document.getElementById('tab-support-create')?.addEventListener('click', () => {
      document.getElementById('tab-support-create')?.classList.add('mc-btn-gold');
      document.getElementById('tab-support-create')?.classList.remove('mc-btn-secondary');
      document.getElementById('tab-support-list')?.classList.remove('mc-btn-gold');
      document.getElementById('tab-support-list')?.classList.add('mc-btn-secondary');
      document.getElementById('support-view-create')?.classList.remove('hidden');
      document.getElementById('support-view-list')?.classList.add('hidden');
    });

    document.getElementById('tab-support-list')?.addEventListener('click', () => {
      document.getElementById('tab-support-list')?.classList.add('mc-btn-gold');
      document.getElementById('tab-support-list')?.classList.remove('mc-btn-secondary');
      document.getElementById('tab-support-create')?.classList.remove('mc-btn-gold');
      document.getElementById('tab-support-create')?.classList.add('mc-btn-secondary');
      document.getElementById('support-view-create')?.classList.add('hidden');
      document.getElementById('support-view-list')?.classList.remove('hidden');
      renderSupport();
    });

    // Destek Talebi Oluşturma Formu (Widget)
    document.getElementById('support-ticket-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session) return;
      const cat = document.getElementById('support-category-select')?.value || 'Diğer';
      const sub = document.getElementById('support-subject-input')?.value || '';
      const msg = document.getElementById('support-message-input')?.value || '';
      const submitBtn = document.getElementById('btn-submit-support-ticket');
      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ İletiliyor...'; }
        const created = await svc().supportService.createTicket(session, {
          category: cat,
          subject: sub,
          message: msg
        });
        showToast('✓ Destek talebiniz oluşturuldu ve Telegram destek ekibimize iletildi!', 'success');
        e.target.reset();
        activeSelectedSupportTicketId = created.id;
        document.getElementById('tab-support-list')?.click();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📨 DESTEK TALEBİNİ İLET'; }
      }
    });

    // Destek Talebine Oyuncu Yanıtı Gönderme (Widget)
    document.getElementById('btn-send-support-reply')?.addEventListener('click', async () => {
      const session = getSession();
      if (!session || !activeSelectedSupportTicketId) return;
      const inputEl = document.getElementById('support-reply-input');
      const text = String(inputEl?.value || '').trim();
      if (!text) return;
      try {
        await svc().supportService.replyToTicket(session, activeSelectedSupportTicketId, text);
        if (inputEl) inputEl.value = '';
        renderSupport();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Genel Tıklama Delegasyonu (Navigasyon, Oyuncu Profili, Mağaza, Bildirimler, Parti Daveti, Admin İşlemleri)
    document.addEventListener('click', async e => {
      // Destek bilet seçimi widget içi ([data-select-ticket])
      const ticketSelectBtn = e.target.closest('[data-select-ticket]');
      if (ticketSelectBtn) {
        activeSelectedSupportTicketId = ticketSelectBtn.getAttribute('data-select-ticket');
        renderSupport();
        return;
      }
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

      // 7.1 Rütbe Karşılaştırma Tablosunu Aç / Kapat (#5)
      if (e.target.closest('#btn-open-rank-comparison')) {
        renderRankComparisonModal();
        document.getElementById('modal-rank-comparison')?.classList.remove('hidden');
        return;
      }
      if (e.target.closest('#btn-close-rank-comparison')) {
        document.getElementById('modal-rank-comparison')?.classList.add('hidden');
        return;
      }

      // 7.2 Stripe Gerçek Para İle Rütbe Satın Al ([data-stripe-buy-rank]) (#2)
      const stripeRankBtn = e.target.closest('[data-stripe-buy-rank]');
      if (stripeRankBtn) {
        const rankId = stripeRankBtn.getAttribute('data-stripe-buy-rank');
        openStripeCheckoutModal(rankId, false);
        return;
      }

      // 7.3 Stripe Modal Butonları & Kupon Doğrulama
      if (e.target.closest('#btn-close-stripe-checkout') || e.target.closest('#btn-cancel-stripe')) {
        document.getElementById('modal-stripe-checkout')?.classList.add('hidden');
        return;
      }

      if (e.target.closest('#btn-apply-stripe-coupon')) {
        if (!activeStripeCheckoutData) return;
        const code = String(document.getElementById('stripe-coupon-code')?.value || '').trim();
        const statusEl = document.getElementById('stripe-coupon-status');
        const priceEl = document.getElementById('stripe-checkout-price');
        if (!code) {
          if (statusEl) { statusEl.textContent = 'Lütfen kupon kodu giriniz.'; statusEl.style.color = '#f59e0b'; }
          return;
        }
        try {
          const disc = svc().discountService.validateCoupon(code, {
            rankId: activeStripeCheckoutData.rankId,
            username: getSession()?.username,
            basePrice: activeStripeCheckoutData.basePrice
          });
          activeStripeCheckoutData.finalPrice = disc.discountedPrice;
          activeStripeCheckoutData.couponCode = disc.code;
          if (priceEl) priceEl.textContent = `${disc.discountedPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ (%${disc.discountPercent} İndirim!)`;
          if (statusEl) { statusEl.textContent = `✓ "${disc.code}" kuponu uygulandı: %${disc.discountPercent} indirim!`; statusEl.style.color = '#22c55e'; }
        } catch (err) {
          if (statusEl) { statusEl.textContent = err.message; statusEl.style.color = '#ef4444'; }
        }
        return;
      }

      if (e.target.closest('#btn-proceed-stripe-checkout')) {
        const session = getSession();
        if (!session || !activeStripeCheckoutData) return;
        const btn = document.getElementById('btn-proceed-stripe-checkout');
        const origText = btn?.innerHTML || 'Öde';
        try {
          if (btn) { btn.disabled = true; btn.innerHTML = '⏳ İşleniyor...'; }
          let recipient = activeStripeCheckoutData.isGift
            ? String(document.getElementById('stripe-recipient-input')?.value || '').trim()
            : session.username;

          if (activeStripeCheckoutData.isGift && !recipient) {
            throw new Error('Lütfen hediye edilecek oyuncu adını giriniz.');
          }

          const res = await svc().paymentService.createCheckoutSession(session, {
            rankId: activeStripeCheckoutData.rankId,
            recipientUsername: recipient,
            couponCode: activeStripeCheckoutData.couponCode
          });

          document.getElementById('modal-stripe-checkout')?.classList.add('hidden');

          if (res.testMode) {
            svc().paymentService.fulfillCompletedPayment(res.sessionId, {
              rankId: activeStripeCheckoutData.rankId,
              username: session.username,
              recipientUsername: recipient,
              amountTry: activeStripeCheckoutData.finalPrice,
              testMode: true
            });
            showToast(
              `💳 [Test Modu] Stripe Checkout başarıyla tamamlandı! ${recipient} kullanıcısına ${activeStripeCheckoutData.rankId} rütbesi tanımlandı.`,
              'success'
            );
            syncHeaderAndDrawer();
            renderShop();
          } else if (res.checkoutUrl) {
            window.location.href = res.checkoutUrl;
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        }
        return;
      }

      // 7.4 Admin İndirim Kuponu Silme ([data-admin-delete-discount])
      const delDiscBtn = e.target.closest('[data-admin-delete-discount]');
      if (delDiscBtn) {
        const session = getSession();
        if (!session) return;
        const code = delDiscBtn.getAttribute('data-admin-delete-discount');
        try {
          svc().discountService.deleteDiscount(session, code);
          showToast(`🎟️ "${code}" kuponu silindi.`, 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 7.5 Admin Telegram Test Anketi Butonu
      if (e.target.closest('#btn-admin-test-telegram-poll')) {
        try {
          const res = await svc().telegramService.createPoll(
            'Minecraft Milyoner Test Anketi: En sevdiğiniz maden hangisi?',
            ['Elmas', 'Netherite', 'Zümrüt', 'Altın']
          );
          showToast(`🧪 Test anketi başarıyla oluşturuldu! Kaynak: ${res.source}`, 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 7.5.1 Admin Telegram Teşhis Yenileme Butonu
      if (e.target.closest('#btn-admin-refresh-telegram-diag')) {
        showToast('🔄 Telegram bağlantı durumu sorgulanıyor...', 'info');
        renderAdmin();
        return;
      }

      // 7.5.2 Admin Telegram Destek Bildirimi Testi
      if (e.target.closest('#btn-admin-test-telegram-support')) {
        try {
          if (typeof fetch === 'function') {
            const ticketUrl = (typeof getApiUrl === 'function') ? getApiUrl('/api/support/ticket') : '/api/support/ticket';
            const res = await fetch(ticketUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: session.username || 'Admin',
                subject: '🧪 24/7 Destek Botu Bağlantı Testi',
                message: 'Bu bildirim yönetici panelinden 24/7 Telegram Destek Grubu entegrasyonunu doğrulamak için gönderildi.',
                category: 'Sistem Testi'
              })
            });
            const d = await res.json();
            if (d.success && d.telegramNotified) {
              showToast('🔔 Destek bildirimi yetkili Telegram grubuna başarıyla iletildi!', 'success');
            } else if (d.success) {
              showToast('ℹ️ Destek talebi oluşturuldu ancak bot token/grup ID ayarlanmamış.', 'warning');
            } else {
              showToast(`⚠️ Destek bildirimi hatası: ${d.error}`, 'error');
            }
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 7.5.3 Sponsorluk Sekme Geçişleri
      if (e.target.closest('#btn-admin-sponsor-subtab-list') || e.target.closest('#btn-admin-contract-cancel')) {
        state.sponsorSubTab = 'list';
        renderAdmin();
        return;
      }
      if (e.target.closest('#btn-admin-sponsor-subtab-builder')) {
        state.sponsorSubTab = 'builder';
        state.editingSponsorId = null;
        renderAdmin();
        return;
      }

      // 7.5.4 Sponsor Kamuya Açık Yayını Aç/Kapat Butonu (.btn-admin-toggle-sponsor-pub)
      const togglePubBtn = e.target.closest('.btn-admin-toggle-sponsor-pub');
      if (togglePubBtn) {
        const spId = togglePubBtn.getAttribute('data-sponsor-id');
        try {
          const sp = svc().sponsorService.getSponsorById(spId);
          if (sp) {
            const nextPub = !sp.isPublic;
            svc().sponsorService.togglePublicVisibility(session, spId, nextPub);
            showToast(nextPub ? `👁️ "${sp.name}" sitede yayına alındı!` : `🔒 "${sp.name}" siteden gizlendi (sözleşme aktif kalır).`, 'info');
            renderAdmin();
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 7.5.5 Sponsor İşlem Butonları (5 Temel İşlem: Düzenle, Görüntüle, Uzat, İptal, Sil)
      const sponsorActionBtn = e.target.closest('.btn-admin-sponsor-action');
      if (sponsorActionBtn) {
        const action = sponsorActionBtn.getAttribute('data-action');
        const spId = sponsorActionBtn.getAttribute('data-sponsor-id');
        const sp = svc().sponsorService.getSponsorById(spId);

        if (!sp) {
          showToast('Sponsor kaydı bulunamadı.', 'error');
          return;
        }

        if (action === 'edit') {
          state.sponsorSubTab = 'builder';
          state.editingSponsorId = spId;
          renderAdmin();
          setTimeout(() => {
            const nameEl = document.getElementById('adm-c-name');
            const repEl = document.getElementById('adm-c-rep');
            const emailEl = document.getElementById('adm-c-email');
            const logoEl = document.getElementById('adm-c-logo');
            const packEl = document.getElementById('adm-c-package');
            const typeEl = document.getElementById('adm-c-type');
            const rankEl = document.getElementById('adm-c-rank');
            const cosmEl = document.getElementById('adm-c-cosmetic-name');
            const startEl = document.getElementById('adm-c-start-date');
            const endEl = document.getElementById('adm-c-end-date');
            const durEl = document.getElementById('adm-c-duration');
            const benEl = document.getElementById('adm-c-benefits');
            const textEl = document.getElementById('adm-c-agreement-text');
            const termEl = document.getElementById('adm-c-termination-cond');
            const dispEl = document.getElementById('adm-c-dispute-cond');

            if (nameEl) nameEl.value = sp.name || '';
            if (repEl) repEl.value = sp.authorizedRep || '';
            if (emailEl) emailEl.value = sp.email || '';
            if (logoEl) logoEl.value = sp.logo || '💎';
            if (packEl) packEl.value = sp.package || 'Resmi Turnuva Ana Sponsorluğu';
            if (typeEl) typeEl.value = sp.type || 'TYPE_C';
            if (rankEl) rankEl.value = sp.sponsoredRank || 'VIP';
            if (cosmEl) cosmEl.value = sp.sponsoredCosmeticName || '';
            if (startEl && sp.startDate) startEl.value = new Date(sp.startDate).toISOString().slice(0, 16);
            if (endEl && sp.endDate) endEl.value = new Date(sp.endDate).toISOString().slice(0, 16);
            if (durEl) durEl.value = sp.durationDays || 30;
            if (benEl) benEl.value = sp.customBenefits || '';
            if (textEl) textEl.value = sp.agreementText || '';
            if (termEl) termEl.value = sp.terminationConditions || '';
            if (dispEl) dispEl.value = sp.disputeConditions || '';
          }, 50);
          return;
        }

        if (action === 'view') {
          const modal = document.getElementById('modal-admin-sponsor-contract');
          const titleEl = document.getElementById('modal-contract-title');
          const textEl = document.getElementById('modal-contract-text');
          const sigListEl = document.getElementById('modal-contract-signatures-list');
          const auditEl = document.getElementById('modal-contract-audit-trail');
          const signIdInp = document.getElementById('sign-sponsor-id');
          const signRepNameInp = document.getElementById('sign-rep-name');
          const signRepEmailInp = document.getElementById('sign-rep-email');

          if (modal && textEl) {
            if (titleEl) titleEl.textContent = `📄 ${sp.name} — Resmi Sponsorluk Sözleşmesi (Sürüm ${sp.contractVersion || 1})`;
            textEl.textContent = sp.agreementText || svc().sponsorService.generateAgreementTemplate(sp);
            if (signIdInp) signIdInp.value = sp.id;
            if (signRepNameInp) signRepNameInp.value = sp.authorizedRep || '';
            if (signRepEmailInp) signRepEmailInp.value = sp.email || '';

            if (sigListEl) {
              const sigs = Array.isArray(sp.signatures) ? sp.signatures : [];
              sigListEl.innerHTML = sigs.length === 0
                ? '<div style="color:#94a3b8;font-style:italic;">Henüz elektronik imza atılmamış (Durum: Onay Bekliyor).</div>'
                : sigs.map(s => `
                    <div style="padding:6px 10px;background:rgba(34,197,94,0.12);border:1px solid #22c55e;border-radius:4px;margin-bottom:6px;">
                      ✓ <strong>${escapeHtml(s.signerName)}</strong> (${escapeHtml(s.role)}) — ${formatDateTR(s.signedAt)} tarihinde elektronik olarak imzaladı.
                    </div>
                  `).join('');
            }

            if (auditEl) {
              const trail = Array.isArray(sp.auditTrail) ? sp.auditTrail : [];
              auditEl.innerHTML = trail.length === 0
                ? '<div style="color:#64748b;">Denetim günlüğü boş.</div>'
                : trail.map(t => `
                    <div style="margin-bottom:4px;border-bottom:1px dotted rgba(255,255,255,0.08);padding-bottom:2px;">
                      <span style="color:#38bdf8;">[${formatDateTR(t.timestamp)}]</span> <strong>${escapeHtml(t.performedBy)}</strong>: ${escapeHtml(t.details)}
                    </div>
                  `).join('');
            }

            modal.classList.remove('hidden');
          }
          return;
        }

        if (action === 'extend') {
          const inputDays = window.prompt(`"${sp.name}" sponsorluk süresini kaç gün uzatmak istiyorsunuz?`, '30');
          if (inputDays === null) return;
          const days = parseInt(inputDays, 10);
          if (isNaN(days) || days <= 0) {
            showToast('Lütfen geçerli bir gün sayısı girin.', 'error');
            return;
          }
          try {
            svc().sponsorService.extendSponsorDuration(session, spId, days);
            showToast(`⏱️ "${sp.name}" sponsorluk süresi ${days} gün uzatıldı!`, 'success');
            renderAdmin();
          } catch (err) {
            showToast(err.message, 'error');
          }
          return;
        }

        if (action === 'terminate') {
          const reason = window.prompt(`"${sp.name}" sponsorluğu için fesih (iptal) başlatma gerekçesini yazın:\n\n(Not: 7 günlük itiraz süresi tanınır ve sözleşme/deliller korunur)`, 'Sözleşme şartlarına uyulmaması nedeniyle.');
          if (reason === null) return;
          if (!reason.trim()) {
            showToast('Fesih başlatmak için gerekçe zorunludur.', 'error');
            return;
          }
          try {
            svc().sponsorService.initiateSponsorTermination(session, spId, { reason });
            showToast(`⚠️ "${sp.name}" sponsorluk fesih süreci başlatıldı. Kayıt siteden gizlendi, sözleşme ve deliller arşivlendi.`, 'warning');
            renderAdmin();
          } catch (err) {
            showToast(err.message, 'error');
          }
          return;
        }

        if (action === 'delete') {
          const confirmArch = window.confirm(`"${sp.name}" sponsorluk kaydını kaldırmak üzeresiniz.\n\nSözleşme ve delil geçmişini koruyarak GÜVENLE ARŞİVLEMEK için "Tamam"a tıklayın.\n(Kalıcı olarak silmek yerine arşivleme önerilir)`);
          if (!confirmArch) return;
          try {
            svc().sponsorService.deleteSponsorRecord(session, spId, { permanent: false });
            showToast(`📦 "${sp.name}" sponsor kaydı arşivlendi (sözleşme ve deliller güvence altında).`, 'info');
            renderAdmin();
          } catch (err) {
            showToast(err.message, 'error');
          }
          return;
        }
      }

      // 7.5.6 Sözleşme Modalı Kapatma Butonu
      if (e.target.closest('#btn-close-sponsor-contract-modal')) {
        document.getElementById('modal-admin-sponsor-contract')?.classList.add('hidden');
        return;
      }

      // 7.5.7 Gemini ile Sözleşme Hükümlerini İyileştir (#btn-admin-gemini-draft-contract)
      if (e.target.closest('#btn-admin-gemini-draft-contract')) {
        const textEl = document.getElementById('adm-c-agreement-text');
        const nameVal = document.getElementById('adm-c-name')?.value || 'Sponsor Kuruluş';
        const repVal = document.getElementById('adm-c-rep')?.value || 'Yetkili Temsilci';
        const startVal = document.getElementById('adm-c-start-date')?.value || new Date().toISOString();
        const endVal = document.getElementById('adm-c-end-date')?.value || new Date(Date.now() + 30*86400000).toISOString();
        const rankVal = document.getElementById('adm-c-rank')?.value || 'VIP';
        const cosmVal = document.getElementById('adm-c-cosmetic-name')?.value || 'Özel Parıltılı Çerçeve';
        const benVal = document.getElementById('adm-c-benefits')?.value || 'Turnuva içi logo ve duyurular';

        const template = svc().sponsorService.generateAgreementTemplate({
          name: nameVal,
          authorizedRep: repVal,
          startDate: startVal,
          endDate: endVal,
          sponsoredRank: rankVal,
          sponsoredCosmeticName: cosmVal,
          customBenefits: benVal
        });

        if (textEl) {
          textEl.value = template;
          showToast('🤖 Gemini sözleşme şablonu güncel tarihler ve taraflar ile oluşturuldu!', 'success');
        }
        return;
      }

      // 7.5.8 Sözleşme İncele / Kabul / Red Butonları
      if (e.target.closest('#btn-action-review-contract')) {
        showToast('📄 Sözleşme metni yukarıdaki alanda tam metin olarak görüntülenmektedir.', 'info');
        return;
      }
      if (e.target.closest('#btn-action-accept-contract')) {
        const nameInp = document.getElementById('sign-rep-name');
        if (nameInp && !nameInp.value) nameInp.value = session.username || 'Yetkili';
        showToast('✓ Şartları kabul ettiniz. Lütfen "İmzala ve Onayla" butonuna basarak işlemi tamamlayın.', 'success');
        return;
      }
      if (e.target.closest('#btn-action-reject-contract')) {
        const spId = document.getElementById('sign-sponsor-id')?.value;
        if (spId && window.confirm('Sözleşmeyi reddetmek istediğinize emin misiniz?')) {
          const sp = svc().sponsorService.getSponsorById(spId);
          if (sp) {
            sp.contractStatus = 'TERMINATED';
            sp.active = false;
            if (!Array.isArray(sp.auditTrail)) sp.auditTrail = [];
            sp.auditTrail.push({
              action: 'CONTRACT_REJECTED',
              performedBy: session.username,
              timestamp: new Date().toISOString(),
              details: 'Sözleşme yetkili tarafından reddedildi.'
            });
            showToast('Sözleşme reddedildi ve işleme kapatıldı.', 'warning');
            document.getElementById('modal-admin-sponsor-contract')?.classList.add('hidden');
            renderAdmin();
          }
        }
        return;
      }

      // 7.6 Admin Mağaza Emojisi Seçici (.btn-pick-emoji)
      const pickEmojiBtn = e.target.closest('.btn-pick-emoji');
      if (pickEmojiBtn) {
        const em = pickEmojiBtn.getAttribute('data-emoji');
        const inp = document.getElementById('adm-shop-custom-emoji');
        const prev = document.getElementById('adm-shop-emoji-preview');
        if (inp) inp.value = em;
        if (prev) prev.innerHTML = em;
        return;
      }

      // ==========================================
      // MODERATÖR PANELİ İŞLEMLERİ (#3)
      // ==========================================
      const modTabBtn = e.target.closest('#mod-sidebar-nav [data-mod-tab]');
      if (modTabBtn) {
        state.modTab = modTabBtn.getAttribute('data-mod-tab');
        renderModerator();
        return;
      }

      // Moderatör: Oyuncu Susturmasını Kaldır ([data-mod-unmute])
      const modUnmuteBtn = e.target.closest('[data-mod-unmute]');
      if (modUnmuteBtn) {
        const session = getSession();
        if (!session) return;
        const targetU = modUnmuteBtn.getAttribute('data-mod-unmute');
        try {
          svc().authGuard.unmuteUser(session, targetU);
          showToast(`🔊 ${targetU} oyuncusunun susturma cezası kaldırıldı.`, 'success');
          renderModerator();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // Moderatör: Hata Durumu Güncelleme ([data-bug-status])
      const bugStatusBtn = e.target.closest('[data-bug-status]');
      if (bugStatusBtn) {
        const session = getSession();
        if (!session) return;
        const bId = bugStatusBtn.getAttribute('data-bug-id');
        const newStatus = bugStatusBtn.getAttribute('data-bug-status');
        try {
          svc().bugService.adminUpdateBug(session, bId, { status: newStatus });
          showToast(`🐞 Hata bildirimi "${newStatus}" olarak güncellendi ve puanlar işletildi!`, 'success');
          renderModerator();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // Moderatör: Öneri Durumu Güncelleme ([data-sug-status])
      const sugModStatusBtn = e.target.closest('[data-sug-status]');
      if (sugModStatusBtn) {
        const session = getSession();
        if (!session) return;
        const sId = sugModStatusBtn.getAttribute('data-sug-id');
        const newStatus = sugModStatusBtn.getAttribute('data-sug-status');
        try {
          svc().suggestionService.adminUpdateSuggestion(session, sId, { status: newStatus });
          showToast(`💡 Öneri durumu "${newStatus}" olarak güncellendi ve puanlar işletildi!`, 'success');
          renderModerator();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // Moderatör AI Soru Sorma Butonu (#btn-ask-mod-ai)
      if (e.target.closest('#btn-ask-mod-ai')) {
        const session = getSession();
        if (!session) return;
        const promptInput = document.getElementById('input-mod-ai-prompt');
        const promptText = String(promptInput?.value || '').trim();
        const historyEl = document.getElementById('mod-ai-history');
        if (!promptText) return;
        if (promptInput) promptInput.value = '';

        if (historyEl) {
          historyEl.innerHTML += `<div style="margin-top:6px;color:#93c5fd;"><strong>Siz:</strong> ${escapeHtml(promptText)}</div><div id="mod-ai-loading" style="margin-top:4px;color:#a7f3d0;font-style:italic;">⏳ Moderatör AI yanıtlıyor...</div>`;
          historyEl.scrollTop = historyEl.scrollHeight;
        }

        try {
          const res = await svc().aiAssistantService.askModeratorAI(session, promptText);
          const loadEl = document.getElementById('mod-ai-loading');
          if (loadEl) loadEl.remove();
          if (historyEl) {
            historyEl.innerHTML += `<div style="margin-top:4px;color:#cbd5e1;">⚔️ <strong>Moderatör AI:</strong> ${escapeHtml(res.reply)}</div>`;
            historyEl.scrollTop = historyEl.scrollHeight;
          }
        } catch (err) {
          const loadEl = document.getElementById('mod-ai-loading');
          if (loadEl) loadEl.remove();
          if (historyEl) {
            historyEl.innerHTML += `<div style="margin-top:4px;color:#f87171;">⚠️ Hata: ${escapeHtml(err.message)}</div>`;
          }
        }
        return;
      }

      // ==========================================
      // DESTEK YETKİLİ PANELİ İŞLEMLERİ (#3)
      // ==========================================
      const ticketTabBtn = e.target.closest('[data-ticket-tab]');
      if (ticketTabBtn) {
        state.ticketFilter = ticketTabBtn.getAttribute('data-ticket-tab');
        renderTicket();
        return;
      }

      // Destek Talebi Sahiplen, Yöneticiye İlet, Çözüldü Yap ([data-ticket-action])
      const ticketActionBtn = e.target.closest('[data-ticket-action]');
      if (ticketActionBtn) {
        const session = getSession();
        if (!session) return;
        const act = ticketActionBtn.getAttribute('data-ticket-action');
        const tId = ticketActionBtn.getAttribute('data-ticket-id');
        try {
          if (act === 'claim') {
            svc().supportService.claimTicket(session, tId);
            showToast(`🎯 #${tId} numaralı talep sahiplenildi!`, 'success');
          } else if (act === 'escalate') {
            svc().supportService.escalateTicket(session, tId, 'Yönetici incelemesi talep edildi.');
            showToast(`🚨 #${tId} numaralı talep üst yöneticiye iletildi.`, 'info');
          } else if (act === 'resolve') {
            svc().supportService.closeTicket(session, tId);
            showToast(`✓ #${tId} numaralı talep çözüldü olarak kapatıldı.`, 'success');
          }
          renderTicket();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // Destek Yanıtını AI ile İyileştir (#btn-ticket-ai-improve)
      if (e.target.closest('#btn-ticket-ai-improve')) {
        const textarea = document.getElementById('ticket-desk-reply-text');
        const currentText = String(textarea?.value || '').trim();
        const improveBtn = document.getElementById('btn-ticket-ai-improve');
        if (!currentText) {
          showToast('Lütfen önce iyileştirilmesini istediğiniz taslak yanıtı yazın.', 'warning');
          return;
        }
        try {
          if (improveBtn) { improveBtn.disabled = true; improveBtn.textContent = '⏳ İyileştiriliyor...'; }
          const res = await svc().aiAssistantService.improveTicketResponse(getSession(), currentText);
          if (textarea && res.improved) {
            textarea.value = res.improved;
            showToast('✨ Yanıtınız profesyonel ve kibar bir Minecraft destek üslubuna dönüştürüldü!', 'success');
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          if (improveBtn) { improveBtn.disabled = false; improveBtn.textContent = '✨ AI ile Yanıtı İyileştir'; }
        }
        return;
      }

      // ==========================================
      // 🧙‍♂️ MVIP BİLGE ASİSTAN MODALI (#5)
      // ==========================================
      if (e.target.closest('#floating-ai-btn')) {
        const session = getSession();
        if (!session) return;
        const userRank = svc().rankService.getUserRank(session.username);
        const effRole = svc().authGuard?.getEffectiveRole(session);
        if (userRank.order < 4 && effRole !== 'ADMIN' && effRole !== 'MODERATOR') {
          showToast('Bilge Asistan ayrıcalığı MVP ve MVIP+ üyelerine özeldir. Mağazadan rütbenizi yükseltebilirsiniz!', 'warning');
          return;
        }
        document.getElementById('modal-ai-assistant')?.classList.remove('hidden');
        return;
      }

      if (e.target.closest('#btn-close-ai-assistant')) {
        document.getElementById('modal-ai-assistant')?.classList.add('hidden');
        return;
      }

      // ==========================================
      // 🔒 PAROLAYI DEĞİŞTİR MODALI (#6)
      // ==========================================
      if (e.target.closest('#btn-open-change-password-modal')) {
        const session = getSession();
        if (!session) return;
        const user = svc().userService.getUserByUsername(session.username);
        const currentGroup = document.getElementById('group-current-password');
        const hasHash = Boolean(user?.passwordHash);
        if (currentGroup) {
          currentGroup.style.display = hasHash ? 'block' : 'none';
          const curInp = document.getElementById('input-current-password');
          if (curInp) curInp.required = hasHash;
        }
        const errEl = document.getElementById('change-password-error');
        if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
        document.getElementById('form-change-password')?.reset();
        document.getElementById('modal-change-password')?.classList.remove('hidden');
        return;
      }

      if (e.target.closest('#btn-close-change-password') || e.target.closest('#btn-cancel-change-password')) {
        document.getElementById('modal-change-password')?.classList.add('hidden');
        return;
      }

      // Şifre Göster/Gizle Butonları (.btn-toggle-pwd-vis)
      const toggleVisBtn = e.target.closest('.btn-toggle-pwd-vis');
      if (toggleVisBtn) {
        const targetId = toggleVisBtn.getAttribute('data-target');
        const inp = document.getElementById(targetId);
        if (inp) {
          const isPwd = inp.type === 'password';
          inp.type = isPwd ? 'text' : 'password';
          toggleVisBtn.textContent = isPwd ? '🙈' : '👁️';
        }
        return;
      }

      // ==========================================
      // 👾 DISCORD GİRİŞ & HESAP BAĞLAMA (#2)
      // ==========================================
      if (e.target.closest('#btn-discord-login-auth')) {
        try {
          const authUrl = await svc().authService.getDiscordAuthUrl();
          if (authUrl) {
            window.location.href = authUrl;
          }
        } catch (err) {
          showToast(err.message || 'Discord ile bağlantı başlatılamadı.', 'error', 9000, { errorCode: 'ERR_DISCORD_SETUP_REQUIRED' });
        }
        return;
      }

      if (e.target.closest('#btn-profile-toggle-telegram')) {
        const session = getSession();
        if (!session) return;
        const action = document.getElementById('btn-profile-toggle-telegram')?.dataset?.telegramAction;
        if (action === 'unlink') {
          if (window.confirm('Telegram hesabı bağlantısını kaldırmak istediğinize emin misiniz?')) {
            try {
              await svc().authService.unlinkTelegram(session);
              showToast('Telegram hesabınızın bağlantısı kaldırıldı.', 'info');
              renderProfile();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        } else {
          try {
            const targetUrl = (typeof getApiUrl === 'function') ? getApiUrl('/api/auth/telegram-start-request') : '/api/auth/telegram-start-request';
            const res = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Telegram botu başlatılamadı. Sunucu TELEGRAM_BOT_TOKEN ayarını kontrol edin.');
            }
            window.open(data.deepLink, '_blank');
            const codeInput = window.prompt(
              'Telegram botu yeni sekmede açıldı.\nLütfen botta "Başlat" (/start) dedikten sonra gelen 6 haneli onay kodunu girin:'
            );
            if (codeInput && codeInput.trim()) {
              const cleanCode = codeInput.replace(/\D/g, '').trim();
              const verifyUrl = (typeof getApiUrl === 'function') ? getApiUrl('/api/auth/telegram-verify-code') : '/api/auth/telegram-verify-code';
              const vRes = await fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nonce: data.nonce, code: cleanCode, linkingUsername: session.username })
              });
              const vData = await vRes.json().catch(() => ({}));
              if (!vRes.ok || !vData.success) {
                throw new Error(vData.error || 'Telegram onay kodu doğrulanamadı.');
              }
              await svc().authService.linkTelegram(session, {
                telegramId: vData.telegramUser?.id,
                telegramUsername: vData.telegramUser?.username
              });
              showToast('🎉 Telegram hesabınız başarıyla bağlandı!', 'success');
              renderProfile();
            }
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
        return;
      }

      if (e.target.closest('#btn-profile-toggle-discord')) {
        const session = getSession();
        if (!session) return;
        const action = document.getElementById('btn-profile-toggle-discord')?.dataset?.discordAction;
        if (action === 'unlink') {
          if (window.confirm('Discord hesabı bağlantısını kaldırmak istediğinize emin misiniz?')) {
            try {
              await svc().authService.unlinkDiscord(session);
              showToast('Discord hesabınızın bağlantısı kaldırıldı.', 'info');
              renderProfile();
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        } else {
          try {
            const authUrl = await svc().authService.getDiscordAuthUrl(session.username);
            if (authUrl) {
              window.location.href = authUrl;
            }
          } catch (err) {
            showToast(err.message || 'Discord bağlantı servisi başlatılamadı.', 'error', 10000, { errorCode: 'ERR_DISCORD_SETUP_REQUIRED' });
          }
        }
        return;
      }

      // ==========================================
      // 🎙️ MİKROFON SES TESTİ MODALI (#9)
      // ==========================================
      if (e.target.closest('#btn-test-mic')) {
        openMicTestModal();
        return;
      }
      if (e.target.closest('#btn-close-test-mic') || e.target.closest('#btn-finish-test-mic')) {
        closeMicTestModal();
        return;
      }
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

      const claimTicketBtn = e.target.closest('[data-admin-claim-ticket]');
      if (claimTicketBtn) {
        const tId = claimTicketBtn.getAttribute('data-admin-claim-ticket');
        try {
          svc().supportService.claimTicket(session, tId);
          showToast(`🎯 #${tId} numaralı destek talebini sahiplendiniz!`, 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const updateTicketStatusBtn = e.target.closest('[data-admin-update-ticket-status]');
      if (updateTicketStatusBtn) {
        const tId = updateTicketStatusBtn.getAttribute('data-admin-update-ticket-status');
        const statusVal = document.getElementById(`adm-sup-status-${tId}`)?.value || 'İŞLENİYOR';
        try {
          svc().supportService.updateTicketStatus(session, tId, statusVal);
          showToast(`#${tId} bilet durumu "${statusVal}" olarak güncellendi.`, 'info');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const aiImproveBtn = e.target.closest('[data-admin-ai-improve-ticket]');
      if (aiImproveBtn) {
        const tId = aiImproveBtn.getAttribute('data-admin-ai-improve-ticket');
        const draftText = String(document.getElementById(`adm-sup-reply-${tId}`)?.value || '').trim();
        if (!draftText) {
          showToast('Lütfen önce bir yanıt taslağı yazın.', 'warning');
          return;
        }
        try {
          aiImproveBtn.disabled = true;
          aiImproveBtn.textContent = '⏳ Düzenleniyor...';
          const improved = await svc().supportService.getAiSuggestedReply(tId, draftText);
          const previewBox = document.getElementById(`adm-ai-preview-box-${tId}`);
          const previewText = document.getElementById(`adm-ai-preview-text-${tId}`);
          if (previewBox && previewText) {
            previewText.textContent = improved;
            previewBox.classList.remove('hidden');
          }
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          aiImproveBtn.disabled = false;
          aiImproveBtn.textContent = '🤖 AI ile İyileştir (Önizle)';
        }
        return;
      }

      const cancelAiPreviewBtn = e.target.closest('[data-admin-cancel-ai-preview]');
      if (cancelAiPreviewBtn) {
        const tId = cancelAiPreviewBtn.getAttribute('data-admin-cancel-ai-preview');
        const previewBox = document.getElementById(`adm-ai-preview-box-${tId}`);
        if (previewBox) previewBox.classList.add('hidden');
        return;
      }

      const sendAiReplyBtn = e.target.closest('[data-admin-send-ai-reply]');
      if (sendAiReplyBtn) {
        const tId = sendAiReplyBtn.getAttribute('data-admin-send-ai-reply');
        const improvedText = document.getElementById(`adm-ai-preview-text-${tId}`)?.textContent || '';
        try {
          svc().supportService.replyToTicket(session, tId, improvedText);
          showToast('✅ AI ile düzenlenmiş yanıt başarıyla gönderildi!', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      if (e.target.closest('#btn-admin-verify-restore')) {
        try {
          const res = svc().backupService.verifyRestoreIntegrity();
          if (res.valid) {
            showToast(`✓ Bütünlük doğrulandı! Canlı veri etkilenmeden ${res.accountCount} hesap ve ${res.ticketCount} bilet başarıyla test edildi.`, 'success');
          } else {
            showToast(`⚠️ Doğrulama hatası: ${res.error}`, 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      const testRestoreBtn = e.target.closest('[data-admin-test-restore-snap]');
      if (testRestoreBtn) {
        const snId = testRestoreBtn.getAttribute('data-admin-test-restore-snap');
        try {
          const res = svc().backupService.verifyRestoreIntegrity(snId);
          if (res.valid) {
            showToast(`✓ Yedek (${snId}) başarıyla test edildi! Canlı veri etkilenmedi.`, 'success');
          } else {
            showToast(`⚠️ Yedek testi başarısız: ${res.error}`, 'error');
          }
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
      if (e.target.id === 'adm-shop-custom-emoji' || e.target.id === 'adm-shop-custom-img') {
        const customEmoji = document.getElementById('adm-shop-custom-emoji')?.value || '';
        const customImg = document.getElementById('adm-shop-custom-img')?.value || '';
        const prev = document.getElementById('adm-shop-emoji-preview');
        if (prev) {
          if (customImg) {
            prev.innerHTML = `<img src="${escapeHtml(customImg)}" style="width:24px;height:24px;object-fit:contain;" alt="" onerror="this.outerHTML='💎';" />`;
          } else {
            prev.innerHTML = escapeHtml(customEmoji || '💎');
          }
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
          const customEmoji = document.getElementById('adm-shop-custom-emoji')?.value || '';
          const customImg = document.getElementById('adm-shop-custom-img')?.value || '';
          const icon = customImg || customEmoji || 'CHEST';

          svc().shopService.adminSaveItem(session, {
            name,
            category,
            icon,
            customEmoji,
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
      } else if (e.target.id === 'admin-create-discount-form') {
        e.preventDefault();
        try {
          const code = document.getElementById('adm-disc-code')?.value || '';
          const discountPercent = Number(document.getElementById('adm-disc-percent')?.value || 15);
          const appliesTo = document.getElementById('adm-disc-applies')?.value || 'ALL';
          const maxUses = Number(document.getElementById('adm-disc-max-uses')?.value || 100);
          svc().discountService.createDiscount(session, {
            code,
            discountPercent,
            appliesTo,
            maxUses
          });
          showToast(`🎟️ "${code.toUpperCase()}" indirim kuponu oluşturuldu!`, 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-contract-builder-form' || e.target.id === 'admin-create-sponsor-form') {
        e.preventDefault();
        try {
          const name = document.getElementById('adm-c-name')?.value || document.getElementById('adm-sp-name')?.value || '';
          const authorizedRep = document.getElementById('adm-c-rep')?.value || '';
          const email = document.getElementById('adm-c-email')?.value || '';
          const logo = document.getElementById('adm-c-logo')?.value || '💎';
          const pack = document.getElementById('adm-c-package')?.value || 'Resmi Turnuva Ana Sponsorluğu';
          const type = document.getElementById('adm-c-type')?.value || 'TYPE_C';
          const sponsoredRank = document.getElementById('adm-c-rank')?.value || null;
          const sponsoredCosmeticName = document.getElementById('adm-c-cosmetic-name')?.value || document.getElementById('adm-sp-cosmetic-name')?.value || '';
          const startDate = document.getElementById('adm-c-start-date')?.value;
          const endDate = document.getElementById('adm-c-end-date')?.value;
          const durationDays = Number(document.getElementById('adm-c-duration')?.value || document.getElementById('adm-sp-duration')?.value || 30);
          const customBenefits = document.getElementById('adm-c-benefits')?.value || '';
          const agreementText = document.getElementById('adm-c-agreement-text')?.value || '';
          const terminationConditions = document.getElementById('adm-c-termination-cond')?.value || '';
          const disputeConditions = document.getElementById('adm-c-dispute-cond')?.value || '';

          svc().sponsorService.saveSponsor(session, {
            id: state.editingSponsorId || undefined,
            name,
            authorizedRep,
            email,
            logo,
            package: pack,
            type,
            sponsoredRank,
            sponsoredCosmeticName,
            startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : new Date(Date.now() + durationDays * 86400000).toISOString(),
            durationDays,
            customBenefits,
            agreementText,
            terminationConditions,
            disputeConditions,
            contractStatus: state.editingSponsorId ? undefined : 'PENDING_APPROVAL'
          });

          showToast(`📜 "${name}" sponsorluk sözleşmesi hazırlandı ve kaydedildi!`, 'success');
          state.sponsorSubTab = 'list';
          state.editingSponsorId = null;
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'form-sign-sponsor-contract') {
        e.preventDefault();
        try {
          const spId = document.getElementById('sign-sponsor-id')?.value;
          const signerName = document.getElementById('sign-rep-name')?.value;
          const signerEmail = document.getElementById('sign-rep-email')?.value;

          if (!spId) throw new Error('Sponsor seçilmedi.');
          svc().sponsorService.signAgreement(spId, { signerName, signerEmail, role: 'YETKİLİ_TEMSİLCİ' });

          showToast(`✍️ Sözleşme başarıyla elektronik olarak imzalandı ve onaylandı!`, 'success');
          document.getElementById('modal-admin-sponsor-contract')?.classList.add('hidden');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-telegram-config-form') {
        e.preventDefault();
        try {
          const botToken = document.getElementById('adm-tg-token')?.value || '';
          const botUsername = document.getElementById('adm-tg-bot-username')?.value || '';
          const chatId = document.getElementById('adm-tg-chat-id')?.value || '';
          const supportBotToken = document.getElementById('adm-tg-support-token')?.value || '';
          const supportChatId = document.getElementById('adm-tg-support-chat-id')?.value || '';
          svc().telegramService.updateConfig(session, { botToken, botUsername, chatId, supportBotToken, supportChatId });
          showToast('🤖 Telegram Bot ayarları güncellendi!', 'success');
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
      } else if (e.target.id === 'admin-firebase-config-form') {
        e.preventDefault();
        try {
          const apiKey = String(document.getElementById('adm-fb-api-key')?.value || '').trim();
          const authDomain = String(document.getElementById('adm-fb-auth-domain')?.value || '').trim();
          const projectId = String(document.getElementById('adm-fb-project-id')?.value || '').trim();
          const storageBucket = String(document.getElementById('adm-fb-storage-bucket')?.value || '').trim();
          const messagingSenderId = String(document.getElementById('adm-fb-sender-id')?.value || '').trim();
          const appId = String(document.getElementById('adm-fb-app-id')?.value || '').trim();

          if (!apiKey || apiKey.length < 20) {
            throw new Error('Geçerli bir Firebase Web API Anahtarı girilmelidir.');
          }

          const newCfg = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
          if (window.MCMFirebase?.setConfig) {
            window.MCMFirebase.setConfig(newCfg);
          }
          showToast('🔥 Canlı Firebase yapılandırması başarıyla kaydedildi! Google Sign-In aktif.', 'success');
          renderAdmin();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (e.target.id === 'admin-platform-settings-form') {
        e.preventDefault();
        try {
          const maintenanceActive = document.getElementById('adm-set-maintenance')?.checked || false;
          const apiUrl = String(document.getElementById('adm-set-api-url')?.value || '').trim().replace(/\/+$/, '');
          if (typeof localStorage !== 'undefined') {
            if (apiUrl) localStorage.setItem('mcm_backend_api_url', apiUrl);
            else localStorage.removeItem('mcm_backend_api_url');
          }
          if (typeof window !== 'undefined') window.MCM_API_BASE_URL = apiUrl;

          svc().backupService.updatePlatformSettings(session, {
            siteTitle: document.getElementById('adm-set-title')?.value || 'Minecraft Milyoner',
            announcementText: document.getElementById('adm-set-announcement')?.value || '',
            maintenanceMode: Boolean(maintenanceActive)
          });
          if (svc().maintenanceService) {
            svc().maintenanceService.setMaintenanceMode(session, maintenanceActive);
          }
          showToast('Platform ayarları, Backend API URL ve Bakım Modu başarıyla güncellendi.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Firebase Ayarlarını Sıfırla (#btn-admin-reset-firebase-config)
    document.addEventListener('click', e => {
      const resetBtn = e.target.closest('#btn-admin-reset-firebase-config');
      if (resetBtn) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('mcm_custom_firebase_config');
        }
        if (window.MCMFirebase?.initFirebase) {
          window.MCMFirebase.initFirebase();
        }
        showToast('Firebase yapılandırması varsayılan demo moduna sıfırlandı.', 'info');
        renderAdmin();
      }
    });

    // Backend API Bağlantı Testi (#btn-admin-test-backend-api)
    document.addEventListener('click', async e => {
      const testBtn = e.target.closest('#btn-admin-test-backend-api');
      if (testBtn) {
        const inp = document.getElementById('adm-set-api-url');
        const rawUrl = String(inp?.value || '').trim().replace(/\/+$/, '');
        if (!rawUrl) {
          showToast('Lütfen önce test edilecek bir Backend API URL adresi girin.', 'warning');
          return;
        }
        testBtn.disabled = true;
        testBtn.textContent = '⏳ Test Ediliyor...';
        try {
          const targetUrl = rawUrl.startsWith('http') ? `${rawUrl}/api/health` : `https://${rawUrl}/api/health`;
          const res = await fetch(targetUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast(`✓ Backend sunucusuna başarıyla bağlanıldı! (${data.version || 'v10'})`, 'success');
          } else {
            showToast(`⚠️ Sunucu yanıt verdi ancak durum kodu: ${res.status}`, 'warning');
          }
        } catch (err) {
          showToast(`❌ Sunucuya erişilemedi: ${err.message}. Lütfen sunucunun (server.js) çalıştığını ve CORS izinlerini kontrol edin.`, 'error');
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = '🔌 Bağlantıyı Test Et';
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
