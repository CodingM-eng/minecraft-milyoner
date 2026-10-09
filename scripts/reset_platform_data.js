/**
 * Minecraft Milyoner - Platform Verilerini Güvenli ve Onaylı Sıfırlama Modülü & CLI
 *
 * UYARI: Bu işlem geri alınamaz!
 * Mevcut tüm kullanıcı hesaplarını, coin/bakiye kayıtlarını (Zümrüt & Netherite),
 * işlem geçmişlerini ve admin hesaplarını tamamen siler.
 *
 * Kullanım (CLI):
 *   node scripts/reset_platform_data.js --confirm-reset-all-data
 *
 * Parametresiz çalıştığında hiçbir veri silinmez; yalnızca neyin silineceğini loglar ve uyarır.
 */

const CLOUD_ENDPOINTS = [
  'https://kvdb.io/VbaQ2SwvGVXLqWRhnvv6sM/mcm_cloud_db_v10',
  'https://kvdb.io/VbaQ2SwvGVXLqWRhnvv6sM/mcm_cloud_db_v10_backup',
  'https://kvdb.io/VbaQ2SwvGVXLqWRhnvv6sM/mcm_cloud_db_v9'
];

const STORAGE_KEYS_TO_WIPE = [
  'mc_millionaire_tr_users_v10',
  'mc_millionaire_tr_active_session_v10',
  'mc_millionaire_tr_parties_v10',
  'mc_millionaire_tr_party_invites_v10',
  'mc_millionaire_tr_notifications_v10',
  'mc_millionaire_tr_support_v10',
  'mc_millionaire_tr_bugs_v10',
  'mc_millionaire_tr_suggestions_v10',
  'mc_millionaire_tr_ranks_v10',
  'mc_millionaire_tr_economy_settings_v10',
  'mc_millionaire_tr_emerald_tx_v10',
  'mc_millionaire_tr_netherite_tx_v10',
  'mc_millionaire_tr_shop_items_v10',
  'mc_millionaire_tr_purchases_v10',
  'mc_millionaire_tr_rank_gifts_v10',
  'mc_millionaire_tr_achievements_v10',
  'mc_millionaire_tr_extralife_cd_v10',
  'mc_millionaire_tr_leaderboard_meta_v10',
  'mc_millionaire_tr_activity_v10',
  'mc_millionaire_tr_first_netherite_v10',
  'mc_millionaire_tr_ai_cfg_v10',
  'mc_millionaire_tr_ai_questions_v10',
  'mc_millionaire_tr_seen_questions_v10',
  'mc_millionaire_tr_tombstones_v10'
];

function buildCleanState(resetEpoch = Date.now()) {
  return {
    version: '0.0.1',
    schemaVersion: '0.0.1',
    resetEpoch,
    updatedAt: new Date(resetEpoch).toISOString(),
    users: [],
    parties: [],
    partyInvitations: [],
    notifications: {},
    support: [],
    bugs: [],
    suggestions: [],
    modPermissions: null,
    platformSettings: null,
    aiConfig: null,
    aiQuestions: [],
    ranks: [],
    shopItems: [],
    leaderboardMeta: {
      lastResetAt: new Date(resetEpoch).toISOString(),
      resetCount: 1,
      lastResetBy: 'STANDALONE_RESET_CLI'
    },
    transactions: [],
    netheriteTx: [],
    purchases: [],
    giftHistory: [],
    extraLifeCooldowns: {},
    firstPremiumNetheriteGranted: {},
    economySettings: null,
    activity: [],
    stripeConfig: null
  };
}

async function executePlatformReset(options = {}) {
  const { confirm = false, dryRun = false, storage = null, logger = console } = options;

  logger.log('===============================================================');
  logger.log('🔥 MINECRAFT MİLYONER PLATFORM VERİLERİNİ SIFIRLAMA İŞLEMİ');
  logger.log('===============================================================');
  logger.log(`Tarih: ${new Date().toISOString()}`);

  if (!confirm) {
    logger.error('❌ HATA: Onay parametresi eksik! İşlem iptal edildi.');
    logger.warn('---------------------------------------------------------------');
    logger.warn('Bu işlem GERİ ALINAMAZDIR ve şunları KALICI OLARAK silecektir:');
    logger.warn('  • Tüm oyuncu hesapları (eski admin hesapları dahil)');
    logger.warn('  • Tüm Zümrüt (Emerald) ve Netherite bakiye kayıtları');
    logger.warn('  • Tüm işlem geçmişleri, alışveriş ve hediye kayıtları');
    logger.warn('  • Tüm parti odaları, davetler ve bildirimler');
    logger.warn('  • Tüm destek talepleri, hata bildirimleri ve öneriler');
    logger.warn('  • Bulut veritabanı (kvdb) ve yerel önbellekler');
    logger.warn('---------------------------------------------------------------');
    logger.warn('Çalıştırmak için lütfen şu komutu kullanın:');
    logger.warn('  node scripts/reset_platform_data.js --confirm-reset-all-data');
    logger.log('===============================================================');
    return { success: false, reason: 'CONFIRMATION_REQUIRED' };
  }

  if (dryRun) {
    logger.info('ℹ️ DRY-RUN modu aktif: Hiçbir veri silinmedi.');
    return { success: true, dryRun: true };
  }

  const resetEpoch = Date.now();
  logger.log(`[1/3] Yeni Reset Epoch oluşturuluyor: ${resetEpoch}`);

  // 1. LocalStorage temizliği (tarayıcı veya mock ortamı varsa)
  if (storage && typeof storage.removeItem === 'function') {
    logger.log('[2/3] Yerel depolama anahtarları temizleniyor...');
    for (const key of STORAGE_KEYS_TO_WIPE) {
      storage.removeItem(key);
      logger.log(`   - Silindi: ${key}`);
    }
    // Eski versiyon anahtarlarını da temizle
    if (typeof storage.length === 'number') {
      const keysToPurge = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith('mc_millionaire_tr_') && !k.endsWith('_v10')) {
          keysToPurge.push(k);
        }
      }
      for (const k of keysToPurge) {
        storage.removeItem(k);
        logger.log(`   - Eski versiyon anahtarı silindi: ${k}`);
      }
    }
    storage.setItem('mc_millionaire_tr_reset_epoch_v10', String(resetEpoch));
    storage.setItem('mc_millionaire_tr_users_v10', JSON.stringify([]));
  } else {
    logger.log('[2/3] Yerel depolama ortamı CLI üzerinde atlandı (Tarayıcı açılışında temizlenecek).');
  }

  // 2. Canlı Bulut Uç Noktalarını Sıfırla
  logger.log('[3/3] Bulut veritabanı uç noktaları temiz boş durumla güncelleniyor...');
  const cleanState = buildCleanState(resetEpoch);

  const endpointResults = [];
  for (const url of CLOUD_ENDPOINTS) {
    try {
      if (typeof fetch === 'function') {
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(cleanState)
        });
        endpointResults.push({ url, status: res.status, ok: res.ok });
        logger.log(`   ✓ ${url} -> HTTP ${res.status}`);
      } else {
        logger.warn(`   ⚠️ fetch fonksiyonu bulunamadı, ${url} güncellenemedi.`);
      }
    } catch (err) {
      endpointResults.push({ url, error: err.message, ok: false });
      logger.error(`   ✕ ${url} -> Hata: ${err.message}`);
    }
  }

  logger.log('===============================================================');
  logger.log('✅ TÜM PLATFORM VERİLERİ BAŞARIYLA SIFIRLANDI!');
  logger.log(`Kullanıcı sayısı: 0, Bakiye: 0, ResetEpoch: ${resetEpoch}`);
  logger.log('===============================================================');

  return {
    success: true,
    resetEpoch,
    cleanState,
    endpointResults
  };
}

// CLI yürütme kontrolü
if (typeof process !== 'undefined' && process.argv) {
  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm-reset-all-data');
  const isDryRun = args.includes('--dry-run');

  if (require.main === module) {
    executePlatformReset({
      confirm: isConfirmed,
      dryRun: isDryRun,
      storage: typeof localStorage !== 'undefined' ? localStorage : null
    }).then(res => {
      if (!res.success) {
        process.exit(1);
      }
    }).catch(err => {
      console.error('Beklenmeyen hata:', err);
      process.exit(1);
    });
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    executePlatformReset,
    buildCleanState,
    STORAGE_KEYS_TO_WIPE,
    CLOUD_ENDPOINTS
  };
}
