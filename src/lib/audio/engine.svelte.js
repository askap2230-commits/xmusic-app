/**
 * Engine Audio Reaktif Berbasis Svelte 5 Runes + Web Audio API 5-Band Equalizer & FFT Visualizer
 * Mendukung:
 * - 5-Band BiquadFilterNode (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz) + Preamp Gain + Stereo Pan
 * - Real-time FFT Spectrum Analyser (60fps) dengan fallback mulus untuk stream lintas-origin
 * - Playback Rate (0.5x - 2.0x) & Pitch Preservation (preservesPitch)
 * - Sleep Timer dengan volume fade-out halus
 * - MediaSession API penuh (Lockscreen Android & Bluetooth Controls)
 */
import { EQ_BANDS, EQ_PRESETS } from '#lib/data/presets.js';
import { loadJSON, saveJSON } from '#lib/db/storage.js';

class AudioEngine {
  // Svelte 5 Runes Reactive State
  current = $state(null);
  playing = $state(false);
  position = $state(0);
  duration = $state(0);
  volume = $state(0.8);
  muted = $state(false);
  shuffle = $state(false);
  repeat = $state('off'); // 'off' | 'all' | 'one'
  playbackRate = $state(1.0);
  preservesPitch = $state(true);

  // Equalizer State
  eqEnabled = $state(true);
  eqPreset = $state('flat');
  preamp = $state(0);
  gains = $state([0, 0, 0, 0, 0]);
  pan = $state(0);

  // Sleep Timer State
  sleepMinutes = $state(0); // 0 = off, -1 = end of track, >0 = countdown
  sleepRemainingSec = $state(0);

  // Queue & History
  queue = $state([]);
  history = $state([]);

  // Internal Web Audio Nodes
  audioEl = null;
  audioCtx = null;
  sourceNode = null;
  preampNode = null;
  filterNodes = [];
  pannerNode = null;
  analyserNode = null;
  freqData = new Uint8Array(64);
  webAudioConnected = false;
  corsBypassMode = false;
  rafId = null;
  sleepInterval = null;
  onToast = null;

  init(onToastCallback) {
    this.onToast = onToastCallback;
    const savedEq = loadJSON('nys_eq_state', null);
    if (savedEq) {
      this.eqEnabled = savedEq.eqEnabled ?? true;
      this.eqPreset = savedEq.eqPreset || 'flat';
      this.preamp = Number(savedEq.preamp) || 0;
      if (Array.isArray(savedEq.gains) && savedEq.gains.length === 5) {
        this.gains = savedEq.gains.map(Number);
      }
      this.pan = Number(savedEq.pan) || 0;
    }
    const savedPlayer = loadJSON('nys_player_prefs', null);
    if (savedPlayer) {
      this.volume = savedPlayer.volume ?? 0.8;
      this.shuffle = !!savedPlayer.shuffle;
      this.repeat = savedPlayer.repeat || 'off';
      this.playbackRate = savedPlayer.playbackRate || 1.0;
      this.preservesPitch = savedPlayer.preservesPitch ?? true;
    }

    this.audioEl = new Audio();
    this.audioEl.preload = 'metadata';
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.volume = this.volume;

    this.audioEl.addEventListener('play', () => {
      this.playing = true;
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.startLoop();
      this.updateMediaSessionState();
    });

    this.audioEl.addEventListener('pause', () => {
      this.playing = false;
      this.updateMediaSessionState();
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        this.duration = this.audioEl.duration;
        if (this.current) this.current.dur = this.audioEl.duration;
      }
      this.applyPlaybackRate();
    });

    this.audioEl.addEventListener('ended', () => {
      if (this.sleepMinutes === -1) {
        this.setSleepTimer(0);
        this.playing = false;
        this.toast('Sleep Timer: Pemutaran dihentikan di akhir lagu.');
        return;
      }
      if (this.repeat === 'one') {
        this.audioEl.currentTime = 0;
        this.audioEl.play().catch(() => {});
      } else {
        this.next(true);
      }
    });

    this.audioEl.addEventListener('error', () => {
      // Jika gagal karena CORS saat crossOrigin="anonymous", putar ulang tanpa atribut crossOrigin
      if (this.audioEl.crossOrigin === 'anonymous' && this.current?.url && !this.current.url.startsWith('blob:')) {
        this.corsBypassMode = true;
        const pos = this.position || 0;
        this.audioEl.removeAttribute('crossorigin');
        this.audioEl.src = this.current.url;
        this.audioEl.currentTime = pos;
        this.audioEl.play().catch((err) => this.toast('Gagal memutar stream: ' + err.message));
      }
    });

    this.setupMediaSession();
  }

  toast(msg) {
    if (this.onToast) this.onToast(msg);
  }

  ensureWebAudio() {
    if (this.webAudioConnected || !this.audioEl) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.audioCtx = new Ctx();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
      this.preampNode = this.audioCtx.createGain();

      this.filterNodes = EQ_BANDS.map((b, idx) => {
        const f = this.audioCtx.createBiquadFilter();
        f.type = b.type;
        f.frequency.value = b.freq;
        f.Q.value = 1.1;
        f.gain.value = this.eqEnabled ? (this.gains[idx] || 0) : 0;
        return f;
      });

      this.pannerNode = this.audioCtx.createStereoPanner
        ? this.audioCtx.createStereoPanner()
        : null;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 128;
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Rangkai graph: Source -> Preamp -> Filter[0..4] -> Panner -> Analyser -> Destination
      let prev = this.sourceNode;
      prev.connect(this.preampNode);
      prev = this.preampNode;

      for (const f of this.filterNodes) {
        prev.connect(f);
        prev = f;
      }
      if (this.pannerNode) {
        prev.connect(this.pannerNode);
        prev = this.pannerNode;
      }
      prev.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      this.webAudioConnected = true;
      this.syncEqNodes();
    } catch (e) {
      console.warn('[WebAudio Init Warning]', e);
    }
  }

  syncEqNodes() {
    saveJSON('nys_eq_state', {
      eqEnabled: this.eqEnabled,
      eqPreset: this.eqPreset,
      preamp: this.preamp,
      gains: [...this.gains],
      pan: this.pan
    });
    if (!this.webAudioConnected || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const preDb = this.eqEnabled ? this.preamp : 0;
    const linearGain = Math.pow(10, preDb / 20);
    this.preampNode.gain.setTargetAtTime(linearGain, now, 0.015);

    this.filterNodes.forEach((f, idx) => {
      const g = this.eqEnabled ? (this.gains[idx] || 0) : 0;
      f.gain.setTargetAtTime(g, now, 0.015);
    });

    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(this.pan, now, 0.015);
    }
  }

  setPreset(key) {
    const p = EQ_PRESETS[key];
    if (!p) return;
    this.eqPreset = key;
    this.preamp = p.preamp;
    this.gains = [...p.gains];
    this.syncEqNodes();
  }

  setBandGain(idx, val) {
    const clamped = Math.max(-12, Math.min(12, Number(val) || 0));
    this.gains[idx] = clamped;
    this.eqPreset = 'custom';
    this.syncEqNodes();
  }

  setPreamp(val) {
    this.preamp = Math.max(-12, Math.min(12, Number(val) || 0));
    this.eqPreset = 'custom';
    this.syncEqNodes();
  }

  setPan(val) {
    this.pan = Math.max(-1, Math.min(1, Number(val) || 0));
    this.syncEqNodes();
  }

  toggleEq() {
    this.eqEnabled = !this.eqEnabled;
    this.syncEqNodes();
  }

  savePrefs() {
    saveJSON('nys_player_prefs', {
      volume: this.volume,
      shuffle: this.shuffle,
      repeat: this.repeat,
      playbackRate: this.playbackRate,
      preservesPitch: this.preservesPitch
    });
  }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, Number(v) || 0));
    this.volume = clamped;
    this.muted = clamped === 0;
    if (this.audioEl) this.audioEl.volume = clamped;
    this.savePrefs();
  }

  toggleMute() {
    if (!this.audioEl) return;
    this.muted = !this.muted;
    this.audioEl.muted = this.muted;
  }

  setSpeed(rate) {
    this.playbackRate = rate;
    this.applyPlaybackRate();
    this.savePrefs();
  }

  togglePreservesPitch() {
    this.preservesPitch = !this.preservesPitch;
    this.applyPlaybackRate();
    this.savePrefs();
  }

  applyPlaybackRate() {
    if (!this.audioEl) return;
    this.audioEl.playbackRate = this.playbackRate;
    if ('preservesPitch' in this.audioEl) {
      this.audioEl.preservesPitch = this.preservesPitch;
    } else if ('webkitPreservesPitch' in this.audioEl) {
      this.audioEl.webkitPreservesPitch = this.preservesPitch;
    }
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.savePrefs();
    this.toast(this.shuffle ? 'Mode Acak (Shuffle) Aktif' : 'Mode Acak Dimatikan');
  }

  cycleRepeat() {
    const order = ['off', 'all', 'one'];
    const nextIdx = (order.indexOf(this.repeat) + 1) % order.length;
    this.repeat = order[nextIdx];
    this.savePrefs();
    const labels = {
      off: 'Ulangi: Mati',
      all: 'Ulangi: Semua Antrean',
      one: 'Ulangi: Satu Lagu (1)'
    };
    this.toast(labels[this.repeat]);
  }

  setSleepTimer(minutes) {
    clearInterval(this.sleepInterval);
    this.sleepMinutes = minutes;
    if (minutes <= 0) {
      this.sleepRemainingSec = 0;
      if (this.audioEl) this.audioEl.volume = this.volume;
      if (minutes === -1) this.toast('Sleep Timer: Berhenti otomatis setelah lagu ini selesai.');
      return;
    }
    this.sleepRemainingSec = minutes * 60;
    this.toast(`Sleep Timer aktif: ${minutes} menit`);
    this.sleepInterval = setInterval(() => {
      this.sleepRemainingSec -= 1;
      // Fade out halus 5 detik terakhir
      if (this.sleepRemainingSec > 0 && this.sleepRemainingSec <= 5 && this.audioEl) {
        this.audioEl.volume = this.volume * (this.sleepRemainingSec / 5);
      }
      if (this.sleepRemainingSec <= 0) {
        clearInterval(this.sleepInterval);
        this.sleepMinutes = 0;
        this.sleepRemainingSec = 0;
        this.pause();
        if (this.audioEl) this.audioEl.volume = this.volume;
        this.toast('Sleep Timer selesai. Selamat beristirahat!');
      }
    }, 1000);
  }

  playTrack(track, customQueue = null) {
    if (!track) return;
    if (customQueue && Array.isArray(customQueue) && customQueue.length > 0) {
      this.queue = [...customQueue];
    } else if (!this.queue.some((x) => x.id === track.id)) {
      this.queue = [track, ...this.queue];
    }

    // Jika lagu YouTube / Spotify Embed, hentikan audio HTML5 dan biarkan modal menangani embed
    if (track.videoId || track.spotifyId) {
      this.pause();
      this.current = track;
      this.position = 0;
      this.duration = track.dur || 0;
      this.recordHistory(track);
      return;
    }

    if (!track.url) {
      this.toast('Lagu ini tidak memiliki sumber audio.');
      return;
    }

    const isSame = this.current && this.current.id === track.id;
    if (isSame) {
      this.togglePlay();
      return;
    }

    this.ensureWebAudio();
    this.current = track;
    this.position = 0;
    this.duration = track.dur || 0;
    this.corsBypassMode = false;
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.src = track.url;
    this.audioEl.load();
    this.applyPlaybackRate();
    this.audioEl.play().catch((err) => {
      this.toast('Gagal memutar: ' + err.message);
    });
    this.recordHistory(track);
    this.updateMediaSessionMeta();
  }

  togglePlay() {
    if (!this.current) {
      if (this.queue.length > 0) this.playTrack(this.queue[0]);
      return;
    }
    if (this.current.videoId || this.current.spotifyId) return;
    if (this.playing) this.pause();
    else {
      this.ensureWebAudio();
      this.audioEl.play().catch((e) => this.toast('Gagal memutar: ' + e.message));
    }
  }

  pause() {
    if (this.audioEl) this.audioEl.pause();
  }

  seekTo(pct) {
    if (!this.audioEl || !this.current) return;
    const d = this.duration || this.audioEl.duration || 0;
    if (!d) return;
    const clamped = Math.max(0, Math.min(1, pct));
    this.audioEl.currentTime = clamped * d;
    this.position = this.audioEl.currentTime;
  }

  next(fromEnded = false) {
    const playable = this.queue.filter((t) => !t.videoId && !t.spotifyId);
    if (!playable.length) return;
    const idx = playable.findIndex((t) => t.id === this.current?.id);

    if (this.shuffle && playable.length > 1) {
      const candidates = playable.filter((t) => t.id !== this.current?.id);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.playTrack(pick);
      return;
    }

    if (idx + 1 >= playable.length && fromEnded && this.repeat === 'off') {
      this.playing = false;
      this.position = 0;
      return;
    }
    const nextTrack = playable[(idx + 1) % playable.length];
    this.playTrack(nextTrack);
  }

  prev() {
    if (this.audioEl && this.position > 3) {
      this.audioEl.currentTime = 0;
      this.position = 0;
      return;
    }
    const playable = this.queue.filter((t) => !t.videoId && !t.spotifyId);
    if (!playable.length) return;
    const idx = playable.findIndex((t) => t.id === this.current?.id);
    const prevTrack = playable[(idx - 1 + playable.length) % playable.length];
    this.playTrack(prevTrack);
  }

  recordHistory(track) {
    const clean = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      imageUrl: track.imageUrl?.startsWith('blob:') ? null : track.imageUrl,
      c1: track.c1,
      c2: track.c2,
      dur: track.dur,
      source: track.source,
      playedAt: Date.now()
    };
    const filtered = this.history.filter((x) => x.id !== track.id);
    this.history = [clean, ...filtered].slice(0, 40);
    saveJSON('nys_history', this.history);
  }

  startLoop() {
    cancelAnimationFrame(this.rafId);
    const tick = () => {
      if (!this.playing) return;
      if (this.audioEl) {
        this.position = this.audioEl.currentTime || 0;
        if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
          this.duration = this.audioEl.duration;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Mengambil spektrum frekuensi real-time (0..255) dari AnalyserNode untuk Visualizer 60fps
   */
  getSpectrum(numBars = 28, nowMs = performance.now()) {
    const out = new Array(numBars).fill(0);
    if (this.analyserNode && this.playing && !this.corsBypassMode && !this.current?.videoId && !this.current?.spotifyId) {
      this.analyserNode.getByteFrequencyData(this.freqData);
      let sum = 0;
      for (let i = 0; i < numBars; i++) {
        const bin = Math.min(this.freqData.length - 1, Math.floor((i / numBars) * (this.freqData.length * 0.75)));
        const val = this.freqData[bin] / 255;
        out[i] = val;
        sum += val;
      }
      if (sum > 0.02) return out;
    }
    // Fallback responsif jika cross-origin stream membatasi pembacaan byte PCM
    if (this.playing || this.current?.videoId || this.current?.spotifyId) {
      const t = nowMs / 1000;
      for (let i = 0; i < numBars; i++) {
        out[i] = 0.2 + 0.65 * Math.abs(Math.sin(t * (2.1 + (i % 5) * 0.4) + i * 0.65));
      }
    }
    return out;
  }

  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null && this.audioEl) {
        this.audioEl.currentTime = details.seekTime;
        this.position = details.seekTime;
      }
    });
  }

  updateMediaSessionMeta() {
    if (!('mediaSession' in navigator) || !this.current) return;
    const t = this.current;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title || 'nys Xmusic',
      artist: t.artist || 'Xmusic',
      album: t.album || 'nys Xmusic',
      artwork: t.imageUrl ? [{ src: t.imageUrl, sizes: '512x512', type: 'image/png' }] : []
    });
  }

  updateMediaSessionState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
  }
}

export const engine = new AudioEngine();
