/**
 * Unified local persistence layer (IndexedDB v2 + LocalStorage + ObjectURL cache).
 * Prevents Android WebView memory leaks by caching and revoking Blob URLs deterministically.
 */

const DB_NAME = 'nys_xmusic_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'local_tracks';
const STORE_PLAYLISTS = 'playlists';

let dbInstance = null;
const objectUrlCache = new Map();
const coverUrlCache = new Map();

/**
 * Opens or returns the singleton IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    request.onerror = (event) => reject(event);
  });
}

/**
 * Saves or updates a local track record in IndexedDB.
 * @param {Record<string, any>} track
 */
export async function saveLocalTrack(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).put(track);
    tx.oncomplete = () => resolve(hydrateTrackUrls(track));
    tx.onerror = (event) => reject(event);
  });
}

/**
 * Loads all locally persisted tracks sorted newest-first.
 */
export async function getAllLocalTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => {
      const list = (req.result || []).map(hydrateTrackUrls);
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(list);
    };
    req.onerror = (event) => reject(event);
  });
}

/**
 * Deletes a local track and revokes any cached ObjectURLs.
 * @param {string} id
 */
export async function deleteLocalTrack(id) {
  const db = await openDB();
  if (objectUrlCache.has(id)) {
    URL.revokeObjectURL(objectUrlCache.get(id));
    objectUrlCache.delete(id);
  }
  if (coverUrlCache.has(id)) {
    URL.revokeObjectURL(coverUrlCache.get(id));
    coverUrlCache.delete(id);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event);
  });
}

/**
 * Revokes all cached ObjectURLs on application teardown.
 */
export function revokeAllTrackUrls() {
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  for (const url of coverUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
  coverUrlCache.clear();
}

/**
 * Hydrates in-memory Blob URLs for audio and cover art without duplicating allocations.
 * @param {Record<string, any>} track
 */
export function hydrateTrackUrls(track) {
  const copy = { ...track, source: track.source || 'local' };
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
    copy.imageUrl = coverUrlCache.get(copy.id);
  }
  return copy;
}

/**
 * Probes the duration of a local File/Blob or remote URL via a transient Audio element.
 * @param {Blob | string} source
 * @returns {Promise<number>}
 */
export function probeAudioDuration(source) {
  return new Promise((resolve) => {
    try {
      const isBlob = source instanceof Blob;
      const srcUrl = isBlob ? URL.createObjectURL(source) : String(source || '');
      if (!srcUrl) return resolve(0);

      const audio = new Audio();
      audio.preload = 'metadata';

      const cleanup = (dur) => {
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

/**
 * Extracts "Artist - Title" metadata from standard audio filenames.
 * @param {string} filename
 * @returns {{ artist: string, title: string }}
 */
export function parseFilenameMeta(filename) {
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

/**
 * Safely reads and parses a JSON value from localStorage.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely serializes and writes a JSON value to localStorage.
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean}
 */
export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
