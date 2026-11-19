// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Official YouTube IFrame Player API Audio Bridge (Strict TypeScript).
 *
 * Improvements in v6.9.0:
 * - Monotonic playGen counter cancels stale async ensurePlayer() / play() calls immediately on stop()
 *   or track switch so two playback paths never overlap or hijack active direct <audio> playback.
 * - Avoids redundant double playVideo() calls when loadVideoById / autoplay is already starting,
 *   preventing YouTube IFrame double state transitions (PLAYING -> PAUSED stutter).
 * - Exposes isReady() and boolean resume() so AudioEngine can detect dead/unready players and recover
 *   immediately instead of leaving the Play button stuck.
 */

export interface YtPlayerInstance {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volumePercent: number): void;
  mute(): void;
  unMute(): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YtGlobal {
  Player: new (
    elementId: string,
    options: {
      height: string;
      width: string;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YtPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YtPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YtPlayerInstance;
}

interface YtBridgeCallbacks {
  onStateChange: (state: number) => void;
  onError: (code: number) => void;
}

let apiLoadPromise: Promise<YtGlobal | null> | null = null;

function loadYoutubeIframeApi(): Promise<YtGlobal | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const win = window as unknown as { YT?: YtGlobal; onYouTubeIframeAPIReady?: () => void };
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      apiLoadPromise = null;
      resolve(null);
    }, 6500);
    const prevReady = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prevReady === 'function') prevReady();
      resolve(win.YT || null);
    };
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        apiLoadPromise = null;
        resolve(null);
      };
      document.head.appendChild(script);
    }
  });
  return apiLoadPromise;
}

function getSafeOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const { protocol, hostname, origin } = window.location;
  if (
    protocol === 'https:' &&
    hostname &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.endsWith('.localhost')
  ) {
    return origin;
  }
  return null;
}

export class YtAudioBridge {
  private player: YtPlayerInstance | null = null;
  private ready = false;
  private initPromise: Promise<YtPlayerInstance | null> | null = null;
  private callbacks: YtBridgeCallbacks | null = null;
  private playGen = 0;
  private currentVideoId: string | null = null;

  configure(callbacks: YtBridgeCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Eagerly preload the YouTube IFrame API script in the background so first playback has no script delay.
   */
  warmUp(): void {
    void loadYoutubeIframeApi();
  }

  isReady(): boolean {
    return Boolean(this.player && this.ready);
  }

  getCurrentVideoId(): string | null {
    return this.currentVideoId;
  }

  private ensureMountNode(): string | null {
    if (typeof document === 'undefined') return null;
    const wrapper = document.getElementById('xmusic-yt-audio-host');
    if (!wrapper) return null;
    let inner = document.getElementById('xmusic-yt-player-slot');
    if (!inner) {
      wrapper.innerHTML = '';
      inner = document.createElement('div');
      inner.id = 'xmusic-yt-player-slot';
      wrapper.appendChild(inner);
    }
    return 'xmusic-yt-player-slot';
  }

  private ensurePlayer(initialVideoId: string): Promise<YtPlayerInstance | null> {
    if (this.player && this.ready) return Promise.resolve(this.player);
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const YT = await loadYoutubeIframeApi();
      if (!YT?.Player) {
        this.initPromise = null;
        return null;
      }
      const mountId = this.ensureMountNode();
      if (!mountId) {
        this.initPromise = null;
        return null;
      }

      return new Promise<YtPlayerInstance | null>((resolve) => {
        const timer = setTimeout(() => {
          this.initPromise = null;
          resolve(null);
        }, 7000);

        const playerVars: Record<string, string | number> = {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1
        };
        const safeOrigin = getSafeOrigin();
        if (safeOrigin) playerVars.origin = safeOrigin;

        this.player = new YT.Player(mountId, {
          height: '200',
          width: '200',
          videoId: initialVideoId,
          playerVars,
          events: {
            onReady: (event) => {
              clearTimeout(timer);
              this.ready = true;
              this.player = event.target;
              resolve(event.target);
            },
            onStateChange: (event) => {
              this.callbacks?.onStateChange(event.data);
            },
            onError: (event) => {
              this.callbacks?.onError(event.data);
            }
          }
        });
      });
    })();

    return this.initPromise;
  }

  async play(videoId: string, volume01: number, muted: boolean, rate: number): Promise<boolean> {
    const gen = ++this.playGen;
    const wasReady = Boolean(this.player && this.ready);
    const prevVideoId = this.currentVideoId;
    this.currentVideoId = videoId;

    const p = await this.ensurePlayer(videoId);
    // Abort immediately if stop(), destroy(), or a newer play() ran while awaiting onReady
    if (!p || gen !== this.playGen) return false;

    try {
      p.setVolume(Math.round(Math.max(0, Math.min(1, volume01)) * 100));
      if (muted) p.mute();
      else p.unMute();
      p.setPlaybackRate(rate);

      if (wasReady || prevVideoId !== videoId) {
        p.loadVideoById(videoId);
      }

      const st = this.getPlayerState();
      if (st !== 1 && st !== 3) {
        p.playVideo();
      }
      return true;
    } catch {
      return false;
    }
  }

  resume(): boolean {
    if (!this.player || !this.ready) return false;
    try {
      const st = this.getPlayerState();
      if (st !== 1 && st !== 3) {
        this.player.playVideo();
      }
      return true;
    } catch {
      return false;
    }
  }

  pause(): void {
    try {
      this.player?.pauseVideo();
    } catch {
      // Ignore
    }
  }

  stop(): void {
    this.playGen += 1;
    this.currentVideoId = null;
    try {
      this.player?.stopVideo();
    } catch {
      // Ignore
    }
  }

  seekTo(seconds: number): void {
    try {
      this.player?.seekTo(Math.max(0, seconds), true);
    } catch {
      // Ignore
    }
  }

  setVolume(volume01: number, muted: boolean): void {
    try {
      this.player?.setVolume(Math.round(Math.max(0, Math.min(1, volume01)) * 100));
      if (muted) this.player?.mute();
      else this.player?.unMute();
    } catch {
      // Ignore
    }
  }

  setPlaybackRate(rate: number): void {
    try {
      this.player?.setPlaybackRate(rate);
    } catch {
      // Ignore
    }
  }

  getCurrentTime(): number {
    try {
      return this.player?.getCurrentTime() || 0;
    } catch {
      return 0;
    }
  }

  getDuration(): number {
    try {
      return this.player?.getDuration() || 0;
    } catch {
      return 0;
    }
  }

  getPlayerState(): number {
    try {
      return this.player?.getPlayerState() ?? -1;
    } catch {
      return -1;
    }
  }

  destroy(): void {
    this.playGen += 1;
    this.currentVideoId = null;
    try {
      this.player?.destroy();
    } catch {
      // Ignore
    }
    this.player = null;
    this.ready = false;
    this.initPromise = null;
  }
}
