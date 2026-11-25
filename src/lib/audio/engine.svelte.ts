// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Audiophile-Grade Reactive Svelte 5 Runes Audio Engine (Strict TypeScript, v6.38.0).
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
 * Stability Guarantees (v6.38.0):
 *   - Monotonic playSessionId eliminates async race conditions and phantom restarts after pause.
 *   - Transition guard suppresses spurious pause/play flicker during track switches.
 *   - Idempotent resume() + automatic self-healing recovery prevents stuck Play buttons on all sources.
 *   - Deduplicated native Android notification sync (WebView owns AudioFocus, zero ping-pong loop).
 */
import { YtAudioBridge } from './ytPlayerBridge.ts';
import { fetchArchiveAudioSearch, fetchSearch, fetchYtSearch } from '#lib/api/services.ts';
import { scoreTrackRelevance } from '#lib/search/smartSearch.ts';
import { ytPreloader } from './ytPreloader.ts';
import { EQ_BANDS, EQ_PRESETS } from '#lib/data/presets.ts';
import { loadJSON, saveJSON } from '#lib/db/storage.ts';
import type { NativeAndroidPlaybackState, RepeatMode, ResolvedAudioStream, Track } from '#lib/types/music.ts';

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
  buffering = $state<boolean>(false);
  resolvingAudio = $state<boolean>(false);
  audioResolveFailed = $state<boolean>(false);
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

  // Non-reactive DSP nodes and concurrency guards for zero overhead
  private audioEl: HTMLAudioElement | null = null;
  private directAudioEl: HTMLAudioElement | null = null;
  private usingDirectAudio = false;
  private ytBridge = new YtAudioBridge();
  private usingYtBridge = false;
  private usingNativeAndroid = false;
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
  private bgResumeTimers: ReturnType<typeof setTimeout>[] = [];
  private ytWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private stallWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private playSessionId = 0;
  private isTransitioning = false;
  private userPaused = false;
  private ducked = false;
  private bgAutoResumeCount = 0;
  private stallRecoveryCount = 0;
  private lastAndroidSyncKey = '';
  private bgVisibilityHandler: (() => void) | null = null;
  private onToast: ((message: string) => void) | null = null;

  private get activeEl(): HTMLAudioElement | null {
    return this.usingDirectAudio ? this.directAudioEl : this.audioEl;
  }

  private canUseNativeAndroidPlayer(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.XmusicAndroidMedia?.playNativeUrl === 'function'
    );
  }

  private readNativeAndroidState(): NativeAndroidPlaybackState | null {
    if (typeof window === 'undefined' || typeof window.XmusicAndroidMedia?.getNativeStateJson !== 'function') {
      return null;
    }
    try {
      const raw = window.XmusicAndroidMedia.getNativeStateJson();
      if (!raw) return null;
      return JSON.parse(raw) as NativeAndroidPlaybackState;
    } catch {
      return null;
    }
  }

  private syncFromNativeAndroidState(): NativeAndroidPlaybackState | null {
    const st = this.readNativeAndroidState();
    if (!st) return null;
    if (st.active) {
      if (st.positionMs >= 0) this.position = st.positionMs / 1000;
      if (st.durationMs > 0) {
        this.duration = st.durationMs / 1000;
        if (this.current) this.current.dur = this.duration;
      }
      this.playing = st.playing;
    }
    return st;
  }

  private playNativeAndroidUrl(
    stream: ResolvedAudioStream,
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): void {
    if (!this.canUseNativeAndroidPlayer() || sessionId !== this.playSessionId || this.userPaused) {
      return;
    }
    this.isTransitioning = true;
    try {
      if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
      if (this.directAudioEl && !this.directAudioEl.paused) this.directAudioEl.pause();
      if (this.usingYtBridge) this.ytBridge.stop();
      this.usingYtBridge = false;
      this.usingDirectAudio = false;
      this.usingNativeAndroid = true;
      this.corsBypassMode = true;
      this.resolvingAudio = false;
      this.audioResolveFailed = false;
      this.buffering = false;
    } finally {
      this.isTransitioning = false;
    }

    saveJSON('nys_last_native_track', { ...track, url: undefined });
    const effVol = this.muted ? 0 : this.ducked ? Math.max(0.05, this.volume * 0.25) : this.volume;
    try {
      window.XmusicAndroidMedia?.playNativeUrl?.(
        track.id,
        track.title || 'nys Xmusic',
        track.artist || 'Xmusic',
        track.album || 'nys Xmusic',
        stream.url,
        stream.userAgent || '',
        Math.round(Math.max(0, resumeAt) * 1000),
        effVol
      );
      this.startPositionSync();
      setTimeout(() => {
        if (sessionId === this.playSessionId && this.usingNativeAndroid && this.buffering) {
          const st = this.syncFromNativeAndroidState();
          if (st?.playing) {
            this.buffering = false;
          }
        }
      }, 3500);
    } catch {
      this.usingNativeAndroid = false;
      this.playDirectUrl(stream.url, track, sessionId, resumeAt);
    }
  }

  private playResolvedStream(
    stream: ResolvedAudioStream,
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): void {
    if (this.canUseNativeAndroidPlayer()) {
      this.playNativeAndroidUrl(stream, track, sessionId, resumeAt);
      return;
    }
    this.playDirectUrl(stream.url, track, sessionId, resumeAt);
  }

  private bindAudioEvents(el: HTMLAudioElement, isDirect: boolean): void {
    el.addEventListener('play', () => {
      if (this.usingDirectAudio !== isDirect || this.isTransitioning) return;
      this.playing = true;
      this.resolvingAudio = false;
      this.audioResolveFailed = false;
      this.clearResumeRecovery();
      if (!isDirect && this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.startPositionSync();
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    });

    el.addEventListener('playing', () => {
      if (this.usingDirectAudio !== isDirect || this.isTransitioning) return;
      this.playing = true;
      this.buffering = false;
      this.resolvingAudio = false;
      this.audioResolveFailed = false;
      this.stallRecoveryCount = 0;
      this.clearStallWatchdog();
      this.clearResumeRecovery();
      this.startPositionSync();
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    });

    el.addEventListener('canplay', () => {
      if (this.usingDirectAudio !== isDirect) return;
      this.buffering = false;
      this.clearStallWatchdog();
    });

    const handleBuffering = (): void => {
      if (this.usingDirectAudio !== isDirect || this.isTransitioning || this.userPaused || el.paused) {
        return;
      }
      this.buffering = true;
      this.armStallWatchdog(el, this.playSessionId);
    };

    el.addEventListener('waiting', handleBuffering);
    el.addEventListener('stalled', handleBuffering);

    el.addEventListener('pause', () => {
      if (this.usingDirectAudio !== isDirect || this.isTransitioning) return;
      this.playing = false;
      this.buffering = false;
      this.clearStallWatchdog();
      this.stopPositionSync();
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    });

    el.addEventListener('loadedmetadata', () => {
      if (this.usingDirectAudio !== isDirect) return;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.duration = el.duration;
        if (this.current) this.current.dur = el.duration;
      }
      this.applyPlaybackRate();
      this.updateMediaSessionPosition();
      this.syncNativeAndroidNotification();
    });

    el.addEventListener('ended', () => {
      if (this.usingDirectAudio !== isDirect || this.isTransitioning) return;
      this.buffering = false;
      this.clearStallWatchdog();
      this.stopPositionSync();
      if (this.sleepMinutes === -1) {
        this.setSleepTimer(0);
        this.playing = false;
        this.syncNativeAndroidNotification(true);
        this.toast('Sleep Timer: Pemutaran dihentikan di akhir lagu.');
        return;
      }
      if (this.repeat === 'one') {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        this.next(true);
      }
    });

    if (!isDirect) {
      el.addEventListener('error', () => {
        if (this.usingDirectAudio || this.isTransitioning) return;
        this.buffering = false;
        this.clearStallWatchdog();
        if (this.current?.url && !this.current.url.startsWith('blob:') && this.directAudioEl) {
          // Automatic seamless switch to CORS-free directAudioEl if server lacks CORS headers
          this.corsBypassMode = true;
          const resumePos = this.position || 0;
          this.isTransitioning = true;
          this.usingDirectAudio = true;
          this.directAudioEl.volume = this.volume;
          this.directAudioEl.muted = this.muted;
          this.directAudioEl.src = this.current.url;
          this.directAudioEl.currentTime = resumePos;
          this.applyPlaybackRate();
          this.isTransitioning = false;
          this.directAudioEl.play().catch((err: Error) => {
            if (err.name === 'AbortError') return;
            this.toast(`Gagal memutar stream: ${err.message}`);
          });
        }
      });
    } else {
      el.addEventListener('error', () => {
        if (!this.usingDirectAudio || !this.current || this.isTransitioning) return;
        this.buffering = false;
        this.clearStallWatchdog();
        const vid = this.current.videoId;
        if (vid) {
          ytPreloader.invalidate(vid);
          const sessionId = ++this.playSessionId;
          this.usingDirectAudio = false;
          this.current = { ...this.current, url: undefined };
          this.usingYtBridge = true;
          this.resolvingAudio = true;
          void this.startYoutubeAudioBridge(this.current, sessionId);
        } else {
          this.playing = false;
          this.syncNativeAndroidNotification();
        }
      });
    }
  }

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
    this.audioEl.preload = 'auto';
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.volume = this.volume;
    this.bindAudioEvents(this.audioEl, false);

    // Pure native HTML5 audio element (no crossorigin, never attached to Web Audio CORS lock)
    // Guarantees smooth, buffered, glitch-free playback for remote & YouTube Music direct streams
    this.directAudioEl = new Audio();
    this.directAudioEl.preload = 'auto';
    this.directAudioEl.volume = this.volume;
    this.bindAudioEvents(this.directAudioEl, true);

    this.ytBridge.configure({
      onStateChange: (state) => {
        if (!this.usingYtBridge || this.isTransitioning) return;
        if (state === 1) {
          this.clearYtWatchdog();
          this.clearResumeRecovery();
          this.playing = true;
          this.buffering = false;
          this.bgAutoResumeCount = 0;
          this.resolvingAudio = false;
          this.audioResolveFailed = false;
          const dur = this.ytBridge.getDuration();
          if (Number.isFinite(dur) && dur > 0) {
            this.duration = dur;
            if (this.current) this.current.dur = dur;
          }
          this.startPositionSync();
          this.updateMediaSessionState();
          this.syncNativeAndroidNotification();
        } else if (state === 3) {
          // Transient initial buffering: keep UI responsive without blocking spinner
          this.resolvingAudio = false;
        } else if (state === 2) {
          this.buffering = false;
          if (
            typeof document !== 'undefined' &&
            document.hidden &&
            !this.userPaused &&
            this.playing &&
            this.bgAutoResumeCount < 3
          ) {
            this.bgAutoResumeCount += 1;
            const sessionId = this.playSessionId;
            const trackSnap = this.current;
            const resumePos = Math.max(this.position, this.ytBridge.getCurrentTime());
            // Try upgrading to a native background-immune <audio> stream if YouTube IFrame paused in background
            if (trackSnap?.videoId && this.bgAutoResumeCount === 1) {
              void ytPreloader.resolveNow(trackSnap.videoId, true).then((stream) => {
                if (
                  stream?.url &&
                  sessionId === this.playSessionId &&
                  !this.userPaused &&
                  this.usingYtBridge &&
                  this.current?.id === trackSnap.id
                ) {
                  this.current = { ...trackSnap, url: stream.url };
                  this.playResolvedStream(stream, this.current, sessionId, resumePos);
                }
              });
            }
            setTimeout(() => {
              if (
                sessionId === this.playSessionId &&
                !this.userPaused &&
                this.usingYtBridge &&
                this.ytBridge.getPlayerState() !== 1
              ) {
                this.ytBridge.resume();
              }
            }, 180);
            return;
          }
          this.playing = false;
          this.stopPositionSync();
          this.updateMediaSessionState();
          this.syncNativeAndroidNotification();
        } else if (state === 0) {
          this.buffering = false;
          this.stopPositionSync();
          if (this.sleepMinutes === -1) {
            this.setSleepTimer(0);
            this.playing = false;
            this.syncNativeAndroidNotification(true);
            this.toast('Sleep Timer: Pemutaran dihentikan di akhir lagu.');
            return;
          }
          if (this.repeat === 'one') {
            this.ytBridge.seekTo(0);
            this.ytBridge.resume();
          } else {
            this.next(true);
          }
        }
      },
      onError: () => {
        if (!this.usingYtBridge || !this.current?.videoId || this.isTransitioning) return;
        if (this.usingNativeAndroid || this.usingDirectAudio) return;
        // Fallback to direct InnerTube/Piped stream resolver if uploader blocked IFrame playback
        this.usingYtBridge = false;
        this.buffering = false;
        void this.resolveAndPlayYoutubeAudio(this.current, this.playSessionId);
      }
    });

    this.setupMediaSession();
    this.registerAndroidNotificationBridge();
    this.setupBackgroundPlaybackGuard();
    this.handleForegroundResume();
    // Eagerly warm up YouTube IFrame API script in background so first YT track plays faster
    setTimeout(() => this.ytBridge.warmUp(), 600);
  }

  destroy(): void {
    this.playSessionId += 1;
    this.stopPositionSync();
    this.clearBgResumeTimers();
    this.clearYtWatchdog();
    this.clearResumeRecovery();
    this.clearStallWatchdog();
    if (this.bgVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.bgVisibilityHandler);
      this.bgVisibilityHandler = null;
    }
    if (this.sleepIntervalId) clearInterval(this.sleepIntervalId);
    this.ytBridge.destroy();
    // NEVER kill XmusicMediaService on page/WebView teardown while native ExoPlayer is playing in background!
    if (!this.usingNativeAndroid) {
      window.XmusicAndroidMedia?.clearNotification();
    }
    for (const el of [this.audioEl, this.directAudioEl]) {
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
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
    for (const el of [this.audioEl, this.directAudioEl]) {
      if (el) {
        el.volume = clamped;
        el.muted = this.muted;
      }
    }
    if (this.usingYtBridge) this.ytBridge.setVolume(clamped, this.muted);
    if (this.usingNativeAndroid) window.XmusicAndroidMedia?.setNativeVolume?.(this.muted ? 0 : clamped);
    this.savePrefs();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.audioEl) this.audioEl.muted = this.muted;
    if (this.directAudioEl) this.directAudioEl.muted = this.muted;
    if (this.usingYtBridge) this.ytBridge.setVolume(this.volume, this.muted);
    if (this.usingNativeAndroid) window.XmusicAndroidMedia?.setNativeVolume?.(this.muted ? 0 : this.volume);
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
    for (const el of [this.audioEl, this.directAudioEl]) {
      if (el) {
        el.playbackRate = this.playbackRate;
        el.preservesPitch = this.preservesPitch;
      }
    }
    if (this.usingYtBridge) this.ytBridge.setPlaybackRate(this.playbackRate);
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
      this.applyEffectiveVolume();
      if (minutes === -1) {
        this.toast('Sleep Timer: Berhenti otomatis setelah lagu ini selesai.');
      }
      return;
    }
    this.sleepRemainingSec = minutes * 60;
    this.toast(`Sleep Timer aktif: ${minutes} menit`);
    this.sleepIntervalId = setInterval(() => {
      this.sleepRemainingSec -= 1;
      if (this.sleepRemainingSec > 0 && this.sleepRemainingSec <= 5) {
        const faded = this.volume * (this.sleepRemainingSec / 5);
        if (this.audioEl) this.audioEl.volume = faded;
        if (this.directAudioEl) this.directAudioEl.volume = faded;
        if (this.usingYtBridge) this.ytBridge.setVolume(faded, this.muted);
      }
      if (this.sleepRemainingSec <= 0) {
        if (this.sleepIntervalId) clearInterval(this.sleepIntervalId);
        this.sleepMinutes = 0;
        this.sleepRemainingSec = 0;
        this.pause();
        this.applyEffectiveVolume();
        this.toast('Sleep Timer selesai. Selamat beristirahat!');
      }
    }, 1000);
  }

  prewarmTrack(track: Track | null | undefined): void {
    if (!track || !track.videoId || track.url) return;
    ytPreloader.prefetch(track.videoId, true);
  }

  prewarmTracks(tracks: Track[], limit = 4): void {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    ytPreloader.prefetchTracks(tracks, limit, false);
  }

  private clearYtWatchdog(): void {
    if (this.ytWatchdogTimer !== null) {
      clearTimeout(this.ytWatchdogTimer);
      this.ytWatchdogTimer = null;
    }
  }

  private clearResumeRecovery(): void {
    if (this.resumeRecoveryTimer !== null) {
      clearTimeout(this.resumeRecoveryTimer);
      this.resumeRecoveryTimer = null;
    }
  }

  private clearStallWatchdog(): void {
    if (this.stallWatchdogTimer !== null) {
      clearTimeout(this.stallWatchdogTimer);
      this.stallWatchdogTimer = null;
    }
  }

  private armStallWatchdog(el: HTMLAudioElement, sessionId: number): void {
    this.clearStallWatchdog();
    const startPos = el.currentTime;
    this.stallWatchdogTimer = setTimeout(() => {
      this.stallWatchdogTimer = null;
      if (sessionId !== this.playSessionId || this.userPaused || el.paused || !this.current) return;
      if (Math.abs(el.currentTime - startPos) >= 0.05) {
        this.buffering = false;
        return;
      }
      if (this.stallRecoveryCount >= 2) return;
      this.stallRecoveryCount += 1;

      if (this.current.videoId) {
        ytPreloader.invalidate(this.current.videoId);
        this.retryYoutubeAudio();
        return;
      }

      try {
        const target = Math.max(0, el.currentTime);
        el.currentTime = target;
        el.play().catch(() => {});
      } catch {
        // Ignore seek errors on live/unseekable streams
      }
    }, 8000);
  }

  private preloadUpcomingQueue(): void {
    if (!this.queue.length || !this.current) return;
    const idx = this.queue.findIndex((t) => t.id === this.current?.id);
    if (idx < 0) return;
    const upcoming: Track[] = [];
    for (let offset = 1; offset <= 2; offset++) {
      const candidate = this.queue[(idx + offset) % this.queue.length];
      if (candidate && candidate.id !== this.current.id && candidate.videoId && !candidate.url) {
        upcoming.push(candidate);
      }
    }
    if (upcoming.length > 0) {
      ytPreloader.prefetchTracks(upcoming, 2, true);
    }
  }

  private playDirectUrl(url: string, track: Track, sessionId: number, resumeAt = 0): void {
    if (!this.directAudioEl || sessionId !== this.playSessionId || this.userPaused) return;
    const el = this.directAudioEl;
    this.isTransitioning = true;
    try {
      if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
      if (this.usingYtBridge) this.ytBridge.stop();
      if (this.usingNativeAndroid) window.XmusicAndroidMedia?.stopNative?.();
      this.usingNativeAndroid = false;
      this.usingYtBridge = false;
      this.usingDirectAudio = true;
      this.corsBypassMode = true;
      this.resolvingAudio = false;
      this.audioResolveFailed = false;
      this.buffering = false;
      el.volume = this.ducked ? Math.max(0.05, this.volume * 0.25) : this.volume;
      el.muted = this.muted;
      el.src = url;
      if (resumeAt > 1) {
        const applyResumeSeek = (): void => {
          if (sessionId !== this.playSessionId || !this.usingDirectAudio) return;
          try {
            const cap = Number.isFinite(el.duration) && el.duration > 2 ? el.duration - 1 : resumeAt;
            el.currentTime = Math.min(resumeAt, cap);
            this.position = el.currentTime;
          } catch {
            // Ignore seek errors before metadata is ready
          }
        };
        if (el.readyState >= 1) {
          applyResumeSeek();
        } else {
          el.addEventListener('loadedmetadata', applyResumeSeek, { once: true });
        }
      }
      this.applyPlaybackRate();
    } finally {
      this.isTransitioning = false;
    }

    el.play().catch((err: Error) => {
      if (err.name === 'AbortError' || sessionId !== this.playSessionId || this.userPaused) return;
      if (track.videoId) {
        ytPreloader.invalidate(track.videoId);
        this.usingDirectAudio = false;
        this.usingYtBridge = true;
        this.resolvingAudio = true;
        void this.startYoutubeAudioBridge({ ...track, url: undefined }, sessionId, resumeAt);
      } else {
        this.playing = false;
        this.buffering = false;
        this.syncNativeAndroidNotification();
        this.toast(`Gagal memutar: ${err.message}`);
      }
    });
  }

  playTrack(track: Track | null, customQueue: Track[] | null = null, forceRestart = false): void {
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
      this.syncNativeAndroidNotification(true);
      return;
    }

    // Same track tapped again while healthy: toggle Play/Pause smoothly without resetting to 0:00
    if (!forceRestart && this.current?.id === track.id && !this.audioResolveFailed && !this.resolvingAudio) {
      this.togglePlay();
      return;
    }

    const sessionId = ++this.playSessionId;
    this.clearYtWatchdog();
    this.clearResumeRecovery();
    this.clearStallWatchdog();
    this.clearBgResumeTimers();
    this.userPaused = false;
    this.bgAutoResumeCount = 0;
    this.stallRecoveryCount = 0;
    this.buffering = false;
    this.audioResolveFailed = false;

    // YouTube Music Track (Instant Cached Preload -> Dual-Path Fast Race)
    if (track.videoId) {
      this.isTransitioning = true;
      try {
        if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
        if (this.directAudioEl && !this.directAudioEl.paused) this.directAudioEl.pause();
        if (this.usingYtBridge) this.ytBridge.stop();
        if (this.usingNativeAndroid) window.XmusicAndroidMedia?.stopNative?.();
        this.usingNativeAndroid = false;
      } finally {
        this.isTransitioning = false;
      }

      this.current = track;
      this.position = 0;
      this.duration = track.dur || 0;
      this.recordHistory(track);
      this.updateMediaSessionMeta();
      this.preloadUpcomingQueue();

      // Always start the official YouTube IFrame Player API bridge immediately at 0ms
      // so audio starts instantaneously with zero stream-extraction stall.
      // Any pre-resolved native stream is kept ready in ytPreloader for seamless background/lockscreen handoff!
      this.usingDirectAudio = false;
      this.usingYtBridge = true;
      this.resolvingAudio = false;
      this.buffering = false;
      this.syncNativeAndroidNotification();
      void this.startYoutubeSmartPlayback(track, sessionId, 0);
      return;
    }

    if (!track.url) {
      this.toast('Lagu ini tidak memiliki sumber audio.');
      return;
    }

    this.resolvingAudio = false;
    this.current = track;
    this.position = 0;
    this.duration = track.dur || 0;

    const isLocalBlob = track.url.startsWith('blob:') || track.url.startsWith('data:');

    if (isLocalBlob && this.audioEl) {
      // Local offline files: full Web Audio 5-Band EQ & Mastering DSP (zero CORS risk)
      this.ensureWebAudio();
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.isTransitioning = true;
      try {
        if (this.usingYtBridge) this.ytBridge.stop();
        if (this.usingNativeAndroid) window.XmusicAndroidMedia?.stopNative?.();
        this.usingNativeAndroid = false;
        this.usingYtBridge = false;
        if (this.directAudioEl && !this.directAudioEl.paused) this.directAudioEl.pause();
        this.usingDirectAudio = false;
        this.corsBypassMode = false;
        this.audioEl.removeAttribute('crossorigin');
        this.audioEl.src = track.url;
        this.applyPlaybackRate();
      } finally {
        this.isTransitioning = false;
      }
      this.audioEl.play().catch((err: Error) => {
        if (err.name === 'AbortError' || sessionId !== this.playSessionId || this.userPaused) return;
        // Guaranteed fallback to pure native audio element if Web Audio fails
        if (this.current?.id === track.id && track.url) {
          this.playDirectUrl(track.url, track, sessionId);
        }
      });
    } else if (track.isPreview) {
      // Instant 0ms playback using preview URL first, while seamlessly upgrading to full-length track in background!
      this.resolvingAudio = false;
      if (track.url) {
        this.playResolvedStream({ url: track.url }, track, sessionId, 0);
      }
      void this.upgradePreviewToFullTrack(track, sessionId);
    } else {
      // All full-length remote HTTP/HTTPS streams (Audius, Internet Archive, Direct URLs):
      // On Android, play via XmusicMediaService Media3 ExoPlayer so background & screen-off never stop
      this.playResolvedStream({ url: track.url }, track, sessionId, 0);
    }

    this.recordHistory(track);
    this.updateMediaSessionMeta();
    this.syncNativeAndroidNotification();
    this.preloadUpcomingQueue();
  }

  private async upgradePreviewToFullTrack(previewTrack: Track, sessionId: number): Promise<void> {
    const cleanTitle = (previewTrack.title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = (previewTrack.artist || '').split(',')[0].trim();
    const query = `${cleanTitle} ${cleanArtist}`.trim();

    try {
      const [ytHits, audiusHits] = await Promise.all([
        fetchYtSearch(query).catch(() => [] as Track[]),
        fetchSearch(query, 6).catch(() => [] as Track[])
      ]);
      if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== previewTrack.id) {
        return;
      }

      const normTitle = cleanTitle.toLowerCase();
      const fullAudius =
        audiusHits.find((t) => t.url && !t.isPreview && t.dur >= 60 && t.title.toLowerCase().includes(normTitle)) ||
        audiusHits.find((t) => Boolean(t.url && !t.isPreview && t.dur >= 60));

      const fullYt =
        ytHits.find((t) => t.videoId && t.title.toLowerCase().includes(normTitle)) ||
        ytHits.find((t) => Boolean(t.videoId));

      if (fullAudius?.url) {
        const resumeAt = Math.max(0, this.position || 0);
        const upgraded: Track = {
          ...previewTrack,
          url: fullAudius.url,
          dur: fullAudius.dur || previewTrack.dur,
          isPreview: false,
          source: 'audius'
        };
        this.current = upgraded;
        this.duration = upgraded.dur || 0;
        this.resolvingAudio = false;
        this.updateMediaSessionMeta();
        this.playResolvedStream({ url: fullAudius.url }, upgraded, sessionId, resumeAt);
        return;
      }

      if (fullYt?.videoId) {
        const resolved = await Promise.race([
          ytPreloader.resolveNow(fullYt.videoId, true),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
        ]);
        if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== previewTrack.id) {
          return;
        }
        if (resolved?.url) {
          const resumeAt = Math.max(0, this.position || 0);
          const upgraded: Track = {
            ...previewTrack,
            videoId: fullYt.videoId,
            url: resolved.url,
            dur: fullYt.dur || previewTrack.dur,
            isPreview: false,
            source: 'youtube'
          };
          this.current = upgraded;
          this.duration = upgraded.dur || 0;
          this.resolvingAudio = false;
          this.updateMediaSessionMeta();
          this.playResolvedStream(resolved, upgraded, sessionId, resumeAt);
          return;
        }
      }
    } catch {
      // Fallback to 30s preview stream below only if no full version exists anywhere
    }

    if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== previewTrack.id) {
      return;
    }
    this.resolvingAudio = false;
    if (previewTrack.url) {
      this.playResolvedStream({ url: previewTrack.url }, previewTrack, sessionId, 0);
    }
  }

  private async startYoutubeSmartPlayback(
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): Promise<void> {
    if (!track.videoId) return;
    const videoId = track.videoId;
    const trackId = track.id;

    // 1. Warm up background stream cache silently (never interrupts foreground official YT Player!)
    ytPreloader.prefetch(videoId, true);

    // 2. Watchdog (4.5s): only triggers fallback if the official YouTube IFrame Player hasn't started playing yet
    this.clearYtWatchdog();
    this.ytWatchdogTimer = setTimeout(() => {
      this.ytWatchdogTimer = null;
      if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== trackId) {
        return;
      }
      if (!this.playing && !this.usingNativeAndroid && !this.usingDirectAudio) {
        void this.resolveAndPlayYoutubeAudio(track, sessionId, resumeAt);
      } else {
        this.resolvingAudio = false;
        this.buffering = false;
      }
    }, 4500);

    // 3. Play directly through the official YouTube IFrame Player API at 0ms
    this.usingYtBridge = true;
    await this.startYoutubeAudioBridge(track, sessionId, resumeAt);
  }

  private async startYoutubeAudioBridge(
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): Promise<void> {
    if (!track.videoId) return;
    const ok = await this.ytBridge.play(
      track.videoId,
      this.volume,
      this.muted,
      this.playbackRate,
      resumeAt
    );
    if (
      sessionId !== this.playSessionId ||
      this.userPaused ||
      this.current?.id !== track.id ||
      this.playing ||
      this.usingDirectAudio ||
      this.usingNativeAndroid
    ) {
      return;
    }
    if (ok) {
      this.resolvingAudio = false;
      this.buffering = false;
    } else {
      this.usingYtBridge = false;
      await this.resolveAndPlayYoutubeAudio(track, sessionId, resumeAt);
    }
  }

  retryYoutubeAudio(preservePosition = false): void {
    if (!this.current?.videoId) return;
    const resumeAt = preservePosition ? Math.max(0, this.position || 0) : 0;
    const sessionId = ++this.playSessionId;
    ytPreloader.invalidate(this.current.videoId);
    this.clearYtWatchdog();
    this.clearResumeRecovery();
    this.clearStallWatchdog();
    this.clearBgResumeTimers();
    this.userPaused = false;
    this.bgAutoResumeCount = 0;
    this.buffering = false;
    this.isTransitioning = true;
    try {
      if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
      if (this.directAudioEl && !this.directAudioEl.paused) this.directAudioEl.pause();
      if (this.usingNativeAndroid) window.XmusicAndroidMedia?.stopNative?.();
      this.usingNativeAndroid = false;
      // Destroy (not merely stop) the YouTube IFrame so suspended/zombie decoders are rebuilt clean
      this.ytBridge.destroy();
    } finally {
      this.isTransitioning = false;
    }
    this.usingDirectAudio = false;
    this.usingYtBridge = true;
    this.resolvingAudio = false;
    this.buffering = true;
    this.audioResolveFailed = false;
    const cleanTrack: Track = { ...this.current, url: undefined };
    this.current = cleanTrack;
    void this.startYoutubeSmartPlayback(cleanTrack, sessionId, resumeAt);
  }

  private async resolveAndPlayYoutubeAudio(
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): Promise<void> {
    if (!track.videoId) return;
    this.resolvingAudio = false;
    this.buffering = true;
    this.audioResolveFailed = false;
    const stream = await Promise.race([
      ytPreloader.resolveNow(track.videoId, true),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ]);
    if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== track.id) return;
    this.clearYtWatchdog();
    this.resolvingAudio = false;

    if (!stream?.url) {
      await this.tryAlternativeFullAudioFallback(track, sessionId, resumeAt);
      return;
    }

    this.current = { ...track, url: stream.url };
    this.playResolvedStream(stream, this.current, sessionId, resumeAt);
  }

  private async tryAlternativeFullAudioFallback(
    track: Track,
    sessionId: number,
    resumeAt = 0
  ): Promise<void> {
    if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== track.id) return;
    if (this.playing || this.usingNativeAndroid || this.usingDirectAudio) return;

    try {
      const cleanTitle = (track.title || '')
        .replace(/\(.*?\)|\[.*?\]|official\s*(music\s*)?(video|audio|lyric|lyrics|mv)/gi, '')
        .trim();
      const cleanArtist = (track.artist || '').replace(/YouTube Music/gi, '').trim();
      const query = `${cleanTitle} ${cleanArtist}`.trim();
      if (query) {
        const [audiusHits, archiveHits, titleOnlyAudius] = await Promise.race([
          Promise.all([
            fetchSearch(query, 8).catch(() => [] as Track[]),
            fetchArchiveAudioSearch(query, 4).catch(() => [] as Track[]),
            cleanTitle && cleanArtist ? fetchSearch(cleanTitle, 6).catch(() => [] as Track[]) : Promise.resolve([] as Track[])
          ]),
          new Promise<[Track[], Track[], Track[]]>((resolve) => setTimeout(() => resolve([[], [], []]), 2200))
        ]);
        if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== track.id) return;
        if (this.playing || this.usingNativeAndroid || this.usingDirectAudio) return;

        const pool = [...audiusHits, ...titleOnlyAudius, ...archiveHits].filter(
          (c) => Boolean(c.url && !c.isPreview && (c.dur === 0 || c.dur >= 60))
        );
        if (pool.length > 0) {
          const emptySet = new Set<string>();
          const ranked = pool
            .map((c) => ({ c, sc: scoreTrackRelevance(c, query, emptySet, emptySet) }))
            .sort((a, b) => b.sc - a.sc);
          const bestMatch = ranked[0]?.c;
          if (bestMatch?.url) {
            this.usingYtBridge = false;
            this.ytBridge.stop();
            this.resolvingAudio = false;
            this.audioResolveFailed = false;
            this.current = { ...track, url: bestMatch.url };
            this.playResolvedStream({ url: bestMatch.url }, this.current, sessionId, resumeAt);
            this.toast('Memutar via sumber audio penuh alternatif.');
            return;
          }
        }
      }
    } catch {
      // Fall through to clean error banner
    }

    if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== track.id) return;
    this.usingYtBridge = false;
    this.resolvingAudio = false;
    this.buffering = false;
    this.audioResolveFailed = true;
    this.toast('Stream audio sedang sibuk. Ketuk Coba Lagi atau Mode Video.');
  }

  /**
   * Idempotent resume with automatic self-healing recovery so clicking Play never gets stuck.
   */
  resume(): void {
    if (!this.current) {
      if (this.queue.length > 0) this.playTrack(this.queue[0]);
      return;
    }
    if (this.current.spotifyId) return;
    if (this.playing && !this.resolvingAudio) return;

    this.userPaused = false;
    this.bgAutoResumeCount = 0;
    this.clearResumeRecovery();

    if (this.usingNativeAndroid && this.canUseNativeAndroidPlayer()) {
      const st = this.readNativeAndroidState();
      if (st?.active && st.trackId === this.current.id) {
        if (st.playing) {
          this.syncFromNativeAndroidState();
          this.startPositionSync();
          return;
        }
        window.XmusicAndroidMedia?.resumeNative?.();
        return;
      }
      this.usingNativeAndroid = false;
      if (this.current.videoId) {
        this.retryYoutubeAudio(true);
        return;
      }
    }

    if (this.current.videoId) {
      if (this.usingDirectAudio && this.directAudioEl) {
        const el = this.directAudioEl;
        const needsReload =
          !el.src ||
          el.error !== null ||
          el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
        if (needsReload) {
          this.retryYoutubeAudio(true);
          return;
        }
        const sessionId = this.playSessionId;
        const beforeTime = el.currentTime || 0;
        el.play().catch((err: Error) => {
          if (err.name === 'AbortError' || this.userPaused) return;
          this.retryYoutubeAudio(true);
        });
        // Liveness watchdog: if expired googlevideo URL stalls after returning from background, refresh cleanly
        this.resumeRecoveryTimer = setTimeout(() => {
          this.resumeRecoveryTimer = null;
          if (sessionId !== this.playSessionId || this.userPaused || !this.usingDirectAudio) return;
          if (el.paused || (!this.playing && Math.abs((el.currentTime || 0) - beforeTime) < 0.05)) {
            this.retryYoutubeAudio(true);
          }
        }, 2500);
        return;
      }

      if (this.usingYtBridge) {
        const st = this.ytBridge.getPlayerState();
        const sameVideo = this.ytBridge.getCurrentVideoId() === this.current.videoId;
        if (
          !this.ytBridge.isReady() ||
          this.audioResolveFailed ||
          this.resolvingAudio ||
          !sameVideo ||
          st === -1 ||
          st === 0
        ) {
          this.retryYoutubeAudio(true);
          return;
        }
        const beforeTime = this.ytBridge.getCurrentTime();
        const ok = this.ytBridge.resume();
        if (!ok) {
          this.retryYoutubeAudio(true);
          return;
        }
        const sessionId = this.playSessionId;
        // Liveness watchdog: catches both frozen BUFFERING (state 3) and zombie iframes with 0s progress
        this.resumeRecoveryTimer = setTimeout(() => {
          this.resumeRecoveryTimer = null;
          if (sessionId !== this.playSessionId || this.userPaused || !this.usingYtBridge) return;
          const liveState = this.ytBridge.getPlayerState();
          const progressed = Math.abs(this.ytBridge.getCurrentTime() - beforeTime) >= 0.05;
          if (liveState !== 1 || (!this.playing && !progressed)) {
            this.retryYoutubeAudio(true);
          }
        }, 2000);
        return;
      }

      this.retryYoutubeAudio(true);
      return;
    }

    const el = this.activeEl;
    if (!el) return;
    const needsReload =
      !el.src ||
      el.error !== null ||
      el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
    if (needsReload && this.current.url) {
      const sessionId = ++this.playSessionId;
      this.playDirectUrl(this.current.url, this.current, sessionId);
      return;
    }

    if (!this.usingDirectAudio) {
      this.ensureWebAudio();
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    }

    el.play().catch((err: Error) => {
      if (err.name === 'AbortError' || this.userPaused) return;
      if (!this.usingDirectAudio && this.current?.url) {
        const sessionId = ++this.playSessionId;
        this.playDirectUrl(this.current.url, this.current, sessionId);
      } else {
        this.toast(`Gagal memutar: ${err.message}`);
      }
    });
  }

  togglePlay(): void {
    if (!this.current) {
      if (this.queue.length > 0) this.playTrack(this.queue[0]);
      return;
    }
    if (this.current.spotifyId) return;

    if (this.playing && !this.resolvingAudio) {
      this.pause();
    } else if (this.resolvingAudio && this.current.videoId) {
      this.retryYoutubeAudio(true);
    } else {
      this.resume();
    }
  }

  pause(): void {
    this.userPaused = true;
    this.clearBgResumeTimers();
    this.clearResumeRecovery();
    this.clearStallWatchdog();
    this.clearYtWatchdog();
    this.resolvingAudio = false;
    this.buffering = false;
    if (this.audioEl && !this.audioEl.paused) this.audioEl.pause();
    if (this.directAudioEl && !this.directAudioEl.paused) this.directAudioEl.pause();
    if (this.usingNativeAndroid) window.XmusicAndroidMedia?.pauseNative?.();
    if (this.usingYtBridge) this.ytBridge.pause();
    this.playing = false;
    this.stopPositionSync();
    this.updateMediaSessionState();
    this.syncNativeAndroidNotification();
  }

  stopTrack(): void {
    this.playSessionId += 1;
    this.userPaused = true;
    this.clearBgResumeTimers();
    this.clearYtWatchdog();
    this.clearResumeRecovery();
    this.clearStallWatchdog();
    this.stopPositionSync();
    this.isTransitioning = true;
    try {
      for (const el of [this.audioEl, this.directAudioEl]) {
        if (el) {
          el.pause();
          el.currentTime = 0;
          el.removeAttribute('src');
          el.load();
        }
      }
    } finally {
      this.isTransitioning = false;
    }
    if (this.usingNativeAndroid) window.XmusicAndroidMedia?.stopNative?.();
    this.usingNativeAndroid = false;
    this.usingDirectAudio = false;
    this.usingYtBridge = false;
    this.playing = false;
    this.buffering = false;
    this.resolvingAudio = false;
    this.audioResolveFailed = false;
    this.current = null;
    this.position = 0;
    this.duration = 0;
    this.lastAndroidSyncKey = '';
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
    this.ytBridge.destroy();
    window.XmusicAndroidMedia?.clearNotification();
  }

  seekTo(fraction: number): void {
    if (!this.current) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    if (this.usingNativeAndroid) {
      const total = this.duration || 0;
      if (!total) return;
      const target = clamped * total;
      this.position = target;
      window.XmusicAndroidMedia?.seekNative?.(Math.round(target * 1000));
      this.updateMediaSessionPosition();
      return;
    }
    if (this.usingYtBridge) {
      const total = this.duration || this.ytBridge.getDuration() || 0;
      if (!total) return;
      const target = clamped * total;
      this.ytBridge.seekTo(target);
      this.position = target;
      this.updateMediaSessionPosition();
      this.syncNativeAndroidNotification(true);
      return;
    }
    const el = this.activeEl;
    if (!el) return;
    const total = this.duration || el.duration || 0;
    if (!total) return;
    el.currentTime = clamped * total;
    this.position = el.currentTime;
    this.updateMediaSessionPosition();
    this.syncNativeAndroidNotification(true);
  }

  seekBySeconds(deltaSec: number): void {
    const total = this.duration || this.activeEl?.duration || 0;
    if (!total) return;
    this.seekTo((this.position + deltaSec) / total);
  }

  next(fromEnded = false): void {
    const playable = this.queue.filter((t) => !t.spotifyId);
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
      this.syncNativeAndroidNotification(true);
      return;
    }
    const nextTrack = playable[(idx + 1) % playable.length];
    this.playTrack(nextTrack, null, fromEnded || nextTrack.id === this.current?.id);
  }

  prev(): void {
    if (this.position > 3) {
      if (this.usingNativeAndroid) window.XmusicAndroidMedia?.seekNative?.(0);
      else if (this.usingYtBridge) this.ytBridge.seekTo(0);
      else if (this.activeEl) this.activeEl.currentTime = 0;
      this.position = 0;
      this.updateMediaSessionPosition();
      return;
    }
    const playable = this.queue.filter((t) => !t.spotifyId);
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
      videoId: track.videoId,
      url: track.url && !track.url.startsWith('blob:') && !track.videoId ? track.url : undefined,
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
      if (this.usingNativeAndroid) {
        this.syncFromNativeAndroidState();
        return;
      }
      if (!this.playing) return;
      if (this.usingYtBridge) {
        this.position = this.ytBridge.getCurrentTime();
        const dur = this.ytBridge.getDuration();
        if (Number.isFinite(dur) && dur > 0) this.duration = dur;
        return;
      }
      const el = this.activeEl;
      if (!el) return;
      this.position = el.currentTime || 0;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.duration = el.duration;
      }
    }, 200);
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

  private clearBgResumeTimers(): void {
    for (const id of this.bgResumeTimers) clearTimeout(id);
    this.bgResumeTimers = [];
  }

  private applyEffectiveVolume(): void {
    const eff = this.ducked ? Math.max(0.05, this.volume * 0.25) : this.volume;
    if (this.audioEl) this.audioEl.volume = eff;
    if (this.directAudioEl) this.directAudioEl.volume = eff;
    if (this.usingYtBridge) this.ytBridge.setVolume(eff, this.muted);
    if (this.usingNativeAndroid) window.XmusicAndroidMedia?.setNativeVolume?.(this.muted ? 0 : eff);
  }

  private handleForegroundResume(): void {
    this.clearBgResumeTimers();
    this.bgAutoResumeCount = 0;

    // 1. If native Android MediaPlayer in XmusicMediaService is running, sync UI state directly
    // without touching or resetting playback!
    if (this.canUseNativeAndroidPlayer()) {
      const nativeState = this.syncFromNativeAndroidState();
      if (nativeState?.active) {
        if (!this.current || (nativeState.trackId && this.current.id !== nativeState.trackId)) {
          const savedNative = loadJSON<Track | null>('nys_last_native_track', null);
          if (savedNative && (!nativeState.trackId || savedNative.id === nativeState.trackId)) {
            this.current = savedNative;
          }
        }
        this.usingNativeAndroid = true;
        this.usingYtBridge = false;
        this.usingDirectAudio = false;
        this.resolvingAudio = false;
        this.buffering = false;
        if (nativeState.playing) {
          this.userPaused = false;
          this.startPositionSync();
        } else {
          this.stopPositionSync();
        }
        this.updateMediaSessionState();
        return;
      }
    }

    if (!this.current || this.current.spotifyId) return;

    if (this.audioCtx?.state === 'suspended' && !this.userPaused) {
      this.audioCtx.resume().catch(() => {});
    }

    // 2. If fallback WebView player was paused while backgrounded, gently resume in place (never reset to 0:00)
    if (!this.userPaused) {
      if (this.usingYtBridge) {
        const st = this.ytBridge.getPlayerState();
        if (this.ytBridge.isReady() && st !== 1) {
          this.ytBridge.resume();
        } else if (!this.ytBridge.isReady()) {
          this.resume();
        }
        return;
      }
      if (this.activeEl && (!this.playing || this.activeEl.paused)) {
        this.resume();
        return;
      }
    }

    if (this.playing) {
      this.updateMediaSessionState();
      this.syncNativeAndroidNotification();
    }
  }

  private setupBackgroundPlaybackGuard(): void {
    if (typeof document === 'undefined') return;
    this.bgVisibilityHandler = () => {
      if (!document.hidden) {
        this.handleForegroundResume();
        return;
      }
      if (this.usingNativeAndroid || !this.playing || this.userPaused) return;
      if (this.audioCtx?.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.clearBgResumeTimers();
      const sessionId = this.playSessionId;

      // Proactive background handoff on Android: if a searched YouTube Music track was playing in
      // WebView (ytBridge or directAudioEl), immediately hand it off to XmusicMediaService's native
      // Media3 ExoPlayer when the user switches apps or turns off the screen!
      if (this.canUseNativeAndroidPlayer() && this.current) {
        const snap = this.current;
        const resumePos = this.usingYtBridge
          ? Math.max(this.position, this.ytBridge.getCurrentTime())
          : Math.max(this.position, this.activeEl?.currentTime || 0);
        if (snap.videoId) {
          const cached = ytPreloader.getCachedStream(snap.videoId);
          if (cached?.url) {
            this.current = { ...snap, url: cached.url };
            this.playNativeAndroidUrl(cached, this.current, sessionId, resumePos);
            return;
          }
          void ytPreloader.resolveNow(snap.videoId, true).then((stream) => {
            if (
              stream?.url &&
              sessionId === this.playSessionId &&
              !this.userPaused &&
              !this.usingNativeAndroid &&
              this.current?.id === snap.id
            ) {
              this.current = { ...snap, url: stream.url };
              this.playNativeAndroidUrl(stream, this.current, sessionId, Math.max(resumePos, this.position));
            }
          });
        } else if (snap.url && !snap.url.startsWith('blob:') && !snap.url.startsWith('data:')) {
          this.playNativeAndroidUrl({ url: snap.url }, snap, sessionId, resumePos);
          return;
        }
      }
      // Keep audio playing seamlessly across Android WebView visibility transitions / screen off
      for (const delayMs of [200, 650, 1400]) {
        const timer = setTimeout(() => {
          if (sessionId !== this.playSessionId || this.userPaused || !this.current) return;
          if (this.audioCtx?.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          if (this.usingYtBridge) {
            const st = this.ytBridge.getPlayerState();
            if (st !== 1) {
              this.ytBridge.resume();
            }
          } else if (this.activeEl && this.activeEl.paused) {
            this.activeEl.play().catch(() => {});
          }
        }, delayMs);
        this.bgResumeTimers.push(timer);
      }
    };
    document.addEventListener('visibilitychange', this.bgVisibilityHandler);
  }

  private registerAndroidNotificationBridge(): void {
    if (typeof window === 'undefined') return;
    window.__xmusicSeekMs = (positionMs: number) => {
      if (!this.current || !Number.isFinite(positionMs)) return;
      const targetSec = Math.max(0, positionMs / 1000);
      if (this.usingNativeAndroid) {
        this.position = targetSec;
        this.updateMediaSessionPosition();
        return;
      }
      const total = this.duration || this.activeEl?.duration || this.ytBridge.getDuration() || 0;
      if (total > 0) {
        this.seekTo(targetSec / total);
      }
    };
    window.__xmusicMediaAction = (action) => {
      if (action === 'togglePlay') this.togglePlay();
      else if (action === 'play') this.resume();
      else if (action === 'pause') this.pause();
      else if (action === 'next') this.next(false);
      else if (action === 'prev') this.prev();
      else if (action === 'stop') this.stopTrack();
      else if (action === 'appResumed') this.handleForegroundResume();
      else if (action === 'nativePlaying') {
        if (!this.usingNativeAndroid) return;
        this.clearYtWatchdog();
        this.clearResumeRecovery();
        this.playing = true;
        this.buffering = false;
        this.resolvingAudio = false;
        this.audioResolveFailed = false;
        this.syncFromNativeAndroidState();
        this.startPositionSync();
        this.updateMediaSessionState();
      } else if (action === 'nativePaused') {
        if (!this.usingNativeAndroid) return;
        this.playing = false;
        this.buffering = false;
        this.syncFromNativeAndroidState();
        this.stopPositionSync();
        this.updateMediaSessionState();
      } else if (action === 'nativeEnded') {
        if (!this.usingNativeAndroid) return;
        this.playing = false;
        this.buffering = false;
        this.stopPositionSync();
        if (this.sleepMinutes === -1) {
          this.setSleepTimer(0);
          this.toast('Sleep Timer: Pemutaran dihentikan di akhir lagu.');
          return;
        }
        if (this.repeat === 'one' && this.current) {
          this.position = 0;
          window.XmusicAndroidMedia?.seekNative?.(0);
          window.XmusicAndroidMedia?.resumeNative?.();
          this.playing = true;
          this.startPositionSync();
        } else {
          this.next(true);
        }
      } else if (action === 'nativeError') {
        if (!this.usingNativeAndroid || !this.current) return;
        this.usingNativeAndroid = false;
        this.buffering = false;
        const vid = this.current.videoId;
        const resumePos = Math.max(0, this.position || 0);
        if (vid) {
          ytPreloader.invalidate(vid);
          const sessionId = ++this.playSessionId;
          const cleanTrack: Track = { ...this.current, url: undefined };
          this.current = cleanTrack;
          this.resolvingAudio = true;
          void ytPreloader.resolveNow(vid, true).then((freshStream) => {
            if (sessionId !== this.playSessionId || this.userPaused || this.current?.id !== cleanTrack.id) {
              return;
            }
            if (freshStream?.url && this.canUseNativeAndroidPlayer()) {
              this.current = { ...cleanTrack, url: freshStream.url };
              this.playNativeAndroidUrl(freshStream, this.current, sessionId, resumePos);
            } else {
              this.usingYtBridge = true;
              void this.startYoutubeAudioBridge(cleanTrack, sessionId, resumePos);
            }
          });
        } else {
          this.playing = false;
        }
      }
      else if (action === 'duck') {
        this.ducked = true;
        this.applyEffectiveVolume();
      } else if (action === 'unduck') {
        this.ducked = false;
        this.applyEffectiveVolume();
      }
    };
  }

  private syncNativeAndroidNotification(force = false): void {
    if (typeof window === 'undefined' || !window.XmusicAndroidMedia) return;
    if (this.usingNativeAndroid && this.current) return;
    if (!this.current) {
      this.lastAndroidSyncKey = '';
      window.XmusicAndroidMedia.clearNotification();
      return;
    }
    const syncKey = `${this.current.id}|${this.playing ? 1 : 0}|${Math.round(this.duration || 0)}`;
    if (!force && syncKey === this.lastAndroidSyncKey) return;
    this.lastAndroidSyncKey = syncKey;
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
    navigator.mediaSession.setActionHandler('play', () => this.resume());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null && this.duration > 0) {
        this.seekTo(details.seekTime / this.duration);
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
