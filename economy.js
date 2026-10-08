/**
 * Minecraft Milyoner - Ekonomi, 7 Rütbe, Netherite, Birleşik Mağaza, Hediye Rütbe ve Liderlik Servisleri (v6.0)
 *
 * Mimari Özellikler:
 * 1. 7 Rütbe Hiyerarşisi (#3): Üye (MEMBER), VIP, VIP+ (VIP_PLUS), MVIP, MVIP+ (MVIP_PLUS), Moderator (MODERATOR), ADMIN
 * 2. Zümrüt & Netherite Çift Para Birimi (#13, #14, #20):
 *    - İlk kayıtta tek seferlik +250 Netherite başlangıç bonusu (asla tekrarlanmaz)
 *    - VIP+, MVIP ve MVIP+ için 24 saatte bir Günlük Netherite Ödülü
 * 3. Birleşik # MAĞAZA (#8, #9, #10, #11, #12, #27):
 *    - Kategoriler: Zümrüt (Emeralds), Rütbeler (Ranks), Kozmetikler (Cosmetics), Özel Ürünler (Special)
 *    - Rütbe Hediye Etme ("🎁 Arkadaşına Hediye Et"): Arkadaş kullanıcı adı doğrulama + Bildirim gönderimi
 *    - Stripe Hazırlık Modu: Sahte ödeme yapılmaz, "Ödeme sistemi yakında aktif olacaktır (Stripe entegrasyonu hazırlanıyor)"
 * 4. Gerçek Liderlik Tablosu & Admin Sıfırlama (#17, #18, #19):
 *    - Sıfır sahte/demo oyuncu
 *    - Filtreler: Puan, Galibiyet, Oyun, Zümrüt
 *    - Admin "Leaderboard'u Sıfırla" özelliği
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    RANKS: 'mc_millionaire_tr_ranks_v9',
    ECONOMY_SETTINGS: 'mc_millionaire_tr_economy_settings_v8',
    TRANSACTIONS: 'mc_millionaire_tr_emerald_tx_v6',
    NETHERITE_TX: 'mc_millionaire_tr_netherite_tx_v6',
    SHOP_ITEMS: 'mc_millionaire_tr_shop_items_v9',
    PURCHASES: 'mc_millionaire_tr_purchases_v6',
    GIFT_HISTORY: 'mc_millionaire_tr_rank_gifts_v6',
    ACHIEVEMENTS: 'mc_millionaire_tr_achievements_v6',
    EXTRA_LIFE_COOLDOWNS: 'mc_millionaire_tr_extralife_cd_v6',
    LEADERBOARD_META: 'mc_millionaire_tr_leaderboard_meta_v6'
  };

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeWrite(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      if (
        key === STORAGE_KEYS.RANKS ||
        key === STORAGE_KEYS.SHOP_ITEMS ||
        key === STORAGE_KEYS.LEADERBOARD_META
      ) {
        const cloud = window.MCMServices?.cloudSyncService;
        if (cloud && typeof cloud.schedulePush === 'function') {
          cloud.schedulePush(250);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function generateId(prefix = 'TX') {
    const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}-${ts}${rnd}`;
  }

  function getServices() {
    return window.MCMServices || {};
  }

  const SYSTEM_RANK_IDS = ['MEMBER', 'VIP', 'VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'MODERATOR', 'ADMIN'];

  function normalizeRankId(rankId) {
    const raw = String(rankId || 'MEMBER').trim().toUpperCase();
    if (!raw) return 'MEMBER';
    if (raw === 'PLAYER' || raw === 'ÜYE' || raw === 'UYE') return 'MEMBER';
    if (raw === 'VIP+') return 'VIP_PLUS';
    if (raw === 'MVIP+') return 'MVIP_PLUS';
    if (raw === 'ULTRA_VIP') return 'MVIP';
    if (raw === 'ELITE_VIP' || raw === 'LEGEND_VIP') return 'MVIP_PLUS';
    if (SYSTEM_RANK_IDS.includes(raw)) {
      return raw;
    }
    return raw.replace(/\s+/g, '_');
  }

  // ==========================================
  // 1. RÜTBE HİYERARŞİSİ (#3: Üye, VIP, VIP+, MVIP, MVIP+, Moderator, ADMIN + Özel Rütbeler)
  // Rütbeler YALNIZCA Netherite ile satın alınabilir (En az 500 Netherite).
  // ==========================================
  const DEFAULT_RANKS = [
    {
      id: 'MEMBER',
      name: 'Üye',
      order: 1,
      badge: '🌱',
      color: '#9ca3af',
      priceTry: 0,
      priceUsd: 0,
      emeraldPrice: 0,
      netheritePrice: 0,
      purchasable: false,
      dailyEmerald: 50,
      dailyNetherite: 0,
      stripePriceId: null,
      permissions: {
        canCreateParty: false,
        canInvitePlayers: false,
        maxPartySize: 0,
        emeraldMultiplier: 1.0,
        dailyEmerald: 50,
        dailyNetherite: 0,
        supportPriority: 'NORMAL',
        bugPriority: 'NORMAL',
        suggestionPriority: 'NORMAL',
        maxExtraLives: 5,
        cosmetics: false,
        rgbName: false,
        profileEffects: false
      },
      features: [
        'Her 24 Saatte +50 Günlük Zümrüt Ödülü',
        'Bireysel bilgi yarışması moduna tam erişim',
        'Parti kodu ile mevcut partilere katılabilme',
        'Kazanılan Zümrütlerle mağazadan alışveriş yapabilme'
      ]
    },
    {
      id: 'VIP',
      name: 'VIP',
      order: 2,
      badge: '💎',
      color: '#38bdf8',
      priceTry: 89.9,
      priceUsd: 2.99,
      emeraldPrice: 0,
      netheritePrice: 500,
      purchasable: true,
      dailyEmerald: 100,
      dailyNetherite: 0,
      stripePriceId: 'price_mcm_rank_vip',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 4,
        emeraldMultiplier: 1.25,
        dailyEmerald: 100,
        dailyNetherite: 0,
        supportPriority: 'HIGH',
        bugPriority: 'HIGH',
        suggestionPriority: 'NORMAL',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: false,
        profileEffects: false
      },
      features: [
        'Her 24 Saatte +100 Günlük Zümrüt Ödülü',
        'Özel 💎 VIP Rozeti ve Mavi İsim Rengi',
        'Parti Oluşturabilme (4 Kişilik Kapasite)',
        '1.25x Zümrüt Kazanım Çarpanı',
        'Yüksek Öncelikli Destek ve Hata Bildirimi',
        'VIP Kozmetik Çerçevelerine Erişim'
      ]
    },
    {
      id: 'VIP_PLUS',
      name: 'VIP+',
      order: 3,
      badge: '🌟',
      color: '#a855f7',
      priceTry: 159.9,
      priceUsd: 4.99,
      emeraldPrice: 0,
      netheritePrice: 1000,
      purchasable: true,
      dailyEmerald: 200,
      dailyNetherite: 25,
      stripePriceId: 'price_mcm_rank_vip_plus',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 6,
        emeraldMultiplier: 1.5,
        dailyEmerald: 200,
        dailyNetherite: 25,
        supportPriority: 'HIGH',
        bugPriority: 'HIGH',
        suggestionPriority: 'HIGH',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: false
      },
      features: [
        'İlk Alımda Tek Seferlik +250 Netherite Hoş Geldin Ödülü!',
        'Her 24 Saatte +25 Günlük Netherite + 200 Günlük Zümrüt Ödülü',
        'Özel 🌟 VIP+ Rozeti ve Mor İsim Rengi',
        '6 Kişilik Parti Oluşturma ve Oyuncu Davet Etme',
        '1.5x Zümrüt Kazanım Çarpanı',
        'Özel İsim Renkleri ve VIP+ Kozmetikleri'
      ]
    },
    {
      id: 'MVIP',
      name: 'MVIP',
      order: 4,
      badge: '🔥',
      color: '#f59e0b',
      priceTry: 299.9,
      priceUsd: 7.99,
      emeraldPrice: 0,
      netheritePrice: 2000,
      purchasable: true,
      dailyEmerald: 350,
      dailyNetherite: 50,
      stripePriceId: 'price_mcm_rank_mvip',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 8,
        emeraldMultiplier: 2.0,
        dailyEmerald: 350,
        dailyNetherite: 50,
        supportPriority: 'VERY_HIGH',
        bugPriority: 'VERY_HIGH',
        suggestionPriority: 'HIGH',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      features: [
        'İlk Alımda Tek Seferlik +250 Netherite Hoş Geldin Ödülü!',
        'Her 24 Saatte +50 Günlük Netherite + 350 Günlük Zümrüt Ödülü',
        'Özel 🔥 MVIP Rozeti ve Altın İsim Efektleri',
        '8 Kişilik Büyük Parti Oluşturma',
        '2.0x Zümrüt Kazanım Çarpanı',
        'Çok Yüksek Öncelikli VIP Destek Hattı',
        'MVIP Özel Profil Efektleri ve Çerçeveleri'
      ]
    },
    {
      id: 'MVIP_PLUS',
      name: 'MVIP+',
      order: 5,
      badge: '👑',
      color: '#ef4444',
      priceTry: 449.9,
      priceUsd: 12.99,
      emeraldPrice: 0,
      netheritePrice: 3500,
      purchasable: true,
      dailyEmerald: 500,
      dailyNetherite: 100,
      stripePriceId: 'price_mcm_rank_mvip_plus',
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 12,
        emeraldMultiplier: 2.5,
        dailyEmerald: 500,
        dailyNetherite: 100,
        supportPriority: 'CRITICAL',
        bugPriority: 'CRITICAL',
        suggestionPriority: 'CRITICAL',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      features: [
        'İlk Alımda Tek Seferlik +250 Netherite Hoş Geldin Ödülü!',
        'Her 24 Saatte +100 Günlük Netherite + 500 Günlük Zümrüt Ödülü',
        'Efsanevi 👑 MVIP+ Kraliyet Rozeti ve RGB İsim Efekti',
        '12 Kişilik Dev Turnuva Partisi Oluşturma',
        '2.5x Zümrüt Kazanım Çarpanı',
        'Kritik Öncelikli Anında Destek ve İnceleme',
        'Tüm Özel Kozmetik ve Profil Efektlerine Tam Erişim'
      ]
    },
    {
      id: 'MODERATOR',
      name: 'Moderator',
      order: 6,
      badge: '⚔️',
      color: '#10b981',
      priceTry: 0,
      priceUsd: 0,
      emeraldPrice: 0,
      netheritePrice: 0,
      purchasable: false,
      dailyEmerald: 300,
      dailyNetherite: 0,
      stripePriceId: null,
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 16,
        emeraldMultiplier: 2.0,
        dailyEmerald: 300,
        dailyNetherite: 0,
        supportPriority: 'CRITICAL',
        bugPriority: 'CRITICAL',
        suggestionPriority: 'CRITICAL',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      features: [
        'Yönetici Tarafından Atanan ⚔️ Resmi Moderatör Rütbesi',
        'Her 24 Saatte +300 Günlük Zümrüt Ödülü',
        'Parti Denetimi ve Topluluk Moderasyon Yetkileri',
        '16 Kişilik Etkinlik Partisi Oluşturabilme',
        'Destek, Hata ve Öneri Taleplerini İnceleme Yetkisi'
      ]
    },
    {
      id: 'ADMIN',
      name: 'ADMIN',
      order: 7,
      badge: '🛡️',
      color: '#ec4899',
      priceTry: 0,
      priceUsd: 0,
      emeraldPrice: 0,
      netheritePrice: 0,
      purchasable: false,
      dailyEmerald: 1000,
      dailyNetherite: 250,
      stripePriceId: null,
      permissions: {
        canCreateParty: true,
        canInvitePlayers: true,
        maxPartySize: 999,
        emeraldMultiplier: 3.0,
        dailyEmerald: 1000,
        dailyNetherite: 250,
        supportPriority: 'CRITICAL',
        bugPriority: 'CRITICAL',
        suggestionPriority: 'CRITICAL',
        maxExtraLives: 5,
        cosmetics: true,
        rgbName: true,
        profileEffects: true
      },
      features: [
        'Tam Sistem ve Yönetici Paneli Kontrolü',
        'Sınırsız Parti ve Turnuva Yönetimi',
        'Oyuncu, Rütbe, Ekonomi, Mağaza ve Liderlik Yönetimi'
      ]
    }
  ];

  // ==========================================
  // 2. VARSAYILAN EKONOMİ AYARLARI
  // ==========================================
  const DEFAULT_ECONOMY_SETTINGS = {
    emeraldPerCorrectAnswer: {
      1: 5,
      2: 5,
      3: 5,
      4: 10,
      5: 15,
      6: 15,
      7: 20,
      8: 25,
      9: 30,
      10: 40,
      11: 50,
      12: 60,
      13: 75,
      14: 90,
      15: 120
    },
    winCompletionBonus: 250,
    partyMatchBonus: 60,
    dailyStreakBonus: 40,
    extraLifeBasePrice: 250,
    extraLifeDynamicPricing: false,
    extraLifeMaxPerUser: 5,
    extraLifeMaxPerMatch: 1,
    extraLifeCooldownSec: 15,
    initialNetheriteBonus: 250,
    dailyEmeraldRewards: {
      MEMBER: 50,
      VIP: 100,
      VIP_PLUS: 200,
      MVIP: 350,
      MVIP_PLUS: 500,
      MODERATOR: 300,
      ADMIN: 1000
    },
    dailyNetheriteRewards: {
      MEMBER: 0,
      VIP: 0,
      VIP_PLUS: 25,
      MVIP: 50,
      MVIP_PLUS: 100,
      MODERATOR: 0,
      ADMIN: 250
    }
  };

  // ==========================================
  // 3. BİRLEŞİK # MAĞAZA VARSAYILAN ÜRÜNLERİ (#8, #9, #10, #20)
  // Kategoriler:
  // - Netherite (⬛ Netherite Bakiye Yükle - Kart ile En Az 500 Netherite Bakiye)
  // - Ranks (👑 Rütbeler - Yalnızca Netherite ile Satın Alınır, En Az 500 Netherite)
  // - Emeralds (🟢 Zümrüt Paketleri - Netherite Takası & Kart ile Zümrüt Bakiye)
  // - Special (❤️ Özel Ürünler & Ekstra Can & Güçlendirmeler)
  // - Cosmetics (🎨 Kozmetikler - Çerçeveler, İsim Renkleri, Rozetler, Profil Efektleri)
  // ==========================================
  const DEFAULT_SHOP_ITEMS = [
    // --- NETHERITE BAKİYE YÜKLE (Netherite) KATEGORİSİ (Kart ile Sadece Bakiye Satın Alımı - En Az 500 Netherite) ---
    {
      id: 'STRIPE_NETHERITE_500',
      name: '500 Netherite Bakiye Paketi (Kart ile Bakiye Yükle)',
      category: 'Netherite',
      icon: '⬛',
      currency: 'STRIPE',
      price: 89.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      netheriteGrant: 500,
      priceTry: 89.9,
      stripePriceId: 'price_mcm_netherite_500',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile hesabınıza anında 500 Netherite bakiye yükleyin! (VIP rütbesi satın almak için yeterlidir).'
    },
    {
      id: 'STRIPE_NETHERITE_1000',
      name: '1.100 Netherite Bakiye Paketi (1.000 + 100 Bonus)',
      category: 'Netherite',
      icon: '⬛',
      currency: 'STRIPE',
      price: 159.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      netheriteGrant: 1100,
      priceTry: 159.9,
      stripePriceId: 'price_mcm_netherite_1000',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile 1.000 + 100 Bonus = 1.100 Netherite bakiye yükleyin! (VIP+ rütbesi ve özel ürünler için ideal).'
    },
    {
      id: 'STRIPE_NETHERITE_2500',
      name: '2.850 Netherite Asil Külçe Sandığı (2.500 + 350 Bonus)',
      category: 'Netherite',
      icon: '🔥',
      currency: 'STRIPE',
      price: 349.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      netheriteGrant: 2850,
      priceTry: 349.9,
      stripePriceId: 'price_mcm_netherite_2500',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile 2.500 + 350 Bonus = 2.850 Netherite bakiye yükleyin! (MVIP rütbesi ve efsanevi kozmetikler için).'
    },
    {
      id: 'STRIPE_NETHERITE_5000',
      name: '6.000 Netherite Hükümdar Hazinesi (5.000 + 1.000 Bonus)',
      category: 'Netherite',
      icon: '👑',
      currency: 'STRIPE',
      price: 599.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      netheriteGrant: 6000,
      priceTry: 599.9,
      stripePriceId: 'price_mcm_netherite_5000',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile 5.000 + 1.000 Bonus = 6.000 Netherite bakiye! (MVIP+ rütbesi, arkadaşa rütbe hediyesi ve tüm mağaza için).'
    },

    // --- ZÜMRÜT (Emeralds) KATEGORİSİ ---
    {
      id: 'EMERALD_PACK_NETHERITE_SMALL',
      name: '500 Zümrüt Paketi (Netherite Takası)',
      category: 'Emeralds',
      icon: '🟢',
      currency: 'NETHERITE',
      price: 50,
      emeraldPrice: 0,
      netheritePrice: 50,
      emeraldGrant: 500,
      priceTry: 0,
      stripePriceId: null,
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: '50 Netherite külçesi karşılığında anında +500 Zümrüt kazanın.'
    },
    {
      id: 'EMERALD_PACK_NETHERITE_MEDIUM',
      name: '1.500 Zümrüt Sandığı (Netherite Takası)',
      category: 'Emeralds',
      icon: '💎',
      currency: 'NETHERITE',
      price: 125,
      emeraldPrice: 0,
      netheritePrice: 125,
      emeraldGrant: 1500,
      priceTry: 0,
      stripePriceId: null,
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: '125 Netherite külçesi ile +1.500 Zümrüt (%20 Bonuslu) hesabınıza eklensin.'
    },
    {
      id: 'EMERALD_PACK_NETHERITE_MEGA',
      name: '3.500 Zümrüt Hazinesi (Netherite Takası)',
      category: 'Emeralds',
      icon: '👑',
      currency: 'NETHERITE',
      price: 250,
      emeraldPrice: 0,
      netheritePrice: 250,
      emeraldGrant: 3500,
      priceTry: 0,
      stripePriceId: null,
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: '250 Netherite külçesi karşılığında devasa +3.500 Zümrüt hazinesi!'
    },
    {
      id: 'EMERALD_PACK_NETHERITE_ROYAL',
      name: '10.000 Zümrüt Kraliyet Kasası (Netherite Takası)',
      category: 'Emeralds',
      icon: '🟢',
      currency: 'NETHERITE',
      price: 600,
      emeraldPrice: 0,
      netheritePrice: 600,
      emeraldGrant: 10000,
      priceTry: 0,
      stripePriceId: null,
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: '600 Netherite karşılığında tam +10.000 Zümrüt (%40 Dev Bonuslu) bakiye!'
    },
    {
      id: 'STRIPE_EMERALD_1000',
      name: '1.000 Zümrüt Bakiye Paketi (Kart ile Satın Al)',
      category: 'Emeralds',
      icon: '💳',
      currency: 'STRIPE',
      price: 49.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      emeraldGrant: 1000,
      priceTry: 49.9,
      stripePriceId: 'price_mcm_emerald_1000',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile 1.000 Zümrüt bakiye yükleyin (Stripe entegrasyonu hazırlanıyor).'
    },
    {
      id: 'STRIPE_EMERALD_5000',
      name: '5.000 Zümrüt Bakiye Sandığı (Kart ile Satın Al)',
      category: 'Emeralds',
      icon: '💳',
      currency: 'STRIPE',
      price: 179.9,
      emeraldPrice: 0,
      netheritePrice: 0,
      emeraldGrant: 5000,
      priceTry: 179.9,
      stripePriceId: 'price_mcm_emerald_5000',
      stock: -1,
      maxPerUser: 999,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Kart ile 5.000 Zümrüt bakiye yükleyin (Stripe entegrasyonu hazırlanıyor).'
    },

    // --- ÖZEL ÜRÜNLER & GÜÇLENDİRMELER (Special) KATEGORİSİ ---
    {
      id: 'ITEM_EXTRA_LIFE',
      name: '+1 Ekstra Can (Ölümsüzlük Totemi)',
      category: 'Special',
      icon: '❤️',
      currency: 'EMERALD',
      price: 250,
      emeraldPrice: 250,
      netheritePrice: 35,
      stock: -1,
      maxPerUser: 5,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Yarışma sırasında yanlış cevap verdiğinizde elenmek yerine ikinci bir şans kazandırır! (Maks. 5 adet)'
    },
    {
      id: 'ITEM_EXTRA_LIFE_BUNDLE_3',
      name: '3x Ekstra Can Paketi',
      category: 'Special',
      icon: '💖',
      currency: 'NETHERITE',
      price: 90,
      emeraldPrice: 675,
      netheritePrice: 90,
      extraLifeCount: 3,
      stock: -1,
      maxPerUser: 5,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Netherite veya Zümrüt ile indirimli 3 adet Ekstra Can birden alın!'
    },
    {
      id: 'ITEM_EXTRA_LIFE_BUNDLE_5',
      name: '5x Tam Kalp Sandığı (Maksimum Can Seti)',
      category: 'Special',
      icon: '💖',
      currency: 'NETHERITE',
      price: 140,
      emeraldPrice: 1050,
      netheritePrice: 140,
      extraLifeCount: 5,
      stock: -1,
      maxPerUser: 5,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Envanterinizi tek seferde 5/5 maksimum Ekstra Can kapasitesine doldurur!'
    },
    {
      id: 'ITEM_TOURNAMENT_BOOST',
      name: 'Turnuva Zümrüt Takviyesi (+250 Zümrüt + 1 Can)',
      category: 'Special',
      icon: '🚀',
      currency: 'NETHERITE',
      price: 60,
      emeraldPrice: 0,
      netheritePrice: 60,
      emeraldGrant: 250,
      extraLifeCount: 1,
      stock: -1,
      maxPerUser: 10,
      requiredRank: 'MEMBER',
      active: true,
      description: '1x Ekstra Can + 250 Zümrüt içeren özel başlangıç destek paketi.'
    },
    {
      id: 'ITEM_VILLAGER_TREASURE',
      name: 'Usta Köylü Ticaret Sandığı (+750 Zümrüt + 1 Can)',
      category: 'Special',
      icon: '🟢',
      currency: 'NETHERITE',
      price: 95,
      emeraldPrice: 0,
      netheritePrice: 95,
      emeraldGrant: 750,
      extraLifeCount: 1,
      stock: -1,
      maxPerUser: 20,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Köylü loncasının özel hazinesi: Anında +750 Zümrüt ve +1 Ekstra Can verir.'
    },
    {
      id: 'ITEM_NETHER_STAR_PACK',
      name: 'Nether Yıldızı Prestij Paketi (+1.250 Zümrüt + 2 Can)',
      category: 'Special',
      icon: '🌟',
      currency: 'NETHERITE',
      price: 150,
      emeraldPrice: 0,
      netheritePrice: 150,
      emeraldGrant: 1250,
      extraLifeCount: 2,
      stock: -1,
      maxPerUser: 20,
      requiredRank: 'MEMBER',
      active: true,
      description: 'Wither zaferinden gelen güç: +1.250 Zümrüt ve +2 Ekstra Can hesabınıza tanımlanır!'
    },
    {
      id: 'ITEM_DRAGON_EGG_RELIC',
      name: 'Ejderha Yumurtası Efsanevi Sandığı (+3.000 Zümrüt + 3 Can)',
      category: 'Special',
      icon: '🐉',
      currency: 'NETHERITE',
      price: 280,
      emeraldPrice: 0,
      netheritePrice: 280,
      emeraldGrant: 3000,
      extraLifeCount: 3,
      stock: -1,
      maxPerUser: 20,
      requiredRank: 'MEMBER',
      active: true,
      description: 'End boyutunun en nadir hazinesi: Anında +3.000 Zümrüt ve +3 Ekstra Can kazandırır!'
    },

    // --- KOZMETİKLER (Cosmetics) KATEGORİSİ ---
    {
      id: 'FRAME_DIAMOND',
      name: 'Elmas Avatar Çerçevesi',
      category: 'Cosmetics',
      subCategory: 'Avatar Frames',
      icon: '💠',
      currency: 'EMERALD',
      price: 450,
      emeraldPrice: 450,
      netheritePrice: 60,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: 'frame-diamond',
      description: 'Profil fotoğrafınızın etrafına parlayan Minecraft Elmas çerçevesi ekler.'
    },
    {
      id: 'FRAME_EMERALD',
      name: 'Zümrüt Krallık Çerçevesi',
      category: 'Cosmetics',
      subCategory: 'Avatar Frames',
      icon: '🟢',
      currency: 'EMERALD',
      price: 650,
      emeraldPrice: 650,
      netheritePrice: 85,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: 'frame-emerald',
      description: 'Profilinize canlı zümrüt yeşili neon çerçeve kazandırır.'
    },
    {
      id: 'FRAME_GOLD_ROYAL',
      name: 'Altın Kraliyet Çerçevesi',
      category: 'Cosmetics',
      subCategory: 'Avatar Frames',
      icon: '👑',
      currency: 'EMERALD',
      price: 550,
      emeraldPrice: 550,
      netheritePrice: 75,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: 'frame-gold-royal',
      description: 'Profil avatarınızı saf altın blok ışıltısıyla çevreler.'
    },
    {
      id: 'FRAME_REDSTONE_PULSE',
      name: 'Kızıltaş Enerji Çerçevesi',
      category: 'Cosmetics',
      subCategory: 'Avatar Frames',
      icon: '⚡',
      currency: 'EMERALD',
      price: 750,
      emeraldPrice: 750,
      netheritePrice: 95,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: 'frame-redstone-pulse',
      description: 'Kızıltaş enerjisiyle parlayan dinamik kırmızı devre çerçevesi.'
    },
    {
      id: 'FRAME_NETHERITE_FLAME',
      name: 'Netherite Alev Çerçevesi',
      category: 'Cosmetics',
      subCategory: 'Avatar Frames',
      icon: '🔥',
      currency: 'NETHERITE',
      price: 110,
      emeraldPrice: 950,
      netheritePrice: 110,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'VIP',
      active: true,
      cssValue: 'frame-nether-flame',
      description: 'Nether kalesinin kızıl alevleriyle çevrili animasyonlu profil çerçevesi.'
    },
    {
      id: 'NAME_COLOR_GOLD',
      name: 'Altın İsim Rengi',
      category: 'Cosmetics',
      subCategory: 'Name Colors',
      icon: '✨',
      currency: 'EMERALD',
      price: 400,
      emeraldPrice: 400,
      netheritePrice: 55,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '#fbbf24',
      description: 'Liderlik tablosu, profil ve partilerde isminiz altın sarısı görünür.'
    },
    {
      id: 'NAME_COLOR_DIAMOND',
      name: 'Elmas Mavisi İsim Rengi',
      category: 'Cosmetics',
      subCategory: 'Name Colors',
      icon: '💎',
      currency: 'EMERALD',
      price: 500,
      emeraldPrice: 500,
      netheritePrice: 65,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '#38bdf8',
      description: 'İsminize parlak Minecraft Elmas mavisi görünümü kazandırır.'
    },
    {
      id: 'NAME_COLOR_EMERALD',
      name: 'Zümrüt Yeşili İsim Rengi',
      category: 'Cosmetics',
      subCategory: 'Name Colors',
      icon: '🟢',
      currency: 'EMERALD',
      price: 550,
      emeraldPrice: 550,
      netheritePrice: 70,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '#17dd62',
      description: 'İsminizi canlı Zümrüt yeşili tonuyla öne çıkarır.'
    },
    {
      id: 'NAME_COLOR_CRIMSON',
      name: 'Kızıl Nether İsim Rengi',
      category: 'Cosmetics',
      subCategory: 'Name Colors',
      icon: '🔥',
      currency: 'EMERALD',
      price: 700,
      emeraldPrice: 700,
      netheritePrice: 90,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '#f43f5e',
      description: 'İsminize ateşli Kızıl Nether (Crimson) rengi verir.'
    },
    {
      id: 'NAME_COLOR_RGB',
      name: 'Efsanevi RGB İsim Efekti',
      category: 'Cosmetics',
      subCategory: 'Name Colors',
      icon: '🌈',
      currency: 'NETHERITE',
      price: 150,
      emeraldPrice: 1500,
      netheritePrice: 150,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'VIP_PLUS',
      active: true,
      cssValue: 'rgb-rainbow',
      description: 'İsminize akıcı gökkuşağı RGB renk geçişi animasyonu uygular.'
    },
    {
      id: 'BADGE_CREEPER_HUNTER',
      name: 'Creeper Avcısı Rozeti',
      category: 'Cosmetics',
      subCategory: 'Badges',
      icon: '🧨',
      currency: 'EMERALD',
      price: 300,
      emeraldPrice: 300,
      netheritePrice: 40,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '🧨 Creeper Avcısı',
      description: 'Profil kartınızda özel Creeper Avcısı unvan rozetini sergileyin.'
    },
    {
      id: 'BADGE_REDSTONE_MASTER',
      name: 'Kızıltaş Ustası Rozeti',
      category: 'Cosmetics',
      subCategory: 'Badges',
      icon: '⚡',
      currency: 'EMERALD',
      price: 500,
      emeraldPrice: 500,
      netheritePrice: 70,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '⚡ Kızıltaş Ustası',
      description: 'Redstone mühendislerine özel prestijli profil rozeti.'
    },
    {
      id: 'BADGE_WITHER_SLAYER',
      name: 'Wither Avcısı Rozeti',
      category: 'Cosmetics',
      subCategory: 'Badges',
      icon: '⚔️',
      currency: 'EMERALD',
      price: 750,
      emeraldPrice: 750,
      netheritePrice: 95,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '⚔️ Wither Avcısı',
      description: 'Nether bosslarını dize getiren cesur oyuncular için özel unvan rozeti.'
    },
    {
      id: 'BADGE_WARDEN_CONQUEROR',
      name: 'Antik Şehir Muhafızı Rozeti',
      category: 'Cosmetics',
      subCategory: 'Badges',
      icon: '🛡️',
      currency: 'EMERALD',
      price: 900,
      emeraldPrice: 900,
      netheritePrice: 115,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: '🛡️ Antik Muhafız',
      description: 'Derin Karanlık (Deep Dark) ve Warden fatihlerine özel prestij rozeti.'
    },
    {
      id: 'BADGE_MILLIONAIRE_KING',
      name: 'Milyoner Hükümdarı Rozeti',
      category: 'Cosmetics',
      subCategory: 'Badges',
      icon: '👑',
      currency: 'NETHERITE',
      price: 150,
      emeraldPrice: 1200,
      netheritePrice: 150,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'VIP',
      active: true,
      cssValue: '👑 Milyoner Hükümdarı',
      description: 'Bilgi yarışmasının zirvesini temsil eden kraliyet unvan rozeti.'
    },
    {
      id: 'EFFECT_EMERALD_GLOW',
      name: 'Zümrüt Işıltısı Profil Efekti',
      category: 'Cosmetics',
      subCategory: 'Profile Effects',
      icon: '🟢',
      currency: 'EMERALD',
      price: 800,
      emeraldPrice: 800,
      netheritePrice: 100,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MEMBER',
      active: true,
      cssValue: 'effect-emerald-glow',
      description: 'Profil kartınızın arka planına parlak zümrüt enerjisi aurası ekler.'
    },
    {
      id: 'EFFECT_NETHER_STORM',
      name: 'Nether Alev Fırtınası Efekti',
      category: 'Cosmetics',
      subCategory: 'Profile Effects',
      icon: '🔥',
      currency: 'NETHERITE',
      price: 125,
      emeraldPrice: 950,
      netheritePrice: 125,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'VIP',
      active: true,
      cssValue: 'effect-nether-storm',
      description: 'Profil kartınızı kızıl Nether lav ve alev parıltısıyla kuşatır.'
    },
    {
      id: 'EFFECT_ENDER_AURA',
      name: 'Ender Ejderhası Aurası',
      category: 'Cosmetics',
      subCategory: 'Profile Effects',
      icon: '🐉',
      currency: 'NETHERITE',
      price: 140,
      emeraldPrice: 1100,
      netheritePrice: 140,
      stock: -1,
      maxPerUser: 1,
      requiredRank: 'MVIP',
      active: true,
      cssValue: 'effect-ender-aura',
      description: 'Profil kartınızın arka planına mistik mor Ender kristali parıltısı ekler.'
    }
  ];

  // ==========================================
  // 4. BAŞARIMLAR (ACHIEVEMENTS)
  // ==========================================
  const DEFAULT_ACHIEVEMENTS = [
    {
      id: 'FIRST_GAME',
      title: 'İlk Kazma Darbesi',
      description: 'İlk Minecraft Milyoner yarışmanı tamamla.',
      icon: '⛏️',
      emeraldReward: 50
    },
    {
      id: 'FIRST_WIN',
      title: 'Milyoner Şampiyonu',
      description: '15 sorunun tamamını doğru yanıtlayarak 1.000.000 ₺ kazan!',
      icon: '🏆',
      emeraldReward: 300
    },
    {
      id: 'EMERALD_COLLECTOR',
      title: 'Zümrüt Koleksiyoncusu',
      description: 'Toplam 1.000 Zümrüt bakiyesine ulaş.',
      icon: '🟢',
      emeraldReward: 150
    },
    {
      id: 'PARTY_CHAMPION',
      title: 'Parti Efsanesi',
      description: 'Bir parti odasına katıl veya parti oluştur.',
      icon: '🎉',
      emeraldReward: 100
    },
    {
      id: 'STREAK_10',
      title: 'Keskin Zeka (10 Seri)',
      description: 'Bir oyunda arka arkaya en az 10 soruyu doğru cevapla.',
      icon: '🔥',
      emeraldReward: 200
    }
  ];

  // ==========================================
  // RÜTBE SERVİSİ (rankService — 7 Ana Rütbe + Admin Özel Rütbe Ekleme Sistemi)
  // ==========================================
  const rankService = {
    normalizeRankId,

    init() {
      const existing = safeRead(STORAGE_KEYS.RANKS, null);
      if (!existing || !Array.isArray(existing) || existing.length < 7) {
        safeWrite(STORAGE_KEYS.RANKS, DEFAULT_RANKS);
      } else {
        // 7 varsayılan rütbeyi koru + Admin tarafından eklenen özel rütbeleri (custom ranks) muhafaza et
        const merged = DEFAULT_RANKS.map(def => {
          const found = existing.find(r => r.id === def.id);
          if (!found) return def;
          const minNeth = def.purchasable ? Math.max(500, Number(found.netheritePrice || def.netheritePrice || 500)) : 0;
          return {
            ...def,
            ...found,
            id: def.id,
            order: def.order,
            emeraldPrice: 0, // Rütbeler yalnızca Netherite ile alınır
            netheritePrice: minNeth,
            dailyEmerald:
              found.dailyEmerald !== undefined && found.dailyEmerald > 0
                ? found.dailyEmerald
                : def.dailyEmerald,
            dailyNetherite:
              def.id === 'MODERATOR'
                ? 0
                : Math.max(Number(found.dailyNetherite || 0), Number(def.dailyNetherite || 0)),
            features: Array.isArray(found.features) && found.features.length > 0 ? found.features : def.features,
            permissions: {
              ...def.permissions,
              ...(found.permissions || {}),
              dailyEmerald:
                found.dailyEmerald !== undefined && found.dailyEmerald > 0
                  ? found.dailyEmerald
                  : def.dailyEmerald,
              dailyNetherite:
                def.id === 'MODERATOR'
                  ? 0
                  : Math.max(Number(found.dailyNetherite || 0), Number(def.dailyNetherite || 0))
            }
          };
        });

        // Özel (custom) rütbeleri ekle
        existing.forEach(customRank => {
          if (customRank && customRank.id && !SYSTEM_RANK_IDS.includes(customRank.id)) {
            merged.push({
              ...customRank,
              isCustom: true,
              emeraldPrice: 0,
              netheritePrice: customRank.purchasable
                ? Math.max(500, Number(customRank.netheritePrice || 500))
                : 0
            });
          }
        });

        merged.sort((a, b) => Number(a.order || 1) - Number(b.order || 1));
        safeWrite(STORAGE_KEYS.RANKS, merged);
      }
    },

    getAllRanks() {
      this.init();
      return safeRead(STORAGE_KEYS.RANKS, DEFAULT_RANKS).sort(
        (a, b) => Number(a.order || 1) - Number(b.order || 1)
      );
    },

    getPurchasableRanks() {
      return this.getAllRanks().filter(r => r.purchasable === true);
    },

    getRankById(rankId) {
      const norm = normalizeRankId(rankId);
      const ranks = this.getAllRanks();
      return ranks.find(r => r.id === norm) || ranks[0];
    },

    getPermissionsForRank(rankId) {
      const rank = this.getRankById(rankId);
      return { ...rank.permissions };
    },

    getUserRank(username) {
      const { userService } = getServices();
      if (!userService || !username) return this.getRankById('MEMBER');
      const user = userService.getUserByUsername(username);
      if (!user) return this.getRankById('MEMBER');

      if (user.role === 'ADMIN' || user.rank === 'ADMIN') return this.getRankById('ADMIN');
      if (user.isModerator || user.role === 'MODERATOR' || user.rank === 'MODERATOR') {
        return this.getRankById('MODERATOR');
      }

      if (user.rankExpiresAt && new Date(user.rankExpiresAt).getTime() < Date.now()) {
        userService.syncUserFields(user.username, {
          rank: 'MEMBER',
          role: 'MEMBER',
          rankExpiresAt: null
        });
        return this.getRankById('MEMBER');
      }

      return this.getRankById(user.rank || user.role || 'MEMBER');
    },

    updateRankConfig(session, rankId, updates = {}) {
      const { authGuard, activityService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const norm = normalizeRankId(rankId);
      const ranks = this.getAllRanks();
      const idx = ranks.findIndex(r => r.id === norm);
      if (idx === -1) throw new Error('Rütbe bulunamadı.');

      const current = ranks[idx];
      const nextPurchasable =
        updates.purchasable !== undefined ? Boolean(updates.purchasable) : current.purchasable;
      const rawNethPrice =
        updates.netheritePrice !== undefined
          ? Number(updates.netheritePrice)
          : current.netheritePrice;
      const finalNethPrice = nextPurchasable ? Math.max(500, rawNethPrice || 500) : 0;

      ranks[idx] = {
        ...current,
        name: updates.name !== undefined ? String(updates.name).trim() : current.name,
        badge: updates.badge !== undefined ? String(updates.badge).trim() : current.badge,
        color: updates.color !== undefined ? String(updates.color).trim() : current.color,
        order: updates.order !== undefined ? Number(updates.order) : current.order,
        purchasable: nextPurchasable,
        priceTry: updates.priceTry !== undefined ? Number(updates.priceTry) : current.priceTry,
        emeraldPrice: 0, // Rütbeler yalnızca Netherite ile alınır
        netheritePrice: finalNethPrice,
        dailyEmerald:
          updates.dailyEmerald !== undefined
            ? Number(updates.dailyEmerald)
            : current.dailyEmerald,
        dailyNetherite:
          updates.dailyNetherite !== undefined
            ? Number(updates.dailyNetherite)
            : current.dailyNetherite,
        updatedAt: new Date().toISOString(),
        permissions: {
          ...current.permissions,
          ...(updates.permissions || {}),
          dailyEmerald:
            updates.dailyEmerald !== undefined
              ? Number(updates.dailyEmerald)
              : current.permissions.dailyEmerald,
          dailyNetherite:
            updates.dailyNetherite !== undefined
              ? Number(updates.dailyNetherite)
              : updates.permissions?.dailyNetherite !== undefined
              ? Number(updates.permissions.dailyNetherite)
              : current.permissions.dailyNetherite
        },
        features: Array.isArray(updates.features) ? updates.features : current.features
      };

      safeWrite(STORAGE_KEYS.RANKS, ranks);
      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `${ranks[idx].name} rütbe yapılandırması güncellendi.`
        );
      }
      return ranks[idx];
    },

    /**
     * YÖNETİCİ PANELİ: Yeni Özel Rütbe Ekleme Sistemi ("Yeni Rütbe Ekle")
     */
    adminCreateRank(session, rankData = {}) {
      const { authGuard, activityService, cloudSyncService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const cleanName = String(rankData.name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        throw new Error('Lütfen geçerli bir rütbe adı girin (Örn: EFSANE, TITAN, ELITE).');
      }

      const rawId = String(rankData.id || cleanName)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_');
      const rankId = rawId || `RANK_${Date.now().toString(36).toUpperCase()}`;

      const ranks = this.getAllRanks();
      if (ranks.some(r => r.id === rankId)) {
        throw new Error(`"${rankId}" koduna sahip bir rütbe zaten mevcut!`);
      }

      const purchasable = rankData.purchasable !== false;
      const netheritePrice = purchasable
        ? Math.max(500, Math.round(Number(rankData.netheritePrice || 500)))
        : 0;
      const dailyEmerald = Math.max(0, Math.round(Number(rankData.dailyEmerald ?? 250)));
      const dailyNetherite = Math.max(0, Math.round(Number(rankData.dailyNetherite ?? 40)));
      const maxPartySize = Math.max(0, Math.round(Number(rankData.maxPartySize ?? 8)));
      const emeraldMultiplier = Math.max(1, Number(rankData.emeraldMultiplier ?? 1.75));
      const order = Math.max(2, Number(rankData.order ?? 5.5));
      const color = String(rankData.color || '#ec4899').trim();
      const badge = String(rankData.badge || '👑').trim();

      const customFeatures = Array.isArray(rankData.features)
        ? rankData.features.map(f => String(f).trim()).filter(Boolean)
        : String(rankData.features || '')
            .split('\n')
            .map(f => f.trim())
            .filter(Boolean);

      const defaultFeatures = [
        ...(dailyNetherite > 0
          ? [
              'İlk Alımda Tek Seferlik +250 Netherite Hoş Geldin Ödülü!',
              `Her 24 Saatte +${dailyNetherite} Günlük Netherite + ${dailyEmerald} Günlük Zümrüt Ödülü`
            ]
          : [`Her 24 Saatte +${dailyEmerald} Günlük Zümrüt Ödülü`]),
        `Özel ${badge} ${cleanName} Rozeti ve Renkli İsim Görünümü`,
        maxPartySize > 0
          ? `${maxPartySize} Kişilik Parti Odası Kurabilme`
          : 'Parti Odalarına Katılabilme',
        `${emeraldMultiplier}x Zümrüt Kazanım Çarpanı`
      ];

      const newRank = {
        id: rankId,
        name: cleanName,
        order,
        badge,
        color,
        priceTry: 0,
        priceUsd: 0,
        emeraldPrice: 0,
        netheritePrice,
        purchasable,
        isCustom: true,
        dailyEmerald,
        dailyNetherite,
        stripePriceId: null,
        updatedAt: new Date().toISOString(),
        permissions: {
          canCreateParty: maxPartySize > 0,
          canInvitePlayers: maxPartySize > 0,
          maxPartySize,
          emeraldMultiplier,
          dailyEmerald,
          dailyNetherite,
          supportPriority: 'HIGH',
          bugPriority: 'HIGH',
          suggestionPriority: 'HIGH',
          maxExtraLives: 5,
          cosmetics: true,
          rgbName: true,
          profileEffects: true
        },
        features: customFeatures.length > 0 ? customFeatures : defaultFeatures
      };

      if (cloudSyncService && typeof cloudSyncService.clearTombstone === 'function') {
        cloudSyncService.clearTombstone('deletedRanks', rankId);
      }

      ranks.push(newRank);
      ranks.sort((a, b) => Number(a.order || 1) - Number(b.order || 1));
      safeWrite(STORAGE_KEYS.RANKS, ranks);

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `Yönetici ${session.username} yeni özel rütbe oluşturdu: ${newRank.badge} ${newRank.name} (${newRank.netheritePrice} Netherite).`
        );
      }

      return newRank;
    },

    adminDeleteRank(session, rankId) {
      const { authGuard, userService, activityService, cloudSyncService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const norm = normalizeRankId(rankId);
      if (SYSTEM_RANK_IDS.includes(norm)) {
        throw new Error('7 temel sistem rütbesi silinemez; yalnızca özellikleri düzenlenebilir.');
      }

      const ranks = this.getAllRanks();
      const target = ranks.find(r => r.id === norm);
      if (!target) throw new Error('Silinecek rütbe bulunamadı.');

      const filtered = ranks.filter(r => r.id !== norm);
      safeWrite(STORAGE_KEYS.RANKS, filtered);

      if (cloudSyncService && typeof cloudSyncService.recordTombstone === 'function') {
        cloudSyncService.recordTombstone('deletedRanks', norm);
      }

      // Bu rütbeye sahip kullanıcıları Üye rütbesine döndür
      if (userService) {
        userService.getAllUsers().forEach(u => {
          if (normalizeRankId(u.rank) === norm) {
            userService.syncUserFields(u.username, { rank: 'MEMBER', role: 'MEMBER' });
          }
        });
      }

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `Yönetici ${session.username} "${target.name}" (${norm}) özel rütbesini sildi.`
        );
      }
      return true;
    },

    assignRankToUser(session, targetUsername, rankId, durationDays = null) {
      const { authGuard, userService, activityService, notificationService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const user = userService.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const rank = this.getRankById(rankId);
      const expiresAt =
        durationDays && Number(durationDays) > 0
          ? new Date(Date.now() + Number(durationDays) * 86400000).toISOString()
          : null;

      const isMod = rank.id === 'MODERATOR';
      const newRole =
        rank.id === 'ADMIN'
          ? 'ADMIN'
          : isMod
          ? 'MODERATOR'
          : rank.id === 'MEMBER'
          ? 'MEMBER'
          : 'VIP';

      userService.syncUserFields(user.username, {
        rank: rank.id,
        role: newRole,
        isModerator: isMod,
        rankExpiresAt: expiresAt
      });

      // İlk kez en az VIP+ rütbesi alındıysa tek seferlik +250 Netherite ver
      netheriteService.ensureInitialBonusOnce(user.username);

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'RANK_UPGRADED',
          title: 'Rütbeniz Güncellendi!',
          message: `Yönetici tarafından hesabınıza ${rank.badge} ${rank.name} rütbesi tanımlandı.`
        });
      }

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `${user.username} oyuncusuna ${rank.name} rütbesi verildi.`
        );
      }
      return userService.getUserByUsername(user.username);
    }
  };

  // ==========================================
  // NETHERITE & GÜNLÜK ÖDÜL SERVİSİ
  // - Tüm rütbelere rütbeye göre artan Günlük Zümrüt (Üye: 50, VIP: 100, VIP+: 200, MVIP: 350, MVIP+: 500)
  // - VIP+ ve üzeri rütbelere rütbeye göre artan Günlük Netherite (VIP+: 25, MVIP: 50, MVIP+: 100)
  // - Sadece ilk kez en az VIP+ rütbesi alındığında tek seferlik +250 Netherite Hoş Geldin Ödülü
  // ==========================================
  const netheriteService = {
    DAILY_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 Saat

    getTransactions(username = null) {
      const list = safeRead(STORAGE_KEYS.NETHERITE_TX, []);
      if (!username) return list;
      const clean = String(username).trim().toLowerCase();
      return list.filter(tx => tx.username.toLowerCase() === clean);
    },

    recordTransaction({ username, amount, type, reason, balanceAfter }) {
      const list = safeRead(STORAGE_KEYS.NETHERITE_TX, []);
      const tx = {
        id: generateId('NTX'),
        username,
        amount: Number(amount),
        type, // 'EARN' | 'SPEND' | 'ADMIN_ADD' | 'ADMIN_REMOVE' | 'DAILY_CLAIM' | 'INITIAL_BONUS'
        reason: String(reason || ''),
        balanceAfter: Number(balanceAfter),
        createdAt: new Date().toISOString()
      };
      list.unshift(tx);
      if (list.length > 500) list.length = 500;
      safeWrite(STORAGE_KEYS.NETHERITE_TX, list);
      return tx;
    },

    getBalance(username) {
      const { userService } = getServices();
      if (!userService || !username) return 0;
      const user = userService.getUserByUsername(username);
      if (!user) return 0;
      this.ensureInitialBonusOnce(user.username);
      const refreshed = userService.getUserByUsername(user.username);
      return Math.max(0, Number(refreshed?.netheriteBalance ?? 0));
    },

    /**
     * Sadece ilk kez en az VIP+ (VIP_PLUS, MVIP, MVIP_PLUS, ADMIN) rütbesine ulaşıldığında
     * tek seferlik +250 Netherite verir. Normal Üye ve VIP rütbelerinde verilmez.
     */
    ensureInitialBonusOnce(username) {
      const { userService, notificationService } = getServices();
      if (!userService || !username) return false;
      const user = userService.getUserByUsername(username);
      if (!user) return false;
      if (user.initialNetheriteBonusClaimed === true) {
        return false;
      }

      const rank = rankService.getUserRank(user.username);
      const qualifiesForInitialBonus =
        ['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(rank.id) ||
        (rank.id !== 'MODERATOR' && (Number(rank.order || 0) >= 3 || Number(rank.dailyNetherite || 0) > 0));
      if (!qualifiesForInitialBonus) {
        return false;
      }

      const currentBalance = Number(user.netheriteBalance || 0);
      const nextBalance = currentBalance + 250;
      userService.syncUserFields(user.username, {
        netheriteBalance: nextBalance,
        initialNetheriteBonusClaimed: true
      });

      this.recordTransaction({
        username: user.username,
        amount: 250,
        type: 'INITIAL_BONUS',
        reason: `İlk ${rank.name} Rütbe Alımı Tek Seferlik Hoş Geldin Ödülü (+250 Netherite)`,
        balanceAfter: nextBalance
      });

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'NETHERITE_DAILY_REWARD',
          title: '🎉 İlk VIP+ ve Üzeri Rütbe Bonusu: +250 Netherite!',
          message: `İlk kez ${rank.name} rütbesine ulaştığınız için tek seferlik +250 Netherite ödülünüz hesabınıza eklendi!`
        });
      }
      return true;
    },

    getDailyEmeraldRewardForRank(rankId) {
      const norm = normalizeRankId(rankId);
      const rank = rankService.getRankById(norm);
      if (rank && typeof rank.dailyEmerald === 'number' && rank.dailyEmerald > 0) {
        return rank.dailyEmerald;
      }
      const settings = economyService.getSettings();
      return Number(settings.dailyEmeraldRewards?.[norm] || 50);
    },

    getDailyRewardForRank(rankId) {
      const norm = normalizeRankId(rankId);
      if (norm === 'MODERATOR' || norm === 'MEMBER' || norm === 'VIP') {
        return 0;
      }
      const rank = rankService.getRankById(norm);
      if (rank && typeof rank.dailyNetherite === 'number' && rank.dailyNetherite > 0) {
        return rank.dailyNetherite;
      }
      if (!['VIP_PLUS', 'MVIP', 'MVIP_PLUS', 'ADMIN'].includes(norm)) {
        return 0;
      }
      const settings = economyService.getSettings();
      return Number(settings.dailyNetheriteRewards?.[norm] || 25);
    },

    /**
     * Günlük Ödül Durumu:
     * - Tüm rütbeler (Üye dahil) her 24 saatte rütbesine göre artan Günlük Zümrüt alır.
     * - VIP+ ve üzeri rütbeler (VIP+: 25, MVIP: 50, MVIP+: 100 ve özel rütbeler) ek olarak Günlük Netherite alır.
     */
    getDailyNetheriteStatus(username) {
      const { userService } = getServices();
      if (!userService || !username) {
        return {
          eligible: false,
          netheriteEligible: false,
          rankId: 'MEMBER',
          rankName: 'Üye',
          dailyAmount: 0,
          dailyEmerald: 50,
          canClaimNow: false,
          remainingMs: 0,
          remainingText: 'Kullanıcı bulunamadı.'
        };
      }

      const user = userService.getUserByUsername(username);
      if (!user) {
        return {
          eligible: false,
          netheriteEligible: false,
          rankId: 'MEMBER',
          rankName: 'Üye',
          dailyAmount: 0,
          dailyEmerald: 50,
          canClaimNow: false,
          remainingMs: 0,
          remainingText: 'Kullanıcı bulunamadı.'
        };
      }

      const rank = rankService.getUserRank(user.username);
      const dailyAmount = this.getDailyRewardForRank(rank.id);
      const netheriteEligible = dailyAmount > 0;
      const dailyEmerald = this.getDailyEmeraldRewardForRank(rank.id);

      const lastClaimIso = user.lastNetheriteClaimAt || user.lastDailyEmeraldClaimAt;
      if (!lastClaimIso) {
        return {
          eligible: true,
          netheriteEligible,
          rankId: rank.id,
          rankName: rank.name,
          dailyAmount,
          dailyEmerald,
          canClaimNow: true,
          remainingMs: 0,
          remainingText: 'Hemen Alınabilir!',
          lastClaimAt: null
        };
      }

      const elapsed = Date.now() - new Date(lastClaimIso).getTime();
      if (elapsed >= this.DAILY_COOLDOWN_MS) {
        return {
          eligible: true,
          netheriteEligible,
          rankId: rank.id,
          rankName: rank.name,
          dailyAmount,
          dailyEmerald,
          canClaimNow: true,
          remainingMs: 0,
          remainingText: 'Hemen Alınabilir!',
          lastClaimAt: lastClaimIso
        };
      }

      const remainingMs = Math.max(0, this.DAILY_COOLDOWN_MS - elapsed);
      const hours = Math.floor(remainingMs / 3600000);
      const minutes = Math.floor((remainingMs % 3600000) / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);

      return {
        eligible: true,
        netheriteEligible,
        rankId: rank.id,
        rankName: rank.name,
        dailyAmount,
        dailyEmerald,
        canClaimNow: false,
        remainingMs,
        remainingText: `${hours}s ${minutes}dk ${seconds}sn sonra`,
        lastClaimAt: lastClaimIso
      };
    },

    claimDailyNetherite(session) {
      const { authGuard, userService, notificationService, activityService } = getServices();
      if (authGuard) authGuard.verifySession(session);

      const status = this.getDailyNetheriteStatus(session.username);
      if (!status.canClaimNow) {
        throw new Error(
          `Günlük ödülünüzü zaten aldınız. Yeni ödül için kalan süre: ${status.remainingText}`
        );
      }

      const user = userService.getUserByUsername(session.username);
      const nowIso = new Date().toISOString();

      // 1. Her rütbeye (Üye dahil) rütbesine göre Günlük Zümrüt ver
      const emeraldGain = Number(status.dailyEmerald || 50);
      const currentEm = Number(user.emeraldBalance || 0);
      const nextEm = currentEm + emeraldGain;

      // 2. VIP+ ve üzeri rütbelere ek olarak rütbesine göre Günlük Netherite ver (VIP+: 25, MVIP: 50, MVIP+: 100)
      const netheriteGain = status.netheriteEligible ? Number(status.dailyAmount || 0) : 0;
      const currentNeth = Number(user.netheriteBalance || 0);
      const nextNeth = currentNeth + netheriteGain;

      userService.syncUserFields(user.username, {
        emeraldBalance: nextEm,
        emeraldsEarnedTotal: Number(user.emeraldsEarnedTotal || 0) + emeraldGain,
        netheriteBalance: nextNeth,
        lastNetheriteClaimAt: nowIso,
        lastDailyEmeraldClaimAt: nowIso
      });

      economyService.recordTransaction({
        username: user.username,
        amount: emeraldGain,
        type: 'EARN',
        reason: `${status.rankName} Günlük Zümrüt Ödülü (+${emeraldGain} Zümrüt)`,
        balanceAfter: nextEm
      });

      let tx = null;
      if (netheriteGain > 0) {
        tx = this.recordTransaction({
          username: user.username,
          amount: netheriteGain,
          type: 'DAILY_CLAIM',
          reason: `${status.rankName} Günlük Netherite Ödülü (+${netheriteGain} Netherite)`,
          balanceAfter: nextNeth
        });
      }

      const rewardSummary =
        netheriteGain > 0
          ? `+${netheriteGain} Netherite ve +${emeraldGain} Zümrüt`
          : `+${emeraldGain} Zümrüt`;

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'NETHERITE_DAILY_REWARD',
          title: '🎁 Günlük Ödülünüz Alındı!',
          message: `${status.rankName} rütbeniz sayesinde günlük ${rewardSummary} hesabınıza eklendi!`
        });
      }

      if (activityService) {
        activityService.log(
          'NETHERITE_DAILY',
          user.username,
          `${user.username} günlük ödülünü aldı (${rewardSummary}).`
        );
      }

      return {
        added: netheriteGain,
        emeraldAdded: emeraldGain,
        balance: nextNeth,
        emeraldBalance: nextEm,
        transaction: tx,
        nextStatus: this.getDailyNetheriteStatus(user.username)
      };
    },

    spendNetherite(username, amount, reason = 'Mağaza Harcaması') {
      const { userService, activityService } = getServices();
      const user = userService.getUserByUsername(username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const cost = Math.max(0, Math.round(Number(amount)));
      const current = Number(user.netheriteBalance || 0);
      if (current < cost) {
        throw new Error(`Yetersiz Netherite bakiyesi! Gereken: ${cost} ⬛, Mevcut: ${current} ⬛`);
      }

      const next = current - cost;
      userService.syncUserFields(user.username, {
        netheriteBalance: next
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: -cost,
        type: 'SPEND',
        reason,
        balanceAfter: next
      });

      if (activityService) {
        activityService.log(
          'NETHERITE_SPEND',
          user.username,
          `${user.username} ${cost} Netherite harcadı (${reason}).`
        );
      }

      return { spent: cost, balance: next, transaction: tx };
    },

    addNetherite(username, amount, reason = 'Netherite Kazanımı', type = 'EARN') {
      const { userService } = getServices();
      const user = userService.getUserByUsername(username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const add = Math.max(0, Math.round(Number(amount)));
      const current = Number(user.netheriteBalance || 0);
      const next = current + add;

      userService.syncUserFields(user.username, {
        netheriteBalance: next
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: add,
        type,
        reason,
        balanceAfter: next
      });

      return { added: add, balance: next, transaction: tx };
    },

    adminModifyNetherite(session, targetUsername, amount, mode = 'ADD', reason = 'Yönetici İşlemi') {
      const { authGuard, userService, activityService, notificationService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const user = userService.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const val = Math.abs(Math.round(Number(amount)));
      if (isNaN(val) || val < 0) throw new Error('Geçerli bir miktar girin.');

      const current = Number(user.netheriteBalance || 0);
      let next = current;
      let delta = 0;

      if (mode === 'ADD') {
        next = current + val;
        delta = val;
      } else if (mode === 'REMOVE') {
        next = Math.max(0, current - val);
        delta = -(current - next);
      } else if (mode === 'SET') {
        next = val;
        delta = val - current;
      }

      userService.syncUserFields(user.username, {
        netheriteBalance: next
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: delta,
        type: delta >= 0 ? 'ADMIN_ADD' : 'ADMIN_REMOVE',
        reason: `${reason} (Yönetici: ${session.username})`,
        balanceAfter: next
      });

      if (delta > 0 && notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'NETHERITE_DAILY_REWARD',
          title: 'Netherite Bakiyeniz Güncellendi',
          message: `Yönetici tarafından hesabınıza +${delta} Netherite eklendi. Yeni bakiye: ${next} Netherite.`
        });
      }

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `${user.username} Netherite bakiyesi güncellendi (${current} -> ${next}).`
        );
      }

      return { balance: next, transaction: tx };
    }
  };

  // ==========================================
  // ZÜMRÜT EKONOMİ SERVİSİ (economyService)
  // ==========================================
  const economyService = {
    init() {
      const existing = safeRead(STORAGE_KEYS.ECONOMY_SETTINGS, null);
      if (!existing) {
        safeWrite(STORAGE_KEYS.ECONOMY_SETTINGS, DEFAULT_ECONOMY_SETTINGS);
      }
    },

    getSettings() {
      this.init();
      const stored = safeRead(STORAGE_KEYS.ECONOMY_SETTINGS, DEFAULT_ECONOMY_SETTINGS) || {};
      return {
        ...DEFAULT_ECONOMY_SETTINGS,
        ...stored,
        dailyEmeraldRewards: {
          ...DEFAULT_ECONOMY_SETTINGS.dailyEmeraldRewards,
          ...(stored.dailyEmeraldRewards || {})
        },
        dailyNetheriteRewards: {
          ...DEFAULT_ECONOMY_SETTINGS.dailyNetheriteRewards,
          ...(stored.dailyNetheriteRewards || {})
        }
      };
    },

    updateSettings(session, updates = {}) {
      const { authGuard, activityService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const current = this.getSettings();
      const next = {
        ...current,
        ...updates,
        emeraldPerCorrectAnswer: {
          ...current.emeraldPerCorrectAnswer,
          ...(updates.emeraldPerCorrectAnswer || {})
        },
        dailyNetheriteRewards: {
          ...current.dailyNetheriteRewards,
          ...(updates.dailyNetheriteRewards || {})
        }
      };
      safeWrite(STORAGE_KEYS.ECONOMY_SETTINGS, next);

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          'Ekonomi ve ödül ayarları güncellendi.'
        );
      }
      return next;
    },

    getTransactions(username = null) {
      const list = safeRead(STORAGE_KEYS.TRANSACTIONS, []);
      if (!username) return list;
      const clean = String(username).trim().toLowerCase();
      return list.filter(tx => tx.username.toLowerCase() === clean);
    },

    recordTransaction({ username, amount, type, reason, balanceAfter }) {
      const list = safeRead(STORAGE_KEYS.TRANSACTIONS, []);
      const tx = {
        id: generateId('ETX'),
        username,
        amount: Number(amount),
        type, // 'EARN' | 'SPEND' | 'ADMIN_ADD' | 'ADMIN_REMOVE'
        reason: String(reason || ''),
        balanceAfter: Number(balanceAfter),
        createdAt: new Date().toISOString()
      };
      list.unshift(tx);
      if (list.length > 500) list.length = 500;
      safeWrite(STORAGE_KEYS.TRANSACTIONS, list);
      return tx;
    },

    getBalance(username) {
      const { userService } = getServices();
      if (!userService || !username) return 0;
      const user = userService.getUserByUsername(username);
      return user ? Math.max(0, Number(user.emeraldBalance || 0)) : 0;
    },

    addEmeralds(username, baseAmount, reason = 'Oyun Ödülü', applyMultiplier = true, notify = false) {
      const { userService, activityService, notificationService } = getServices();
      if (!userService || !username) return { added: 0, balance: 0 };

      const user = userService.getUserByUsername(username);
      if (!user) return { added: 0, balance: 0 };

      const rank = rankService.getUserRank(username);
      const multiplier = applyMultiplier ? Number(rank.permissions.emeraldMultiplier || 1.0) : 1.0;
      const finalAmount = Math.max(1, Math.round(Number(baseAmount) * multiplier));

      const currentBalance = Number(user.emeraldBalance || 0);
      const newBalance = currentBalance + finalAmount;

      userService.syncUserFields(user.username, {
        emeraldBalance: newBalance,
        emeraldsEarnedTotal: Number(user.emeraldsEarnedTotal || 0) + finalAmount
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: finalAmount,
        type: 'EARN',
        reason: multiplier > 1 ? `${reason} (${multiplier}x ${rank.name} Bonusu)` : reason,
        balanceAfter: newBalance
      });

      if (notify && notificationService && finalAmount >= 25) {
        notificationService.notifyUser(user.username, {
          type: 'EMERALD_EARNED',
          title: `+${finalAmount} Zümrüt Kazanıldı!`,
          message: `${reason} kapsamında +${finalAmount} Zümrüt hesabınıza eklendi.`
        });
      }

      if (activityService && finalAmount >= 50) {
        activityService.log(
          'EMERALD_EARN',
          user.username,
          `${user.username} +${finalAmount} Zümrüt kazandı (${reason}).`
        );
      }

      achievementService.checkAndUnlock(user.username);

      return {
        added: finalAmount,
        multiplier,
        balance: newBalance,
        transaction: tx
      };
    },

    spendEmeralds(username, amount, reason = 'Mağaza Satın Alımı') {
      const { userService, activityService } = getServices();
      const user = userService.getUserByUsername(username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const cost = Math.max(0, Math.round(Number(amount)));
      const currentBalance = Number(user.emeraldBalance || 0);
      if (currentBalance < cost) {
        throw new Error(`Yetersiz Zümrüt bakiyesi! Gereken: ${cost} 🟢, Mevcut: ${currentBalance} 🟢`);
      }

      const newBalance = currentBalance - cost;
      userService.syncUserFields(user.username, {
        emeraldBalance: newBalance,
        emeraldsSpentTotal: Number(user.emeraldsSpentTotal || 0) + cost
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: -cost,
        type: 'SPEND',
        reason,
        balanceAfter: newBalance
      });

      if (activityService) {
        activityService.log(
          'EMERALD_SPEND',
          user.username,
          `${user.username} ${cost} Zümrüt harcadı (${reason}).`
        );
      }

      return {
        spent: cost,
        balance: newBalance,
        transaction: tx
      };
    },

    adminModifyEmeralds(session, targetUsername, amount, mode = 'ADD', reason = 'Yönetici İşlemi') {
      const { authGuard, userService, activityService, notificationService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const user = userService.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const val = Math.abs(Math.round(Number(amount)));
      if (isNaN(val) || val <= 0) throw new Error('Geçerli bir miktar girin.');

      const current = Number(user.emeraldBalance || 0);
      let next = current;
      let txType = 'ADMIN_ADD';
      let signedAmount = val;

      if (mode === 'ADD') {
        next = current + val;
        txType = 'ADMIN_ADD';
        signedAmount = val;
      } else if (mode === 'REMOVE') {
        next = Math.max(0, current - val);
        txType = 'ADMIN_REMOVE';
        signedAmount = -(current - next);
      } else if (mode === 'SET') {
        next = val;
        txType = val >= current ? 'ADMIN_ADD' : 'ADMIN_REMOVE';
        signedAmount = val - current;
      }

      userService.syncUserFields(user.username, {
        emeraldBalance: next
      });

      const tx = this.recordTransaction({
        username: user.username,
        amount: signedAmount,
        type: txType,
        reason: `${reason} (Yönetici: ${session.username})`,
        balanceAfter: next
      });

      if (signedAmount > 0 && notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'EMERALD_EARNED',
          title: 'Zümrüt Bakiyeniz Güncellendi',
          message: `Yönetici tarafından hesabınıza +${signedAmount} Zümrüt eklendi. Yeni bakiye: ${next} Zümrüt.`
        });
      }

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `${user.username} Zümrüt bakiyesi güncellendi (${current} -> ${next}).`
        );
      }

      return { balance: next, transaction: tx };
    },

    rewardCorrectAnswer(username, levelIndex) {
      const settings = this.getSettings();
      const level = Number(levelIndex) + 1;
      const baseReward = Number(settings.emeraldPerCorrectAnswer[level] || 10);
      return this.addEmeralds(username, baseReward, `${level}. Soru Doğru Cevap Ödülü`, true, false);
    },

    rewardGameCompletion(username, didWin, isPartyMatch = false) {
      const settings = this.getSettings();
      let totalBase = 0;
      const reasons = [];

      if (didWin) {
        totalBase += Number(settings.winCompletionBonus || 250);
        reasons.push('Milyoner Şampiyonluk Ödülü');
      }
      if (isPartyMatch) {
        totalBase += Number(settings.partyMatchBonus || 60);
        reasons.push('Parti Maçı Tamamlama Bonusu');
      }

      if (totalBase <= 0) return { added: 0, balance: this.getBalance(username) };
      return this.addEmeralds(username, totalBase, reasons.join(' + '), true, true);
    }
  };

  // ==========================================
  // EKSTRA CAN SERVİSİ (extraLifeService)
  // ==========================================
  const extraLifeService = {
    getExtraLifePrice(username) {
      const settings = economyService.getSettings();
      const base = Number(settings.extraLifeBasePrice || 250);
      if (!settings.extraLifeDynamicPricing) return base;

      const { userService } = getServices();
      const user = userService?.getUserByUsername(username);
      const owned = Number(user?.extraLives || 0);
      return base + owned * 50;
    },

    getUserExtraLives(username) {
      const { userService } = getServices();
      const user = userService?.getUserByUsername(username);
      return user ? Math.max(0, Number(user.extraLives || 0)) : 0;
    },

    buyExtraLife(session, currency = 'EMERALD') {
      const { authGuard, userService, activityService, notificationService } = getServices();
      if (authGuard) authGuard.verifySession(session);

      const user = userService.getUserByUsername(session.username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const settings = economyService.getSettings();
      const maxLives = Number(settings.extraLifeMaxPerUser || 5);
      const currentLives = Number(user.extraLives || 0);

      if (currentLives >= maxLives) {
        throw new Error(`Maksimum Ekstra Can sınırına (${maxLives}/${maxLives}) ulaştınız!`);
      }

      const cooldowns = safeRead(STORAGE_KEYS.EXTRA_LIFE_COOLDOWNS, {});
      const lastBought = Number(cooldowns[user.username] || 0);
      const cdMs = Number(settings.extraLifeCooldownSec || 15) * 1000;
      const now = Date.now();

      if (now - lastBought < cdMs) {
        const waitSec = Math.ceil((cdMs - (now - lastBought)) / 1000);
        throw new Error(`Yeni bir Ekstra Can almadan önce ${waitSec} saniye beklemelisiniz.`);
      }

      const normCurrency = String(currency || 'EMERALD').toUpperCase();
      let spentInfo = null;

      if (normCurrency === 'NETHERITE') {
        const netheriteCost = 35;
        spentInfo = netheriteService.spendNetherite(
          user.username,
          netheriteCost,
          '+1 Ekstra Can Satın Alımı'
        );
      } else {
        const price = this.getExtraLifePrice(user.username);
        spentInfo = economyService.spendEmeralds(
          user.username,
          price,
          '+1 Ekstra Can Satın Alımı'
        );
      }

      const nextLives = currentLives + 1;
      userService.syncUserFields(user.username, {
        extraLives: nextLives
      });

      cooldowns[user.username] = now;
      safeWrite(STORAGE_KEYS.EXTRA_LIFE_COOLDOWNS, cooldowns);

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'SHOP_PURCHASE',
          title: '❤️ +1 Ekstra Can Satın Alındı',
          message: `Envanterinize +1 Ekstra Can eklendi. Mevcut Ekstra Can: ${nextLives}/${maxLives}.`
        });
      }

      if (activityService) {
        activityService.log(
          'SHOP_PURCHASE',
          user.username,
          `${user.username} +1 Ekstra Can satın aldı (${nextLives}/${maxLives}).`
        );
      }

      return {
        extraLives: nextLives,
        maxLives,
        balance: economyService.getBalance(user.username),
        netheriteBalance: netheriteService.getBalance(user.username),
        spentInfo
      };
    },

    consumeExtraLifeInMatch(username) {
      const { userService, activityService } = getServices();
      const user = userService?.getUserByUsername(username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const currentLives = Number(user.extraLives || 0);
      if (currentLives <= 0) {
        throw new Error('Kullanılabilir Ekstra Canınız bulunmuyor!');
      }

      const nextLives = currentLives - 1;
      userService.syncUserFields(user.username, {
        extraLives: nextLives
      });

      if (activityService) {
        activityService.log(
          'EXTRA_LIFE_USED',
          user.username,
          `${user.username} yarışmada 1 Ekstra Can kullandı (Kalan: ${nextLives}).`
        );
      }

      return {
        remainingLives: nextLives
      };
    }
  };

  // ==========================================
  // BİRLEŞİK # MAĞAZA SERVİSİ (shopService — #8, #9, #10, #11, #12, #20, #27)
  // Kategoriler: Emeralds (Zümrüt), Ranks (Rütbeler), Cosmetics (Kozmetikler), Special (Özel Ürünler)
  // ==========================================
  const shopService = {
    init() {
      const existing = safeRead(STORAGE_KEYS.SHOP_ITEMS, null);
      if (!existing || !Array.isArray(existing) || existing.length === 0) {
        safeWrite(STORAGE_KEYS.SHOP_ITEMS, DEFAULT_SHOP_ITEMS);
      } else {
        // Ensure default items exist with up-to-date cssValue & subCategory while preserving admin custom items
        const merged = [...existing];
        DEFAULT_SHOP_ITEMS.forEach(def => {
          const idx = merged.findIndex(i => i.id === def.id);
          if (idx === -1) {
            merged.push(def);
          } else {
            merged[idx] = {
              ...def,
              ...merged[idx],
              subCategory: merged[idx].subCategory || def.subCategory,
              cssValue: merged[idx].cssValue || def.cssValue,
              icon: def.icon
            };
          }
        });
        safeWrite(STORAGE_KEYS.SHOP_ITEMS, merged);
      }
    },

    getAllItems(includeInactive = false) {
      this.init();
      const items = safeRead(STORAGE_KEYS.SHOP_ITEMS, DEFAULT_SHOP_ITEMS);
      if (includeInactive) return items;
      return items.filter(i => i.active !== false);
    },

    getItemsByCategory(category = 'ALL') {
      const items = this.getAllItems(false);
      if (!category || category === 'ALL') return items;
      return items.filter(i => i.category === category);
    },

    getUserPurchases(username) {
      const all = safeRead(STORAGE_KEYS.PURCHASES, []);
      if (!username) return all;
      const clean = String(username).trim().toLowerCase();
      return all.filter(p => p.username.toLowerCase() === clean);
    },

    getGiftHistory(username = null) {
      const all = safeRead(STORAGE_KEYS.GIFT_HISTORY, []);
      if (!username) return all;
      const clean = String(username).trim().toLowerCase();
      return all.filter(
        g =>
          g.fromUsername.toLowerCase() === clean ||
          g.toUsername.toLowerCase() === clean
      );
    },

    /**
     * Standart mağaza ürünü satın alma (Zümrüt, Kozmetikler, Özel Ürünler)
     */
    purchaseItem(session, itemId, preferredCurrency = null) {
      const { authGuard, userService, paymentService, notificationService, activityService } =
        getServices();
      if (authGuard) authGuard.verifySession(session);

      if (itemId === 'ITEM_EXTRA_LIFE') {
        return extraLifeService.buyExtraLife(session, preferredCurrency || 'EMERALD');
      }

      const items = this.getAllItems(true);
      const idx = items.findIndex(i => i.id === itemId);
      if (idx === -1) throw new Error('Ürün mağazada bulunamadı.');

      const item = items[idx];
      if (item.active === false) throw new Error('Bu ürün şu anda satışta değil.');
      if (item.stock !== -1 && Number(item.stock) <= 0) {
        throw new Error('Bu ürünün stoğu tükenmiştir.');
      }

      const user = userService.getUserByUsername(session.username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      // Rütbe gereksinimi kontrolü
      const userRank = rankService.getUserRank(user.username);
      const reqRank = rankService.getRankById(item.requiredRank || 'MEMBER');
      if (userRank.order < reqRank.order) {
        throw new Error(`Bu ürünü satın almak için en az [${reqRank.name}] rütbesi gereklidir!`);
      }

      // Kart (Stripe) ile YALNIZCA Bakiye Paketleri (Netherite Bakiye en az 500 veya Zümrüt Bakiye) satın alınabilir
      const chosenCurrency = String(preferredCurrency || item.currency || 'EMERALD').toUpperCase();
      if (chosenCurrency === 'STRIPE' || item.currency === 'STRIPE') {
        if (!paymentService) {
          throw new Error(
            'Ödeme sistemi yakında aktif olacaktır (Stripe entegrasyonu hazırlanıyor)'
          );
        }
        const isNetheriteBalancePack =
          item.category === 'Netherite' || Number(item.netheriteGrant || 0) > 0;
        if (isNetheriteBalancePack && Number(item.netheriteGrant || 0) < 500) {
          throw new Error('Kart ile satın alınabilecek en düşük Netherite paketi 500 Netherite olmalıdır.');
        }
        const stripeRes = paymentService.createPreparedStripeSession(session, {
          productType: isNetheriteBalancePack ? 'NETHERITE_BALANCE' : 'EMERALD_PACKAGE',
          productId: item.id,
          productName: item.name,
          amountTry: item.priceTry || item.price || 89.9,
          currency: 'TRY'
        });
        return {
          stripePrepared: true,
          message: stripeRes.userNotice,
          sessionRecord: stripeRes.sessionRecord
        };
      }

      // Özel Ekstra Can Paketi kontrolü
      if (item.extraLifeCount && Number(item.extraLifeCount) > 0) {
        const settings = economyService.getSettings();
        const maxLives = Number(settings.extraLifeMaxPerUser || 5);
        const currentLives = Number(user.extraLives || 0);
        if (currentLives + Number(item.extraLifeCount) > maxLives) {
          throw new Error(
            `Bu paketi alırsanız maksimum Ekstra Can sınırını (${maxLives}) aşarsınız! Mevcut: ${currentLives}`
          );
        }
      }

      // Kullanıcı başına limit kontrolü
      const ownedItems = Array.isArray(user.ownedCosmetics) ? [...user.ownedCosmetics] : [];
      if (item.category === 'Cosmetics' && Number(item.maxPerUser) === 1 && ownedItems.includes(item.id)) {
        throw new Error('Bu kozmetik ürüne zaten sahipsiniz!');
      }

      // Ödeme tahsilatı (NETHERITE veya EMERALD)
      if (chosenCurrency === 'NETHERITE') {
        const nPrice = Number(
          item.netheritePrice !== undefined && item.netheritePrice > 0
            ? item.netheritePrice
            : item.price
        );
        netheriteService.spendNetherite(user.username, nPrice, `Mağaza: ${item.name}`);
      } else {
        const ePrice = Number(
          item.emeraldPrice !== undefined && item.emeraldPrice > 0
            ? item.emeraldPrice
            : item.price
        );
        economyService.spendEmeralds(user.username, ePrice, `Mağaza: ${item.name}`);
      }

      // Stok güncelle
      if (item.stock !== -1) {
        items[idx].stock = Math.max(0, Number(item.stock) - 1);
        safeWrite(STORAGE_KEYS.SHOP_ITEMS, items);
      }

      // Ürün etkisini uygula
      const latestUser = userService.getUserByUsername(user.username);
      const syncPayload = {};

      if (item.emeraldGrant && Number(item.emeraldGrant) > 0) {
        economyService.addEmeralds(
          user.username,
          Number(item.emeraldGrant),
          `${item.name} Paket İçeriği`,
          false,
          true
        );
      }

      if (item.netheriteGrant && Number(item.netheriteGrant) > 0) {
        netheriteService.addNetherite(
          user.username,
          Number(item.netheriteGrant),
          `${item.name} Bakiye Yüklemesi`
        );
      }

      if (item.extraLifeCount && Number(item.extraLifeCount) > 0) {
        syncPayload.extraLives = Math.min(
          5,
          Number(latestUser.extraLives || 0) + Number(item.extraLifeCount)
        );
      }

      if (item.category === 'Cosmetics') {
        if (!ownedItems.includes(item.id)) ownedItems.push(item.id);
        const equipped = {
          ...(latestUser.equippedCosmetics || {
            avatarFrame: null,
            nameColor: null,
            badge: null,
            profileEffect: null
          })
        };
        const sub = String(item.subCategory || '').trim();
        if (sub === 'Avatar Frames' || sub === 'Avatar Çerçevesi' || String(item.id || '').startsWith('FRAME_')) {
          equipped.avatarFrame = item.id;
        } else if (sub === 'Name Colors' || sub === 'Ad Rengi' || sub === 'İsim Rengi' || String(item.id || '').startsWith('NAME_COLOR_')) {
          equipped.nameColor = item.id;
        } else if (sub === 'Profile Effects' || sub === 'Profil Efekti' || String(item.id || '').startsWith('EFFECT_')) {
          equipped.profileEffect = item.id;
        } else {
          equipped.badge = item.id;
        }
        syncPayload.ownedCosmetics = ownedItems;
        syncPayload.equippedCosmetics = equipped;
      }

      if (Object.keys(syncPayload).length > 0) {
        userService.syncUserFields(user.username, syncPayload);
      }

      const purchases = safeRead(STORAGE_KEYS.PURCHASES, []);
      const purchaseRecord = {
        id: generateId('PUR'),
        username: user.username,
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currency: chosenCurrency,
        price:
          chosenCurrency === 'NETHERITE'
            ? Number(item.netheritePrice || item.price)
            : Number(item.emeraldPrice || item.price),
        createdAt: new Date().toISOString()
      };
      purchases.unshift(purchaseRecord);
      safeWrite(STORAGE_KEYS.PURCHASES, purchases);

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'SHOP_PURCHASE',
          title: 'Mağaza Satın Alımı Başarılı',
          message: `${item.icon || '🛍️'} ${item.name} başarıyla satın alındı!`
        });
      }

      if (activityService) {
        activityService.log(
          'SHOP_PURCHASE',
          user.username,
          `${user.username} mağazadan "${item.name}" satın aldı.`
        );
      }

      return {
        stripePrepared: false,
        item,
        purchase: purchaseRecord,
        balance: economyService.getBalance(user.username),
        netheriteBalance: netheriteService.getBalance(user.username)
      };
    },

    /**
     * #10: Kendisi için Rütbe Satın Alma (VIP, VIP+, MVIP, MVIP+ ve Özel Rütbeler)
     * KURAL: Rütbeler Zümrüt veya doğrudan Kart ile ALINAMAZ; YALNIZCA Netherite bakiyesi ile (en az 500 Netherite) satın alınır!
     */
    purchaseRankForSelf(session, rankId, paymentMethod = 'NETHERITE') {
      const { authGuard, userService, notificationService, activityService } =
        getServices();
      if (authGuard) authGuard.verifySession(session);

      const rank = rankService.getRankById(rankId);
      if (!rank || !rank.purchasable) {
        throw new Error('Bu rütbe mağazadan satın alınamaz.');
      }

      const user = userService.getUserByUsername(session.username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const currentRank = rankService.getUserRank(user.username);
      if (currentRank.order >= rank.order) {
        throw new Error(`Zaten ${currentRank.name} veya daha yüksek bir rütbeye sahipsiniz!`);
      }

      const method = String(paymentMethod || 'NETHERITE').toUpperCase();
      if (method !== 'NETHERITE') {
        throw new Error(
          'Rütbeler Zümrüt veya doğrudan Kart ile satın alınamaz! Rütbeleri yalnızca Netherite bakiyeniz ile satın alabilirsiniz. (Netherite Bakiye Yükle sekmesinden kart ile Netherite bakiyesi alabilirsiniz).'
        );
      }

      const requiredNetherite = Math.max(500, Number(rank.netheritePrice || 500));
      netheriteService.spendNetherite(
        user.username,
        requiredNetherite,
        `${rank.name} Rütbe Yükseltmesi`
      );

      userService.syncUserFields(user.username, {
        rank: rank.id,
        role: 'VIP',
        rankExpiresAt: null
      });

      const firstVipPlusBonus = netheriteService.ensureInitialBonusOnce(user.username);

      if (notificationService) {
        notificationService.notifyUser(user.username, {
          type: 'RANK_UPGRADED',
          title: `🎉 ${rank.badge} ${rank.name} Rütbesine Yükseldiniz!`,
          message: `Tebrikler! ${rank.name} rütbesi ve tüm ayrıcalıkları hesabınıza tanımlandı.`
        });
      }

      if (activityService) {
        activityService.log(
          'RANK_UPGRADE',
          user.username,
          `${user.username} mağazadan ${rank.name} rütbesini ${requiredNetherite} Netherite ile satın aldı.`
        );
      }

      return {
        stripePrepared: false,
        rank,
        firstVipPlusBonusGranted: Boolean(firstVipPlusBonus),
        balance: economyService.getBalance(user.username),
        netheriteBalance: netheriteService.getBalance(user.username)
      };
    },

    /**
     * #11: "🎁 Arkadaşına Hediye Et" Rütbe Hediye Sistemi
     * KURAL: Rütbe hediyesi de YALNIZCA Netherite bakiyesi ile (en az 500 Netherite) yapılır!
     */
    giftRankToFriend(session, { friendUsername, rankId, paymentMethod = 'NETHERITE' }) {
      const { authGuard, userService, notificationService, activityService } =
        getServices();
      if (authGuard) authGuard.verifySession(session);

      const cleanFriend = String(friendUsername || '').trim();
      if (!cleanFriend) {
        throw new Error('Lütfen hediye göndermek istediğiniz arkadaşınızın kullanıcı adını girin.');
      }

      const gifter = userService.getUserByUsername(session.username);
      if (!gifter) throw new Error('Oturum sahibi bulunamadı.');

      if (gifter.username.toLowerCase() === cleanFriend.toLowerCase()) {
        throw new Error('Kendinize hediye gönderemezsiniz! Kendi hesabınız için "Satın Al" butonunu kullanın.');
      }

      const recipient = userService.getUserByUsername(cleanFriend);
      if (!recipient) {
        throw new Error(`"${cleanFriend}" kullanıcı adına sahip bir oyuncu bulunamadı!`);
      }

      const rank = rankService.getRankById(rankId);
      if (!rank || !rank.purchasable) {
        throw new Error('Bu rütbe hediye edilemez.');
      }

      const recipientCurrentRank = rankService.getUserRank(recipient.username);
      if (recipientCurrentRank.order >= rank.order) {
        throw new Error(
          `${recipient.username} zaten ${recipientCurrentRank.name} veya daha yüksek bir rütbeye sahip!`
        );
      }

      const method = String(paymentMethod || 'NETHERITE').toUpperCase();
      if (method !== 'NETHERITE') {
        throw new Error(
          'Rütbe hediyesi yalnızca Netherite bakiyesi ile gönderilebilir! (Netherite Bakiye Yükle sekmesinden kart ile Netherite bakiyesi alabilirsiniz).'
        );
      }

      const requiredNetherite = Math.max(500, Number(rank.netheritePrice || 500));
      netheriteService.spendNetherite(
        gifter.username,
        requiredNetherite,
        `🎁 ${recipient.username} için ${rank.name} Rütbe Hediyesi`
      );

      // Alıcının rütbesini yükselt
      userService.syncUserFields(recipient.username, {
        rank: rank.id,
        role: 'VIP',
        rankExpiresAt: null
      });

      // Alıcı ilk kez en az VIP+ rütbesine ulaştıysa +250 Netherite bonusunu ver
      netheriteService.ensureInitialBonusOnce(recipient.username);

      // Hediye geçmişine kaydet
      const gifts = safeRead(STORAGE_KEYS.GIFT_HISTORY, []);
      const giftRecord = {
        id: generateId('GIFT'),
        fromUsername: gifter.username,
        toUsername: recipient.username,
        rankId: rank.id,
        rankName: rank.name,
        paymentMethod: 'NETHERITE',
        cost: requiredNetherite,
        createdAt: new Date().toISOString()
      };
      gifts.unshift(giftRecord);
      safeWrite(STORAGE_KEYS.GIFT_HISTORY, gifts);

      // Alıcıya bildirim gönder (#11)
      if (notificationService) {
        notificationService.notifyUser(recipient.username, {
          type: 'RANK_GIFTED',
          title: '🎁 Yeni Rütbe Hediyesi!',
          message: `🎁 ${gifter.username} sana ${rank.name} rütbesi hediye etti!`,
          meta: {
            fromUsername: gifter.username,
            rankId: rank.id,
            rankName: rank.name
          }
        });

        notificationService.notifyUser(gifter.username, {
          type: 'SHOP_PURCHASE',
          title: '🎁 Rütbe Hediyesi Gönderildi',
          message: `${recipient.username} adlı oyuncuya başarıyla ${rank.badge} ${rank.name} rütbesi hediye ettiniz!`
        });
      }

      if (activityService) {
        activityService.log(
          'RANK_GIFT',
          gifter.username,
          `🎁 ${gifter.username}, ${recipient.username} oyuncusuna ${rank.name} rütbesi hediye etti (${requiredNetherite} Netherite).`
        );
      }

      return {
        stripePrepared: false,
        giftRecord,
        recipientUsername: recipient.username,
        rank,
        balance: economyService.getBalance(gifter.username),
        netheriteBalance: netheriteService.getBalance(gifter.username)
      };
    },

    equipCosmetic(session, itemId) {
      const { authGuard, userService } = getServices();
      if (authGuard) authGuard.verifySession(session);

      const user = userService.getUserByUsername(session.username);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const owned = Array.isArray(user.ownedCosmetics) ? user.ownedCosmetics : [];
      if (!owned.includes(itemId)) {
        throw new Error('Bu kozmetik ürüne sahip değilsiniz.');
      }

      const item = this.getAllItems(true).find(i => i.id === itemId);
      if (!item) throw new Error('Kozmetik ürün bulunamadı.');

      const equipped = { ...(user.equippedCosmetics || {}) };
      const sub = String(item.subCategory || item.category || '').trim();
      if (sub === 'Avatar Frames' || sub === 'Avatar Çerçevesi' || String(item.id || '').startsWith('FRAME_')) {
        equipped.avatarFrame = equipped.avatarFrame === itemId ? null : itemId;
      } else if (sub === 'Name Colors' || sub === 'Ad Rengi' || sub === 'İsim Rengi' || String(item.id || '').startsWith('NAME_COLOR_')) {
        equipped.nameColor = equipped.nameColor === itemId ? null : itemId;
      } else if (sub === 'Profile Effects' || sub === 'Profil Efekti' || String(item.id || '').startsWith('EFFECT_')) {
        equipped.profileEffect = equipped.profileEffect === itemId ? null : itemId;
      } else {
        equipped.badge = equipped.badge === itemId ? null : itemId;
      }

      userService.syncUserFields(user.username, { equippedCosmetics: equipped });
      return equipped;
    },

    adminSaveItem(session, itemData) {
      const { authGuard, activityService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const items = this.getAllItems(true);
      const id = itemData.id ? String(itemData.id).trim() : generateId('ITEM');
      const idx = items.findIndex(i => i.id === id);

      const subCat = String(itemData.subCategory || 'Badges').trim();
      const itemIcon = String(itemData.icon || '💎').trim();
      const itemName = String(itemData.name || 'Yeni Ürün').trim();
      let defaultCssValue = String(itemData.cssValue || '').trim();
      if (!defaultCssValue && String(itemData.category || 'Cosmetics').trim() === 'Cosmetics') {
        if (subCat === 'Avatar Frames') defaultCssValue = 'frame-diamond';
        else if (subCat === 'Name Colors') defaultCssValue = '#fbbf24';
        else if (subCat === 'Profile Effects') defaultCssValue = 'effect-ender-aura';
        else defaultCssValue = `${itemIcon} ${itemName}`;
      }

      const cleanItem = {
        id,
        name: itemName,
        category: String(itemData.category || 'Cosmetics').trim(),
        subCategory: subCat,
        icon: itemIcon,
        currency: String(itemData.currency || 'EMERALD').toUpperCase(),
        price: Math.max(0, Number(itemData.price || 100)),
        emeraldPrice: Math.max(0, Number(itemData.emeraldPrice ?? itemData.price ?? 100)),
        netheritePrice: Math.max(0, Number(itemData.netheritePrice ?? 25)),
        stock: itemData.stock === -1 || itemData.stock === '-1' ? -1 : Math.max(0, Number(itemData.stock || 0)),
        maxPerUser: Math.max(1, Number(itemData.maxPerUser || 1)),
        requiredRank: normalizeRankId(itemData.requiredRank || 'MEMBER'),
        active: itemData.active !== false,
        cssValue: defaultCssValue,
        description: String(itemData.description || '').trim()
      };

      if (idx === -1) {
        items.push(cleanItem);
      } else {
        items[idx] = { ...items[idx], ...cleanItem };
      }

      safeWrite(STORAGE_KEYS.SHOP_ITEMS, items);
      if (activityService) {
        activityService.log('ADMIN_ACTION', session.username, `Mağaza ürünü kaydedildi: ${cleanItem.name}`);
      }
      return cleanItem;
    },

    adminDeleteItem(session, itemId) {
      const { authGuard, activityService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const items = this.getAllItems(true);
      const filtered = items.filter(i => i.id !== itemId);
      safeWrite(STORAGE_KEYS.SHOP_ITEMS, filtered);

      if (activityService) {
        activityService.log('ADMIN_ACTION', session.username, `Mağaza ürünü silindi: ${itemId}`);
      }
      return true;
    }
  };

  // ==========================================
  // GERÇEK LİDERLİK TABLOSU SERVİSİ (#17, #18, #19)
  // Sıfır sahte/demo oyuncu + Admin "Leaderboard'u Sıfırla"
  // ==========================================
  const leaderboardService = {
    getMeta() {
      return safeRead(STORAGE_KEYS.LEADERBOARD_META, {
        lastResetAt: null,
        lastResetBy: null
      });
    },

    /**
     * #17 & #19: Yalnızca gerçek oyuncuları döndürür.
     * Eğer liderlik tablosu sıfırlanmışsa veya henüz gerçek aktivite/oyuncu yoksa boş dizi döner
     * ve arayüzde "Henüz sıralama bulunmuyor." gösterilir.
     */
    getLeaderboard({ sortBy = 'points', search = '' } = {}) {
      const { userService } = getServices();
      if (!userService) return [];

      const meta = this.getMeta();
      const users = userService.getAllUsers().filter(u => !u.isDemo && u.status !== 'SUSPENDED');

      const entries = users
        .map(u => {
          const rankObj = rankService.getUserRank(u.username);
          const points = Number(u.points || u.bestScore || 0);
          const gamesWon = Number(u.gamesWon || 0);
          const gamesPlayed = Number(u.gamesPlayed || 0);
          const emeraldBalance = Number(u.emeraldBalance || 0);
          const netheriteBalance = Number(u.netheriteBalance || 0);

          return {
            username: u.username,
            minecraftPlayerName: u.minecraftPlayerName || '',
            avatarUrl: u.avatarUrl || '',
            rankId: rankObj.id,
            rankName: rankObj.name,
            rankBadge: rankObj.badge,
            rankColor: rankObj.color,
            points,
            gamesWon,
            gamesPlayed,
            emeraldBalance,
            netheriteBalance,
            equippedCosmetics: u.equippedCosmetics || {},
            lastUpdatedAt: u.updatedAt || u.lastLoginAt || u.createdAt
          };
        })
        .filter(entry => {
          // Eğer admin liderlik tablosunu sıfırladıysa, sıfırlama sonrasında en az 1 oyun oynamış veya puan kazanmış olanları göster
          if (meta.lastResetAt) {
            return entry.points > 0 || entry.gamesPlayed > 0 || entry.gamesWon > 0;
          }
          return true;
        });

      const q = String(search || '').trim().toLowerCase();
      const filtered = q
        ? entries.filter(
            e =>
              e.username.toLowerCase().includes(q) ||
              (e.minecraftPlayerName && e.minecraftPlayerName.toLowerCase().includes(q)) ||
              e.rankName.toLowerCase().includes(q)
          )
        : entries;

      filtered.sort((a, b) => {
        if (sortBy === 'emerald' || sortBy === 'emeralds') {
          return b.emeraldBalance - a.emeraldBalance || b.points - a.points;
        }
        if (sortBy === 'wins') {
          return b.gamesWon - a.gamesWon || b.points - a.points;
        }
        if (sortBy === 'games' || sortBy === 'matches') {
          return b.gamesPlayed - a.gamesPlayed || b.points - a.points;
        }
        // Varsayılan: Puan ('points')
        return b.points - a.points || b.gamesWon - a.gamesWon || b.emeraldBalance - a.emeraldBalance;
      });

      return filtered.map((item, idx) => ({
        ...item,
        position: idx + 1
      }));
    },

    /**
     * #18: Admin "Leaderboard'u Sıfırla"
     * Tüm oyuncuların yarışma puanlarını, galibiyetlerini ve oyun sayılarını sıfırlar.
     * Hesapları, rütbeleri veya Netherite/Zümrüt bakiyelerini SİLMEZ.
     */
    adminResetLeaderboard(session) {
      const { authGuard, userService, activityService, notificationService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const users = userService.getAllUsers();
      users.forEach(u => {
        userService.syncUserFields(u.username, {
          points: 0,
          bestScore: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0
        });
        try {
          localStorage.removeItem(`mc_millionaire_tr_stats_v5_${u.username.toLowerCase()}`);
        } catch (err) {
          // ignore
        }
      });

      const resetMeta = {
        lastResetAt: new Date().toISOString(),
        lastResetBy: session.username
      };
      safeWrite(STORAGE_KEYS.LEADERBOARD_META, resetMeta);

      if (notificationService) {
        notificationService.broadcastNotification(session, {
          type: 'ADMIN_ANNOUNCEMENT',
          title: '🏆 Liderlik Tablosu Sıfırlandı',
          message: 'Yeni sezon başladı! Liderlik tablosu sıralamaları yönetici tarafından sıfırlandı.'
        });
      }

      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `Yönetici ${session.username} Liderlik Tablosunu (Leaderboard) sıfırladı.`
        );
      }

      return resetMeta;
    },

    adminEditPlayerLeaderboard(session, targetUsername, { points, gamesWon, gamesPlayed, emeraldBalance }) {
      const { authGuard, userService, activityService } = getServices();
      if (authGuard) authGuard.requireRole(session, ['ADMIN']);

      const user = userService.getUserByUsername(targetUsername);
      if (!user) throw new Error('Oyuncu bulunamadı.');

      const payload = {};
      if (points !== undefined) {
        payload.points = Math.max(0, Number(points));
        payload.bestScore = Math.max(0, Number(points));
      }
      if (gamesWon !== undefined) payload.gamesWon = Math.max(0, Number(gamesWon));
      if (gamesPlayed !== undefined) payload.gamesPlayed = Math.max(0, Number(gamesPlayed));
      if (emeraldBalance !== undefined) payload.emeraldBalance = Math.max(0, Number(emeraldBalance));

      userService.syncUserFields(user.username, payload);

      // Eğer puan eklendiyse reset filtresine takılmaması için
      if (activityService) {
        activityService.log(
          'ADMIN_ACTION',
          session.username,
          `${user.username} liderlik tablosu verileri güncellendi.`
        );
      }
      return userService.getUserByUsername(user.username);
    }
  };

  // ==========================================
  // BAŞARIM SERVİSİ (achievementService)
  // ==========================================
  const achievementService = {
    getAllAchievements() {
      return DEFAULT_ACHIEVEMENTS;
    },

    getUserAchievements(username) {
      const { userService } = getServices();
      const user = userService?.getUserByUsername(username);
      const unlockedIds = Array.isArray(user?.achievements) ? user.achievements : [];
      return DEFAULT_ACHIEVEMENTS.map(ach => ({
        ...ach,
        unlocked: unlockedIds.includes(ach.id)
      }));
    },

    unlock(username, achievementId) {
      const { userService, activityService } = getServices();
      const user = userService?.getUserByUsername(username);
      if (!user) return null;

      const unlocked = Array.isArray(user.achievements) ? [...user.achievements] : [];
      if (unlocked.includes(achievementId)) return null;

      const ach = DEFAULT_ACHIEVEMENTS.find(a => a.id === achievementId);
      if (!ach) return null;

      unlocked.push(achievementId);
      userService.syncUserFields(user.username, { achievements: unlocked });

      if (ach.emeraldReward > 0) {
        economyService.addEmeralds(
          user.username,
          ach.emeraldReward,
          `Başarım Ödülü: ${ach.title}`,
          false,
          true
        );
      }

      if (activityService) {
        activityService.log(
          'ACHIEVEMENT_UNLOCK',
          user.username,
          `${user.username} "${ach.title}" başarımını kazandı!`
        );
      }

      return ach;
    },

    checkAndUnlock(username, context = {}) {
      const { userService } = getServices();
      const user = userService?.getUserByUsername(username);
      if (!user) return [];

      const newlyUnlocked = [];
      if (Number(user.gamesPlayed || 0) >= 1) {
        const u = this.unlock(username, 'FIRST_GAME');
        if (u) newlyUnlocked.push(u);
      }
      if (Number(user.gamesWon || 0) >= 1 || context.didWin) {
        const u = this.unlock(username, 'FIRST_WIN');
        if (u) newlyUnlocked.push(u);
      }
      if (Number(user.emeraldBalance || 0) >= 1000) {
        const u = this.unlock(username, 'EMERALD_COLLECTOR');
        if (u) newlyUnlocked.push(u);
      }
      if (context.joinedParty) {
        const u = this.unlock(username, 'PARTY_CHAMPION');
        if (u) newlyUnlocked.push(u);
      }
      if (Number(context.streak || 0) >= 10) {
        const u = this.unlock(username, 'STREAK_10');
        if (u) newlyUnlocked.push(u);
      }
      return newlyUnlocked;
    }
  };

  // Başlangıçta servisleri hazırla
  rankService.init();
  economyService.init();
  shopService.init();

  // Global MCMServices nesnesine bağla
  window.MCMServices = Object.assign(window.MCMServices || {}, {
    rankService,
    netheriteService,
    economyService,
    extraLifeService,
    shopService,
    leaderboardService,
    achievementService
  });
})(window);
