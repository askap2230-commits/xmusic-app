// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Unified local persistence layer (IndexedDB v2 + LocalStorage + ObjectURL cache).
 * Prevents Android WebView memory leaks by caching and revoking Blob URLs deterministically.
 */
import type { Track } from '#lib/types/music.ts';

const DB_NAME = 'nys_xmusic_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'local_tracks';
const STORE_PLAYLISTS = 'playlists';

let dbInstance: IDBDatabase | null = null;
const objectUrlCache = new Map<string, string>();
const coverUrlCache = new Map<string, string>();

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalTrack(track: Track): Promise<Track> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).put(track);
    tx.oncomplete = () => resolve(hydrateTrackUrls(track));
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllLocalTracks(): Promise<Track[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => {
      const list = ((req.result as Track[]) || []).map(hydrateTrackUrls);
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalTrack(id: string): Promise<void> {
  const db = await openDB();
  const cachedAudio = objectUrlCache.get(id);
  if (cachedAudio) {
    URL.revokeObjectURL(cachedAudio);
    objectUrlCache.delete(id);
  }
  const cachedCover = coverUrlCache.get(id);
  if (cachedCover) {
    URL.revokeObjectURL(cachedCover);
    coverUrlCache.delete(id);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function revokeAllTrackUrls(): void {
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  for (const url of coverUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
  coverUrlCache.clear();
}

export function hydrateTrackUrls(track: Track): Track {
  const copy: Track = { ...track, source: track.source || 'local' };
  if (copy.blob instanceof Blob) {
    if (!objectUrlCache.has(copy.id)) {
      objectUrlCache.set(copy.id, URL.createObjectURL(copy.blob));
    }
    copy.url = objectUrlCache.get(copy.id);
  }
  if (copy.coverBlob instanceof Blob) {
    if (!coverUrlCache.has(copy.id)) {
      coverUrlCache.set(copy.id, URL.createObjectURL(copy.coverBlob));
    }
    copy.imageUrl = coverUrlCache.get(copy.id) || null;
  }
  return copy;
}

export function probeAudioDuration(source: Blob | string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const isBlob = source instanceof Blob;
      const srcUrl = isBlob ? URL.createObjectURL(source) : String(source || '');
      if (!srcUrl) return resolve(0);

      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = (dur: number): void => {
        audio.removeAttribute('src');
        if (isBlob) URL.revokeObjectURL(srcUrl);
        resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
      };

      const timeoutId = setTimeout(() => cleanup(0), 4000);
      audio.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        cleanup(audio.duration);
      };
      audio.onerror = () => {
        clearTimeout(timeoutId);
        cleanup(0);
      };
      audio.src = srcUrl;
    } catch {
      resolve(0);
    }
  });
}

export function parseFilenameMeta(filename: string): { artist: string; title: string } {
  const clean = String(filename || 'Tanpa Judul')
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ')
    .trim();
  const parts = clean.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim()
    };
  }
  return {
    artist: 'Koleksi Lokal',
    title: clean
  };
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
