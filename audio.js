/**
 * KİM MİLYONER OLMAK İSTER? — MINECRAFT EDITION
 * Gelişmiş Web Audio API Ses Sistemi (soundService & SoundManager)
 * Bölümler 4 & 30:
 * - Buton tıklama, Menü açma/kapama, Satın alma, Başarılı işlem, Hata, Bildirim
 * - Partiye katılma, Parti daveti, Rütbe yükseltme, Zümrüt kazanma/harcama, Başarım kilidi
 * - Oyun başlangıcı, Oyun kazanma, Oyun kaybetme
 * - Kullanıcı etkileşimi öncesi otomatik ses çalmama (autoplay policy uyumu)
 * - Kalıcı ses tercihleri (Ses Efektleri, Müzik, Ana Menü Sesi, Bildirim Sesleri, Mağaza Sesleri)
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.hasUserInteracted = false;

    // Bölüm 4 & 30: Ses Tercihleri
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.menuSoundEnabled = true;
    this.notificationSoundEnabled = true;
    this.shopSoundEnabled = true;
    this.musicVolume = 0.5;
    this.sfxVolume = 0.75;

    this.currentMusicMode = null; // 'menu' | 'game' | 'suspense' | null
    this.musicTimer = null;
    this.suspenseTimer = null;
    this.musicStep = 0;

    this.loadSettings();
    this.bindFirstInteractionListener();
  }

  bindFirstInteractionListener() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const unlockAudio = () => {
      this.hasUserInteracted = true;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
    window.addEventListener('keydown', unlockAudio, { once: false, passive: true });
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('mc_millionaire_audio');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.musicEnabled === 'boolean') this.musicEnabled = parsed.musicEnabled;
        if (typeof parsed.sfxEnabled === 'boolean') this.sfxEnabled = parsed.sfxEnabled;
        if (typeof parsed.menuSoundEnabled === 'boolean') this.menuSoundEnabled = parsed.menuSoundEnabled;
        if (typeof parsed.notificationSoundEnabled === 'boolean') {
          this.notificationSoundEnabled = parsed.notificationSoundEnabled;
        }
        if (typeof parsed.shopSoundEnabled === 'boolean') this.shopSoundEnabled = parsed.shopSoundEnabled;
        if (typeof parsed.musicVolume === 'number') this.musicVolume = parsed.musicVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
      }
    } catch (e) {
      console.warn('Ses ayarları yüklenemedi:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(
        'mc_millionaire_audio',
        JSON.stringify({
          musicEnabled: this.musicEnabled,
          sfxEnabled: this.sfxEnabled,
          menuSoundEnabled: this.menuSoundEnabled,
          notificationSoundEnabled: this.notificationSoundEnabled,
          shopSoundEnabled: this.shopSoundEnabled,
          musicVolume: this.musicVolume,
          sfxVolume: this.sfxVolume
        })
      );
    } catch (e) {
      console.warn('Ses ayarları kaydedilemedi:', e);
    }
  }

  getSettings() {
    return {
      sfxEnabled: this.sfxEnabled,
      musicEnabled: this.musicEnabled,
      menuSoundEnabled: this.menuSoundEnabled,
      notificationSoundEnabled: this.notificationSoundEnabled,
      shopSoundEnabled: this.shopSoundEnabled,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume
    };
  }

  initContext() {
    if (!this.hasUserInteracted) return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return Boolean(this.ctx);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    this.saveSettings();
    if (!this.musicEnabled) {
      this.stopMusicLoop();
    } else if (this.currentMusicMode) {
      this.startMusic(this.currentMusicMode, true);
    }
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = Boolean(enabled);
    this.saveSettings();
  }

  setMenuSoundEnabled(enabled) {
    this.menuSoundEnabled = Boolean(enabled);
    this.saveSettings();
  }

  setNotificationSoundEnabled(enabled) {
    this.notificationSoundEnabled = Boolean(enabled);
    this.saveSettings();
  }

  setShopSoundEnabled(enabled) {
    this.shopSoundEnabled = Boolean(enabled);
    this.saveSettings();
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, Number(val) || 0));
    this.saveSettings();
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(val) || 0));
    this.saveSettings();
  }

  playTone(freq, type, duration, startTimeOffset = 0, gainVal = 0.25, isMusic = false, pitchSlide = null) {
    this.hasUserInteracted = true;
    if (!this.initContext() || !this.ctx) return;
    if (isMusic && !this.musicEnabled) return;
    if (!isMusic && !this.sfxEnabled) return;

    const masterVol = isMusic ? this.musicVolume : this.sfxVolume;
    if (masterVol <= 0.001) return;

    const now = this.ctx.currentTime + startTimeOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (pitchSlide) {
      osc.frequency.exponentialRampToValueAtTime(pitchSlide, now + duration);
    }

    const finalGain = Math.max(0.0001, gainVal * masterVol);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(finalGain, now + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playNoise(duration, startTimeOffset = 0, gainVal = 0.2, filterFreq = 1200) {
    this.hasUserInteracted = true;
    if (!this.initContext() || !this.ctx || !this.sfxEnabled || this.sfxVolume <= 0.001) return;

    const now = this.ctx.currentTime + startTimeOffset;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = this.ctx.createGain();
    const finalGain = Math.max(0.0001, gainVal * this.sfxVolume);
    gain.gain.setValueAtTime(finalGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  // ==========================
  // BÖLÜM 4: MINECRAFT SES EFEKTLERİ
  // ==========================

  // 1. Buton Tıklama (Minecraft Taş Buton Sesi)
  playClick() {
    if (!this.menuSoundEnabled) return;
    this.playTone(580, 'square', 0.045, 0, 0.2);
    this.playTone(880, 'triangle', 0.03, 0.02, 0.15);
    this.playNoise(0.035, 0, 0.12, 1800);
  }

  // 2. Menü Açma (Minecraft Sandık / Envanter Açılış Sesi)
  playMenuOpen() {
    if (!this.menuSoundEnabled) return;
    this.playNoise(0.05, 0, 0.14, 1500);
    this.playTone(310, 'triangle', 0.09, 0, 0.22, false, 460);
    this.playTone(520, 'sine', 0.11, 0.06, 0.2, false, 680);
  }

  // 3. Menü Kapama (Minecraft Sandık Kapanış Sesi)
  playMenuClose() {
    if (!this.menuSoundEnabled) return;
    this.playTone(480, 'triangle', 0.08, 0, 0.2, false, 280);
    this.playNoise(0.045, 0.04, 0.16, 1100);
  }

  // 4. Mağaza Satın Alma (Zümrüt + XP Çınlaması)
  playPurchase() {
    if (!this.shopSoundEnabled) return;
    const notes = [659.25, 880, 1174.66, 1567.98];
    notes.forEach((f, idx) => {
      this.playTone(f, 'triangle', 0.16, idx * 0.055, 0.28);
      this.playTone(f * 1.5, 'sine', 0.12, idx * 0.055 + 0.015, 0.14);
    });
  }

  // 5. Zümrüt Kazanma (Minecraft XP Küresi Sesi)
  playEmeraldGain() {
    if (!this.shopSoundEnabled) return;
    this.playTone(783.99, 'sine', 0.12, 0, 0.26, false, 1174.66);
    this.playTone(1046.5, 'triangle', 0.18, 0.07, 0.28, false, 1567.98);
  }

  // 6. Zümrüt Harcama
  playEmeraldSpend() {
    if (!this.shopSoundEnabled) return;
    this.playTone(880, 'triangle', 0.1, 0, 0.22, false, 587.33);
    this.playTone(587.33, 'sine', 0.14, 0.07, 0.2);
  }

  // 7. Başarılı İşlem
  playSuccess() {
    this.playTone(523.25, 'triangle', 0.12, 0, 0.25);
    this.playTone(659.25, 'triangle', 0.14, 0.07, 0.25);
    this.playTone(1046.5, 'sine', 0.22, 0.14, 0.28);
  }

  // 8. Hata Sesi
  playError() {
    this.playWrong();
  }

  // 9. Bildirim Sesi (Toast Ping)
  playNotification() {
    if (!this.notificationSoundEnabled) return;
    this.playTone(659.25, 'sine', 0.1, 0, 0.2);
    this.playTone(987.77, 'triangle', 0.15, 0.06, 0.22);
  }

  // 10. Partiye Katılma (Portal / Takım Sesi)
  playPartyJoin() {
    this.playTone(440, 'triangle', 0.12, 0, 0.25);
    this.playTone(554.37, 'triangle', 0.12, 0.08, 0.25);
    this.playTone(659.25, 'sine', 0.2, 0.16, 0.3);
    this.playTone(880, 'sine', 0.26, 0.24, 0.3);
  }

  // 11. Parti Daveti
  playPartyInvite() {
    if (!this.notificationSoundEnabled) return;
    this.playTone(587.33, 'sine', 0.12, 0, 0.24);
    this.playTone(880, 'triangle', 0.18, 0.09, 0.26);
  }

  // 12. Rütbe Yükseltme (Totem / Challenge Fanfare)
  playRankUpgrade() {
    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    chords.forEach((f, i) => {
      this.playTone(f, 'triangle', 0.24, i * 0.07, 0.32);
      this.playTone(f * 0.5, 'sine', 0.24, i * 0.07, 0.2);
    });
  }

  // 13. Başarım Kilidi Açıldı
  playAchievementUnlock() {
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((f, i) => {
      this.playTone(f, 'triangle', 0.2, i * 0.08, 0.28);
    });
  }

  // 14. Oyun Başlangıcı
  playGameStart() {
    this.playTone(329.63, 'triangle', 0.14, 0, 0.26);
    this.playTone(440, 'triangle', 0.14, 0.09, 0.26);
    this.playTone(659.25, 'sine', 0.26, 0.18, 0.3);
  }

  // 15. Cevap Seçimi
  playAnswerSelect() {
    this.playTone(330, 'triangle', 0.12, 0, 0.3);
    this.playTone(440, 'square', 0.18, 0.06, 0.25);
    this.playTone(659.25, 'sine', 0.25, 0.12, 0.28);
  }

  // 16. Gerilim / Bekleme Sesi
  playSuspense(durationMs = 1750) {
    this.stopSuspense();
    if (!this.sfxEnabled) return;

    this.playTone(98, 'sawtooth', 0.45, 0, 0.3, false, 65);
    this.playTone(196, 'sine', 0.4, 0, 0.25);

    const steps = 6;
    const interval = durationMs / steps;
    for (let i = 0; i < steps; i++) {
      const offsetSec = (i * interval) / 1000;
      const pitch = 220 + i * 28;
      this.playTone(pitch, 'triangle', 0.12, offsetSec, 0.22);
      this.playTone(pitch * 0.5, 'sine', 0.15, offsetSec + 0.05, 0.28);
    }
  }

  stopSuspense() {
    if (this.suspenseTimer) {
      clearTimeout(this.suspenseTimer);
      this.suspenseTimer = null;
    }
  }

  // 17. Doğru Cevap (Minecraft XP Level-Up)
  playCorrect() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.22, idx * 0.065, 0.32);
      this.playTone(freq * 1.5, 'sine', 0.18, idx * 0.065 + 0.02, 0.14);
    });
  }

  // 18. Yanlış Cevap / Oyun Kaybetme
  playWrong() {
    this.playNoise(0.25, 0, 0.4, 900);
    this.playTone(220, 'sawtooth', 0.25, 0, 0.35, false, 130);
    this.playTone(174.61, 'sawtooth', 0.3, 0.2, 0.35, false, 110);
    this.playTone(130.81, 'square', 0.55, 0.42, 0.38, false, 73.42);
  }

  playGameLoss() {
    this.playWrong();
  }

  // 19. Joker Sesleri
  playJokerActivate() {
    this.playTone(587.33, 'sine', 0.15, 0, 0.25);
    this.playTone(880, 'triangle', 0.2, 0.06, 0.25);
    this.playTone(1174.66, 'sine', 0.28, 0.12, 0.28);
  }

  playFiftyFifty() {
    this.playJokerActivate();
    this.playNoise(0.12, 0.15, 0.35, 1400);
    this.playTone(300, 'square', 0.12, 0.15, 0.3, false, 140);
    this.playNoise(0.14, 0.36, 0.35, 1200);
    this.playTone(260, 'square', 0.14, 0.36, 0.3, false, 120);
  }

  playAudience() {
    const freqs = [440, 554.37, 659.25, 880, 659.25, 880, 1108.73];
    freqs.forEach((f, i) => {
      this.playTone(f, 'sine', 0.12, i * 0.07, 0.24);
    });
  }

  playVillager() {
    this.playTone(215, 'sawtooth', 0.42, 0, 0.22, false, 265);
    this.playTone(430, 'triangle', 0.42, 0, 0.28, false, 510);
    this.playTone(255, 'sawtooth', 0.32, 0.22, 0.2, false, 185);
    this.playTone(510, 'triangle', 0.32, 0.22, 0.25, false, 370);
  }

  playChangeQuestion() {
    this.playNoise(0.28, 0, 0.25, 2200);
    this.playTone(240, 'sine', 0.3, 0, 0.3, false, 760);
    this.playTone(783.99, 'triangle', 0.25, 0.22, 0.28);
    this.playTone(1046.5, 'sine', 0.35, 0.32, 0.28);
  }

  // 20. Zafer / Oyun Kazanma Fanfarı
  playVictory() {
    const fanfare = [
      { f: 523.25, t: 0, d: 0.2 },
      { f: 659.25, t: 0.16, d: 0.2 },
      { f: 783.99, t: 0.32, d: 0.2 },
      { f: 1046.5, t: 0.48, d: 0.45 },
      { f: 783.99, t: 0.85, d: 0.2 },
      { f: 1046.5, t: 1.05, d: 0.5 },
      { f: 1318.51, t: 1.45, d: 0.7 },
      { f: 1567.98, t: 1.85, d: 1.1 }
    ];
    fanfare.forEach(n => {
      this.playTone(n.f, 'triangle', n.d, n.t, 0.35);
      this.playTone(n.f * 0.5, 'sine', n.d, n.t, 0.25);
    });
  }

  playGameWin() {
    this.playVictory();
  }

  // ==========================
  // ARKA PLAN MÜZİK SİSTEMİ
  // ==========================
  startMusic(mode = 'menu', forceRestart = false) {
    if (!this.hasUserInteracted) {
      this.currentMusicMode = mode;
      return;
    }
    if (this.currentMusicMode === mode && this.musicTimer && !forceRestart) {
      return;
    }
    this.currentMusicMode = mode;
    this.stopMusicLoop();

    if (!this.musicEnabled) return;
    if (mode === 'menu' && !this.menuSoundEnabled) return;

    this.musicStep = 0;

    const menuNotes = [
      329.63, 392.0, 493.88, 523.25,
      392.0, 329.63, 293.66, 392.0,
      261.63, 329.63, 392.0, 493.88,
      293.66, 349.23, 440.0, 392.0
    ];

    const gameNotes = [
      220.0, 261.63, 329.63, 261.63,
      246.94, 293.66, 369.99, 293.66,
      261.63, 329.63, 392.0, 329.63,
      246.94, 329.63, 440.0, 329.63
    ];

    const stepInterval = mode === 'menu' ? 950 : 650;

    const tick = () => {
      if (!this.musicEnabled || this.currentMusicMode !== mode) return;
      if (mode === 'menu' && !this.menuSoundEnabled) return;

      if (mode === 'menu') {
        const freq = menuNotes[this.musicStep % menuNotes.length];
        this.playTone(freq, 'sine', 1.4, 0, 0.14, true);
        if (this.musicStep % 2 === 0) {
          this.playTone(freq * 0.5, 'triangle', 1.8, 0, 0.1, true);
        }
      } else if (mode === 'game') {
        const freq = gameNotes[this.musicStep % gameNotes.length];
        this.playTone(freq, 'sine', 0.55, 0, 0.11, true);
        if (this.musicStep % 4 === 0) {
          this.playTone(freq * 0.5, 'triangle', 1.1, 0, 0.09, true);
        }
      }

      this.musicStep++;
      this.musicTimer = setTimeout(tick, stepInterval);
    };

    tick();
  }

  stopMusicLoop() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

window.soundManager = new SoundManager();
window.MCMServices = window.MCMServices || {};
window.MCMServices.soundService = window.soundManager;
