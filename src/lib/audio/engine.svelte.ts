// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Audiophile-Grade Reactive Svelte 5 Runes Audio Engine (Strict TypeScript).
 *
 * Signal Chain (Zero-Clipping Lossless-Clear DSP):
 *   MediaElementAudioSourceNode
 *     -> Preamp GainNode (smooth exponential/target ramp, zero zipper noise)
 *     -> 5-Band BiquadFilterNode (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz)
 *     -> Mastering DynamicsCompressorNode (transparent anti-clipping limiter, toggleable)
 *     -> StereoPannerNode (L/R balance)
 *     -> AnalyserNode (pull-based FFT visualizer)
 *     -> AudioContext.destination (latencyHint: 'playback')
 *
 * Native Android Media Notification:
 *   Synchronizes track metadata, playback state, and position to both W3C MediaSession API
 *   and the native Android Foreground MediaStyle Service bridge (window.XmusicAndroidMedia).
 */
import { resolveYoutubeAudioStream } from '#lib/api/services.ts';
import { EQ_BANDS, EQ_PRESETS } from '#lib/data/presets.ts';
import { loadJSON, saveJSON } from '#lib/db/storage.ts';
import type { RepeatMode, Track } from '#lib/types/music.ts';

interface SavedEqState {
  eqEnabled: boolean;
  eqPreset: string;
  preamp: number;
  gains: [number, number, number, number, number];
  pan: number;
  limiterEnabled: boolean;
}

interface SavedPlayerPrefs {
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playbackRate: number;
  preservesPitch: boolean;
}

class AudioEngine {
  // Core reactive playback state
  current = $state<Track | null>(null);
  playing = $state<boolean>(false);
  position = $state<number>(0);
  duration = $state<number>(0);
  volume = $state<number>(0.85);
  muted = $state<boolean>(false);
  shuffle = $state<boolean>(false);
  repeat = $state<RepeatMode>('off');
  playbackRate = $state<number>(1.0);
  preservesPitch = $state<boolean>(true);

  // Audiophile 5-Band EQ & Mastering Limiter state
  eqEnabled = $state<boolean>(true);
  limiterEnabled = $state<boolean>(true);
  eqPreset = $state<string>('flat');
  preamp = $state<number>(0);
  gains = $state<[number, number, number, number, number]>([0, 0, 0, 0, 0]);
  pan = $state<number>(0);

  // Sleep Timer state (0 = off, -1 = end of track, >0 = countdown minutes)
  sleepMinutes = $state<number>(0);
  sleepRemainingSec = $state<number>(0);

  // Queue & play history
  queue = $state<Track[]>([]);
  history = $state<Track[]>([]);

  // Non-reactive DSP nodes for zero overhead
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampNode: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private limiterNode: DynamicsCompressorNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(64);
  private webAudioConnected = false;
  private corsBypassMode = false;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private sleepIntervalId: ReturnType<typeof setInterval> | null = null;
  private onToast: ((message: string) => void) | null = null;

  init(onToastCallback: (message: string) => void): void {
    this.onToast = onToastCallback;

    const savedEq = loadJSON<Partial<SavedEqState> | null>('nys_eq_state', null);
    if (savedEq) {
      this.eqEnabled = savedEq.eqEnabled ?? true;
      this.limiterEnabled = savedEq.limiterEnabled ?? true;
      this.eqPreset = savedEq.eqPreset || 'flat';
      this.preamp = Number(savedEq.preamp) || 0;
      if (Array.isArray(savedEq.gains) && savedEq.gains.length === 5) {
        this.gains = [
          Number(savedEq.gains[0]) || 0,
          Number(savedEq.gains[1]) || 0,
          Number(savedEq.gains[2]) || 0,
          Number(savedEq.gains[3]) || 0,
          Number(savedEq.gains[4]) || 0
        ];
      }
      this.pan = Number(savedEq.pan) || 0;
    }

    const savedPlayer = loadJSON<Partial<SavedPlayerPrefs> | null>('nys_player_prefs', null);
    if (savedPlayer) {
      this.volume = savedPlayer.volume ?? 0.85;
      this.shuffle = Boolean(savedPlayer.shuffle);
      this.repeat = savedPlayer.repeat || 'off';
      this.playbackRate = savedPlayer.playbackRate || 1.0;
      this.preservesPitch = savedPlayer.preservesPitch ?? true;
    }

    if (this.audioEl) return;

    this.audioEl = new Audio();
    this.audioEl.preload = 'metadata';
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.volume = this.volume;

    this.audioEl.addEventListener('play', () => {
      this.playing = true;
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.startPositionSync();
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    });

    this.audioEl.addEventListener('pause', () => {
      this.playing = false;
      this.stopPositionSync();
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (this.audioEl && Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        this.duration = this.audioEl.duration;
        if (this.current) this.current.dur = this.audioEl.duration;
      }
      this.applyPlaybackRate();
      this.updateMediaSessionPosition();
      this.syncNativeAndroidNotification();
    });

    this.audioEl.addEventListener('ended', () => {
      this.stopPositionSync();
      if (this.sleepMinutes === -1) {
        this.setSleepTimer(0);
        this.playing = false;
        this.syncNativeAndroidNotification();
        this.toast('Sleep Timer: Pemutaran dihentikan di akhir lagu.');
        return;
      }
      if (this.repeat === 'one' && this.audioEl) {
        this.audioEl.currentTime = 0;
        this.audioEl.play().catch(() => {});
      } else {
        this.next(true);
      }
    });

    this.audioEl.addEventListener('error', () => {
      if (
        this.audioEl &&
        this.audioEl.crossOrigin === 'anonymous' &&
        this.current?.url &&
        !this.current.url.startsWith('blob:')
      ) {
        this.corsBypassMode = true;
        const resumePos = this.position || 0;
        this.audioEl.removeAttribute('crossorigin');
        this.audioEl.src = this.current.url;
        this.audioEl.currentTime = resumePos;
        this.audioEl.play().catch((err: Error) => this.toast(`Gagal memutar stream: ${err.message}`));
      }
    });

    this.setupMediaSession();
    this.registerAndroidNotificationBridge();
  }

  destroy(): void {
    this.stopPositionSync();
    if (this.sleepIntervalId) clearInterval(this.sleepIntervalId);
    window.XmusicAndroidMedia?.clearNotification();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
  }

  private toast(message: string): void {
    if (this.onToast) this.onToast(message);
  }

  private ensureWebAudio(): void {
    if (this.webAudioConnected || !this.audioEl) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      // 'playback' latencyHint uses larger hardware buffers for glitch-free, lossless-grade clarity on Android
      this.audioCtx = new AudioCtx({ latencyHint: 'playback' });
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
      this.preampNode = this.audioCtx.createGain();

      this.filterNodes = EQ_BANDS.map((band, idx) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.freq;
        filter.Q.value = band.type === 'peaking' ? 1.15 : 0.707;
        filter.gain.value = this.eqEnabled ? this.gains[idx] : 0;
        return filter;
      });

      // Transparent mastering limiter prevents digital clipping when EQ bands are boosted
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.knee.value = 6;
      this.limiterNode.attack.value = 0.003;
      this.limiterNode.release.value = 0.15;

      this.pannerNode = this.audioCtx.createStereoPanner
        ? this.audioCtx.createStereoPanner()
        : null;

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 128;
      this.analyserNode.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Signal chain: Source -> Preamp -> Filter[0..4] -> Limiter -> Panner -> Analyser -> Destination
      let node: AudioNode = this.sourceNode;
      node.connect(this.preampNode);
      node = this.preampNode;

      for (const filter of this.filterNodes) {
        node.connect(filter);
        node = filter;
      }

      node.connect(this.limiterNode);
      node = this.limiterNode;

      if (this.pannerNode) {
        node.connect(this.pannerNode);
        node = this.pannerNode;
      }

      node.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      this.webAudioConnected = true;
      this.syncEqNodes();
    } catch (err) {
      console.warn('[WebAudio Init Warning]', err);
    }
  }

  private syncEqNodes(): void {
    saveJSON('nys_eq_state', {
      eqEnabled: this.eqEnabled,
      limiterEnabled: this.limiterEnabled,
      eqPreset: this.eqPreset,
      preamp: this.preamp,
      gains: [...this.gains],
      pan: this.pan
    });

    if (!this.webAudioConnected || !this.audioCtx || !this.preampNode) return;
    if (this.audioCtx.state === 'suspended' && this.playing) {
      this.audioCtx.resume().catch(() => {});
    }

    const now = this.audioCtx.currentTime;
    const preampDb = this.eqEnabled ? this.preamp : 0;
    const linearGain = Math.pow(10, preampDb / 20);
    this.preampNode.gain.setTargetAtTime(linearGain, now, 0.015);

    this.filterNodes.forEach((filter, idx) => {
      const gain = this.eqEnabled ? this.gains[idx] : 0;
      filter.gain.setTargetAtTime(gain, now, 0.015);
    });

    if (this.limiterNode) {
      // Active limiter: -1 dB ceiling at 12:1 ratio; bypassed: 0 dB threshold at 1:1 ratio
      this.limiterNode.threshold.setTargetAtTime(this.limiterEnabled ? -1.0 : 0.0, now, 0.015);
      this.limiterNode.ratio.setTargetAtTime(this.limiterEnabled ? 12.0 : 1.0, now, 0.015);
    }

    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(this.pan, now, 0.015);
    }
  }

  setPreset(key: string): void {
    const preset = EQ_PRESETS[key];
    if (!preset) return;
    this.eqPreset = key;
    this.preamp = preset.preamp;
    this.gains = [...preset.gains] as [number, number, number, number, number];
    this.syncEqNodes();
  }

  resetEq(): void {
    this.setPreset('flat');
    this.setPan(0);
    this.setSpeed(1.0);
    this.preservesPitch = true;
    this.applyPlaybackRate();
    this.savePrefs();
    this.toast('Semua pengaturan audio direset ke Flat (Lossless).');
  }

  setBandGain(index: number, value: number | string): void {
    const clamped = Math.max(-12, Math.min(12, Number(value) || 0));
    const next = [...this.gains] as [number, number, number, number, number];
    next[index] = clamped;
    this.gains = next;
    this.eqPreset = 'custom';
    this.syncEqNodes();
  }

  setPreamp(value: number | string): void {
    this.preamp = Math.max(-12, Math.min(12, Number(value) || 0));
    this.eqPreset = 'custom';
    this.syncEqNodes();
  }

  setPan(value: number | string): void {
    this.pan = Math.max(-1, Math.min(1, Number(value) || 0));
    this.syncEqNodes();
  }

  toggleEq(): void {
    this.eqEnabled = !this.eqEnabled;
    this.syncEqNodes();
    this.toast(this.eqEnabled ? 'Equalizer 5-Band Aktif' : 'Equalizer Bypass (Direct)');
  }

  toggleLimiter(): void {
    this.limiterEnabled = !this.limiterEnabled;
    this.syncEqNodes();
    this.toast(
      this.limiterEnabled
        ? 'Limiter Anti-Distorsi Aktif (Suara Jernih Bebas Clipping)'
        : 'Limiter Dinonaktifkan'
    );
  }

  private savePrefs(): void {
    saveJSON('nys_player_prefs', {
      volume: this.volume,
      shuffle: this.shuffle,
      repeat: this.repeat,
      playbackRate: this.playbackRate,
      preservesPitch: this.preservesPitch
    });
  }

  setVolume(value: number | string): void {
    const clamped = Math.max(0, Math.min(1, Number(value) || 0));
    this.volume = clamped;
    this.muted = clamped === 0;
    if (this.audioEl) {
      this.audioEl.volume = clamped;
      this.audioEl.muted = this.muted;
    }
    this.savePrefs();
  }

  toggleMute(): void {
    if (!this.audioEl) return;
    this.muted = !this.muted;
    this.audioEl.muted = this.muted;
  }

  setSpeed(rate: number): void {
    this.playbackRate = rate;
    this.applyPlaybackRate();
    this.savePrefs();
    this.updateMediaSessionPosition();
  }

  togglePreservesPitch(): void {
    this.preservesPitch = !this.preservesPitch;
    this.applyPlaybackRate();
    this.savePrefs();
  }

  private applyPlaybackRate(): void {
    if (!this.audioEl) return;
    this.audioEl.playbackRate = this.playbackRate;
    this.audioEl.preservesPitch = this.preservesPitch;
  }

  toggleShuffle(): void {
    this.shuffle = !this.shuffle;
    this.savePrefs();
    this.toast(this.shuffle ? 'Mode Acak (Shuffle) Aktif' : 'Mode Acak Dimatikan');
  }

  cycleRepeat(): void {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    this.repeat = order[(order.indexOf(this.repeat) + 1) % order.length];
    this.savePrefs();
    const labels: Record<RepeatMode, string> = {
      off: 'Ulangi: Mati',
      all: 'Ulangi: Semua Antrean',
      one: 'Ulangi: Satu Lagu (1)'
    };
    this.toast(labels[this.repeat]);
  }

  setSleepTimer(minutes: number): void {
    if (this.sleepIntervalId) clearInterval(this.sleepIntervalId);
    this.sleepMinutes = minutes;
    if (minutes <= 0) {
      this.sleepRemainingSec = 0;
      if (this.audioEl) this.audioEl.volume = this.volume;
      if (minutes === -1) {
        this.toast('Sleep Timer: Berhenti otomatis setelah lagu ini selesai.');
      }
      return;
    }
    this.sleepRemainingSec = minutes * 60;
    this.toast(`Sleep Timer aktif: ${minutes} menit`);
    this.sleepIntervalId = setInterval(() => {
      this.sleepRemainingSec -= 1;
      if (this.sleepRemainingSec > 0 && this.sleepRemainingSec <= 5 && this.audioEl) {
        this.audioEl.volume = this.volume * (this.sleepRemainingSec / 5);
      }
      if (this.sleepRemainingSec <= 0) {
        if (this.sleepIntervalId) clearInterval(this.sleepIntervalId);
        this.sleepMinutes = 0;
        this.sleepRemainingSec = 0;
        this.pause();
        if (this.audioEl) this.audioEl.volume = this.volume;
        this.toast('Sleep Timer selesai. Selamat beristirahat!');
      }
    }, 1000);
  }

  playTrack(track: Track | null, customQueue: Track[] | null = null): void {
    if (!track) return;
    if (Array.isArray(customQueue) && customQueue.length > 0) {
      this.queue = [...customQueue];
    } else if (!this.queue.some((item) => item.id === track.id)) {
      this.queue = [track, ...this.queue];
    }

    if (track.spotifyId) {
      this.pause();
      this.current = track;
      this.position = 0;
      this.duration = track.dur || 0;
      this.recordHistory(track);
      this.updateMediaSessionMeta();
      this.syncNativeAndroidNotification();
      return;
    }

    if (track.videoId && !track.url) {
      this.pause();
      this.current = track;
      this.position = 0;
      this.duration = track.dur || 0;
      this.recordHistory(track);
      this.updateMediaSessionMeta();
      this.syncNativeAndroidNotification();
      void this.resolveAndPlayYoutubeAudio(track);
      return;
    }

    if (!track.url) {
      this.toast('Lagu ini tidak memiliki sumber audio.');
      return;
    }

    if (this.current?.id === track.id) {
      this.togglePlay();
      return;
    }

    this.ensureWebAudio();
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.current = track;
    this.position = 0;
    this.duration = track.dur || 0;
    this.corsBypassMode = false;

    if (this.audioEl) {
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.src = track.url;
      this.audioEl.load();
      this.applyPlaybackRate();
      this.audioEl.play().catch((err: Error) => {
        this.toast(`Gagal memutar: ${err.message}`);
      });
    }

    this.recordHistory(track);
    this.updateMediaSessionMeta();
    this.syncNativeAndroidNotification();
  }

  private async resolveAndPlayYoutubeAudio(track: Track): Promise<void> {
    if (!track.videoId) return;
    const streamUrl = await resolveYoutubeAudioStream(track.videoId);
    if (!streamUrl || this.current?.id !== track.id) return;
    const upgraded: Track = { ...track, url: streamUrl };
    this.current = upgraded;
    this.ensureWebAudio();
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (this.audioEl) {
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.src = streamUrl;
      this.audioEl.load();
      this.applyPlaybackRate();
      this.audioEl.play().catch(() => {
        // If direct stream fails, TrackModal still provides the YouTube embed fallback
        if (this.current?.id === track.id) {
          this.current = { ...track, url: undefined };
        }
      });
    }
  }

  togglePlay(): void {
    if (!this.current) {
      if (this.queue.length > 0) this.playTrack(this.queue[0]);
      return;
    }
    if ((this.current.videoId && !this.current.url) || this.current.spotifyId) return;
    if (this.playing) {
      this.pause();
    } else if (this.audioEl) {
      this.ensureWebAudio();
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.audioEl.play().catch((err: Error) => this.toast(`Gagal memutar: ${err.message}`));
    }
  }

  pause(): void {
    if (this.audioEl) this.audioEl.pause();
  }

  stopTrack(): void {
    this.stopPositionSync();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    }
    this.playing = false;
    this.current = null;
    this.position = 0;
    this.duration = 0;
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
    window.XmusicAndroidMedia?.clearNotification();
  }

  seekTo(fraction: number): void {
    if (!this.audioEl || !this.current) return;
    const total = this.duration || this.audioEl.duration || 0;
    if (!total) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    this.audioEl.currentTime = clamped * total;
    this.position = this.audioEl.currentTime;
    this.updateMediaSessionPosition();
    this.syncNativeAndroidNotification();
  }

  seekBySeconds(deltaSec: number): void {
    const total = this.duration || this.audioEl?.duration || 0;
    if (!total) return;
    this.seekTo((this.position + deltaSec) / total);
  }

  next(fromEnded = false): void {
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
      this.syncNativeAndroidNotification();
      return;
    }
    this.playTrack(playable[(idx + 1) % playable.length]);
  }

  prev(): void {
    if (this.audioEl && this.position > 3) {
      this.audioEl.currentTime = 0;
      this.position = 0;
      this.updateMediaSessionPosition();
      return;
    }
    const playable = this.queue.filter((t) => !t.videoId && !t.spotifyId);
    if (!playable.length) return;
    const idx = playable.findIndex((t) => t.id === this.current?.id);
    this.playTrack(playable[(idx - 1 + playable.length) % playable.length]);
  }

  private recordHistory(track: Track): void {
    const snapshot: Track = {
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
    const filtered = this.history.filter((item) => item.id !== track.id);
    this.history = [snapshot, ...filtered].slice(0, 40);
    saveJSON('nys_history', this.history);
  }

  private startPositionSync(): void {
    this.stopPositionSync();
    this.syncIntervalId = setInterval(() => {
      if (!this.playing || !this.audioEl) return;
      this.position = this.audioEl.currentTime || 0;
      if (Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0) {
        this.duration = this.audioEl.duration;
      }
    }, 150);
  }

  private stopPositionSync(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  getSpectrum(numBars = 28, nowMs = performance.now()): number[] {
    const bars: number[] = new Array<number>(numBars).fill(0);
    if (
      this.analyserNode &&
      this.playing &&
      !this.corsBypassMode &&
      !this.current?.videoId &&
      !this.current?.spotifyId
    ) {
      this.analyserNode.getByteFrequencyData(this.freqData);
      let energy = 0;
      for (let i = 0; i < numBars; i++) {
        const bin = Math.min(
          this.freqData.length - 1,
          Math.floor((i / numBars) * (this.freqData.length * 0.75))
        );
        const val = this.freqData[bin] / 255;
        bars[i] = val;
        energy += val;
      }
      if (energy > 0.02) return bars;
    }

    if (this.playing || this.current?.videoId || this.current?.spotifyId) {
      const t = nowMs / 1000;
      for (let i = 0; i < numBars; i++) {
        bars[i] = 0.2 + 0.65 * Math.abs(Math.sin(t * (2.1 + (i % 5) * 0.4) + i * 0.65));
      }
    }
    return bars;
  }

  private registerAndroidNotificationBridge(): void {
    if (typeof window === 'undefined') return;
    window.__xmusicMediaAction = (action) => {
      if (action === 'togglePlay') this.togglePlay();
      else if (action === 'play') {
        if (!this.playing) this.togglePlay();
      } else if (action === 'pause') this.pause();
      else if (action === 'next') this.next(false);
      else if (action === 'prev') this.prev();
      else if (action === 'stop') {
        this.stopTrack();
      }
    };
  }

  private syncNativeAndroidNotification(): void {
    if (typeof window === 'undefined' || !window.XmusicAndroidMedia) return;
    if (!this.current) {
      window.XmusicAndroidMedia.clearNotification();
      return;
    }
    try {
      window.XmusicAndroidMedia.updateNowPlaying(
        this.current.title || 'nys Xmusic',
        this.current.artist || 'Xmusic',
        this.current.album || 'nys Xmusic',
        this.playing,
        Math.round((this.duration || 0) * 1000),
        Math.round((this.position || 0) * 1000)
      );
    } catch {
      // Ignore if native bridge is unavailable
    }
  }

  private setupMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null && this.audioEl) {
        this.audioEl.currentTime = details.seekTime;
        this.position = details.seekTime;
        this.updateMediaSessionPosition();
      }
    });
  }

  private updateMediaSessionMeta(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !this.current) return;
    const t = this.current;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title || 'nys Xmusic',
      artist: t.artist || 'Xmusic',
      album: t.album || 'nys Xmusic',
      artwork: t.imageUrl ? [{ src: t.imageUrl, sizes: '512x512', type: 'image/png' }] : []
    });
  }

  private updateMediaSessionState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
    this.updateMediaSessionPosition();
  }

  private updateMediaSessionPosition(): void {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }
    if (this.duration > 0 && Number.isFinite(this.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: this.duration,
          playbackRate: this.playbackRate,
          position: Math.min(this.position, this.duration)
        });
      } catch {
        // Ignore out-of-range position errors during track switches
      }
    }
  }
}

export const engine = new AudioEngine();
