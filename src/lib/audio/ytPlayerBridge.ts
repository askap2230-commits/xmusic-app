// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Official YouTube IFrame Player API Audio Bridge (Strict TypeScript).
 *
 * Why this is required in late 2026:
 * YouTube moved unauthenticated InnerTube clients to SABR + GVS PO Token enforcement.
 * The official YouTube IFrame Player API handles PO Token, SABR, and cipher verification
 * natively inside Android WebView while letting Xmusic render 100% native iOS audio UI,
 * seekbar, volume, synced lyrics, and Android lockscreen controls.
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
    const timer = setTimeout(() => resolve(null), 8000);
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

export class YtAudioBridge {
  private player: YtPlayerInstance | null = null;
  private ready = false;
  private initPromise: Promise<YtPlayerInstance | null> | null = null;
  private callbacks: YtBridgeCallbacks | null = null;

  configure(callbacks: YtBridgeCallbacks): void {
    this.callbacks = callbacks;
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
      const host = document.getElementById('xmusic-yt-audio-host');
      if (!host) {
        this.initPromise = null;
        return null;
      }

      return new Promise<YtPlayerInstance | null>((resolve) => {
        const timer = setTimeout(() => {
          this.initPromise = null;
          resolve(null);
        }, 8000);

        this.player = new YT.Player('xmusic-yt-audio-host', {
          height: '1',
          width: '1',
          videoId: initialVideoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },
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
    const wasReady = Boolean(this.player && this.ready);
    const p = await this.ensurePlayer(videoId);
    if (!p) return false;
    try {
      p.setVolume(Math.round(Math.max(0, Math.min(1, volume01)) * 100));
      if (muted) p.mute();
      else p.unMute();
      p.setPlaybackRate(rate);
      if (wasReady) {
        p.loadVideoById(videoId);
      }
      p.playVideo();
      return true;
    } catch {
      return false;
    }
  }

  resume(): void {
    try {
      this.player?.playVideo();
    } catch {
      // Ignore
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

  destroy(): void {
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
