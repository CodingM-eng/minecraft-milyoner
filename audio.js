/**
 * KİM MİLYONER OLMAQ İSTƏR? — MINECRAFT EDITION
 * Complete Web Audio API Sound System (Original Royalty-Free Minecraft & Quiz Synth)
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicVolume = 0.5;
    this.sfxVolume = 0.75;
    this.currentMusicMode = null; // 'menu' | 'game' | 'suspense' | null
    this.musicTimer = null;
    this.suspenseTimer = null;
    this.musicStep = 0;

    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('mc_millionaire_audio');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.musicEnabled === 'boolean') this.musicEnabled = parsed.musicEnabled;
        if (typeof parsed.sfxEnabled === 'boolean') this.sfxEnabled = parsed.sfxEnabled;
        if (typeof parsed.musicVolume === 'number') this.musicVolume = parsed.musicVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
      }
    } catch (e) {
      console.warn('Audio settings load error:', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('mc_millionaire_audio', JSON.stringify({
        musicEnabled: this.musicEnabled,
        sfxEnabled: this.sfxEnabled,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume
      }));
    } catch (e) {
      console.warn('Audio settings save error:', e);
    }
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    this.saveSettings();
    if (!enabled) {
      this.stopMusicLoop();
    } else if (this.currentMusicMode) {
      this.startMusic(this.currentMusicMode, true);
    }
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = enabled;
    this.saveSettings();
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this.saveSettings();
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this.saveSettings();
  }

  // Helper to play a synthesized note
  playTone(freq, type, duration, startTimeOffset = 0, gainVal = 0.25, isMusic = false, pitchSlide = null) {
    this.initContext();
    if (!this.ctx) return;
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

  // Noise burst for stone clicks, explosions, damage
  playNoise(duration, startTimeOffset = 0, gainVal = 0.2, filterFreq = 1200) {
    this.initContext();
    if (!this.ctx || !this.sfxEnabled || this.sfxVolume <= 0.001) return;

    const now = this.ctx.currentTime + startTimeOffset;
    const bufferSize = this.ctx.sampleRate * duration;
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
  // SOUND EFFECTS
  // ==========================

  // 1. Button Click (Minecraft UI Stone Click)
  playClick() {
    this.playTone(580, 'square', 0.045, 0, 0.2);
    this.playTone(880, 'triangle', 0.03, 0.02, 0.15);
    this.playNoise(0.035, 0, 0.12, 1800);
  }

  // 2. Answer Selection (Block lock-in chime)
  playAnswerSelect() {
    this.playTone(330, 'triangle', 0.12, 0, 0.3);
    this.playTone(440, 'square', 0.18, 0.06, 0.25);
    this.playTone(659.25, 'sine', 0.25, 0.12, 0.28);
  }

  // 3. Suspense / Tension Sound (Heartbeat & rising dramatic ticks during 1.8s reveal)
  playSuspense(durationMs = 1750) {
    this.stopSuspense();
    if (!this.sfxEnabled) return;

    // Dramatic low impact
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

  // 4. Correct Answer Sound (Minecraft XP Level-Up Arpeggio)
  playCorrect() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 'triangle', 0.22, idx * 0.065, 0.32);
      this.playTone(freq * 1.5, 'sine', 0.18, idx * 0.065 + 0.02, 0.14);
    });
  }

  // 5. Wrong Answer Sound (Minecraft Damage Crunch + Wither Descending Tone)
  playWrong() {
    this.playNoise(0.25, 0, 0.4, 900);
    this.playTone(220, 'sawtooth', 0.25, 0, 0.35, false, 130);
    this.playTone(174.61, 'sawtooth', 0.3, 0.2, 0.35, false, 110);
    this.playTone(130.81, 'square', 0.55, 0.42, 0.38, false, 73.42);
  }

  // 6. Generic Joker Activation Sound (Enchantment shimmer)
  playJokerActivate() {
    this.playTone(587.33, 'sine', 0.15, 0, 0.25);
    this.playTone(880, 'triangle', 0.2, 0.06, 0.25);
    this.playTone(1174.66, 'sine', 0.28, 0.12, 0.28);
  }

  // 7. 50/50 Sound (2 Anvil / Block Break pops removing two wrong options)
  playFiftyFifty() {
    this.playJokerActivate();
    // First block break
    this.playNoise(0.12, 0.15, 0.35, 1400);
    this.playTone(300, 'square', 0.12, 0.15, 0.3, false, 140);
    // Second block break
    this.playNoise(0.14, 0.36, 0.35, 1200);
    this.playTone(260, 'square', 0.14, 0.36, 0.3, false, 120);
  }

  // 8. Audience Voting Sound (Server players radar scan pings)
  playAudience() {
    const freqs = [440, 554.37, 659.25, 880, 659.25, 880, 1108.73];
    freqs.forEach((f, i) => {
      this.playTone(f, 'sine', 0.12, i * 0.07, 0.24);
    });
  }

  // 9. Villager Sound (Authentic "Hrmmm!" nasal pitch curve)
  playVillager() {
    // Classic Villager "Hrmmm" formant-like pitch bend
    this.playTone(215, 'sawtooth', 0.42, 0, 0.22, false, 265);
    this.playTone(430, 'triangle', 0.42, 0, 0.28, false, 510);
    this.playTone(255, 'sawtooth', 0.32, 0.22, 0.20, false, 185);
    this.playTone(510, 'triangle', 0.32, 0.22, 0.25, false, 370);
  }

  // 10. Question Change Sound (Ender Pearl Teleport Whoosh + Portal Chime)
  playChangeQuestion() {
    this.playNoise(0.28, 0, 0.25, 2200);
    this.playTone(240, 'sine', 0.3, 0, 0.3, false, 760);
    this.playTone(783.99, 'triangle', 0.25, 0.22, 0.28);
    this.playTone(1046.50, 'sine', 0.35, 0.32, 0.28);
  }

  // 11. Victory / Millionaire Winner Sound (Epic Challenge Complete Fanfare)
  playVictory() {
    const fanfare = [
      { f: 523.25, t: 0, d: 0.2 },
      { f: 659.25, t: 0.16, d: 0.2 },
      { f: 783.99, t: 0.32, d: 0.2 },
      { f: 1046.50, t: 0.48, d: 0.45 },
      { f: 783.99, t: 0.85, d: 0.2 },
      { f: 1046.50, t: 1.05, d: 0.5 },
      { f: 1318.51, t: 1.45, d: 0.7 },
      { f: 1567.98, t: 1.85, d: 1.1 }
    ];
    fanfare.forEach(n => {
      this.playTone(n.f, 'triangle', n.d, n.t, 0.35);
      this.playTone(n.f * 0.5, 'sine', n.d, n.t, 0.25);
    });
  }

  // ==========================
  // BACKGROUND MUSIC SYSTEM
  // ==========================

  startMusic(mode = 'menu', forceRestart = false) {
    if (this.currentMusicMode === mode && this.musicTimer && !forceRestart) {
      return;
    }
    this.currentMusicMode = mode;
    this.stopMusicLoop();

    if (!this.musicEnabled) return;

    this.musicStep = 0;

    // Peaceful Minecraft Piano-like Ambient Progression for Menu
    const menuNotes = [
      329.63, 392.00, 493.88, 523.25,
      392.00, 329.63, 293.66, 392.00,
      261.63, 329.63, 392.00, 493.88,
      293.66, 349.23, 440.00, 392.00
    ];

    // Quiz Show + Minecraft Cave Tension Arpeggio for Game
    const gameNotes = [
      220.00, 261.63, 329.63, 261.63,
      246.94, 293.66, 369.99, 293.66,
      261.63, 329.63, 392.00, 329.63,
      246.94, 329.63, 440.00, 329.63
    ];

    const stepInterval = mode === 'menu' ? 950 : 650;

    const tick = () => {
      if (!this.musicEnabled || this.currentMusicMode !== mode) return;

      if (mode === 'menu') {
        const freq = menuNotes[this.musicStep % menuNotes.length];
        this.playTone(freq, 'sine', 1.4, 0, 0.14, true);
        if (this.musicStep % 2 === 0) {
          this.playTone(freq * 0.5, 'triangle', 1.8, 0, 0.10, true);
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
