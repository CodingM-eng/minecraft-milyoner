/**
 * Minecraft Milyoner - Firebase Authentication & Google Drive Yapılandırması (v0.0.1)
 *
 * Özellikler:
 * 1. Firebase Authentication Entegrasyonu (Google Sign-In & Email/Password)
 * 2. Google Drive İzin Kapsamı (https://www.googleapis.com/auth/drive.file)
 * 3. Oturum Kalıcılığı (Local Persistence)
 * 4. codingdevelopia@gmail.com için sunucu/kural seviyesinde doğrulanabilir Admin Kontrolü
 * 5. Canlı Firebase Anahtarları Yönetimi (Arayüzden Kolayca Girilebilir)
 * 6. Yerel / Çevrimdışı Geliştirici Test Modu (Simülasyon Girişi)
 */

(function (window) {
  'use strict';

  const SUPER_ADMIN_EMAIL = 'codingdevelopia@gmail.com';
  const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

  // Varsayılan Firebase proje konfigürasyonu şablonu
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDemoMinecraftMillionaireKey_PlaceHolder',
    authDomain: 'minecraft-milyoner.firebaseapp.com',
    projectId: 'minecraft-milyoner',
    storageBucket: 'minecraft-milyoner.appspot.com',
    messagingSenderId: '102938475610',
    appId: '1:102938475610:web:9a8b7c6d5e4f3a2b1c0d'
  };

  function isPlaceholderConfig(cfg) {
    if (!cfg || !cfg.apiKey) return true;
    const key = String(cfg.apiKey).toLowerCase();
    return key.includes('placeholder') || key.includes('demo') || key.length < 20;
  }

  function getStoredConfig() {
    try {
      const raw = localStorage.getItem('mcm_custom_firebase_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.apiKey) {
          return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      // fallback
    }
    return window.MCM_FIREBASE_CUSTOM_CONFIG || DEFAULT_FIREBASE_CONFIG;
  }

  let firebaseApp = null;
  let authInstance = null;
  let firestoreInstance = null;

  function initFirebase() {
    if (typeof window.firebase === 'undefined') {
      return null;
    }
    const cfg = getStoredConfig();

    // Placeholder anahtar varsa gerçek Firebase başlatmasını sessizce geç
    if (isPlaceholderConfig(cfg)) {
      return { firebaseApp: null, auth: null, firestore: null, isPlaceholder: true };
    }

    try {
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        firebaseApp = window.firebase.initializeApp(cfg);
      } else {
        firebaseApp = window.firebase.app();
      }

      authInstance = window.firebase.auth();
      // Oturum kalıcılığı: Tarayıcı kapansa bile açık kalır
      authInstance.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      if (window.firebase.firestore) {
        firestoreInstance = window.firebase.firestore();
      }

      return { firebaseApp, auth: authInstance, firestore: firestoreInstance, isPlaceholder: false };
    } catch (err) {
      console.warn('[Firebase] Başlatma uyarısı:', err.message);
      return null;
    }
  }

  function isFirebaseReady() {
    return Boolean(typeof window.firebase !== 'undefined' && authInstance);
  }

  function isSuperAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  }

  // ========================================================
  // FIREBASE AYARLARI VE TEST MODU MODALI (UI)
  // ========================================================
  let pendingAuthPromise = null;

  function ensureSetupModalInDOM() {
    let modal = document.getElementById('modal-firebase-setup');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modal-firebase-setup';
    modal.className = 'mc-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText =
      'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);';

    modal.innerHTML = `
      <div class="mc-modal-card" style="background: #111827; border: 2px solid #3b82f6; border-radius: 12px; width: 100%; max-width: 580px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); overflow: hidden; color: #f3f4f6; font-family: Inter, sans-serif;">
        <div style="background: #1e293b; padding: 14px 18px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">🔥</span>
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #ffffff;">Firebase Yapılandırması &amp; Test Modu</h3>
          </div>
          <button type="button" id="btn-close-fb-setup" style="background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <div style="padding: 18px; max-height: 80vh; overflow-y: auto;">
          <div id="fb-setup-alert" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 0.85rem; color: #fde68a;">
            <strong>Bilgi:</strong> Firebase API anahtarınız henüz girilmemiş veya canlı Google bağlantısı yapılandırılmamış. Aşağıdaki seçeneklerden birini kullanarak hemen devam edebilirsiniz.
          </div>

          <!-- 1. HIZLI TEST / SİMÜLASYON GİRİŞİ -->
          <div style="margin-bottom: 20px; background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: #60a5fa; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> <span>Hızlı Test / Simülasyon Girişi (Kurulum Gerektirmez)</span>
            </h4>
            <p style="margin: 0 0 12px 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.4;">
              Firebase Console ile uğraşmadan tüm oyunu, rütbeleri, Drive görünürlük kurallarını ve Admin panelini hemen test edin:
            </p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" id="btn-fb-test-admin" class="mc-btn mc-btn-gold mc-btn-sm" style="text-align: left; padding: 10px 14px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                <span>👑 <strong>Admin Olarak Giriş Yap</strong> (codingdevelopia@gmail.com)</span>
                <span style="font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">Tam Yetkili</span>
              </button>
              <button type="button" id="btn-fb-test-user-drive" class="mc-btn mc-btn-primary mc-btn-sm" style="text-align: left; padding: 10px 14px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                <span>👤 <strong>Normal Oyuncu</strong> (Drive İzni Açık — Tam Profil)</span>
                <span style="font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">✓ Drive Onaylı</span>
              </button>
              <button type="button" id="btn-fb-test-user-nodrive" class="mc-btn mc-btn-secondary mc-btn-sm" style="text-align: left; padding: 10px 14px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                <span>🔒 <strong>Kısıtlı Oyuncu</strong> (Drive İzni Yok — Gizli Bakiye)</span>
                <span style="font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">🔒 Gizli Profil</span>
              </button>
            </div>
          </div>

          <!-- 2. CANLI FIREBASE PROJE BİLGİLERİ -->
          <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 14px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: #34d399; display: flex; align-items: center; gap: 6px;">
              <span>🔑</span> <span>Canlı Firebase Projenizi Bağlayın</span>
            </h4>
            <p style="margin: 0 0 10px 0; font-size: 0.8rem; color: #94a3b8; line-height: 1.4;">
              <a href="https://console.firebase.google.com" target="_blank" style="color: #60a5fa; text-decoration: underline;">Firebase Console &gt; Project Settings &gt; General &gt; Web App</a> bölümündeki config nesnesini yapıştırın:
            </p>
            <textarea id="fb-setup-config-json" rows="4" style="width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #f8fafc; font-family: monospace; font-size: 0.8rem; padding: 8px; resize: vertical;" placeholder='{\n  "apiKey": "AIzaSy...",\n  "authDomain": "proje.firebaseapp.com",\n  "projectId": "proje-id",\n  "appId": "1:..."\n}'></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end;">
              <button type="button" id="btn-save-fb-config" class="mc-btn mc-btn-primary mc-btn-sm" style="padding: 8px 16px;">
                💾 Kaydet &amp; Canlı Bağlan
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Kapatma butonu
    modal.querySelector('#btn-close-fb-setup').onclick = () => {
      closeFirebaseSetupModal();
      if (pendingAuthPromise) {
        pendingAuthPromise.reject(new Error('Firebase yapılandırma penceresi kapatıldı.'));
        pendingAuthPromise = null;
      }
    };

    // Test Girişleri
    modal.querySelector('#btn-fb-test-admin').onclick = () => {
      resolveWithSimulation({
        isAdmin: true,
        hasDrive: true,
        email: SUPER_ADMIN_EMAIL,
        name: 'CodingDevelopia'
      });
    };

    modal.querySelector('#btn-fb-test-user-drive').onclick = () => {
      resolveWithSimulation({
        isAdmin: false,
        hasDrive: true,
        email: 'steve.pro@gmail.com',
        name: 'StevePro'
      });
    };

    modal.querySelector('#btn-fb-test-user-nodrive').onclick = () => {
      resolveWithSimulation({
        isAdmin: false,
        hasDrive: false,
        email: 'alex.nodrive@gmail.com',
        name: 'AlexNoDrive'
      });
    };

    // Yapılandırma Kaydet
    modal.querySelector('#btn-save-fb-config').onclick = () => {
      const text = modal.querySelector('#fb-setup-config-json').value.trim();
      if (!text) {
        alert('Lütfen geçerli bir Firebase yapılandırma JSON metni yapıştırın.');
        return;
      }
      try {
        let parsed = null;
        if (text.startsWith('{')) {
          parsed = JSON.parse(text);
        } else {
          // apiKey: "...", authDomain: "..." formatı
          const cleaned = text
            .replace(/const\s+firebaseConfig\s*=\s*/, '')
            .replace(/;?\s*$/, '')
            .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
            .replace(/'/g, '"');
          parsed = JSON.parse(cleaned);
        }
        if (!parsed.apiKey) {
          throw new Error('Yapılandırma nesnesinde apiKey bulunamadı.');
        }

        localStorage.setItem('mcm_custom_firebase_config', JSON.stringify(parsed));
        closeFirebaseSetupModal();
        alert('Firebase yapılandırması başarıyla kaydedildi! Sayfa canlı anahtarlarla yeniden başlatılıyor.');
        window.location.reload();
      } catch (err) {
        alert('Yapılandırma metni çözümlenemedi: ' + err.message);
      }
    };

    return modal;
  }

  function resolveWithSimulation({ isAdmin, hasDrive, email, name }) {
    closeFirebaseSetupModal();
    const result = {
      success: true,
      user: {
        uid: 'sim_' + (isAdmin ? 'admin_codingdevelopia' : hasDrive ? 'drive_user' : 'nodrive_user'),
        email: email,
        displayName: name,
        photoURL: '',
        emailVerified: true
      },
      accessToken: hasDrive ? 'mock_drive_access_token_' + Date.now() : null,
      drivePermissionGranted: Boolean(hasDrive),
      isAdmin: Boolean(isAdmin),
      isSimulated: true
    };

    if (pendingAuthPromise) {
      pendingAuthPromise.resolve(result);
      pendingAuthPromise = null;
    }
  }

  function openFirebaseSetupModal(options = {}) {
    const modal = ensureSetupModalInDOM();
    const alertEl = modal.querySelector('#fb-setup-alert');
    if (alertEl && options.reason) {
      alertEl.innerHTML = `<strong>Uyarı:</strong> ${options.reason}`;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeFirebaseSetupModal() {
    const modal = document.getElementById('modal-firebase-setup');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  /**
   * Google ile Giriş Yap & Google Drive Kapsamı İste
   * Canlı Firebase hazır değilse veya hata verirse otomatik olarak Test & Yapılandırma modalını açar.
   */
  async function signInWithGoogleAndDrive(options = {}) {
    const { promptConsent = true } = options;
    const cfg = getStoredConfig();

    // 1. Placeholder anahtar durumu: Hemen rehber / test modalını göster
    if (isPlaceholderConfig(cfg)) {
      return new Promise((resolve, reject) => {
        pendingAuthPromise = { resolve, reject };
        openFirebaseSetupModal({
          reason:
            'Firebase projenizin canlı API anahtarları henüz girilmemiş. Canlı anahtarlarınızı ekleyebilir veya aşağıdaki Hızlı Test Girişleri ile anında devam edebilirsiniz.'
        });
      });
    }

    // 2. Canlı Firebase hazırla
    if (!isFirebaseReady()) {
      initFirebase();
    }

    if (!isFirebaseReady()) {
      return new Promise((resolve, reject) => {
        pendingAuthPromise = { resolve, reject };
        openFirebaseSetupModal({
          reason:
            'Firebase SDK başlatılamadı. Lütfen canlı Firebase config bilgilerinizi kontrol edin veya Test Modu ile giriş yapın.'
        });
      });
    }

    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_FILE_SCOPE);

    const customParams = {};
    if (promptConsent) {
      customParams.prompt = 'consent';
      customParams.access_type = 'offline';
    }
    provider.setCustomParameters(customParams);

    try {
      const result = await authInstance.signInWithPopup(provider);
      const user = result.user;
      const credential = result.credential;
      const accessToken = credential ? credential.accessToken : null;
      const hasDriveScope = Boolean(accessToken);

      const email = (user.email || '').toLowerCase().trim();
      const isAdmin = isSuperAdminEmail(email);

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || email.split('@')[0],
          photoURL: user.photoURL || '',
          emailVerified: user.emailVerified
        },
        accessToken,
        drivePermissionGranted: hasDriveScope,
        isAdmin,
        rawResult: result,
        isSimulated: false
      };
    } catch (err) {
      console.warn('[Firebase Google Sign-In Error]', err);

      // Yaygın Firebase hatalarını açıkla ve test modalı seçeneği sun
      let friendlyReason = '';
      if (err.code === 'auth/invalid-api-key' || err.code === 'auth/api-key-not-valid') {
        friendlyReason =
          'Firebase API Anahtarı geçersiz veya kopyalanırken eksik girilmiş. Lütfen Firebase Console &gt; Project Settings bölümünden aldığınız gerçek anahtarı girin veya Test Modu ile devam edin.';
      } else if (err.code === 'auth/operation-not-supported-in-this-environment') {
        friendlyReason =
          'Bu sayfa yerel dosya (file://) üzerinden açıldığı için tarayıcı Google OAuth penceresine izin vermiyor. Lütfen sayfayı bir yerel sunucu (localhost) üzerinden açın veya Test Modu ile devam edin.';
      } else if (err.code === 'auth/unauthorized-domain') {
        const host = window.location.hostname || 'bu alan adı';
        friendlyReason = `${host} adresi Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains listesine eklenmemiş. Lütfen konsola ekleyin veya Test Modunu kullanın.`;
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Tarayıcınız Google oturum penceresini engelledi. Lütfen açılır pencerelere (pop-up) izin verin.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        throw new Error('Google giriş penceresi kapatıldı.');
      } else {
        friendlyReason = `Google girişi başarısız oldu (${err.message}). Canlı yapılandırmanızı kontrol edebilir veya Test Modu ile devam edebilirsiniz.`;
      }

      // Kullanıcıyı modal ile kurtar
      return new Promise((resolve, reject) => {
        pendingAuthPromise = { resolve, reject };
        openFirebaseSetupModal({ reason: friendlyReason });
      });
    }
  }

  /**
   * Yalnızca Google Drive iznini sonradan isteme veya yenileme
   */
  async function requestDrivePermissionOnly() {
    return await signInWithGoogleAndDrive({ promptConsent: true });
  }

  /**
   * Firebase Oturumu Kapatma
   */
  async function signOut() {
    if (authInstance) {
      try {
        await authInstance.signOut();
      } catch (e) {
        // ignore
      }
    }
    return true;
  }

  // Global namespace'e bağla
  window.MCMFirebase = {
    SUPER_ADMIN_EMAIL,
    DRIVE_FILE_SCOPE,
    initFirebase,
    isFirebaseReady,
    isSuperAdminEmail,
    isPlaceholderConfig,
    signInWithGoogleAndDrive,
    requestDrivePermissionOnly,
    openFirebaseSetupModal,
    closeFirebaseSetupModal,
    signOut,
    getAuth: () => authInstance,
    getFirestore: () => firestoreInstance,
    getConfig: getStoredConfig,
    setConfig: cfg => {
      try {
        localStorage.setItem('mcm_custom_firebase_config', JSON.stringify(cfg));
        initFirebase();
      } catch (e) {}
    }
  };

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFirebase());
  } else {
    initFirebase();
  }
})(typeof window !== 'undefined' ? window : globalThis);
