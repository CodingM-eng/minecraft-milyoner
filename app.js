/**
 * KİM MİLYONER OLMAK İSTER? — MINECRAFT EDITION
 * Ana Oyun Motoru, Rastgele Soru Seçici, Jokerler, İstatistik Kayıt Sistemi ve Parçacık Efektleri
 */

(function () {
  'use strict';

  // ==========================================
  // 15 SORULUK ÖDÜL MERDİVENİ (EMERALD)
  // ==========================================
  const PRIZE_LADDER = [
    { level: 1, amount: 100, label: "100 Emerald", milestone: false },
    { level: 2, amount: 200, label: "200 Emerald", milestone: false },
    { level: 3, amount: 500, label: "500 Emerald", milestone: false },
    { level: 4, amount: 1000, label: "1.000 Emerald", milestone: false },
    { level: 5, amount: 2000, label: "2.000 Emerald", milestone: true },
    { level: 6, amount: 5000, label: "5.000 Emerald", milestone: false },
    { level: 7, amount: 10000, label: "10.000 Emerald", milestone: false },
    { level: 8, amount: 20000, label: "20.000 Emerald", milestone: false },
    { level: 9, amount: 50000, label: "50.000 Emerald", milestone: false },
    { level: 10, amount: 100000, label: "100.000 Emerald", milestone: true },
    { level: 11, amount: 250000, label: "250.000 Emerald", milestone: false },
    { level: 12, amount: 500000, label: "500.000 Emerald", milestone: false },
    { level: 13, amount: 750000, label: "750.000 Emerald", milestone: false },
    { level: 14, amount: 1000000, label: "1.000.000 Emerald", milestone: false },
    { level: 15, amount: 5000000, label: "5.000.000 Emerald", milestone: true }
  ];

  const DIFFICULTY_LABELS = {
    easy: "Kolay (1–5)",
    medium: "Orta (6–10)",
    hard: "Zor (11–15)"
  };

  // ==========================================
  // ÖZGÜN PİKSEL-ART SVG ÜRETİCİLERİ
  // ==========================================
  function createEmeraldSVG(size = 24) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; display: inline-block; vertical-align: middle;">
        <path d="M5 1H11V2H12V4H13V12H12V14H11V15H5V14H4V12H3V4H4V2H5V1Z" fill="#084D20"/>
        <path d="M6 2H10V3H11V5H12V11H11V13H10V14H6V13H5V11H4V5H5V3H6V2Z" fill="#17DD62"/>
        <path d="M6 3H9V4H10V6H6V3Z" fill="#86FFAC"/>
        <path d="M5 5H6V10H5V5Z" fill="#86FFAC"/>
        <path d="M7 6H10V11H7V6Z" fill="#12B84F"/>
        <path d="M6 11H10V13H6V11Z" fill="#0B8435"/>
      </svg>
    `;
  }

  function createDiamondSVG(size = 48) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated; display: inline-block; vertical-align: middle;">
        <path d="M5 1H11V2H13V4H14V11H13V13H11V14H9V15H7V14H5V13H3V11H2V4H3V2H5V1Z" fill="#0B3C49"/>
        <path d="M5 2H11V4H13V11H11V13H9V14H7V13H5V11H3V4H5V2Z" fill="#3DE0FF"/>
        <path d="M6 3H10V5H11V7H6V3Z" fill="#B8F6FF"/>
        <path d="M4 5H6V9H4V5Z" fill="#B8F6FF"/>
        <path d="M6 8H11V11H9V12H7V11H6V8Z" fill="#19A7C9"/>
      </svg>
    `;
  }

  function createVillagerSVG(size = 54) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">
        <rect x="3" y="2" width="10" height="12" fill="#BD8B62"/>
        <rect x="3" y="2" width="10" height="2" fill="#A4724B"/>
        <rect x="4" y="5" width="8" height="1" fill="#472E1B"/>
        <rect x="4" y="6" width="2" height="2" fill="#FFFFFF"/>
        <rect x="5" y="6" width="1" height="2" fill="#17DD62"/>
        <rect x="10" y="6" width="2" height="2" fill="#FFFFFF"/>
        <rect x="10" y="6" width="1" height="2" fill="#17DD62"/>
        <rect x="7" y="7" width="2" height="5" fill="#9E6B47"/>
        <rect x="7" y="7" width="1" height="4" fill="#B27D56"/>
        <rect x="5" y="12" width="6" height="1" fill="#69462B"/>
      </svg>
    `;
  }

  // ==========================================
  // İSTATİSTİK VE KAYIT SİSTEMİ (localStorage)
  // ==========================================
  const STATS_STORAGE_KEY = 'mc_millionaire_tr_stats_v1';

  class StatsManager {
    constructor() {
      this.stats = {
        highestPrize: 0,
        highestLevel: 0,
        totalGames: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        totalEmeralds: 0
      };
      this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(STATS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.stats = { ...this.stats, ...parsed };
        }
      } catch (e) {
        console.warn('İstatistikler yüklenemedi:', e);
      }
    }

    save() {
      try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(this.stats));
      } catch (e) {
        console.warn('İstatistikler kaydedilemedi:', e);
      }
      this.updateUI();
    }

    recordGameStart() {
      this.stats.totalGames++;
      this.save();
    }

    recordCorrect(levelReached, currentPrize) {
      this.stats.correctAnswers++;
      if (levelReached > this.stats.highestLevel) {
        this.stats.highestLevel = levelReached;
      }
      if (currentPrize > this.stats.highestPrize) {
        this.stats.highestPrize = currentPrize;
      }
      this.save();
    }

    recordGameEnd(wonAmount, isWrong) {
      if (isWrong) {
        this.stats.wrongAnswers++;
      }
      if (wonAmount > 0) {
        this.stats.totalEmeralds += wonAmount;
        if (wonAmount > this.stats.highestPrize) {
          this.stats.highestPrize = wonAmount;
        }
      }
      this.save();
    }

    reset() {
      this.stats = {
        highestPrize: 0,
        highestLevel: 0,
        totalGames: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        totalEmeralds: 0
      };
      this.save();
    }

    formatNumber(n) {
      return Number(n || 0).toLocaleString('tr-TR');
    }

    updateUI() {
      const prizeStr = `${this.formatNumber(this.stats.highestPrize)} Emerald`;
      const levelStr = `${this.stats.highestLevel} / 15`;
      const totalEmStr = `${this.formatNumber(this.stats.totalEmeralds)} Emerald`;

      // Ana Menü Özet İstatistikler
      const menuPrize = document.getElementById('menu-best-prize');
      const menuLevel = document.getElementById('menu-best-level');
      const menuGames = document.getElementById('menu-games-played');
      if (menuPrize) menuPrize.textContent = prizeStr;
      if (menuLevel) menuLevel.textContent = levelStr;
      if (menuGames) menuGames.textContent = this.formatNumber(this.stats.totalGames);

      // İstatistikler Modalı
      const sPrize = document.getElementById('stat-highest-prize');
      const sLevel = document.getElementById('stat-highest-level');
      const sGames = document.getElementById('stat-total-games');
      const sCorrect = document.getElementById('stat-correct-answers');
      const sWrong = document.getElementById('stat-wrong-answers');
      const sTotalEm = document.getElementById('stat-total-emeralds');

      if (sPrize) sPrize.textContent = prizeStr;
      if (sLevel) sLevel.textContent = levelStr;
      if (sGames) sGames.textContent = this.formatNumber(this.stats.totalGames);
      if (sCorrect) sCorrect.textContent = this.formatNumber(this.stats.correctAnswers);
      if (sWrong) sWrong.textContent = this.formatNumber(this.stats.wrongAnswers);
      if (sTotalEm) sTotalEm.textContent = totalEmStr;
    }
  }

  // ==========================================
  // MİNECRAFT GECE/GÜNDÜZ ATMOSFERİ VE PARÇACIK MOTORU
  // ==========================================
  class ParticleEngine {
    constructor() {
      this.bgCanvas = document.getElementById('bg-canvas');
      this.fxCanvas = document.getElementById('fx-canvas');
      this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
      this.fxCtx = this.fxCanvas ? this.fxCanvas.getContext('2d') : null;

      this.isNight = true;
      this.bgBlocks = [];
      this.stars = [];
      this.fxParticles = [];

      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.initBgElements();
      this.animate();
    }

    setAtmosphere(isNight) {
      this.isNight = isNight;
      document.body.classList.toggle('atmos-night', isNight);
      document.body.classList.toggle('atmos-day', !isNight);
    }

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (this.bgCanvas) {
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
      }
      if (this.fxCanvas) {
        this.fxCanvas.width = w;
        this.fxCanvas.height = h;
      }
    }

    initBgElements() {
      // Floating Emerald, Diamond, Gold & Stone pixel cubes
      const types = [
        { color: '#17dd62', border: '#86ffac' }, // Emerald
        { color: '#3de0ff', border: '#b8f6ff' }, // Diamond
        { color: '#ffbe1a', border: '#ffe885' }, // Gold
        { color: '#374151', border: '#6b7280' }  // Stone/Obsidian
      ];

      this.bgBlocks = [];
      for (let i = 0; i < 38; i++) {
        const t = types[Math.floor(Math.random() * types.length)];
        this.bgBlocks.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: 8 + Math.floor(Math.random() * 14),
          speedY: -0.22 - Math.random() * 0.5,
          speedX: (Math.random() - 0.5) * 0.28,
          color: t.color,
          border: t.border,
          alpha: 0.12 + Math.random() * 0.22
        });
      }

      // Pixel stars for Night / Clouds for Day
      this.stars = [];
      for (let i = 0; i < 45; i++) {
        this.stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * (window.innerHeight * 0.65),
          size: 2 + Math.floor(Math.random() * 3),
          twinkleSpeed: 0.02 + Math.random() * 0.04,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    spawnBurst(x, y, type = 'emerald', count = 42) {
      const palettes = {
        emerald: ['#17dd62', '#86ffac', '#12b84f', '#ffbe1a', '#3de0ff'],
        damage: ['#ff3b3b', '#b31919', '#fca5a5', '#52525b'],
        victory: ['#17dd62', '#3de0ff', '#ffbe1a', '#b66dff', '#ffffff']
      };
      const colors = palettes[type] || palettes.emerald;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.2 + Math.random() * 8;
        this.fxParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.6,
          size: 5 + Math.floor(Math.random() * 8),
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.013 + Math.random() * 0.015,
          gravity: 0.16
        });
      }
    }

    animate() {
      if (this.bgCtx && this.bgCanvas) {
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;
        this.bgCtx.clearRect(0, 0, w, h);

        // Draw blocky Moon (Night) or blocky Sun (Day) in top-right sky
        const celestialX = Math.max(w - 140, 60);
        const celestialY = 85;
        if (this.isNight) {
          // Pixel Moon
          this.bgCtx.fillStyle = 'rgba(226, 232, 240, 0.16)';
          this.bgCtx.fillRect(celestialX - 8, celestialY - 8, 60, 60);
          this.bgCtx.fillStyle = 'rgba(248, 250, 252, 0.35)';
          this.bgCtx.fillRect(celestialX, celestialY, 44, 44);

          // Twinkling Pixel Stars
          for (const s of this.stars) {
            s.phase += s.twinkleSpeed;
            const a = 0.15 + (Math.sin(s.phase) * 0.5 + 0.5) * 0.35;
            this.bgCtx.fillStyle = `rgba(255, 255, 255, ${a})`;
            this.bgCtx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
          }
        } else {
          // Pixel Sun
          this.bgCtx.fillStyle = 'rgba(255, 190, 26, 0.18)';
          this.bgCtx.fillRect(celestialX - 10, celestialY - 10, 68, 68);
          this.bgCtx.fillStyle = 'rgba(253, 224, 71, 0.42)';
          this.bgCtx.fillRect(celestialX, celestialY, 48, 48);
        }

        // Floating Pixel Blocks & Gems
        for (const b of this.bgBlocks) {
          b.y += b.speedY;
          b.x += b.speedX;
          if (b.y < -24) {
            b.y = h + 24;
            b.x = Math.random() * w;
          }
          if (b.x < -24) b.x = w + 24;
          if (b.x > w + 24) b.x = -24;

          const bx = Math.floor(b.x);
          const by = Math.floor(b.y);
          this.bgCtx.globalAlpha = b.alpha;
          this.bgCtx.fillStyle = b.color;
          this.bgCtx.fillRect(bx, by, b.size, b.size);
          this.bgCtx.fillStyle = b.border;
          this.bgCtx.fillRect(bx, by, b.size, 2);
        }
        this.bgCtx.globalAlpha = 1;
      }

      // Render Foreground Burst Particles
      if (this.fxCtx && this.fxCanvas) {
        const w = this.fxCanvas.width;
        const h = this.fxCanvas.height;
        this.fxCtx.clearRect(0, 0, w, h);

        for (let i = this.fxParticles.length - 1; i >= 0; i--) {
          const p = this.fxParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            this.fxParticles.splice(i, 1);
            continue;
          }

          this.fxCtx.globalAlpha = Math.max(0, p.alpha);
          this.fxCtx.fillStyle = p.color;
          this.fxCtx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        }
        this.fxCtx.globalAlpha = 1;
      }

      requestAnimationFrame(() => this.animate());
    }
  }

  // ==========================================
  // ANA OYUN KONTROLCÜSÜ
  // ==========================================
  class MinecraftMillionaireGame {
    constructor() {
      this.statsManager = new StatsManager();
      this.particles = new ParticleEngine();

      // Oyun Durumu: 'MENU' | 'QUESTION' | 'ANSWER_SELECTED' | 'CORRECT_REVEAL' | 'WRONG_REVEAL' | 'GAMEOVER' | 'VICTORY'
      this.state = 'MENU';
      this.currentLevelIndex = 0; // 0..14 (Soru 1..15)
      this.usedQuestionIds = new Set(); // Aynı oyunda kesinlikle tekrar etmemesi için kullanılan ID'ler
      this.lastQuestionIdsAcrossGames = []; // Arka arkaya yeni oyunlarda ilk soruların bile farklı gelmesi için
      this.lastCategory = null; // Aynı kategorinin üst üste gelmesini önlemek için
      this.currentQuestion = null;
      this.eliminatedIndices = new Set();

      this.jokers = {
        fiftyFifty: false,
        audience: false,
        villager: false,
        change: false
      };

      this.suspenseTimeout = null;
      this.victoryConfettiInterval = null;

      this.initIcons();
      this.buildMoneyLadder();
      this.bindEvents();
      this.syncAudioUI();
      this.statsManager.updateUI();
    }

    initIcons() {
      const headerEmerald = document.getElementById('header-emerald-icon');
      const heroLeft = document.getElementById('hero-emerald-left');
      const heroRight = document.getElementById('hero-diamond-right');
      const sidebarEmerald = document.getElementById('sidebar-emerald-icon');
      const victoryEmerald = document.getElementById('victory-huge-emerald');

      if (headerEmerald) headerEmerald.innerHTML = createEmeraldSVG(24);
      if (heroLeft) heroLeft.innerHTML = createEmeraldSVG(50);
      if (heroRight) heroRight.innerHTML = createDiamondSVG(50);
      if (sidebarEmerald) sidebarEmerald.innerHTML = createEmeraldSVG(22);
      if (victoryEmerald) victoryEmerald.innerHTML = createEmeraldSVG(94);
    }

    buildMoneyLadder() {
      const listEl = document.getElementById('money-ladder-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      const reversed = [...PRIZE_LADDER].reverse();
      reversed.forEach(item => {
        const li = document.createElement('li');
        li.className = `ladder-step ${item.milestone ? 'milestone' : ''}`;
        li.id = `ladder-step-${item.level}`;
        li.innerHTML = `
          <span class="ladder-step-num">${item.level}</span>
          <span class="ladder-step-prize">
            ${createEmeraldSVG(16)}
            <span>${item.label}</span>
          </span>
        `;
        listEl.appendChild(li);
      });
    }

    updateMoneyLadderUI() {
      const currentLvl = this.currentLevelIndex + 1;
      PRIZE_LADDER.forEach(item => {
        const el = document.getElementById(`ladder-step-${item.level}`);
        if (!el) return;
        el.classList.remove('active', 'passed');
        if (item.level === currentLvl) {
          el.classList.add('active');
        } else if (item.level < currentLvl) {
          el.classList.add('passed');
        }
      });
    }

    // 1–5. sorular: "easy", 6–10. sorular: "medium", 11–15. sorular: "hard"
    getDifficultyForLevel(levelNumber) {
      if (levelNumber <= 5) return 'easy';
      if (levelNumber <= 10) return 'medium';
      return 'hard';
    }

    // Fisher-Yates Kripto Destekli Rastgele Karıştırma
    shuffleArray(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        let rand;
        if (window.crypto && window.crypto.getRandomValues) {
          const buf = new Uint32Array(1);
          window.crypto.getRandomValues(buf);
          rand = buf[0] / (0xffffffff + 1);
        } else {
          rand = Math.random();
        }
        const j = Math.floor(rand * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    /**
     * RASTGELE VE ADİL SORU SEÇİM SİSTEMİ
     * - Aynı oyunda kullanılan bir soru kesinlikle tekrar seçilmez.
     * - Zorluk seviyesine ("easy", "medium", "hard") uygun havuzdan seçilir.
     * - Bir önceki sorunun kategorisiyle aynı kategoriden kaçınılır (mümkünse farklı kategori seçilir).
     * - Şıkların (A, B, C, D) dizilimi de her soruda rastgele karıştırılır ve doğru cevap yalnızca hafızada tutulur.
     */
    pickQuestionForDifficulty(difficulty) {
      const allQuestions = window.QUESTIONS_DB || [];

      // 1. Bu oyunda henüz hiç kullanılmamış ve ilgili zorluktaki sorular
      let pool = allQuestions.filter(
        q => q.difficulty === difficulty && !this.usedQuestionIds.has(q.id)
      );

      // 2. Eğer bir önceki sorunun kategorisinden farklı kategoride sorular varsa önceliği onlara ver
      if (this.lastCategory) {
        const diffCategoryPool = pool.filter(q => q.category !== this.lastCategory);
        if (diffCategoryPool.length > 0) {
          pool = diffCategoryPool;
        }
      }

      // 3. Eğer önceki oyunda yeni çıkmış sorular dışında alternatif varsa onları tercih et (her yeni oyunda bambaşka sıra için)
      if (this.lastQuestionIdsAcrossGames.length > 0) {
        const freshAcrossGames = pool.filter(q => !this.lastQuestionIdsAcrossGames.includes(q.id));
        if (freshAcrossGames.length > 0) {
          pool = freshAcrossGames;
        }
      }

      // Güvenlik: Havuz boşaldıysa (imkansıza yakın ama güvenlik için) kullanılmamış herhangi bir soruyu al
      if (pool.length === 0) {
        pool = allQuestions.filter(q => !this.usedQuestionIds.has(q.id));
      }

      const shuffledPool = this.shuffleArray(pool);
      const chosen = shuffledPool[0];

      this.usedQuestionIds.add(chosen.id);
      this.lastCategory = chosen.category;

      // Son 25 soruyu oyunlar arası hafızada tut ki arka arkaya başlatılan oyunlarda bile aynı sorular gelmesin
      this.lastQuestionIdsAcrossGames.push(chosen.id);
      if (this.lastQuestionIdsAcrossGames.length > 25) {
        this.lastQuestionIdsAcrossGames.shift();
      }

      // Şıkları da karıştır
      const indexedAnswers = chosen.answers.map((text, idx) => ({
        text,
        isCorrect: idx === chosen.correctAnswer
      }));
      const shuffledAnswers = this.shuffleArray(indexedAnswers);

      // Doğru cevabı DOM üzerinde hiçbir attribute olarak açık etmeden yalnızca bu nesnede sakla
      return {
        id: chosen.id,
        question: chosen.question,
        answers: shuffledAnswers.map(a => a.text),
        correctAnswer: shuffledAnswers.findIndex(a => a.isCorrect),
        difficulty: chosen.difficulty,
        category: chosen.category,
        explanation: chosen.explanation
      };
    }

    showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(sec => {
        sec.classList.remove('active');
      });
      const target = document.getElementById(screenId);
      if (target) {
        target.classList.add('active');
      }
    }

    // ==========================================
    // YENİ OYUN BAŞLAT / MENÜYE DÖN
    // ==========================================
    startNewGame() {
      this.clearTimers();
      this.currentLevelIndex = 0;
      this.usedQuestionIds.clear();
      this.eliminatedIndices.clear();
      this.lastCategory = null;

      this.jokers = {
        fiftyFifty: false,
        audience: false,
        villager: false,
        change: false
      };

      this.statsManager.recordGameStart();
      this.updateJokerButtonsUI();
      this.showScreen('screen-game');
      window.soundManager.startMusic('game');
      this.loadCurrentLevelQuestion();
    }

    returnToMainMenu() {
      this.clearTimers();
      this.state = 'MENU';
      this.showScreen('screen-menu');
      window.soundManager.startMusic('menu');
      this.statsManager.updateUI();
    }

    clearTimers() {
      if (this.suspenseTimeout) {
        clearTimeout(this.suspenseTimeout);
        this.suspenseTimeout = null;
      }
      if (this.victoryConfettiInterval) {
        clearInterval(this.victoryConfettiInterval);
        this.victoryConfettiInterval = null;
      }
      window.soundManager.stopSuspense();
    }

    // ==========================================
    // SORUYU EKRANA YÜKLE
    // ==========================================
    loadCurrentLevelQuestion(isChangedQuestion = false) {
      this.state = 'QUESTION';
      this.eliminatedIndices.clear();

      const levelNumber = this.currentLevelIndex + 1;
      const difficulty = this.getDifficultyForLevel(levelNumber);
      const prizeObj = PRIZE_LADDER[this.currentLevelIndex];

      this.currentQuestion = this.pickQuestionForDifficulty(difficulty);

      // Üst Bilgi Çubuğunu Güncelle
      document.getElementById('current-level-badge').textContent = `Soru ${levelNumber} / 15`;
      document.getElementById('current-difficulty-badge').textContent = DIFFICULTY_LABELS[difficulty];
      document.getElementById('current-category-badge').textContent = this.currentQuestion.category;
      document.getElementById('current-target-prize').textContent = prizeObj.label;
      document.getElementById('question-number-title').textContent = `Soru ${levelNumber} / 15`;

      // Soru Kartı Geçiş Animasyonu
      const qCard = document.getElementById('question-card');
      if (qCard) {
        qCard.classList.remove('changing');
        void qCard.offsetWidth;
        qCard.classList.add('changing');
      }

      document.getElementById('question-text').textContent = this.currentQuestion.question;

      // Joker ve Açıklama Panellerini Gizle
      const jokerPanel = document.getElementById('joker-feedback-panel');
      if (jokerPanel) {
        jokerPanel.classList.add('hidden');
        jokerPanel.innerHTML = '';
      }

      const expPanel = document.getElementById('explanation-panel');
      if (expPanel) expPanel.classList.add('hidden');

      // 4 Cevap Butonunu Doldur
      for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`answer-btn-${i}`);
        const textEl = document.getElementById(`answer-text-${i}`);
        const pctEl = document.getElementById(`answer-percent-${i}`);

        if (textEl) textEl.textContent = this.currentQuestion.answers[i];
        if (pctEl) {
          pctEl.classList.add('hidden');
          pctEl.textContent = '%0';
        }
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('selected', 'correct', 'wrong', 'eliminated');
        }
      }

      this.updateMoneyLadderUI();
      this.updateJokerButtonsUI();
    }

    // ==========================================
    // CEVAP SEÇİMİ VE GERİLİM SÜRESİ
    // ==========================================
    selectAnswer(index) {
      if (this.state !== 'QUESTION') return;
      if (this.eliminatedIndices.has(index)) return;

      this.state = 'ANSWER_SELECTED';

      // Gerilim süresince tüm butonları kilitle
      for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`answer-btn-${i}`);
        if (btn) btn.disabled = true;
      }
      this.updateJokerButtonsUI();

      // 1. Seçilen cevap sarı/parlak renkte vurgulansın
      const selectedBtn = document.getElementById(`answer-btn-${index}`);
      if (selectedBtn) {
        selectedBtn.classList.add('selected');
      }

      // 2. Cevap seçme ve gerilim sesi oynasın
      window.soundManager.playAnswerSelect();
      window.soundManager.playSuspense(1650);

      // 3. Kısa bekleme süresi (1.65 saniye) sonunda cevabı açıkla
      this.suspenseTimeout = setTimeout(() => {
        this.revealAnswer(index);
      }, 1650);
    }

    revealAnswer(selectedIndex) {
      const correctIndex = this.currentQuestion.correctAnswer;
      const selectedBtn = document.getElementById(`answer-btn-${selectedIndex}`);
      const correctBtn = document.getElementById(`answer-btn-${correctIndex}`);

      if (selectedBtn) selectedBtn.classList.remove('selected');

      if (selectedIndex === correctIndex) {
        // DOĞRU CEVAP!
        this.state = 'CORRECT_REVEAL';
        if (correctBtn) correctBtn.classList.add('correct');

        window.soundManager.playCorrect();

        if (correctBtn) {
          const rect = correctBtn.getBoundingClientRect();
          this.particles.spawnBurst(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            'emerald',
            45
          );
        }

        const levelReached = this.currentLevelIndex + 1;
        const prizeEarned = PRIZE_LADDER[this.currentLevelIndex].amount;
        this.statsManager.recordCorrect(levelReached, prizeEarned);

        // Bilgi / Açıklama Kutusu ve Sonraki Soru Butonu
        const expPanel = document.getElementById('explanation-panel');
        const expText = document.getElementById('explanation-text');
        const nextLabel = document.getElementById('btn-next-label');

        if (expText) expText.textContent = this.currentQuestion.explanation;
        if (nextLabel) {
          nextLabel.textContent = levelReached === 15
            ? '🏆 BÜYÜK ÖDÜLÜ AL! ➔'
            : 'SONRAKİ SORU ➔';
        }
        if (expPanel) expPanel.classList.remove('hidden');

      } else {
        // YANLIŞ CEVAP!
        this.state = 'WRONG_REVEAL';
        if (selectedBtn) selectedBtn.classList.add('wrong');
        if (correctBtn) correctBtn.classList.add('correct');

        window.soundManager.playWrong();

        if (selectedBtn) {
          const rect = selectedBtn.getBoundingClientRect();
          this.particles.spawnBurst(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            'damage',
            36
          );
        }

        // Oyuncu doğru cevabı yeşil olarak gördükten 1.8 saniye sonra Oyun Bitti ekranına geç
        this.suspenseTimeout = setTimeout(() => {
          this.triggerGameOver(selectedIndex);
        }, 1800);
      }
    }

    proceedToNextQuestion() {
      if (this.state !== 'CORRECT_REVEAL') return;

      if (this.currentLevelIndex >= 14) {
        // 15. soru da tamamlandı -> MİLYONER!
        this.triggerVictory();
      } else {
        this.currentLevelIndex++;
        this.loadCurrentLevelQuestion();
      }
    }

    getGuaranteedPrizeOnLoss() {
      // Baraj sistemi: 5. soru geçildiyse 2.000 Emerald, 10. soru geçildiyse 100.000 Emerald garanti
      const completedLevels = this.currentLevelIndex; // 0..14
      if (completedLevels >= 10) return 100000;
      if (completedLevels >= 5) return 2000;
      return 0;
    }

    triggerGameOver(selectedIndex) {
      this.state = 'GAMEOVER';
      window.soundManager.stopMusicLoop();

      const letters = ['A', 'B', 'C', 'D'];
      const correctIdx = this.currentQuestion.correctAnswer;
      const guaranteedPrize = this.getGuaranteedPrizeOnLoss();

      this.statsManager.recordGameEnd(guaranteedPrize, true);

      document.getElementById('gameover-user-answer').textContent =
        `${letters[selectedIndex]}) ${this.currentQuestion.answers[selectedIndex]}`;
      document.getElementById('gameover-correct-answer').textContent =
        `${letters[correctIdx]}) ${this.currentQuestion.answers[correctIdx]}`;
      document.getElementById('gameover-explanation').textContent =
        this.currentQuestion.explanation;

      document.getElementById('gameover-level').textContent = `Soru ${this.currentLevelIndex + 1} / 15`;
      document.getElementById('gameover-prize').textContent =
        `${guaranteedPrize.toLocaleString('tr-TR')} Emerald`;
      document.getElementById('gameover-correct-count').textContent = `${this.currentLevelIndex}`;
      document.getElementById('gameover-wrong-count').textContent = '1';

      this.showScreen('screen-gameover');
    }

    triggerVictory() {
      this.state = 'VICTORY';
      window.soundManager.stopMusicLoop();
      window.soundManager.playVictory();

      this.statsManager.recordGameEnd(5000000, false);

      const usedCount = Object.values(this.jokers).filter(Boolean).length;
      document.getElementById('victory-jokers-used').textContent = `${usedCount} / 4`;

      this.showScreen('screen-victory');

      this.particles.spawnBurst(window.innerWidth * 0.3, window.innerHeight * 0.35, 'victory', 65);
      this.particles.spawnBurst(window.innerWidth * 0.7, window.innerHeight * 0.35, 'victory', 65);

      this.victoryConfettiInterval = setInterval(() => {
        if (this.state !== 'VICTORY') return;
        const rx = window.innerWidth * (0.18 + Math.random() * 0.64);
        const ry = window.innerHeight * (0.18 + Math.random() * 0.45);
        this.particles.spawnBurst(rx, ry, 'victory', 34);
      }, 1350);
    }

    // ==========================================
    // 4 İNTERAKTİF JOKER MEKANİĞİ
    // ==========================================
    updateJokerButtonsUI() {
      const canUse = this.state === 'QUESTION';
      const map = [
        { id: 'joker-5050', used: this.jokers.fiftyFifty },
        { id: 'joker-audience', used: this.jokers.audience },
        { id: 'joker-villager', used: this.jokers.villager },
        { id: 'joker-change', used: this.jokers.change }
      ];

      map.forEach(item => {
        const btn = document.getElementById(item.id);
        if (!btn) return;
        btn.disabled = !canUse || item.used;
        btn.classList.toggle('used', item.used);
      });
    }

    // 1. %50 / 50 Jokeri: İki yanlış cevabı kaldırır
    useJokerFiftyFifty() {
      if (this.state !== 'QUESTION' || this.jokers.fiftyFifty) return;
      this.jokers.fiftyFifty = true;
      window.soundManager.playFiftyFifty();

      const correctIdx = this.currentQuestion.correctAnswer;
      const wrongIndices = [0, 1, 2, 3].filter(
        i => i !== correctIdx && !this.eliminatedIndices.has(i)
      );

      const shuffledWrong = this.shuffleArray(wrongIndices);
      const toRemove = shuffledWrong.slice(0, 2);

      toRemove.forEach(idx => {
        this.eliminatedIndices.add(idx);
        const btn = document.getElementById(`answer-btn-${idx}`);
        if (btn) {
          btn.disabled = true;
          btn.classList.add('eliminated');
          const rect = btn.getBoundingClientRect();
          this.particles.spawnBurst(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            'damage',
            18
          );
        }
      });

      this.updateJokerButtonsUI();
    }

    // 2. Seyirciye Sor Jokeri: A, B, C, D için gerçekçi rastgele yüzdeler üretir
    useJokerAudience() {
      if (this.state !== 'QUESTION' || this.jokers.audience) return;
      this.jokers.audience = true;
      window.soundManager.playAudience();

      const correctIdx = this.currentQuestion.correctAnswer;
      const activeIndices = [0, 1, 2, 3].filter(i => !this.eliminatedIndices.has(i));

      const diff = this.currentQuestion.difficulty;
      const baseBoost = diff === 'easy' ? 68 : diff === 'medium' ? 56 : 45;
      const percentages = [0, 0, 0, 0];

      let remaining = 100;
      const correctPct = Math.min(
        remaining - (activeIndices.length - 1) * 4,
        baseBoost + Math.floor((Math.random() - 0.5) * 16)
      );
      percentages[correctIdx] = correctPct;
      remaining -= correctPct;

      const otherActive = this.shuffleArray(activeIndices.filter(i => i !== correctIdx));
      otherActive.forEach((idx, pos) => {
        if (pos === otherActive.length - 1) {
          percentages[idx] = remaining;
        } else {
          const share = Math.floor(Math.random() * (remaining + 1));
          percentages[idx] = share;
          remaining -= share;
        }
      });

      const letters = ['A', 'B', 'C', 'D'];
      const panel = document.getElementById('joker-feedback-panel');
      if (panel) {
        panel.classList.remove('hidden');
        panel.innerHTML = `
          <div class="audience-poll-wrap">
            <div class="audience-header">
              <span>👥 MİNECRAFT SEYİRCİ OYLAMASI SONUÇLARI:</span>
              <span>${letters.map((l, i) => `${l} — %${percentages[i]}`).join(' | ')}</span>
            </div>
            <div class="audience-bars-grid">
              ${letters.map((letter, idx) => `
                <div class="audience-bar-col">
                  <div class="audience-bar-pct">%${percentages[idx]}</div>
                  <div class="audience-bar-track">
                    <div class="audience-bar-fill" id="aud-bar-${idx}" style="height: 0%;"></div>
                  </div>
                  <div class="audience-bar-label">${letter}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        setTimeout(() => {
          percentages.forEach((pct, idx) => {
            const bar = document.getElementById(`aud-bar-${idx}`);
            if (bar) bar.style.height = `${pct}%`;

            const tag = document.getElementById(`answer-percent-${idx}`);
            if (tag && !this.eliminatedIndices.has(idx)) {
              tag.textContent = `%${pct}`;
              tag.classList.remove('hidden');
            }
          });
        }, 50);
      }

      this.updateJokerButtonsUI();
    }

    // 3. Köylüye Sor Jokeri: Köylü karakteri ipucu verir (her zaman %100 kesin doğru söylemez)
    useJokerVillager() {
      if (this.state !== 'QUESTION' || this.jokers.villager) return;
      this.jokers.villager = true;
      window.soundManager.playVillager();

      const letters = ['A', 'B', 'C', 'D'];
      const correctIdx = this.currentQuestion.correctAnswer;
      const diff = this.currentQuestion.difficulty;

      // Köylünün doğru bilme ihtimali: Kolayda %90, Ortada %82, Zorda %74
      const accuracyChance = diff === 'easy' ? 0.90 : diff === 'medium' ? 0.82 : 0.74;
      const tellsTruth = Math.random() < accuracyChance;

      let suggestedIdx = correctIdx;
      if (!tellsTruth) {
        const wrongChoices = [0, 1, 2, 3].filter(
          i => i !== correctIdx && !this.eliminatedIndices.has(i)
        );
        if (wrongChoices.length > 0) {
          suggestedIdx = wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
        }
      }

      const suggestedLetter = letters[suggestedIdx];
      const suggestedText = this.currentQuestion.answers[suggestedIdx];

      const templates = [
        `"Hmm... Hmm... Bence cevap <strong>${suggestedLetter}) ${suggestedText}</strong> olabilir. Kütüphanedeki parşömenlerde öyle görmüştüm!"`,
        `"Hrmmm! Köy meydanında gezgin tüccarla konuşmuştuk, büyük ihtimalle doğru şık <strong>${suggestedLetter} (${suggestedText})</strong> ama yine de dikkatli ol!"`,
        `"Hmm... 5 Emerald verirsen söylerim... Şaka şaka! Bana kalırsa cevap <strong>${suggestedLetter}) ${suggestedText}</strong> seçeneği."`
      ];
      const chosenLine = templates[Math.floor(Math.random() * templates.length)];

      const panel = document.getElementById('joker-feedback-panel');
      if (panel) {
        panel.classList.remove('hidden');
        panel.innerHTML = `
          <div class="villager-dialogue-wrap">
            <div class="villager-avatar">${createVillagerSVG(54)}</div>
            <div class="villager-speech">
              <div class="villager-name">🧑‍🌾 BİLGE KÖYLÜ (Usta Kütüphaneci)</div>
              <p class="villager-text">${chosenLine}</p>
            </div>
          </div>
        `;
      }

      this.updateJokerButtonsUI();
    }

    // 4. Soruyu Değiştir Jokeri: Aynı zorluk seviyesinden yeni, rastgele ve kullanılmamış bir soru getirir
    useJokerChangeQuestion() {
      if (this.state !== 'QUESTION' || this.jokers.change) return;
      this.jokers.change = true;
      window.soundManager.playChangeQuestion();

      const qCard = document.getElementById('question-card');
      if (qCard) {
        const rect = qCard.getBoundingClientRect();
        this.particles.spawnBurst(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          'emerald',
          30
        );
      }

      this.loadCurrentLevelQuestion(true);
    }

    // ==========================================
    // SES VE ATMOSFER ARAYÜZ SENKRONİZASYONU
    // ==========================================
    syncAudioUI() {
      const sm = window.soundManager;

      const qMusicBtn = document.getElementById('btn-quick-music');
      const qMusicIcon = document.getElementById('quick-music-icon');
      const qMusicLabel = document.getElementById('quick-music-label');

      const qSfxBtn = document.getElementById('btn-quick-sfx');
      const qSfxIcon = document.getElementById('quick-sfx-icon');
      const qSfxLabel = document.getElementById('quick-sfx-label');

      if (qMusicBtn) qMusicBtn.classList.toggle('muted', !sm.musicEnabled);
      if (qMusicIcon) qMusicIcon.textContent = sm.musicEnabled ? '🎵' : '🔇';
      if (qMusicLabel) qMusicLabel.textContent = sm.musicEnabled ? 'MÜZİK: AÇIK' : 'MÜZİK: KAPALI';

      if (qSfxBtn) qSfxBtn.classList.toggle('muted', !sm.sfxEnabled);
      if (qSfxIcon) qSfxIcon.textContent = sm.sfxEnabled ? '🔊' : '🔈';
      if (qSfxLabel) qSfxLabel.textContent = sm.sfxEnabled ? 'EFEKT: AÇIK' : 'EFEKT: KAPALI';

      const toggleMusicBtn = document.getElementById('toggle-music-btn');
      const toggleMusicText = document.getElementById('toggle-music-text');
      const toggleSfxBtn = document.getElementById('toggle-sfx-btn');
      const toggleSfxText = document.getElementById('toggle-sfx-text');

      if (toggleMusicBtn) {
        toggleMusicBtn.className = `mc-btn mc-btn-small ${sm.musicEnabled ? 'mc-btn-emerald' : 'mc-btn-danger'}`;
      }
      if (toggleMusicText) toggleMusicText.textContent = sm.musicEnabled ? 'AÇIK' : 'KAPALI';

      if (toggleSfxBtn) {
        toggleSfxBtn.className = `mc-btn mc-btn-small ${sm.sfxEnabled ? 'mc-btn-emerald' : 'mc-btn-danger'}`;
      }
      if (toggleSfxText) toggleSfxText.textContent = sm.sfxEnabled ? 'AÇIK' : 'KAPALI';

      const musicSlider = document.getElementById('slider-music-vol');
      const musicLabel = document.getElementById('music-vol-label');
      const sfxSlider = document.getElementById('slider-sfx-vol');
      const sfxLabel = document.getElementById('sfx-vol-label');

      const mPct = Math.round(sm.musicVolume * 100);
      const sPct = Math.round(sm.sfxVolume * 100);

      if (musicSlider) musicSlider.value = mPct;
      if (musicLabel) musicLabel.textContent = `%${mPct}`;
      if (sfxSlider) sfxSlider.value = sPct;
      if (sfxLabel) sfxLabel.textContent = `%${sPct}`;
    }

    // ==========================================
    // BUTON VE KLAVYE ETKİLEŞİMLERİ
    // ==========================================
    bindEvents() {
      const clickAndRun = (id, fn) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', () => {
          window.soundManager.playClick();
          fn();
        });
      };

      // Ana Menü Butonları
      clickAndRun('btn-start-game', () => this.startNewGame());
      clickAndRun('btn-open-rules', () => this.openModal('modal-rules'));
      clickAndRun('btn-open-audio', () => this.openModal('modal-audio'));
      clickAndRun('btn-open-stats', () => {
        this.statsManager.updateUI();
        this.openModal('modal-stats');
      });

      // Üst Çubuk Butonları
      clickAndRun('top-brand-btn', () => this.returnToMainMenu());
      clickAndRun('btn-top-stats', () => {
        this.statsManager.updateUI();
        this.openModal('modal-stats');
      });
      clickAndRun('btn-top-settings', () => this.openModal('modal-audio'));

      // Gece / Gündüz Atmosfer Butonu
      clickAndRun('btn-toggle-atmos', () => {
        const nextNight = !this.particles.isNight;
        this.particles.setAtmosphere(nextNight);
        const icon = document.getElementById('atmos-icon');
        const label = document.getElementById('atmos-label');
        if (icon) icon.textContent = nextNight ? '🌙' : '☀️';
        if (label) label.textContent = nextNight ? 'ATMOSFER: GECE' : 'ATMOSFER: GÜNDÜZ';
      });

      clickAndRun('btn-quick-music', () => {
        window.soundManager.setMusicEnabled(!window.soundManager.musicEnabled);
        if (window.soundManager.musicEnabled && !window.soundManager.currentMusicMode) {
          window.soundManager.startMusic(this.state === 'MENU' ? 'menu' : 'game');
        }
        this.syncAudioUI();
      });

      clickAndRun('btn-quick-sfx', () => {
        window.soundManager.setSfxEnabled(!window.soundManager.sfxEnabled);
        this.syncAudioUI();
      });

      // Oyun Ekranı Butonları
      clickAndRun('btn-quit-menu', () => this.returnToMainMenu());
      clickAndRun('btn-next-question', () => this.proceedToNextQuestion());

      // 4 Joker Butonu
      clickAndRun('joker-5050', () => this.useJokerFiftyFifty());
      clickAndRun('joker-audience', () => this.useJokerAudience());
      clickAndRun('joker-villager', () => this.useJokerVillager());
      clickAndRun('joker-change', () => this.useJokerChangeQuestion());

      // Cevap Şıkları (A, B, C, D)
      for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`answer-btn-${i}`);
        if (btn) {
          btn.addEventListener('click', () => this.selectAnswer(i));
        }
      }

      // Zafer ve Oyun Bitti Ekranı Butonları
      clickAndRun('btn-victory-restart', () => this.startNewGame());
      clickAndRun('btn-victory-menu', () => this.returnToMainMenu());
      clickAndRun('btn-gameover-restart', () => this.startNewGame());
      clickAndRun('btn-gameover-menu', () => this.returnToMainMenu());

      // Ses Ayarları Modalı
      clickAndRun('toggle-music-btn', () => {
        window.soundManager.setMusicEnabled(!window.soundManager.musicEnabled);
        if (window.soundManager.musicEnabled && !window.soundManager.currentMusicMode) {
          window.soundManager.startMusic(this.state === 'MENU' ? 'menu' : 'game');
        }
        this.syncAudioUI();
      });

      clickAndRun('toggle-sfx-btn', () => {
        window.soundManager.setSfxEnabled(!window.soundManager.sfxEnabled);
        this.syncAudioUI();
      });

      const musicSlider = document.getElementById('slider-music-vol');
      if (musicSlider) {
        musicSlider.addEventListener('input', e => {
          window.soundManager.setMusicVolume(Number(e.target.value) / 100);
          this.syncAudioUI();
        });
      }

      const sfxSlider = document.getElementById('slider-sfx-vol');
      if (sfxSlider) {
        sfxSlider.addEventListener('input', e => {
          window.soundManager.setSfxVolume(Number(e.target.value) / 100);
          this.syncAudioUI();
        });
      }

      const testVillager = document.getElementById('btn-test-villager');
      if (testVillager) {
        testVillager.addEventListener('click', () => window.soundManager.playVillager());
      }

      const testLevelUp = document.getElementById('btn-test-levelup');
      if (testLevelUp) {
        testLevelUp.addEventListener('click', () => window.soundManager.playCorrect());
      }

      // İstatistikleri Sıfırla
      clickAndRun('btn-reset-stats', () => {
        this.statsManager.reset();
      });

      // Modal Kapatma Butonları
      document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
          window.soundManager.playClick();
          const modalId = btn.getAttribute('data-close');
          this.closeModal(modalId);
        });
      });

      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
          if (e.target === overlay) {
            window.soundManager.playClick();
            overlay.classList.add('hidden');
          }
        });
      });

      // İlk tıklamada Web Audio kilidini aç ve menü müziğini başlat
      const unlockAudio = () => {
        if (!window.soundManager.currentMusicMode && window.soundManager.musicEnabled) {
          window.soundManager.startMusic(this.state === 'MENU' ? 'menu' : 'game');
        }
        document.removeEventListener('pointerdown', unlockAudio);
      };
      document.addEventListener('pointerdown', unlockAudio);

      // Klavye Desteği (A/B/C/D, 1/2/3/4, Enter/Space, Escape)
      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
            m.classList.add('hidden');
          });
          return;
        }

        const anyModalOpen = document.querySelector('.modal-overlay:not(.hidden)');
        if (anyModalOpen) return;

        const key = e.key.toUpperCase();
        if (this.state === 'QUESTION') {
          if (key === 'A') this.selectAnswer(0);
          else if (key === 'B') this.selectAnswer(1);
          else if (key === 'C') this.selectAnswer(2);
          else if (key === 'D') this.selectAnswer(3);
          else if (key === '1') this.useJokerFiftyFifty();
          else if (key === '2') this.useJokerAudience();
          else if (key === '3') this.useJokerVillager();
          else if (key === '4') this.useJokerChangeQuestion();
        } else if (this.state === 'CORRECT_REVEAL') {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.soundManager.playClick();
            this.proceedToNextQuestion();
          }
        }
      });
    }

    openModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.remove('hidden');
    }

    closeModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.add('hidden');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.mcQuizGame = new MinecraftMillionaireGame();
  });
})();
