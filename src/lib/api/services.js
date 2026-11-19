/**
 * External streaming, metadata, and synced lyrics integrations:
 * - Audius v1 API with automatic multi-host discovery failover
 * - Spotify Web API v1 (Client Credentials Flow) with oEmbed fallback
 * - LRCLIB synced LRC lyrics API (no API key required)
 * - YouTube Data API v3, oEmbed, and user-configured RapidAPI MP3 converter
 */
import { loadJSON, saveJSON } from '#lib/db/storage.js';

const APP_NAME = 'nysxmusic';
const DEFAULT_AUDIUS_BASE = 'https://api.audius.co/v1';

const DEFAULT_API_CONFIG = {
  rapidApiKey: '',
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
  if ('spotifyClientId' in partial || 'spotifyClientSecret' in partial) {
    spotifyTokenCache = { token: null, expiresAt: 0 };
  }
  return next;
}

/**
 * Acquires a Spotify Web API access token via OAuth Client Credentials Flow.
 */
export async function getSpotifyAccessToken() {
  const { spotifyClientId, spotifyClientSecret } = getApiConfig();
  if (!spotifyClientId || !spotifyClientSecret) return null;

  if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt - 30000) {
    return spotifyTokenCache.token;
  }

  try {
    const credentials = btoa(`${spotifyClientId.trim()}:${spotifyClientSecret.trim()}`);
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.access_token) {
      spotifyTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
      };
      return data.access_token;
    }
  } catch (err) {
    console.warn('[Spotify Auth Error]', err);
  }
  return null;
}

/**
 * Fetches rich metadata (title, artist, album, HD artwork, duration) from Spotify Web API v1,
 * falling back automatically to Spotify oEmbed when API credentials are not configured.
 */
export async function fetchSpotifyMetadata(type, id, rawUrl) {
  const token = await getSpotifyAccessToken();
  if (token && type && id) {
    try {
      const endpoints = {
        track: `https://api.spotify.com/v1/tracks/${id}`,
        album: `https://api.spotify.com/v1/albums/${id}`,
        playlist: `https://api.spotify.com/v1/playlists/${id}`
      };
      const endpoint = endpoints[type];

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
    } catch (err) {
      console.warn('[Spotify API Error]', err);
    }
  }

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
 * Fetches time-synced LRC lyrics from LRCLIB by track title, artist, and optional duration.
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
    // Fall through to search endpoint
  }

  try {
    const q = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((item) => item.syncedLyrics) || list[0];
        return best.syncedLyrics || best.plainLyrics || null;
      }
    }
  } catch {
    // Ignore when offline
  }
  return null;
}

/**
 * Parses LRC-formatted text ("[mm:ss.xx] Lyric line") into an ordered array.
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
      for (const match of matches) {
        const mins = Number(match[1]) || 0;
        const secs = Number(match[2]) || 0;
        const msStr = (match[3] || '0').padEnd(3, '0').slice(0, 3);
        const time = mins * 60 + secs + Number(msStr) / 1000;
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

export function audiusToTrack(track) {
  const cfg = getApiConfig();
  const base = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const pp = track.user?.profile_picture;
  let artistPhoto = null;
  if (pp) {
    if (typeof pp === 'string') artistPhoto = pp;
    else if (pp['480x480']) artistPhoto = pp['480x480'];
  }
  return {
    id: `audius_${track.id}`,
    title: track.title || 'Untitled',
    artist: track.user?.name || 'Audius Artist',
    artistPhoto,
    album: track.genre || 'Audius Stream',
    dur: Number(track.duration) || 0,
    c1: '#3b82f6',
    c2: '#172554',
    imageUrl: track.artwork?.['480x480'] || track.artwork?.['150x150'] || null,
    url: `${base}/tracks/${track.id}/stream?app_name=${APP_NAME}`,
    source: 'audius',
    lyrics: track.description || ''
  };
}

export async function audiusFetch(path) {
  const cfg = getApiConfig();
  const primary = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';

  try {
    const res = await fetch(`${primary}${path}${sep}app_name=${APP_NAME}`);
    if (res.ok) {
      const data = await res.json();
      return (data.data || []).map(audiusToTrack);
    }
  } catch (err) {
    console.warn('[Audius Primary Error]', err);
  }

  try {
    const hostRes = await fetch('https://api.audius.co');
    const hostData = await hostRes.json();
    const nodes = hostData?.data || [];
    for (const node of nodes.slice(0, 3)) {
      try {
        const nodeUrl = `${node.replace(/\/$/, '')}/v1`;
        const res = await fetch(`${nodeUrl}${path}${sep}app_name=${APP_NAME}`);
        if (res.ok) {
          const data = await res.json();
          return (data.data || []).map(audiusToTrack);
        }
      } catch {
        // Try next discovery node
      }
    }
  } catch {
    // Offline mode
  }
  return [];
}

export async function fetchTrending(limit = 32) {
  return audiusFetch(`/tracks/trending?limit=${limit}`);
}

export async function fetchSearch(query, limit = 30) {
  return audiusFetch(`/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`);
}

export function ytToTrack(video) {
  const id = typeof video.id === 'string' ? video.id : video.id?.videoId;
  const snippet = video.snippet || {};
  const thumbs = snippet.thumbnails || {};
  return {
    id: `yt_${id}`,
    title: snippet.title || 'YouTube Music',
    artist: (snippet.channelTitle || 'YouTube').replace(/ - Topic$/, ''),
    album: 'YouTube',
    dur: 0,
    c1: '#dc2626',
    c2: '#2b1014',
    imageUrl: (thumbs.maxres || thumbs.high || thumbs.medium || {}).url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    videoId: id,
    source: 'youtube',
    artistPhoto: null
  };
}

export async function fetchYtTrending(region = 'ID') {
  const { ytApiKey } = getApiConfig();
  if (!ytApiKey) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${region}&maxResults=24&key=${ytApiKey}`
    );
    const data = await res.json();
    return (data.items || []).map(ytToTrack);
  } catch {
    return [];
  }
}

export async function fetchYtSearch(query) {
  const { ytApiKey } = getApiConfig();
  if (!ytApiKey) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(query)}&key=${ytApiKey}`
    );
    const data = await res.json();
    return (data.items || []).map(ytToTrack);
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
    const parsed = new URL(clean);
    const parts = parsed.pathname.split('/').filter(Boolean).filter((p) => !p.startsWith('intl-'));
    const [type, id] = parts;
    if (type && id && ['track', 'album', 'playlist', 'artist', 'episode'].includes(type)) {
      return { type, id };
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export async function fetchOEmbedMeta(url, isSpotify = false) {
  const endpoint = isSpotify
    ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function rapidDownloadMp3(videoId) {
  const { rapidApiKey, rapidApiHost } = getApiConfig();
  if (!rapidApiKey) {
    return { ok: false, msg: 'RapidAPI Key belum diisi di menu Profil & Pengaturan API.' };
  }
  let data = { msg: 'Tidak ada respons dari server API.' };
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(`https://${rapidApiHost}/dl?id=${encodeURIComponent(videoId)}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': rapidApiHost
        }
      });
      if (!res.ok) {
        const reason =
          res.status === 401 || res.status === 403
            ? ' (API Key tidak valid atau belum subscribe youtube-mp36 di RapidAPI)'
            : res.status === 429
              ? ' (Kuota harian RapidAPI habis)'
              : '';
        return { ok: false, msg: `HTTP ${res.status}${reason}` };
      }
      data = await res.json();
    } catch (err) {
      return { ok: false, msg: `Koneksi gagal: ${err.message}` };
    }
    if (data.link) {
      return { ok: true, link: data.link, title: data.title || 'audio.mp3', duration: data.duration || 0 };
    }
    if (data.status === 'processing') {
      await new Promise((resolve) => setTimeout(resolve, 2200));
      continue;
    }
    break;
  }
  return { ok: false, msg: data.msg || 'API tidak mengembalikan tautan unduhan.' };
}
