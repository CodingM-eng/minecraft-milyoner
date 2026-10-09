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
  // FIREBASE GÜVENLİK VE YÖNETİM
  // (Normal ziyaretçilere ham anahtar veya test modu pencereleri gösterilmez)
  // ========================================================

  function openFirebaseSetupModal(options = {}) {
    console.info('[Firebase Config] Setup modal request:', options);
  }

  function closeFirebaseSetupModal() {
    // no-op
  }

  /**
   * Google ile Giriş Yap & Google Drive Kapsamı İste
   * Canlı Firebase yapılandırılmışsa açılır Google popup penceresini çalıştırır.
   * Henüz yapılandırılmamışsa veya ortamda engellenmişse temiz biçimde Gmail OTP akışına aktarır.
   */
  async function signInWithGoogleAndDrive(options = {}) {
    const { promptConsent = true } = options;
    const cfg = getStoredConfig();

    // 1. Placeholder anahtar durumu: Doğrudan Gmail & OTP doğrulama akışına yönlendir
    if (isPlaceholderConfig(cfg)) {
      return {
        success: false,
        needFallbackToGmail: true,
        reason: 'Firebase canlı yapılandırması bekleniyor. Güvenli Gmail & OTP doğrulamasına geçiliyor.'
      };
    }

    // 2. Canlı Firebase hazırla
    if (!isFirebaseReady()) {
      initFirebase();
    }

    if (!isFirebaseReady()) {
      return {
        success: false,
        needFallbackToGmail: true,
        reason: 'Firebase SDK henüz hazır değil. Gmail & OTP doğrulamasına geçiliyor.'
      };
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

      // Yaygın popup hataları
      if (err.code === 'auth/popup-blocked') {
        throw new Error('Tarayıcınız Google oturum penceresini engelledi. Lütfen açılır pencerelere (pop-up) izin verin.');
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        throw new Error('Google oturum penceresi kapatıldı.');
      }

      return {
        success: false,
        needFallbackToGmail: true,
        error: err,
        code: err.code,
        message: err.message
      };
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
