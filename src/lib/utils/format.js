// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared formatting and pure helper utilities.
 */

/**
 * Formats seconds as M:SS.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Returns a time-of-day greeting in Indonesian for the UI header.
 * @param {Date} [now]
 * @returns {string}
 */
export function getTimeGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Returns the uppercase initial character for fallback artwork.
 * @param {string | undefined | null} title
 * @returns {string}
 */
export function getTrackInitial(title) {
  return (String(title || '?').trim()[0] || '?').toUpperCase();
}

/**
 * Computes the active synced lyric index for the current playback position.
 * @param {Array<{ time: number | null, text: string, synced: boolean }>} lines
 * @param {number} positionSec
 * @returns {number}
 */
export function findActiveLyricIndex(lines, positionSec) {
  if (!lines.length || !lines[0]?.synced) return -1;
  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time !== null && lines[i].time <= positionSec + 0.15) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}
