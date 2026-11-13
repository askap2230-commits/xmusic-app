/**
 * Layanan Streaming & Integrasi API
 * - Audius v1 Multi-Host (auto-failover)
 * - Spotify Web API v1 (Client Credentials Flow: deteksi Judul, Artis, Album, Gambar Sampul HD & Durasi) + oEmbed Fallback
 * - LRCLIB Synced Lyrics API (Lirik LRC tersinkronisasi waktu tanpa perlu API key)
 * - YouTube Data API v3, oEmbed, & RapidAPI Downloader
 */
import { loadJSON, saveJSON } from '#lib/db/storage.js';

const APP_NAME = 'nysxmusic';
const DEFAULT_AUDIUS_BASE = 'https://api.audius.co/v1';

const DEFAULT_API_CONFIG = {
  rapidApiKey: '18f2f39b5emsh07bc8d281308cd9p1bb969jsne61e351bb861',
  rapidApiHost: 'youtube-mp36.p.rapidapi.com',
  ytApiKey: '',
  spotifyClientId: '',
  spotifyClientSecret: '',
  audiusHost: DEFAULT_AUDIUS_BASE
};

let spotifyTokenCache = {
  token: null,
  expiresAt: 0
};

export function getApiConfig() {
  return { ...DEFAULT_API_CONFIG, ...loadJSON('nys_api_config', {}) };
}

export function saveApiConfig(partial) {
  const next = { ...getApiConfig(), ...partial };
  saveJSON('nys_api_config', next);
  // Reset token cache jika kredensial Spotify berubah
  if ('spotifyClientId' in partial || 'spotifyClientSecret' in partial) {
    spotifyTokenCache = { token: null, expiresAt: 0 };
  }
  return next;
}

/**
 * Mengambil Access Token Spotify Web API via Client Credentials Flow
 */
export async function getSpotifyAccessToken() {
  const { spotifyClientId, spotifyClientSecret } = getApiConfig();
  if (!spotifyClientId || !spotifyClientSecret) return null;

  if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt - 30000) {
    return spotifyTokenCache.token;
  }

  try {
    const creds = btoa(`${spotifyClientId.trim()}:${spotifyClientSecret.trim()}`);
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      spotifyTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
      };
      return data.access_token;
    }
  } catch (e) {
    console.warn('[Spotify Auth Error]', e);
  }
  return null;
}

/**
 * Mendeteksi detail lengkap (Judul, Artis, Album, Gambar HD, Durasi) dari tautan Spotify
 * Menggunakan Spotify Web API v1 jika Client ID & Secret diisi, lalu fallback ke oEmbed.
 */
export async function fetchSpotifyMetadata(type, id, rawUrl) {
  const token = await getSpotifyAccessToken();
  if (token && type && id) {
    try {
      const endpoint =
        type === 'track'
          ? `https://api.spotify.com/v1/tracks/${id}`
          : type === 'album'
            ? `https://api.spotify.com/v1/albums/${id}`
            : type === 'playlist'
              ? `https://api.spotify.com/v1/playlists/${id}`
              : null;

      if (endpoint) {
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (type === 'track') {
            const artists = (data.artists || []).map((a) => a.name).join(', ') || 'Spotify Artist';
            const imageUrl = data.album?.images?.[0]?.url || data.album?.images?.[1]?.url || null;
            return {
              via: 'Spotify Web API v1',
              title: data.name || 'Spotify Track',
              artist: artists,
              album: data.album?.name || 'Spotify',
              dur: Math.round((Number(data.duration_ms) || 0) / 1000),
              imageUrl,
              previewUrl: data.preview_url || null
            };
          }
          if (type === 'album') {
            const artists = (data.artists || []).map((a) => a.name).join(', ') || 'Spotify Artist';
            return {
              via: 'Spotify Web API v1',
              title: data.name || 'Spotify Album',
              artist: artists,
              album: 'Album Spotify',
              dur: 0,
              imageUrl: data.images?.[0]?.url || null
            };
          }
          if (type === 'playlist') {
            return {
              via: 'Spotify Web API v1',
              title: data.name || 'Spotify Playlist',
              artist: data.owner?.display_name || 'Spotify',
              album: 'Playlist Spotify',
              dur: 0,
              imageUrl: data.images?.[0]?.url || null
            };
          }
        }
      }
    } catch (e) {
      console.warn('[Spotify API Error]', e);
    }
  }

  // Fallback otomatis ke oEmbed (tanpa API Key)
  const oembed = await fetchOEmbedMeta(rawUrl, true);
  if (oembed) {
    let title = oembed.title || 'Spotify Track';
    let artist = oembed.author_name || 'Spotify';
    if (title.includes(' - ') && (!oembed.author_name || oembed.author_name === 'Spotify')) {
      const parts = title.split(' - ');
      title = parts[0].trim();
      artist = parts.slice(1).join(' - ').trim();
    }
    return {
      via: 'Spotify oEmbed',
      title,
      artist,
      album: 'Spotify',
      dur: 0,
      imageUrl: oembed.thumbnail_url || null
    };
  }

  return null;
}

/**
 * Mengambil lirik tersinkronisasi (LRC) secara otomatis berdasarkan judul dan artis via LRCLIB
 */
export async function fetchSyncedLyrics(title, artist, durationSec = 0) {
  if (!title) return null;
  const cleanTitle = String(title).replace(/\(.*?\)|\[.*?\]/g, '').trim();
  const cleanArtist = String(artist || '').split(',')[0].trim();

  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist
    });
    if (durationSec > 0) params.set('duration', String(Math.round(durationSec)));

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics || data.plainLyrics) {
        return data.syncedLyrics || data.plainLyrics;
      }
    }
  } catch {
    // lanjut ke pencarian umum
  }

  try {
    const q = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((x) => x.syncedLyrics) || list[0];
        return best.syncedLyrics || best.plainLyrics || null;
      }
    }
  } catch {
    // abaikan jika offline
  }
  return null;
}

/**
 * Mengurai teks LRC berformat "[mm:ss.xx] Baris lirik" menjadi array terurut
 */
export function parseLrcLyrics(rawText) {
  if (!rawText || !String(rawText).trim()) return [];
  const lines = String(rawText).split(/\r?\n/);
  const parsed = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)];
    const text = line.replace(timeRegex, '').trim();
    if (matches.length > 0 && text) {
      for (const m of matches) {
        const min = Number(m[1]) || 0;
        const sec = Number(m[2]) || 0;
        const msStr = (m[3] || '0').padEnd(3, '0').slice(0, 3);
        const time = min * 60 + sec + Number(msStr) / 1000;
        parsed.push({ time, text, synced: true });
      }
    } else if (text && !line.startsWith('[')) {
      parsed.push({ time: null, text, synced: false });
    }
  }

  if (parsed.some((p) => p.synced)) {
    return parsed.filter((p) => p.synced).sort((a, b) => a.time - b.time);
  }
  return parsed;
}

export function audiusToTrack(t) {
  const cfg = getApiConfig();
  const base = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const pp = t.user?.profile_picture;
  let artistPhoto = null;
  if (pp) {
    if (typeof pp === 'string') artistPhoto = pp;
    else if (pp['480x480']) artistPhoto = pp['480x480'];
  }
  return {
    id: 'audius_' + t.id,
    title: t.title || 'Untitled',
    artist: t.user?.name || 'Audius Artist',
    artistPhoto,
    album: t.genre || 'Audius Stream',
    dur: Number(t.duration) || 0,
    c1: '#6366f1',
    c2: '#1e1b4b',
    imageUrl: t.artwork?.['480x480'] || t.artwork?.['150x150'] || null,
    url: `${base}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
    source: 'audius',
    lyrics: t.description || ''
  };
}

export async function audiusFetch(path) {
  const cfg = getApiConfig();
  const primary = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';

  try {
    const res = await fetch(`${primary}${path}${sep}app_name=${APP_NAME}`);
    if (res.ok) {
      const d = await res.json();
      return (d.data || []).map(audiusToTrack);
    }
  } catch (e) {
    console.warn('[Audius Primary Error]', e);
  }

  try {
    const hostRes = await fetch('https://api.audius.co');
    const hostData = await hostRes.json();
    const nodes = hostData?.data || [];
    for (const node of nodes.slice(0, 3)) {
      try {
        const nodeUrl = `${node.replace(/\/$/, '')}/v1`;
        const r = await fetch(`${nodeUrl}${path}${sep}app_name=${APP_NAME}`);
        if (r.ok) {
          const d = await r.json();
          return (d.data || []).map(audiusToTrack);
        }
      } catch {
        // coba node berikutnya
      }
    }
  } catch {
    // abaikan jika sedang full offline
  }
  return [];
}

export async function fetchTrending(limit = 36) {
  return audiusFetch(`/tracks/trending?limit=${limit}`);
}

export async function fetchSearch(q, limit = 30) {
  return audiusFetch(`/tracks/search?query=${encodeURIComponent(q)}&limit=${limit}`);
}

export function ytToTrack(v) {
  const id = typeof v.id === 'string' ? v.id : v.id?.videoId;
  const s = v.snippet || {};
  const th = s.thumbnails || {};
  return {
    id: 'yt_' + id,
    title: s.title || 'YouTube Music',
    artist: (s.channelTitle || 'YouTube').replace(/ - Topic$/, ''),
    album: 'YouTube',
    dur: 0,
    c1: '#ef4444',
    c2: '#2a0b0b',
    imageUrl: (th.maxres || th.high || th.medium || {}).url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    videoId: id,
    source: 'youtube',
    artistPhoto: null
  };
}

export async function fetchYtTrending(region = 'ID') {
  const { ytApiKey } = getApiConfig();
  if (!ytApiKey) return [];
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${region}&maxResults=24&key=${ytApiKey}`
    );
    const d = await r.json();
    return (d.items || []).map(ytToTrack);
  } catch {
    return [];
  }
}

export async function fetchYtSearch(q) {
  const { ytApiKey } = getApiConfig();
  if (!ytApiKey) return [];
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(q)}&key=${ytApiKey}`
    );
    const d = await r.json();
    return (d.items || []).map(ytToTrack);
  } catch {
    return [];
  }
}

export function extractYouTubeId(url) {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (clean.includes('youtu.be/')) return clean.split('youtu.be/')[1].split(/[?&/]/)[0];
  if (clean.includes('/shorts/')) return clean.split('/shorts/')[1].split(/[?&/]/)[0];
  if (clean.includes('/embed/')) return clean.split('/embed/')[1].split(/[?&/]/)[0];
  if (clean.includes('v=')) return clean.split('v=')[1].split('&')[0];
  return '';
}

export function extractSpotifyEmbed(url) {
  const clean = String(url || '').trim();
  if (!clean.includes('spotify.com')) return null;
  try {
    const u = new URL(clean);
    const parts = u.pathname.split('/').filter(Boolean).filter((p) => !p.startsWith('intl-'));
    const type = parts[0];
    const id = parts[1];
    if (type && id && ['track', 'album', 'playlist', 'artist', 'episode'].includes(type)) {
      return { type, id };
    }
  } catch {
    // fallback
  }
  return null;
}

export async function fetchOEmbedMeta(url, isSpotify = false) {
  const endpoint = isSpotify
    ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  try {
    const r = await fetch(endpoint);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function rapidDownloadMp3(videoId) {
  const { rapidApiKey, rapidApiHost } = getApiConfig();
  if (!rapidApiKey) {
    return { ok: false, msg: 'RapidAPI Key belum diisi di menu Pengaturan.' };
  }
  let data = { msg: 'Tidak ada respons dari server API.' };
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(`https://${rapidApiHost}/dl?id=${encodeURIComponent(videoId)}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': rapidApiHost
        }
      });
      if (!r.ok) {
        const reason =
          r.status === 401 || r.status === 403
            ? ' (API Key tidak valid atau belum subscribe youtube-mp36 di RapidAPI)'
            : r.status === 429
              ? ' (Kuota harian RapidAPI habis)'
              : '';
        return { ok: false, msg: `HTTP ${r.status}${reason}` };
      }
      data = await r.json();
    } catch (e) {
      return { ok: false, msg: `Koneksi gagal: ${e.message}` };
    }
    if (data.link) {
      return { ok: true, link: data.link, title: data.title || 'audio.mp3', duration: data.duration || 0 };
    }
    if (data.status === 'processing') {
      await new Promise((res) => setTimeout(res, 2200));
      continue;
    }
    break;
  }
  return { ok: false, msg: data.msg || 'API tidak mengembalikan tautan unduhan.' };
}
