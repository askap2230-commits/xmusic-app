// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from '#lib/i18n/index.svelte.ts';
import type { ParsedLyricLine } from '#lib/types/music.ts';

/**
 * Formats seconds as M:SS.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Returns a time-of-day greeting in Indonesian for the UI header.
 */
export function getTimeGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 11) return i18n.t('greeting.morning');
  if (hour < 15) return i18n.t('greeting.afternoon');
  if (hour < 19) return i18n.t('greeting.evening');
  return i18n.t('greeting.night');
}

/**
 * Returns the uppercase initial character for fallback artwork.
 */
export function getTrackInitial(title: string | undefined | null): string {
  return (String(title || '?').trim()[0] || '?').toUpperCase();
}

/**
 * Computes the active synced lyric index for the current playback position.
 */
export function findActiveLyricIndex(lines: ParsedLyricLine[], positionSec: number): number {
  if (!lines.length || !lines[0]?.synced) return -1;
  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineTime = lines[i].time;
    if (lineTime !== null && lineTime <= positionSec + 0.15) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}
