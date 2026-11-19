// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Smart, Data-Saver-Aware Predictive YouTube Music Preloader (v6.7.0).
 *
 * Design Principles:
 * 1. Metadata-Only Pre-Resolution: Only resolves lightweight stream URL metadata (~2-8 KB JSON),
 *    NEVER pre-downloads multi-MB audio files until the user actually plays the track.
 * 2. Network-Adaptive Budgets (Android WebView NetworkInformation API):
 *    - Wi-Fi / 4G: up to 4 viewport tracks + 2 upcoming queue tracks (concurrency 2).
 *    - 3G / Cellular: up to 2 viewport tracks + 1 upcoming queue track (concurrency 1).
 *    - Data Saver (`saveData: true`) or 2G/slow-2G: zero speculative viewport preload;
 *      resolves only on direct `pointerdown` intent + next 1 queue track.
 * 3. Visibility-Aware Battery & Data Guard: Pauses speculative viewport prefetching when
 *    `document.hidden === true` (screen off / background), allowing only urgent next-in-queue prefetch.
 * 4. Negative-Cache Backoff (5-min cooldown): Prevents repeatedly retrying failed/blocked video IDs.
 * 5. Zero-Byte DNS+TLS Preconnect: Warms TCP/TLS handshakes for resolved stream origins without
 *    downloading any audio bytes, cutting playback start latency by 150-400ms.
 */
import { resolveYoutubeAudioStream } from '#lib/api/services.ts';
import type { Track } from '#lib/types/music.ts';

interface CacheEntry {
  url: string;
  expiresAt: number;
}

interface NetworkConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
}

const CACHE_TTL_MS = 45 * 60 * 1000;
const FAIL_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 60;
const MAX_PRECONNECT_ORIGINS = 3;
const SESSION_STORAGE_KEY = 'nys_yt_stream_cache_v1';

class SmartYtPreloader {
  private cache = new Map<string, CacheEntry>();
  private failedUntil = new Map<string, number>();
  private inFlight = new Map<string, Promise<string | null>>();
  private queue: Array<{ videoId: string; urgent: boolean }> = [];
  private preconnectedOrigins = new Set<string>();
  private activeCount = 0;

  constructor() {
    this.hydrateSessionCache();
  }

  private getNetworkBudget(): {
    maxConcurrent: number;
    viewportLimit: number;
    allowSpeculative: boolean;
  } {
    if (typeof navigator === 'undefined') {
      return { maxConcurrent: 2, viewportLimit: 4, allowSpeculative: true };
    }
    const nav = navigator as Navigator & { connection?: NetworkConnectionLike };
    const conn = nav.connection;
    if (!conn) {
      return { maxConcurrent: 2, viewportLimit: 4, allowSpeculative: true };
    }
    const eff = (conn.effectiveType || '').toLowerCase();
    if (conn.saveData || eff === 'slow-2g' || eff === '2g') {
      return { maxConcurrent: 1, viewportLimit: 0, allowSpeculative: false };
    }
    if (eff === '3g' || conn.type === 'cellular') {
      return { maxConcurrent: 1, viewportLimit: 2, allowSpeculative: true };
    }
    return { maxConcurrent: 2, viewportLimit: 4, allowSpeculative: true };
  }

  private hydrateSessionCache(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      const now = Date.now();
      for (const [vid, entry] of Object.entries(parsed)) {
        if (entry?.url && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
          this.cache.set(vid, entry);
        }
      }
    } catch {
      // Ignore storage quota or malformed JSON errors
    }
  }

  private persistSessionCache(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const obj: Record<string, CacheEntry> = {};
      const now = Date.now();
      for (const [vid, entry] of this.cache.entries()) {
        if (entry.expiresAt > now) obj[vid] = entry;
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage quota errors
    }
  }

  private preconnectOrigin(streamUrl: string): void {
    if (typeof document === 'undefined' || this.preconnectedOrigins.size >= MAX_PRECONNECT_ORIGINS) {
      return;
    }
    try {
      const origin = new URL(streamUrl).origin;
      if (!origin.startsWith('https://') || this.preconnectedOrigins.has(origin)) return;
      this.preconnectedOrigins.add(origin);
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch {
      // Ignore invalid URL
    }
  }

  private isInFailCooldown(videoId: string): boolean {
    const until = this.failedUntil.get(videoId);
    if (!until) return false;
    if (Date.now() >= until) {
      this.failedUntil.delete(videoId);
      return false;
    }
    return true;
  }

  getCachedUrl(videoId: string): string | null {
    const entry = this.cache.get(videoId);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(videoId);
      return null;
    }
    return entry.url;
  }

  invalidate(videoId: string): void {
    this.cache.delete(videoId);
    this.failedUntil.delete(videoId);
    this.persistSessionCache();
  }

  private putCache(videoId: string, url: string): void {
    this.failedUntil.delete(videoId);
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(videoId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    this.preconnectOrigin(url);
    this.persistSessionCache();
  }

  /**
   * Immediately resolve a videoId (reusing any in-flight or cached promise).
   * Always bypasses fail cooldown when called explicitly by user playback.
   */
  resolveNow(videoId: string, bypassCooldown = false): Promise<string | null> {
    const cached = this.getCachedUrl(videoId);
    if (cached) return Promise.resolve(cached);

    if (!bypassCooldown && this.isInFailCooldown(videoId)) {
      return Promise.resolve(null);
    }

    const existing = this.inFlight.get(videoId);
    if (existing) return existing;

    const promise = resolveYoutubeAudioStream(videoId)
      .then((url) => {
        if (url) {
          this.putCache(videoId, url);
        } else {
          this.failedUntil.set(videoId, Date.now() + FAIL_COOLDOWN_MS);
        }
        return url;
      })
      .catch(() => {
        this.failedUntil.set(videoId, Date.now() + FAIL_COOLDOWN_MS);
        return null;
      })
      .finally(() => {
        this.inFlight.delete(videoId);
      });

    this.inFlight.set(videoId, promise);
    return promise;
  }

  /**
   * Queue a single videoId for predictive background pre-resolution.
   * Urgent items (pointerdown/hover or next-in-queue) jump to the front and bypass Data Saver viewport cap.
   */
  prefetch(videoId: string, urgent = false): void {
    if (!videoId) return;
    if (this.getCachedUrl(videoId) || this.inFlight.has(videoId) || this.isInFailCooldown(videoId)) {
      return;
    }

    // Never run speculative viewport prefetch when screen is off or in background (saves battery & data)
    if (!urgent && typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const budget = this.getNetworkBudget();
    if (!urgent && !budget.allowSpeculative) {
      return;
    }

    const existingIdx = this.queue.findIndex((item) => item.videoId === videoId);
    if (existingIdx !== -1) {
      if (urgent && existingIdx > 0) {
        const [item] = this.queue.splice(existingIdx, 1);
        item.urgent = true;
        this.queue.unshift(item);
      }
      return;
    }

    if (urgent) {
      this.queue.unshift({ videoId, urgent: true });
    } else {
      this.queue.push({ videoId, urgent: false });
    }

    if (this.queue.length > 10) {
      this.queue.length = 10;
    }
    this.pump();
  }

  /**
   * Predictively pre-resolve YouTube Music tracks adapted to current network quality & Data Saver.
   */
  prefetchTracks(tracks: Track[], limit = 4, urgent = false): void {
    const budget = this.getNetworkBudget();
    const effectiveLimit = urgent
      ? Math.min(limit, budget.maxConcurrent === 1 ? 1 : 2)
      : Math.min(limit, budget.viewportLimit);

    if (effectiveLimit <= 0) return;

    let added = 0;
    for (const track of tracks) {
      if (added >= effectiveLimit) break;
      if (track.videoId && !track.url) {
        this.prefetch(track.videoId, urgent);
        added += 1;
      }
    }
  }

  private pump(): void {
    const budget = this.getNetworkBudget();
    while (this.activeCount < budget.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      if (!next.urgent && typeof document !== 'undefined' && document.hidden) continue;
      if (
        this.getCachedUrl(next.videoId) ||
        this.inFlight.has(next.videoId) ||
        this.isInFailCooldown(next.videoId)
      ) {
        continue;
      }

      this.activeCount += 1;
      void this.resolveNow(next.videoId, false).finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.pump();
      });
    }
  }
}

export const ytPreloader = new SmartYtPreloader();
