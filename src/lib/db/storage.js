/**
 * Penyimpanan Lokal Terpadu (IndexedDB v2 + LocalStorage Cache + Manajemen ObjectURL)
 * Mencegah memory leak pada WebView Android dengan melakukan caching URL.createObjectURL.
 */

const DB_NAME = 'nys_xmusic_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'local_tracks';
const STORE_PLAYLISTS = 'playlists';

let dbInstance = null;
const objectUrlCache = new Map();
const coverUrlCache = new Map();

export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_TRACKS)) {
        d.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_PLAYLISTS)) {
        d.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    req.onerror = (e) => reject(e);
  });
}

export async function saveLocalTrack(track) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).put(track);
    tx.oncomplete = () => resolve(hydrateTrackUrls(track));
    tx.onerror = (e) => reject(e);
  });
}

export async function getAllLocalTracks() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => {
      const list = (req.result || []).map(hydrateTrackUrls);
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(list);
    };
    req.onerror = (e) => reject(e);
  });
}

export async function deleteLocalTrack(id) {
  const d = await openDB();
  if (objectUrlCache.has(id)) {
    URL.revokeObjectURL(objectUrlCache.get(id));
    objectUrlCache.delete(id);
  }
  if (coverUrlCache.has(id)) {
    URL.revokeObjectURL(coverUrlCache.get(id));
    coverUrlCache.delete(id);
  }
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

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
 * Membaca durasi asli file audio menggunakan elemen Audio sementara sebelum disimpan ke IndexedDB.
 */
export function probeAudioDuration(fileOrBlob) {
  return new Promise((resolve) => {
    try {
      const tempUrl = URL.createObjectURL(fileOrBlob);
      const tempAudio = new Audio();
      tempAudio.preload = 'metadata';
      const cleanup = (dur) => {
        tempAudio.removeAttribute('src');
        URL.revokeObjectURL(tempUrl);
        resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
      };
      const timer = setTimeout(() => cleanup(0), 4000);
      tempAudio.onloadedmetadata = () => {
        clearTimeout(timer);
        cleanup(tempAudio.duration);
      };
      tempAudio.onerror = () => {
        clearTimeout(timer);
        cleanup(0);
      };
      tempAudio.src = tempUrl;
    } catch {
      resolve(0);
    }
  });
}

/**
 * Memisahkan "Artis - Judul" secara otomatis dari nama file MP3/M4A/WAV/FLAC
 */
export function parseFilenameMeta(filename) {
  const clean = String(filename || 'Tanpa Judul').replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
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

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
