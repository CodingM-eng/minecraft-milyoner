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
    PARTY_STATUSES
  } = window.MCMServices;

  class TournamentPlatformController {
    constructor() {
      this.session = null;
      this.selectedPartyId = null;
      this.currentInvitationText = '';
      this.confirmCallback = null;

      this.init();
    }

    init() {
      this.bindLicenseGate();
      this.bindTopBar();
      this.bindPartyLobby();
      this.bindAdminPanel();
      this.bindConfirmModal();
      this.bindInvitationModal();

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
      }, 3400);
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
    // TOP BAR & NAVIGATION
    // ==========================================
    updateTopBarSessionUI() {
      const badge = document.getElementById('top-session-badge');
      const nameEl = document.getElementById('top-session-username');
      const roleEl = document.getElementById('top-session-role');
      const adminBtn = document.getElementById('btn-top-admin');
      const partyBtn = document.getElementById('btn-top-party');
      const logoutBtn = document.getElementById('btn-top-logout');

      if (!this.session) {
        if (badge) badge.classList.add('hidden');
        if (adminBtn) adminBtn.classList.add('hidden');
        if (partyBtn) partyBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        return;
      }

      if (badge) badge.classList.remove('hidden');
      if (nameEl) nameEl.textContent = this.session.username;
      if (roleEl) {
        roleEl.textContent = this.session.role;
        roleEl.className = `role-badge role-${this.session.role.toLowerCase()}`;
      }

      // Strictly show Admin Panel button ONLY if role === 'ADMIN'
      if (adminBtn) {
        adminBtn.classList.toggle('hidden', this.session.role !== 'ADMIN');
      }
      if (partyBtn) partyBtn.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    }

    bindTopBar() {
      const adminBtn = document.getElementById('btn-top-admin');
      const partyBtn = document.getElementById('btn-top-party');
      const menuPartyBtn = document.getElementById('btn-open-party-hub');
      const logoutBtn = document.getElementById('btn-top-logout');

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

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          window.soundManager.playClick();
          this.handleLogout();
        });
      }
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
      this.renderAdminLicenses();
      this.renderAdminParties();
      this.renderAdminPlayers();
      this.renderAdminActivity();
    }

    renderAdminDashboard() {
      const licenses = licenseService.listLicensesForAdmin(this.session);
      const parties = partyService.listParties(this.session);
      const logs = activityService.getAll();

      const totalLic = licenses.length;
      const activeLic = licenses.filter(l => l.effectiveStatus === 'ACTIVE').length;
      const revokedLic = licenses.filter(l => l.effectiveStatus === 'REVOKED').length;

      const totalParties = parties.length;
      const activeParties = parties.filter(p =>
        ['WAITING', 'READY', 'STARTING', 'ACTIVE'].includes(p.status)
      ).length;
      const totalParticipants = parties.reduce((sum, p) => sum + p.participants.length, 0);

      document.getElementById('adm-metric-total-lic').textContent = totalLic;
      document.getElementById('adm-metric-active-lic').textContent = activeLic;
      document.getElementById('adm-metric-revoked-lic').textContent = revokedLic;
      document.getElementById('adm-metric-total-parties').textContent = totalParties;
      document.getElementById('adm-metric-active-parties').textContent = activeParties;
      document.getElementById('adm-metric-total-participants').textContent = totalParticipants;

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
      let players = playerService.getAllPlayers();
      if (q) {
        players = players.filter(
          p => p.username.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
        );
      }

      wrap.innerHTML = players
        .map(p => {
          const seen = new Date(p.lastSeenAt).toLocaleString('tr-TR');
          return `
            <div class="adm-row-card">
              <div class="adm-row-main">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                  <strong>⛏️ ${this.escapeHtml(p.username)}</strong>
                  <span class="role-badge role-${p.role.toLowerCase()}">${p.role}</span>
                  <span class="status-pill status-${p.status === 'ONLINE' ? 'ACTIVE' : 'DISABLED'}">${p.status}</span>
                </div>
                <div class="adm-row-sub">
                  <span>🔑 License ID: ${this.escapeHtml(p.licenseId)}</span>
                  <span>🕒 Son Görülme: ${seen}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
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
