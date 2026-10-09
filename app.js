/**
 * Minecraft Milyoner - Ana Oyun Motoru, Kimlik Doğrulama Kapısı ve Ses Sistemi (v0.0.1)
 *
 * Özellikler:
 * - Lisanssız Tam Türkçe Giriş / Kayıt / Şifre Sıfırlama (#1)
 * - Ayrı Yönetici Girişi ("Yönetici Girişi") (#2)
 * - Kayıtta İsteğe Bağlı Minecraft Oyuncu Adı & Tek Seferlik +250 Netherite (#4, #14)
 * - 15 Soruluk Minecraft Milyoner Yarışma Motoru, Jokerler, Ekstra Can ve Zümrüt Ödülleri
 */

(function (window) {
  'use strict';

  // ==========================================
  // 15 BASAMAKLI ÖDÜL AĞACI
  // ==========================================
  const PRIZE_LADDER = [
    { level: 1, amount: 100, label: '100 ₺', safe: false },
    { level: 2, amount: 1000, label: '1.000 ₺', safe: true },
    { level: 3, amount: 2000, label: '2.000 ₺', safe: false },
    { level: 4, amount: 3000, label: '3.000 ₺', safe: false },
    { level: 5, amount: 5000, label: '5.000 ₺', safe: false },
    { level: 6, amount: 7500, label: '7.500 ₺', safe: false },
    { level: 7, amount: 15000, label: '15.000 ₺', safe: true },
    { level: 8, amount: 30000, label: '30.000 ₺', safe: false },
    { level: 9, amount: 60000, label: '60.000 ₺', safe: false },
    { level: 10, amount: 125000, label: '125.000 ₺', safe: false },
    { level: 11, amount: 250000, label: '250.000 ₺', safe: false },
    { level: 12, amount: 400000, label: '400.000 ₺', safe: false },
    { level: 13, amount: 600000, label: '600.000 ₺', safe: false },
    { level: 14, amount: 800000, label: '800.000 ₺', safe: false },
    { level: 15, amount: 1000000, label: '1.000.000 ₺', safe: true }
  ];

  // ==========================================
  // MINECRAFT SORU HAVUZU (KOLAY / ORTA / ZOR)
  // ==========================================
  const QUESTION_POOL = [
    // --- KOLAY (1-5) ---
    {
      id: 'E1',
      difficulty: 'easy',
      q: "Minecraft'ta bir Çalışma Masası (Crafting Table) yapmak için kaç adet tahta blok gerekir?",
      options: ['2', '4', '6', '8'],
      answer: 1,
      explanation: '2x2 envanter ızgarasına 4 adet tahta yerleştirilerek Çalışma Masası üretilir.'
    },
    {
      id: 'E2',
      difficulty: 'easy',
      q: "Hangi yaratık oyuncuya yaklaştığında tıslayarak patlar ve bloklara zarar verir?",
      options: ['Zombi', 'İskelet', 'Creeper', 'Enderman'],
      answer: 2,
      explanation: 'Creeper oyuncuya sessizce yaklaşıp yaklaşık 1.5 saniye tısladıktan sonra patlar.'
    },
    {
      id: 'E3',
      difficulty: 'easy',
      q: "Obsidyen bloğunu kırıp envantere alabilmek için en az hangi kalitede kazma gereklidir?",
      options: ['Taş Kazma', 'Demir Kazma', 'Altın Kazma', 'Elmas Kazma'],
      answer: 3,
      explanation: 'Obsidyen yalnızca Elmas veya Netherite kazma ile kırıldığında düşer.'
    },
    {
      id: 'E4',
      difficulty: 'easy',
      q: "Köylülerle (Villager) ticaret yaparken kullanılan temel para birimi cevheri hangisidir?",
      options: ['Elmas', 'Zümrüt (Emerald)', 'Altın Külçesi', 'Lapis Lazuli'],
      answer: 1,
      explanation: 'Köylü ticaret sisteminin resmi para birimi Zümrüt (Emerald) cevheridir.'
    },
    {
      id: 'E5',
      difficulty: 'easy',
      q: "Gece olduğunda uyumak ve yeniden doğma noktasını ayarlamak için kullanılan eşya nedir?",
      options: ['Yatak', 'Kamp Ateşi', 'Fener', 'Sandık'],
      answer: 0,
      explanation: '3 Yün ve 3 Tahta ile yapılan Yatak, geceyi geçirmeyi ve doğma noktasını kaydetmeyi sağlar.'
    },
    {
      id: 'E6',
      difficulty: 'easy',
      q: "Creeper'lar aşağıdaki hayvanlardan hangisinden korkup kaçarlar?",
      options: ['Kurt', 'Kedi ve Ocelot', 'At', ' Koyun'],
      answer: 1,
      explanation: 'Creeper yaratıkları kedilerden ve ocelotlardan uzak durur.'
    },
    {
      id: 'E7',
      difficulty: 'easy',
      q: "Su kovası ve lav kaynağı birleştiğinde lav kaynağının üzerine su dökülürse ne oluşur?",
      options: ['Kırıktaş', 'Obsidyen', 'Kumtaşı', 'Bazalt'],
      answer: 1,
      explanation: 'Duran lav kaynak bloğuna su temas ettiğinde Obsidyen oluşur.'
    },
    {
      id: 'E8',
      difficulty: 'easy',
      q: "Minecraft'ta açlık barını doldurmak için ineklerden elde edilen pişmiş etin adı nedir?",
      options: ['Biftek (Steak)', 'Koyun Eti', 'Tavuk Kızartması', 'Altın Elma'],
      answer: 0,
      explanation: 'Çiğ sığır eti fırında pişirildiğinde Biftek (Steak) olur ve yüksek doygunluk verir.'
    },

    // --- ORTA (6-10) ---
    {
      id: 'M1',
      difficulty: 'medium',
      q: "Nether boyutunda Yatak kullanmaya çalışırsanız ne olur?",
      options: [
        'Sabah olur',
        'Yatak şiddetli bir şekilde patlar',
        'Hiçbir şey olmaz',
        'Nether portalı açılır'
      ],
      answer: 1,
      explanation: 'Nether ve End boyutlarında yatakta uyumaya çalışmak güçlü bir patlamaya yol açar.'
    },
    {
      id: 'M2',
      difficulty: 'medium',
      q: "Büyü Masası'nın (Enchanting Table) maksimum seviye (30. seviye) büyü verebilmesi için etrafına en az kaç Kitaplık dizilmelidir?",
      options: ['10', '12', '15', '18'],
      answer: 2,
      explanation: '30. seviye büyülerin kilidini açmak için Büyü Masası çevresinde 15 adet Kitaplık bulunmalıdır.'
    },
    {
      id: 'M3',
      difficulty: 'medium',
      q: "Elmas ekipmanları Netherite seviyesine yükseltmek için Demirci Masasında (Smithing Table) Netherite Külçesi ile birlikte ne gerekir?",
      options: [
        'Nether Yıldızı',
        'Netherite Yükseltme Demirci Şablonu',
        'Ejderha Nefesi',
        'Alev Tozu'
      ],
      answer: 1,
      explanation: '1.20 güncellemesinden itibaren Netherite Yükseltme Demirci Şablonu (Smithing Template) zorunludur.'
    },
    {
      id: 'M4',
      difficulty: 'medium',
      q: "Bir Redstone sinyalinin yenileyici (Repeater) kullanmadan ulaşabileceği maksimum mesafe kaç bloktur?",
      options: ['8 Blok', '12 Blok', '15 Blok', '20 Blok'],
      answer: 2,
      explanation: 'Standart Redstone tozu sinyali kaynağından itibaren en fazla 15 blok ilerler.'
    },
    {
      id: 'M5',
      difficulty: 'medium',
      q: "End Portalını aktif hale getirmek için End Portalı Çerçevelerine toplam kaç adet Ender Gözü (Eye of Ender) yerleştirilmelidir?",
      options: ['8', '10', '12', '16'],
      answer: 2,
      explanation: 'End Portalı 12 adet çerçeve bloğundan oluşur ve tamamında Ender Gözü bulunmalıdır.'
    },
    {
      id: 'M6',
      difficulty: 'medium',
      q: "Ölümsüzlük Totemi (Totem of Undying) hangi yaratıktan düşer?",
      options: ['Wither İskeleti', 'Uyandırıcı (Evoker)', 'Yağmacı (Pillager)', 'Gardiyan (Warden)'],
      answer: 1,
      explanation: 'Ölümsüzlük Totemi, Orman Köşklerinde veya Baskınlarda bulunan Uyandırıcıdan (Evoker) düşer.'
    },
    {
      id: 'M7',
      difficulty: 'medium',
      q: "Hangi iksir oyuncuya ateş ve lav hasarına karşı tam bağışıklık kazandırır?",
      options: [
        'İyileştirme İksiri',
        'Ateş Direnci İksiri',
        'Yenilenme İksiri',
        'Gece Görüşü İksiri'
      ],
      answer: 1,
      explanation: 'Magma Kremi ile yapılan Ateş Direnci İksiri lav ve ateş hasarını tamamen engeller.'
    },

    // --- ZOR (11-15) ---
    {
      id: 'H1',
      difficulty: 'hard',
      q: "Antik Şehirlerde (Ancient City) yaşayan ve görme yetisi olmadığı halde titreşimleri algılayan devasa boss benzeri yaratık hangisidir?",
      options: ['Yaşlı Gardiyan', 'Warden (Muhafız)', 'Ravager', 'Shulker'],
      answer: 1,
      explanation: 'Derin Karanlık biyomundaki Antik Şehirlerde Sculk Çığırtkanı tarafından çağrılan yaratık Warden\'dır.'
    },
    {
      id: 'H2',
      difficulty: 'hard',
      q: "1 adet Netherite Külçesi (Netherite Ingot) üretmek için kaç adet Netherite Hurdası ve kaç adet Altın Külçesi gerekir?",
      options: [
        '2 Hurda + 2 Altın',
        '4 Netherite Hurdası + 4 Altın Külçesi',
        '6 Hurda + 2 Altın',
        '8 Hurda + 1 Altın'
      ],
      answer: 1,
      explanation: 'Antik Kalıntıların eritilmesiyle elde edilen 4 Netherite Hurdası ve 4 Altın Külçesi birleştirilir.'
    },
    {
      id: 'H3',
      difficulty: 'hard',
      q: "Fener (Beacon) bloğunun tam güçte (4 katlı piramit) çalışabilmesi için taban piramidinde toplam kaç adet cevher bloğu bulunmalıdır?",
      options: ['81 Blok', '128 Blok', '164 Blok', '200 Blok'],
      answer: 2,
      explanation: '9x9 (81) + 7x7 (49) + 5x5 (25) + 3x3 (9) = toplam 164 adet cevher bloğu gerekir.'
    },
    {
      id: 'H4',
      difficulty: 'hard',
      q: "Minecraft'ta bir Zombi Köylüyü tekrar normal bir Köylüye dönüştürmek için hangi iksir atılmalı ve ardından ne verilmelidir?",
      options: [
        'Güç İksiri + Elmas',
        'Zayıflık İksiri + Altın Elma',
        'Rejenerasyon İksiri + Zümrüt',
        'Anında Sağlık İksiri + Altın Havuç'
      ],
      answer: 1,
      explanation: 'Önce Patlayıcı Zayıflık İksiri atılır, ardından Altın Elma yedirilerek iyileşme süreci başlatılır.'
    },
    {
      id: 'H5',
      difficulty: 'hard',
      q: "Nether boyutunda 1 blok ilerlemek, Ana Dünyada (Overworld) kaç blok ilerlemeye karşılık gelir?",
      options: ['4 Blok', '8 Blok', '16 Blok', '32 Blok'],
      answer: 1,
      explanation: 'Nether koordinatları Overworld koordinatlarına göre 1:8 oranında ölçeklenmiştir.'
    },
    {
      id: 'H6',
      difficulty: 'hard',
      q: "Wither boss'unu çağırmak için Ruh Kumu/Ruh Toprağı üzerine kaç adet Wither İskeleti Kafatası yerleştirilmelidir?",
      options: ['1', '2', '3', '4'],
      answer: 2,
      explanation: 'T şeklinde 4 Ruh Kumu üzerine 3 adet Wither İskeleti Kafatası koyularak Wither çağrılır.'
    },
    {
      id: 'H7',
      difficulty: 'hard',
      q: "Oyunda Büyü Masası olmadan yalnızca ganimet sandıklarından veya köylü ticaretinden elde edilebilen ve XP ile eşyayı onaran büyü hangisidir?",
      options: ['Kırılmazlık III', 'Onarım (Mending)', 'Servet III', 'İpeksi Dokunuş'],
      answer: 1,
      explanation: 'Onarım (Mending) bir hazine büyüsüdür ve Büyü Masasından çıkmaz; toplanan XP küreleriyle eşyayı tamir eder.'
    }
  ];

  // ==========================================
  // WEB AUDIO SES EFEKTLERİ
  // ==========================================
  const soundEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
    },

    playTone(freq, duration = 0.14, type = 'sine', gainVal = 0.08) {
      const toggle = document.getElementById('setting-sound-toggle');
      if (toggle && !toggle.checked) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // ignore audio errors
      }
    },

    click() {
      this.playTone(520, 0.06, 'triangle', 0.06);
    },

    correct() {
      this.playTone(587.33, 0.12, 'sine', 0.09);
      setTimeout(() => this.playTone(880, 0.22, 'sine', 0.1), 110);
    },

    wrong() {
      this.playTone(220, 0.25, 'sawtooth', 0.08);
      setTimeout(() => this.playTone(165, 0.35, 'sawtooth', 0.08), 160);
    },

    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.18, 'triangle', 0.1), i * 110);
      });
    },

    creeperHissAndBoom() {
      // Tsssss fuse + explosion
      [380, 440, 520, 620].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.08, 'sawtooth', 0.045), i * 75);
      });
      setTimeout(() => {
        this.playTone(110, 0.32, 'square', 0.11);
        this.playTone(75, 0.38, 'sawtooth', 0.1);
      }, 340);
    },

    endermanTeleport() {
      // Ender pearl / Enderman vwoop
      this.playTone(740, 0.09, 'sine', 0.08);
      setTimeout(() => this.playTone(310, 0.12, 'triangle', 0.09), 70);
      setTimeout(() => this.playTone(590, 0.14, 'sine', 0.08), 160);
    },

    villagerHrmmm() {
      // Iconic Villager "Hrmmm!" + emerald chime
      this.playTone(235, 0.14, 'triangle', 0.09);
      setTimeout(() => this.playTone(275, 0.18, 'triangle', 0.09), 110);
      setTimeout(() => this.playTone(220, 0.16, 'sine', 0.08), 240);
      setTimeout(() => this.playTone(987.77, 0.15, 'sine', 0.07), 380);
    }
  };

  // ==========================================
  // OYUN DURUMU
  // ==========================================
  const gameState = {
    active: false,
    isPartyMatch: false,
    questions: [],
    currentIndex: 0,
    currentPrize: 0,
    safePrize: 0,
    emeraldEarnedThisMatch: 0,
    streak: 0,
    extraLifeUsedInMatch: false,
    timer: null,
    timeLeft: 30,
    lifelines: {
      fifty: true,
      audience: true,
      villager: true
    }
  };

  function svc() {
    return window.MCMServices || {};
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getCombinedQuestionPool(difficulty) {
    const combined = [];
    const seen = new Set();

    // 1. Öncelik: Yönetici Gemini API Anahtarı ile üretilen AI Soru Havuzu
    const aiService = svc().aiQuestionService;
    if (aiService && typeof aiService.getAiQuestionsByDifficulty === 'function') {
      const aiList = aiService.getAiQuestionsByDifficulty(difficulty) || [];
      aiList.forEach(item => {
        const qText = String(item.q || item.question || '').trim();
        if (qText && !seen.has(qText) && Array.isArray(item.options) && item.options.length === 4) {
          seen.add(qText);
          combined.push({
            id: item.id || `AI_${difficulty}_${combined.length}`,
            difficulty,
            q: qText,
            options: [...item.options],
            answer: Number(item.answer ?? item.correct ?? 0),
            explanation: item.explanation || '',
            isAi: true
          });
        }
      });
    }

    // 2. Yerleşik Soru Havuzu
    QUESTION_POOL.filter(q => q.difficulty === difficulty).forEach(item => {
      if (item.q && !seen.has(item.q)) {
        seen.add(item.q);
        combined.push(item);
      }
    });

    // 3. Genişletilmiş QUESTIONS_DB Havuzu
    if (window.QUESTIONS_DB && Array.isArray(window.QUESTIONS_DB[difficulty])) {
      window.QUESTIONS_DB[difficulty].forEach(item => {
        const qText = item.question || item.q;
        if (qText && !seen.has(qText)) {
          seen.add(qText);
          combined.push({
            difficulty,
            q: qText,
            options: Array.isArray(item.options) ? [...item.options] : [],
            answer: typeof item.correct === 'number' ? item.correct : item.answer,
            explanation: item.explanation || ''
          });
        }
      });
    }

    return combined;
  }

  function pickNonRepeatingDifficultyQuestions(difficulty, count = 5) {
    const pool = getCombinedQuestionPool(difficulty);
    const aiService = svc().aiQuestionService;
    const seenKeys = aiService?.getSeenQuestionKeys ? aiService.getSeenQuestionKeys() : new Set();

    const norm = str =>
      String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9çğıöşü]/gi, '');

    const unseenAi = [];
    const unseenStandard = [];
    const seenPool = [];

    pool.forEach(q => {
      const key = norm(q.q);
      if (!seenKeys.has(key)) {
        if (q.isAi) unseenAi.push(q);
        else unseenStandard.push(q);
      } else {
        seenPool.push(q);
      }
    });

    const orderedCandidates = [
      ...shuffle(unseenAi),
      ...shuffle(unseenStandard),
      ...shuffle(seenPool)
    ];

    return orderedCandidates.slice(0, count);
  }

  function buildMatchQuestions() {
    const easy = pickNonRepeatingDifficultyQuestions('easy', 5);
    const medium = pickNonRepeatingDifficultyQuestions('medium', 5);
    const hard = pickNonRepeatingDifficultyQuestions('hard', 5);
    const combined = [...easy, ...medium, ...hard];

    svc().aiQuestionService?.markQuestionsSeen?.(combined);

    return combined.map(item => {
      const indexed = item.options.map((text, idx) => ({
        text,
        correct: idx === item.answer
      }));
      const mixed = shuffle(indexed);
      return {
        ...item,
        options: mixed.map(m => m.text),
        answer: mixed.findIndex(m => m.correct)
      };
    });
  }

  // ==========================================
  // ÖDÜL MERDİVENİ OLUŞTURMA
  // ==========================================
  function renderPrizeLadder() {
    const ladderEl = document.getElementById('prize-ladder');
    if (!ladderEl) return;

    ladderEl.innerHTML = [...PRIZE_LADDER]
      .reverse()
      .map(step => {
        const idx = step.level - 1;
        const isCurrent = gameState.active && idx === gameState.currentIndex;
        const isPassed = gameState.active && idx < gameState.currentIndex;
        return `
          <li class="ladder-item ${step.safe ? 'safe-haven' : ''} ${isCurrent ? 'current' : ''} ${
          isPassed ? 'passed' : ''
        }">
            <span class="step-num">${step.level}</span>
            <span class="step-amount">${step.label}</span>
          </li>
        `;
      })
      .join('');
  }

  // ==========================================
  // YARIŞMAYI BAŞLATMA
  // ==========================================
  function startNewGameSession(isParty = false) {
    const session = svc().authService?.getActiveSession();
    if (!session) {
      document.getElementById('access-gate')?.classList.remove('hidden');
      return;
    }

    soundEngine.click();
    stopQuestionTimer();

    gameState.active = true;
    gameState.isPartyMatch = Boolean(isParty);
    gameState.questions = buildMatchQuestions();
    gameState.currentIndex = 0;
    gameState.currentPrize = 0;
    gameState.safePrize = 0;
    gameState.emeraldEarnedThisMatch = 0;
    gameState.streak = 0;
    gameState.extraLifeUsedInMatch = false;
    gameState.lifelines = {
      fifty: true,
      audience: true,
      villager: true
    };

    // Yöneticinin tanımladığı Gemini API Anahtarı varsa arka planda yeni sorular üret ve maça enjekte et
    svc().aiQuestionService?.ensureFreshQuestionsForMatch?.(gameState);

    ['lifeline-5050', 'lifeline-audience', 'lifeline-villager'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('used');
      }
    });

    window.MCMPlatform?.navigateToScreen('game');
    loadQuestionOnStage();
  }

  function loadQuestionOnStage() {
    stopQuestionTimer();
    const qObj = gameState.questions[gameState.currentIndex];
    if (!qObj) {
      finishGameSession({ didWin: true, walkedAway: false });
      return;
    }

    const stepInfo = PRIZE_LADDER[gameState.currentIndex];
    const numEl = document.getElementById('hud-question-num');
    const safeEl = document.getElementById('hud-safe-prize');
    const diffEl = document.getElementById('question-difficulty');
    const prizeTagEl = document.getElementById('question-prize-tag');
    const qTextEl = document.getElementById('question-text');
    const walkAmtEl = document.getElementById('walk-away-amount');
    const feedbackEl = document.getElementById('lifeline-feedback');

    if (numEl) numEl.textContent = `${gameState.currentIndex + 1} / 15`;
    if (safeEl) safeEl.textContent = `${gameState.safePrize.toLocaleString('tr-TR')} ₺`;
    if (diffEl) {
      diffEl.textContent =
        qObj.difficulty === 'easy'
          ? 'KOLAY SEVİYE'
          : qObj.difficulty === 'medium'
          ? 'ORTA SEVİYE'
          : 'ZOR SEVİYE';
    }
    if (prizeTagEl) prizeTagEl.textContent = `${stepInfo.label} DEĞERİNDE SORU`;
    if (qTextEl) qTextEl.textContent = qObj.q;
    if (walkAmtEl) walkAmtEl.textContent = `${gameState.currentPrize.toLocaleString('tr-TR')} ₺`;
    if (feedbackEl) {
      feedbackEl.classList.add('hidden');
      feedbackEl.innerHTML = '';
    }
    const stageActorsEl = document.getElementById('mc-stage-actors');
    if (stageActorsEl) {
      stageActorsEl.classList.add('hidden');
      stageActorsEl.innerHTML = '';
    }

    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`ans-${i}`);
      if (!btn) continue;
      btn.disabled = false;
      btn.className = 'answer-btn';
      const txtSpan = btn.querySelector('.ans-text');
      if (txtSpan) txtSpan.textContent = qObj.options[i];
    }

    renderPrizeLadder();
    startQuestionTimer();
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    gameState.timeLeft = 30;
    updateTimerUI();

    gameState.timer = setInterval(() => {
      gameState.timeLeft--;
      updateTimerUI();
      if (gameState.timeLeft <= 0) {
        stopQuestionTimer();
        handleWrongOrTimeout(-1, 'Süre doldu!');
      }
    }, 1000);
  }

  function stopQuestionTimer() {
    if (gameState.timer) {
      clearInterval(gameState.timer);
      gameState.timer = null;
    }
  }

  function updateTimerUI() {
    const txt = document.getElementById('timer-text');
    const ring = document.getElementById('timer-ring-fill');
    if (txt) txt.textContent = String(Math.max(0, gameState.timeLeft));
    if (ring) {
      const circumference = 163.36;
      const offset = circumference - (Math.max(0, gameState.timeLeft) / 30) * circumference;
      ring.style.strokeDashoffset = String(offset);
    }
  }

  // ==========================================
  // CEVAP SEÇİMİ VE EKSTRA CAN KONTROLÜ
  // ==========================================
  function handleAnswerSelection(chosenIndex) {
    if (!gameState.active) return;
    stopQuestionTimer();

    const qObj = gameState.questions[gameState.currentIndex];
    if (!qObj) return;

    for (let i = 0; i < 4; i++) {
      const b = document.getElementById(`ans-${i}`);
      if (b) b.disabled = true;
    }

    const chosenBtn = document.getElementById(`ans-${chosenIndex}`);
    chosenBtn?.classList.add('selected');
    soundEngine.click();

    setTimeout(() => {
      chosenBtn?.classList.remove('selected');
      if (chosenIndex === qObj.answer) {
        // DOĞRU CEVAP!
        chosenBtn?.classList.add('correct');
        soundEngine.correct();

        const stepInfo = PRIZE_LADDER[gameState.currentIndex];
        gameState.currentPrize = stepInfo.amount;
        if (stepInfo.safe) {
          gameState.safePrize = stepInfo.amount;
        }
        gameState.streak++;

        // Zümrüt ödülü ver
        const session = svc().authService?.getActiveSession();
        if (session && svc().economyService) {
          const rewardRes = svc().economyService.rewardCorrectAnswer(
            session.username,
            gameState.currentIndex
          );
          gameState.emeraldEarnedThisMatch += Number(rewardRes.added || 0);
          svc().achievementService?.checkAndUnlock(session.username, {
            streak: gameState.streak
          });
          window.MCMPlatform?.syncHeaderAndDrawer();
        }

        setTimeout(() => {
          gameState.currentIndex++;
          if (gameState.currentIndex >= 15) {
            finishGameSession({ didWin: true, walkedAway: false });
          } else {
            loadQuestionOnStage();
          }
        }, 1100);
      } else {
        // YANLIŞ CEVAP!
        chosenBtn?.classList.add('wrong');
        soundEngine.wrong();
        handleWrongOrTimeout(chosenIndex, qObj.explanation);
      }
    }, 650);
  }

  function handleWrongOrTimeout(chosenIndex, reasonText) {
    const session = svc().authService?.getActiveSession();
    const availableLives = session
      ? svc().extraLifeService?.getUserExtraLives(session.username) || 0
      : 0;

    // Ekstra Can varsa ve bu maçta henüz kullanılmadıysa ikinci şans sun
    if (availableLives > 0 && !gameState.extraLifeUsedInMatch && chosenIndex >= 0) {
      const modal = document.getElementById('extra-life-modal');
      const countEl = document.getElementById('extra-life-modal-count');
      if (countEl) countEl.textContent = String(availableLives);
      if (modal) {
        modal.dataset.wrongIndex = String(chosenIndex);
        modal.classList.remove('hidden');
        return;
      }
    }

    const qObj = gameState.questions[gameState.currentIndex];
    if (qObj) {
      const correctBtn = document.getElementById(`ans-${qObj.answer}`);
      correctBtn?.classList.add('correct');
    }

    setTimeout(() => {
      finishGameSession({
        didWin: false,
        walkedAway: false,
        explanation: reasonText || qObj?.explanation || ''
      });
    }, 1300);
  }

  function finishGameSession({ didWin = false, walkedAway = false, explanation = '' }) {
    stopQuestionTimer();
    gameState.active = false;

    const finalPrize = didWin
      ? 1000000
      : walkedAway
      ? gameState.currentPrize
      : gameState.safePrize;

    if (didWin) soundEngine.win();

    const session = svc().authService?.getActiveSession();
    if (session) {
      // Kullanıcı istatistiklerini ve gerçek liderlik puanını güncelle
      svc().userService?.recordGameResult(session.username, {
        scoreEarned: finalPrize,
        didWin
      });

      // Oyun sonu Zümrüt ödülü
      if (svc().economyService) {
        const bonusRes = svc().economyService.rewardGameCompletion(
          session.username,
          didWin,
          gameState.isPartyMatch
        );
        gameState.emeraldEarnedThisMatch += Number(bonusRes.added || 0);
      }

      // Parti maçındaysa parti skorunu güncelle
      const activeParty = svc().partyService?.getActivePartyForUser(session.username);
      if (activeParty) {
        svc().partyService.updateMemberScore(session.username, finalPrize);
      }

      // Yerel son maç geçmişine kaydet
      try {
        const key = `mc_millionaire_tr_stats_v5_${session.username.toLowerCase()}`;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        const recentMatches = Array.isArray(existing.recentMatches) ? existing.recentMatches : [];
        recentMatches.unshift({
          date: new Date().toISOString(),
          didWin,
          reachedQuestion: gameState.currentIndex + 1,
          prizeWon: finalPrize
        });
        if (recentMatches.length > 20) recentMatches.length = 20;
        localStorage.setItem(key, JSON.stringify({ ...existing, recentMatches }));
      } catch (e) {
        // ignore
      }
    }

    // Oyun Sonu Ekranını Doldur
    const iconEl = document.getElementById('gameover-icon');
    const titleEl = document.getElementById('gameover-title');
    const subEl = document.getElementById('gameover-subtitle');
    const prizeEl = document.getElementById('gameover-prize');
    const emEl = document.getElementById('gameover-emerald-earned');
    const expEl = document.getElementById('gameover-explanation');

    if (iconEl) iconEl.textContent = didWin ? '👑' : walkedAway ? '💰' : '💥';
    if (titleEl) {
      titleEl.textContent = didWin
        ? 'TEBRİKLER! MİLYONER OLDUNUZ!'
        : walkedAway
        ? 'YARIŞMADAN ÇEKİLDİNİZ'
        : 'OYUN BİTTİ!';
    }
    if (subEl) {
      subEl.textContent = didWin
        ? '15 sorunun tamamını doğru yanıtlayarak büyük ödülü kazandınız!'
        : walkedAway
        ? 'Mevcut ödülünüzü garanti altına alarak yarışmayı tamamladınız.'
        : `${gameState.currentIndex + 1}. soruda elendiniz.`;
    }
    if (prizeEl) prizeEl.textContent = `${finalPrize.toLocaleString('tr-TR')} ₺`;
    if (emEl) emEl.textContent = `+${gameState.emeraldEarnedThisMatch.toLocaleString('tr-TR')} 🟢`;
    if (expEl) expEl.textContent = explanation || '';

    window.MCMPlatform?.syncHeaderAndDrawer();
    window.MCMPlatform?.navigateToScreen('gameover');
  }

  // ==========================================
  // JOKERLER & MINECRAFT MOB ANİMASYONLARI (CREEPER, ENDERMAN, BİLGE KÖYLÜ SAĞA GEÇER)
  // ==========================================
  const STAGE_MOB_SVGS = {
    CREEPER: `<svg viewBox="0 0 16 24" class="stage-mob-svg" shape-rendering="crispEdges">
      <rect x="4" y="2" width="8" height="8" fill="#50c846"/>
      <rect x="5" y="3" width="2" height="2" fill="#82eb78"/>
      <rect x="5" y="4" width="2" height="2" fill="#111827"/>
      <rect x="9" y="4" width="2" height="2" fill="#111827"/>
      <rect x="7" y="6" width="2" height="3" fill="#111827"/>
      <rect x="6" y="7" width="1" height="3" fill="#111827"/>
      <rect x="9" y="7" width="1" height="3" fill="#111827"/>
      <rect x="5" y="10" width="6" height="8" fill="#3da134"/>
      <rect x="6" y="11" width="3" height="4" fill="#50c846"/>
      <rect x="3" y="18" width="4" height="5" fill="#2c7a24"/>
      <rect x="9" y="18" width="4" height="5" fill="#2c7a24"/>
      <rect x="3" y="21" width="4" height="2" fill="#143811"/>
      <rect x="9" y="21" width="4" height="2" fill="#143811"/>
    </svg>`,
    ENDERMAN: `<svg viewBox="0 0 16 24" class="stage-mob-svg" shape-rendering="crispEdges">
      <rect x="2" y="1" width="1" height="1" fill="#d946ef"/>
      <rect x="13" y="3" width="1" height="1" fill="#a855f7"/>
      <rect x="1" y="12" width="1" height="1" fill="#e879f9"/>
      <rect x="14" y="15" width="1" height="1" fill="#c084fc"/>
      <rect x="4" y="2" width="8" height="7" fill="#111827"/>
      <rect x="4" y="5" width="3" height="1" fill="#f5d0fe"/>
      <rect x="5" y="5" width="1" height="1" fill="#d946ef"/>
      <rect x="9" y="5" width="3" height="1" fill="#f5d0fe"/>
      <rect x="10" y="5" width="1" height="1" fill="#d946ef"/>
      <rect x="5" y="9" width="6" height="6" fill="#0f172a"/>
      <rect x="3" y="9" width="1" height="10" fill="#1e293b"/>
      <rect x="12" y="9" width="1" height="10" fill="#1e293b"/>
      <rect x="6" y="15" width="1" height="8" fill="#0f172a"/>
      <rect x="9" y="15" width="1" height="8" fill="#0f172a"/>
    </svg>`,
    VILLAGER: `<svg viewBox="0 0 16 24" class="stage-mob-svg" shape-rendering="crispEdges">
      <rect x="3" y="1" width="10" height="3" fill="#dc2626"/>
      <rect x="4" y="2" width="8" height="1" fill="#facc15"/>
      <rect x="4" y="4" width="8" height="7" fill="#d4946a"/>
      <rect x="4" y="5" width="8" height="1" fill="#78350f"/>
      <rect x="5" y="6" width="2" height="2" fill="#16a34a"/>
      <rect x="9" y="6" width="2" height="2" fill="#16a34a"/>
      <rect x="7" y="7" width="2" height="5" fill="#b5764e"/>
      <rect x="4" y="11" width="8" height="9" fill="#78350f"/>
      <rect x="6" y="11" width="4" height="9" fill="#a16207"/>
      <rect x="3" y="12" width="10" height="4" fill="#92400e"/>
      <rect x="7" y="13" width="2" height="2" fill="#22c55e"/>
      <rect x="5" y="20" width="2" height="3" fill="#451a03"/>
      <rect x="9" y="20" width="2" height="3" fill="#451a03"/>
    </svg>`
  };

  function useFiftyFifty() {
    if (!gameState.active || !gameState.lifelines.fifty) return;
    gameState.lifelines.fifty = false;
    soundEngine.creeperHissAndBoom();

    const btn = document.getElementById('lifeline-5050');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('used');
    }

    const qObj = gameState.questions[gameState.currentIndex];
    if (!qObj) return;

    const letters = ['A', 'B', 'C', 'D'];
    const wrongIndices = [0, 1, 2, 3].filter(i => i !== qObj.answer);
    const toHide = shuffle(wrongIndices).slice(0, 2);

    // Sahneye Creeper çıkar, şişip parlasın ve 2 yanlış şıkkı patlatsın!
    const stageActorsEl = document.getElementById('mc-stage-actors');
    if (stageActorsEl) {
      stageActorsEl.classList.remove('hidden');
      stageActorsEl.innerHTML = `
        <div class="mc-stage-actor creeper-stage-actor creeper-fuse">
          <div class="actor-character-wrap">
            ${STAGE_MOB_SVGS.CREEPER}
            <div class="creeper-explosion-particles">
              <span>💥</span><span>🟩</span><span>💨</span><span>🔥</span>
            </div>
          </div>
          <div class="actor-speech-bubble creeper-bubble">
            <strong>💥 Creeper 50:50 Patlaması!</strong>
            <p><em>"Tsssss... BOOM!"</em> — <strong>${letters[toHide[0]]}</strong> ve <strong>${letters[toHide[1]]}</strong> şıkları Creeper tarafından havaya uçuruldu!</p>
          </div>
        </div>
      `;
    }

    setTimeout(() => {
      toHide.forEach(idx => {
        const b = document.getElementById(`ans-${idx}`);
        if (b) {
          b.disabled = true;
          b.classList.add('eliminated', 'creeper-blasted');
        }
      });
    }, 320);
  }

  function useAskAudience() {
    if (!gameState.active || !gameState.lifelines.audience) return;
    gameState.lifelines.audience = false;
    soundEngine.endermanTeleport();

    const btn = document.getElementById('lifeline-audience');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('used');
    }

    const qObj = gameState.questions[gameState.currentIndex];
    if (!qObj) return;

    const letters = ['A', 'B', 'C', 'D'];
    const rates = [10, 10, 10, 10];
    rates[qObj.answer] = 64;
    let rem = 36;
    [0, 1, 2, 3]
      .filter(i => i !== qObj.answer)
      .forEach((idx, pos) => {
        if (pos === 2) rates[idx] = rem;
        else {
          const share = Math.floor(Math.random() * rem);
          rates[idx] = share;
          rem -= share;
        }
      });

    // Sahneye Enderman ışınlansın ve End Boyutu Sunucu Oylaması çubuklarını göstersin!
    const stageActorsEl = document.getElementById('mc-stage-actors');
    if (stageActorsEl) {
      stageActorsEl.classList.remove('hidden');
      stageActorsEl.innerHTML = `
        <div class="mc-stage-actor enderman-stage-actor enderman-teleport-in">
          <div class="actor-character-wrap">
            ${STAGE_MOB_SVGS.ENDERMAN}
            <div class="ender-portal-particles">
              <span>✦</span><span>🟣</span><span>✦</span><span>🔮</span>
            </div>
          </div>
          <div class="actor-speech-bubble enderman-bubble">
            <strong>🔮 Enderman &amp; Sunucu Oylaması:</strong>
            <div class="enderman-poll-bars">
              ${rates
                .map(
                  (r, i) => `
                  <div class="ender-poll-row ${i === qObj.answer ? 'is-top' : ''}">
                    <span class="ender-poll-letter">${letters[i]}</span>
                    <div class="ender-poll-track">
                      <div class="ender-poll-fill" style="width:${r}%"></div>
                    </div>
                    <strong class="ender-poll-pct">%${r}</strong>
                  </div>
                `
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    }

    const fb = document.getElementById('lifeline-feedback');
    if (fb) {
      fb.classList.remove('hidden');
      fb.innerHTML = `<strong>👥 Sunucu Oylaması:</strong> ${rates
        .map((r, i) => `${letters[i]}: %${r}`)
        .join(' • ')}`;
    }
  }

  function useWiseVillager() {
    if (!gameState.active || !gameState.lifelines.villager) return;
    gameState.lifelines.villager = false;
    soundEngine.villagerHrmmm();

    const btn = document.getElementById('lifeline-villager');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('used');
    }

    const qObj = gameState.questions[gameState.currentIndex];
    if (!qObj) return;

    const letters = ['A', 'B', 'C', 'D'];
    const recommendedLetter = letters[qObj.answer];
    const recommendedText = qObj.options[qObj.answer];

    // Bilge Köylü sahnede belirir ve SAĞA GEÇER (.villager-move-right)!
    const stageActorsEl = document.getElementById('mc-stage-actors');
    if (stageActorsEl) {
      stageActorsEl.classList.remove('hidden');
      stageActorsEl.innerHTML = `
        <div id="active-villager-stage-actor" class="mc-stage-actor villager-stage-actor">
          <div class="actor-speech-bubble villager-bubble">
            <strong>📖 Bilge Köylü (Sağ Kürsüye Geçti):</strong>
            <p>"Hrmmm! Sağa geçip antik parşömenlerime baktım... Doğru cevap büyük ihtimalle <strong>${recommendedLetter}) ${recommendedText}</strong>!"</p>
          </div>
          <div class="actor-character-wrap villager-character-wrap">
            ${STAGE_MOB_SVGS.VILLAGER}
            <div class="villager-emerald-sparkles">
              <span>🟢</span><span>✨</span><span>📖</span>
            </div>
          </div>
        </div>
      `;

      // Animasyon: Bilge Köylü soldan yürüyerek SAĞA GEÇSİN
      requestAnimationFrame(() => {
        const vActor = document.getElementById('active-villager-stage-actor');
        vActor?.classList.add('villager-move-right');
      });
    }

    // Önerilen şıkkı zümrüt ışıltısıyla vurgula
    const recBtn = document.getElementById(`ans-${qObj.answer}`);
    recBtn?.classList.add('villager-recommended');

    const fb = document.getElementById('lifeline-feedback');
    if (fb) {
      fb.classList.remove('hidden');
      fb.innerHTML = `<strong>🧙‍♂️ Bilge Köylü:</strong> "Hrmmm! Parşömenlerime göre doğru cevap büyük ihtimalle <strong>${recommendedLetter}) ${recommendedText}</strong>!"`;
    }
  }

  // ==========================================
  // KİMLİK DOĞRULAMA KAPISI (LİSANSSIZ GİRİŞ / KAYIT / YÖNETİCİ GİRİŞİ)
  // ==========================================
  function initAccessGate() {
    const gate = document.getElementById('access-gate');
    const loginForm = document.getElementById('access-login-form');
    const regForm = document.getElementById('access-register-form');
    const forgotForm = document.getElementById('access-forgot-form');
    const gmailEmailForm = document.getElementById('access-gmail-email-form');
    const otpForm = document.getElementById('access-otp-form');
    const gmailSetupForm = document.getElementById('access-gmail-setup-form');

    let currentOtpEmail = '';
    let currentOtpDriveScope = true;
    let currentOtpPhotoUrl = '';
    let otpCountdownInterval = null;

    function hideAllGateForms() {
      loginForm?.classList.add('hidden');
      regForm?.classList.add('hidden');
      forgotForm?.classList.add('hidden');
      gmailEmailForm?.classList.add('hidden');
      otpForm?.classList.add('hidden');
      gmailSetupForm?.classList.add('hidden');
      if (otpCountdownInterval) {
        clearInterval(otpCountdownInterval);
        otpCountdownInterval = null;
      }
    }

    function returnToLoginForm() {
      hideAllGateForms();
      document.querySelectorAll('.auth-tab').forEach(t => {
        const isLogin = t.getAttribute('data-auth-tab') === 'login';
        t.classList.toggle('active', isLogin);
        t.setAttribute('aria-selected', isLogin ? 'true' : 'false');
      });
      loginForm?.classList.remove('hidden');
    }

    // Sekme değiştirme (Sadece Giriş Yap & Kayıt Ol)
    document.querySelectorAll('.auth-tab[data-auth-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-auth-tab');
        hideAllGateForms();
        document.querySelectorAll('.auth-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });

        loginForm?.classList.toggle('hidden', mode !== 'login');
        regForm?.classList.toggle('hidden', mode !== 'register');
      });
    });

    // Şifremi Unuttum geçiş butonları
    document.getElementById('btn-goto-forgot')?.addEventListener('click', () => {
      hideAllGateForms();
      forgotForm?.classList.remove('hidden');
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
    });

    document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
      returnToLoginForm();
    });

    // Geri dön butonları
    document.querySelectorAll('.btn-cancel-to-login').forEach(btn => {
      btn.addEventListener('click', returnToLoginForm);
    });

    function startOtpCountdown(expiresAt) {
      if (otpCountdownInterval) clearInterval(otpCountdownInterval);
      const timerBadge = document.getElementById('gate-otp-timer-badge');

      function update() {
        const remainingMs = Math.max(0, expiresAt - Date.now());
        const totalSec = Math.floor(remainingMs / 1000);
        const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const secs = String(totalSec % 60).padStart(2, '0');
        if (timerBadge) {
          timerBadge.textContent = `⏱️ ${mins}:${secs}`;
          timerBadge.style.color = totalSec < 30 ? '#ef4444' : '#fde047';
        }
        if (remainingMs <= 0) {
          clearInterval(otpCountdownInterval);
          otpCountdownInterval = null;
          const errEl = document.getElementById('gate-otp-error');
          if (errEl) {
            errEl.textContent = 'Doğrulama kodunun süresi doldu. Lütfen "Tekrar Gönder" butonuna tıklayın.';
            errEl.classList.remove('hidden');
          }
        }
      }
      update();
      otpCountdownInterval = setInterval(update, 1000);
    }

    let currentOtpCode = '';

    function copyCodeToClipboard(code) {
      if (!code) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(code)
          .then(() => {
            window.MCMPlatform?.showToast('📋 Onay kodu panoya kopyalandı!', 'success');
          })
          .catch(() => {
            prompt('Lütfen kodu kopyalayın:', code);
          });
      } else {
        prompt('Lütfen kodu kopyalayın:', code);
      }
    }

    function launchOtpScreen(email, driveScope = true, photoUrl = '') {
      currentOtpEmail = String(email || '').trim().toLowerCase();
      currentOtpDriveScope = Boolean(driveScope);
      currentOtpPhotoUrl = photoUrl || '';

      const otpData = svc().authService.generateOtp(currentOtpEmail);
      currentOtpCode = otpData.code;

      hideAllGateForms();
      otpForm?.classList.remove('hidden');
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));

      const targetEmailEl = document.getElementById('gate-otp-target-email');
      if (targetEmailEl) targetEmailEl.textContent = currentOtpEmail;

      const codeDisplayEl = document.getElementById('gate-otp-code-display');
      if (codeDisplayEl) {
        codeDisplayEl.textContent = otpData.code;
        codeDisplayEl.onclick = () => copyCodeToClipboard(currentOtpCode);
      }

      const inputEl = document.getElementById('gate-otp-input');
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }

      const errEl = document.getElementById('gate-otp-error');
      errEl?.classList.add('hidden');

      startOtpCountdown(otpData.expiresAt);

      // Kodu panoya otomatik kopyalamayı da dene
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(otpData.code).catch(() => {});
      }

      window.MCMPlatform?.showToast(
        `📬 [Gmail Gelen Kutusu]: Doğrulama kodunuz: ${otpData.code}`,
        'info',
        { copyText: otpData.code, copyLabel: '📋 Kodu Kopyala' }
      );
    }

    window.launchGmailEmailPrompt = function () {
      hideAllGateForms();
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      gmailEmailForm?.classList.remove('hidden');
      const errEl = document.getElementById('gate-gmail-email-error');
      errEl?.classList.add('hidden');
      const inputEl = document.getElementById('gate-gmail-address');
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
    };

    function renderGateErrorWithCopyButton(el, message) {
      if (!el) return;
      el.innerHTML = '';
      const textSpan = document.createElement('span');
      textSpan.textContent = message;
      el.appendChild(textSpan);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mc-btn mc-btn-secondary mc-btn-xs';
      copyBtn.style.cssText =
        'margin-left: 8px; padding: 2px 6px; font-size: 0.72rem; white-space: nowrap; vertical-align: middle; cursor: pointer; display: inline-block;';
      copyBtn.innerHTML = '📋 Hatayı Kopyala';
      copyBtn.title = 'Hata ve sistem detaylarını panoya kopyala';
      copyBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        window.MCMPlatform?.copyDiagnosticsReport(message);
      };
      el.appendChild(copyBtn);
      el.classList.remove('hidden');
    }

    // 1. Birleşik Giriş (Tüm Kullanıcılar, Moderatörler ve Yöneticiler)
    loginForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-login-error');
      errEl?.classList.add('hidden');

      const username = document.getElementById('gate-login-username')?.value || '';
      const password = document.getElementById('gate-login-password')?.value || '';

      try {
        const session = await svc().authService.login({ username, password });
        gate?.classList.add('hidden');
        window.MCMPlatform?.syncHeaderAndDrawer();
        if (session.isAdminSession) {
          window.MCMPlatform?.navigateToScreen('admin');
          window.MCMPlatform?.showToast(
            `🛡️ Yönetici oturumu açıldı (${session.username}).`,
            'success'
          );
        } else {
          window.MCMPlatform?.navigateToScreen('welcome');
          window.MCMPlatform?.showToast(
            session.isModerator
              ? `🛡️ Hoş geldin Moderatör ${session.username}!`
              : `Hoş geldin, ${session.username}!`,
            'success'
          );
        }
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // 2. Normal Kullanıcı Kaydı (#1: Lisans Kodu Yok, #4: İsteğe Bağlı MC Adı, #14: +250 Netherite)
    regForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-reg-error');
      errEl?.classList.add('hidden');

      const username = document.getElementById('gate-reg-username')?.value || '';
      const minecraftPlayerName = document.getElementById('gate-reg-mc-name')?.value || '';
      const password = document.getElementById('gate-reg-password')?.value || '';
      const passwordConfirm = document.getElementById('gate-reg-password-confirm')?.value || '';

      try {
        const session = await svc().authService.registerAccount({
          username,
          password,
          passwordConfirm,
          minecraftPlayerName
        });
        gate?.classList.add('hidden');
        window.MCMPlatform?.syncHeaderAndDrawer();
        window.MCMPlatform?.navigateToScreen('welcome');
        window.MCMPlatform?.showToast(
          `🎉 Hoş geldin ${session.username}! Günlük ücretsiz Zümrüt ödülünü Ana Sayfadan hemen alabilirsin!`,
          'success'
        );
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // 3. Şifre Sıfırlama (#1: Lisans Kodu Yok)
    forgotForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-forgot-error');
      const okEl = document.getElementById('gate-forgot-success');
      errEl?.classList.add('hidden');
      okEl?.classList.add('hidden');

      const username = document.getElementById('gate-forgot-username')?.value || '';
      const minecraftPlayerName = document.getElementById('gate-forgot-mc-name')?.value || '';
      const newPassword = document.getElementById('gate-forgot-new-password')?.value || '';

      try {
        await svc().authService.resetForgottenPassword({
          username,
          minecraftPlayerName,
          newPassword
        });
        if (okEl) {
          okEl.textContent = 'Şifreniz başarıyla güncellendi! Giriş sekmesinden giriş yapabilirsiniz.';
          okEl.classList.remove('hidden');
        }
        forgotForm.reset();
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // 4. Gmail E-posta Girişi Formu Submit
    gmailEmailForm?.addEventListener('submit', e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-gmail-email-error');
      errEl?.classList.add('hidden');

      const email = document.getElementById('gate-gmail-address')?.value || '';
      try {
        if (!email || !email.includes('@')) {
          throw new Error('Lütfen geçerli bir Gmail adresi girin.');
        }
        launchOtpScreen(email, true, '');
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // 5. OTP Doğrulama Formu Submit
    otpForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-otp-error');
      errEl?.classList.add('hidden');

      const inputCode = document.getElementById('gate-otp-input')?.value || '';

      try {
        svc().authService.verifyOtp(currentOtpEmail, inputCode);

        // Kullanıcı bu Gmail ile daha önce kayıt olmuş mu?
        const existingUser = svc().userService.getUserByEmail(currentOtpEmail);
        if (existingUser) {
          // Zaten kayıtlı kullanıcı -> Doğrudan oturum aç
          const session = await svc().authService.loginExistingGmailUser({ email: currentOtpEmail });
          gate?.classList.add('hidden');
          window.MCMPlatform?.syncHeaderAndDrawer();
          if (session.isAdminSession) {
            window.MCMPlatform?.navigateToScreen('admin');
            window.MCMPlatform?.showToast(`🛡️ Yönetici oturumu açıldı (${session.email})!`, 'success');
          } else {
            window.MCMPlatform?.navigateToScreen('welcome');
            window.MCMPlatform?.showToast(`🎉 Hoş geldin, ${session.username}!`, 'success');
          }
        } else {
          // Yeni Kullanıcı -> Kullanıcı Adı ve Şifre Belirleme Adımına Geç
          hideAllGateForms();
          gmailSetupForm?.classList.remove('hidden');

          const verifiedEmailEl = document.getElementById('gate-setup-verified-email');
          if (verifiedEmailEl) verifiedEmailEl.textContent = currentOtpEmail;

          const usernameInput = document.getElementById('gate-setup-username');
          if (usernameInput) {
            const rawPrefix = currentOtpEmail.split('@')[0].replace(/[^a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]/g, '_');
            usernameInput.value = rawPrefix.substring(0, 18);
          }

          const setupErrEl = document.getElementById('gate-setup-error');
          setupErrEl?.classList.add('hidden');

          const pwdInput = document.getElementById('gate-setup-password');
          if (pwdInput) pwdInput.focus();
        }
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // OTP Kodu Tekrar Gönder Butonu
    document.getElementById('btn-resend-otp')?.addEventListener('click', () => {
      if (!currentOtpEmail) return;
      launchOtpScreen(currentOtpEmail, currentOtpDriveScope, currentOtpPhotoUrl);
    });

    // OTP Kodu Doğrudan Kopyalama Butonu
    document.getElementById('btn-copy-otp-code')?.addEventListener('click', () => {
      if (!currentOtpCode) return;
      copyCodeToClipboard(currentOtpCode);
      const btn = document.getElementById('btn-copy-otp-code');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> <span>Kopyalandı!</span>';
        setTimeout(() => (btn.innerHTML = orig), 2500);
      }
    });

    // OTP Kodu Hemen Doldur Butonu
    document.getElementById('btn-autofill-otp-code')?.addEventListener('click', () => {
      if (!currentOtpCode) return;
      const inputEl = document.getElementById('gate-otp-input');
      if (inputEl) {
        inputEl.value = currentOtpCode;
        inputEl.focus();
        window.MCMPlatform?.showToast(
          '⚡ Kod kutuya otomatik yazıldı! "Kodu Onayla" butonuna basabilirsiniz.',
          'success'
        );
      }
    });

    // 6. Kullanıcı Adı ve Şifre Belirleme Formu Submit
    gmailSetupForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const errEl = document.getElementById('gate-setup-error');
      errEl?.classList.add('hidden');

      const username = document.getElementById('gate-setup-username')?.value || '';
      const mcName = document.getElementById('gate-setup-mc-name')?.value || '';
      const password = document.getElementById('gate-setup-password')?.value || '';
      const passwordConfirm = document.getElementById('gate-setup-password-confirm')?.value || '';

      try {
        const session = await svc().authService.registerWithGmailAndOtp({
          email: currentOtpEmail,
          username,
          password,
          passwordConfirm,
          minecraftPlayerName: mcName,
          drivePermissionGranted: currentOtpDriveScope,
          photoUrl: currentOtpPhotoUrl
        });

        gate?.classList.add('hidden');
        window.MCMPlatform?.syncHeaderAndDrawer();

        if (session.isAdminSession) {
          window.MCMPlatform?.navigateToScreen('admin');
          window.MCMPlatform?.showToast(`🛡️ Yönetici oturumu başarıyla oluşturuldu (${session.email})!`, 'success');
        } else {
          window.MCMPlatform?.navigateToScreen('welcome');
          window.MCMPlatform?.showToast(`🎉 Tebrikler ${session.username}! Hesabın başarıyla oluşturuldu.`, 'success');
        }
      } catch (err) {
        renderGateErrorWithCopyButton(errEl, err.message);
      }
    });

    // 🌐 Firebase Google ile Giriş & Drive Senkronizasyonu
    const googleLoginBtn = document.getElementById('btn-firebase-google-login');
    googleLoginBtn?.addEventListener('click', async () => {
      const origHtml = googleLoginBtn.innerHTML;
      try {
        googleLoginBtn.disabled = true;
        googleLoginBtn.innerHTML = `<span>⏳ Google Hesabı Bağlanıyor...</span>`;

        let res = null;
        if (
          window.MCMFirebase &&
          typeof window.MCMFirebase.signInWithGoogleAndDrive === 'function'
        ) {
          res = await window.MCMFirebase.signInWithGoogleAndDrive({ promptConsent: true });
        }

        if (res && res.success && res.user && res.user.email) {
          launchOtpScreen(res.user.email, res.drivePermissionGranted, res.user.photoURL);
          return;
        }

        // Firebase canlı yapılandırılmamışsa veya ortam pop-up desteklemiyorsa temiz Gmail OTP ekranını aç
        window.launchGmailEmailPrompt();
      } catch (err) {
        console.warn('Google pop-up bağlantısı başarısız, Gmail formuna yönlendiriliyor:', err);
        window.launchGmailEmailPrompt();
      } finally {
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = origHtml;
      }
    });

    // Aktif oturum varsa kapıyı gizle
    const activeSession = svc().authService?.getActiveSession();
    if (activeSession) {
      gate?.classList.add('hidden');
      window.MCMPlatform?.syncHeaderAndDrawer();
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && document.getElementById(`screen-${hash}`)) {
        window.MCMPlatform?.navigateToScreen(hash, { skipHistory: true });
      }
    } else {
      gate?.classList.remove('hidden');
    }
  }

  async function handleUserLogout() {
    stopQuestionTimer();
    gameState.active = false;
    try {
      await svc().authService?.logout();
    } catch (e) {
      // ignore
    }
    window.MCMPlatform?.syncHeaderAndDrawer();

    const gate = document.getElementById('access-gate');
    gate?.classList.remove('hidden');
    document.getElementById('tab-btn-login')?.click();
    window.MCMPlatform?.showToast('Hesabınızdan güvenli bir şekilde çıkış yapıldı.', 'info');
  }

  // ==========================================
  // OYUN BUTONLARINI BAĞLA
  // ==========================================
  function bindGameControls() {
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      startNewGameSession(false);
    });

    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      startNewGameSession(false);
    });

    document.getElementById('btn-go-home')?.addEventListener('click', () => {
      window.MCMPlatform?.navigateToScreen('welcome');
    });

    for (let i = 0; i < 4; i++) {
      document.getElementById(`ans-${i}`)?.addEventListener('click', () => {
        handleAnswerSelection(i);
      });
    }

    document.getElementById('lifeline-5050')?.addEventListener('click', useFiftyFifty);
    document.getElementById('lifeline-audience')?.addEventListener('click', useAskAudience);
    document.getElementById('lifeline-villager')?.addEventListener('click', useWiseVillager);

    document.getElementById('btn-walk-away')?.addEventListener('click', () => {
      if (!gameState.active) return;
      finishGameSession({ didWin: false, walkedAway: true });
    });

    // Ekstra Can İkinci Şans Modalı
    document.getElementById('btn-use-extra-life')?.addEventListener('click', () => {
      const modal = document.getElementById('extra-life-modal');
      const session = svc().authService?.getActiveSession();
      if (!modal || !session) return;

      try {
        svc().extraLifeService.consumeExtraLifeInMatch(session.username);
        gameState.extraLifeUsedInMatch = true;
        modal.classList.add('hidden');

        const wrongIdx = Number(modal.dataset.wrongIndex ?? -1);
        if (wrongIdx >= 0) {
          const wrongBtn = document.getElementById(`ans-${wrongIdx}`);
          if (wrongBtn) {
            wrongBtn.disabled = true;
            wrongBtn.classList.add('eliminated');
          }
        }

        for (let i = 0; i < 4; i++) {
          const b = document.getElementById(`ans-${i}`);
          if (b && !b.classList.contains('eliminated')) {
            b.disabled = false;
          }
        }

        window.MCMPlatform?.syncHeaderAndDrawer();
        window.MCMPlatform?.showToast(
          '❤️ 1 Ekstra Can kullanıldı! Yanlış şık elendi, yarışmaya devam edebilirsiniz!',
          'success'
        );
        startQuestionTimer();
      } catch (err) {
        window.MCMPlatform?.showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-skip-extra-life')?.addEventListener('click', () => {
      const modal = document.getElementById('extra-life-modal');
      modal?.classList.add('hidden');
      const qObj = gameState.questions[gameState.currentIndex];
      finishGameSession({
        didWin: false,
        walkedAway: false,
        explanation: qObj?.explanation || ''
      });
    });
  }

  // ==========================================
  // ETKİLEŞİMLİ MINECRAFT CANLI MOB SAHNESİ (ENDERMAN, CREEPER, ALLAY, BİLGE KÖYLÜ)
  // ==========================================
  function initAmbientMobs() {
    const endermanEl = document.getElementById('ambient-mob-enderman');
    const creeperEl = document.getElementById('ambient-mob-creeper');
    const allayEl = document.getElementById('ambient-mob-allay');
    const villagerEl = document.getElementById('ambient-mob-villager');

    const showSpeechBubble = (speechId, duration = 1800) => {
      const bubble = document.getElementById(speechId);
      if (!bubble) return;
      bubble.classList.remove('hidden');
      if (bubble._hideTimer) clearTimeout(bubble._hideTimer);
      bubble._hideTimer = setTimeout(() => {
        bubble.classList.add('hidden');
      }, duration);
    };

    if (endermanEl) {
      const triggerEndermanTeleport = () => {
        soundEngine.endermanTeleport();
        showSpeechBubble('ambient-enderman-speech', 1600);
        endermanEl.classList.add('is-teleporting');
        const offsetX = Math.floor((Math.random() - 0.5) * 220);
        const offsetY = Math.floor(Math.random() * -28);
        endermanEl.style.setProperty('--mob-tx', `${offsetX}px`);
        endermanEl.style.setProperty('--mob-ty', `${offsetY}px`);
        setTimeout(() => {
          endermanEl.classList.remove('is-teleporting');
        }, 550);
      };

      endermanEl.addEventListener('click', triggerEndermanTeleport);
      setInterval(() => {
        if (!document.hidden && Math.random() < 0.55) {
          triggerEndermanTeleport();
        }
      }, 14000);
    }

    if (creeperEl) {
      creeperEl.addEventListener('click', () => {
        soundEngine.creeperHissAndBoom();
        showSpeechBubble('ambient-creeper-speech', 1600);
        creeperEl.classList.remove('is-exploding');
        void creeperEl.offsetWidth;
        creeperEl.classList.add('is-exploding');
        setTimeout(() => {
          creeperEl.classList.remove('is-exploding');
        }, 1200);
      });
    }

    if (allayEl) {
      allayEl.addEventListener('click', () => {
        soundEngine.win();
        showSpeechBubble('ambient-allay-speech', 1800);
        allayEl.classList.remove('is-dancing');
        void allayEl.offsetWidth;
        allayEl.classList.add('is-dancing');
        setTimeout(() => {
          allayEl.classList.remove('is-dancing');
        }, 1400);
      });
    }

    if (villagerEl) {
      villagerEl.addEventListener('click', () => {
        soundEngine.villagerHrmmm();
        showSpeechBubble('ambient-villager-speech', 2200);
        villagerEl.classList.toggle('walked-right');
      });
    }
  }

  function initApp() {
    initAccessGate();
    bindGameControls();
    initAmbientMobs();
    renderPrizeLadder();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  window.startNewGameSession = startNewGameSession;
  window.handleUserLogout = handleUserLogout;
  window.refreshWelcomeScreen = function () {
    window.MCMPlatform?.syncHeaderAndDrawer();
  };
})(window);
