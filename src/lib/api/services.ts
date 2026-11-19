// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { loadJSON, saveJSON } from '#lib/db/storage.ts';
import { ERA_PRESETS, REGION_OPTIONS } from '#lib/data/presets.ts';
import type {
  AlgorithmConfig,
  ApiConfig,
  DownloadResult,
  HubMeta,
  ParsedLyricLine,
  SearchSuggestion,
  SpotifyEmbedRef,
  Track
} from '#lib/types/music.ts';

const APP_NAME = 'nysxmusic';
const DEFAULT_AUDIUS_BASE = 'https://api.audius.co/v1';

const DEFAULT_API_CONFIG: ApiConfig = {
  rapidApiKey: '',
  rapidApiHost: 'youtube-mp36.p.rapidapi.com',
  ytApiKey: '',
  spotifyClientId: '',
  spotifyClientSecret: '',
  audiusHost: DEFAULT_AUDIUS_BASE,
  pipedInstance: ''
};

let spotifyTokenCache: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0
};

export function getApiConfig(): ApiConfig {
  return { ...DEFAULT_API_CONFIG, ...loadJSON<Partial<ApiConfig>>('nys_api_config', {}) };
}

export function saveApiConfig(partial: Partial<ApiConfig>): ApiConfig {
  const next: ApiConfig = { ...getApiConfig(), ...partial };
  saveJSON('nys_api_config', next);
  if ('spotifyClientId' in partial || 'spotifyClientSecret' in partial) {
    spotifyTokenCache = { token: null, expiresAt: 0 };
  }
  return next;
}

export async function getSpotifyAccessToken(): Promise<string | null> {
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
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
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

export async function fetchSpotifyMetadata(
  type: SpotifyEmbedRef['type'],
  id: string,
  rawUrl: string
): Promise<HubMeta | null> {
  const token = await getSpotifyAccessToken();
  if (token && type && id) {
    try {
      const endpoints: Partial<Record<SpotifyEmbedRef['type'], string>> = {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any = await res.json();
          if (type === 'track') {
            const artists =
              (data.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Spotify Artist';
            const imageUrl: string | null =
              data.album?.images?.[0]?.url || data.album?.images?.[1]?.url || null;
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
            const artists =
              (data.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Spotify Artist';
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

export async function fetchSyncedLyrics(
  title: string,
  artist: string,
  durationSec = 0
): Promise<string | null> {
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
      const data = (await res.json()) as { syncedLyrics?: string; plainLyrics?: string };
      if (data.syncedLyrics || data.plainLyrics) {
        return data.syncedLyrics || data.plainLyrics || null;
      }
    }
  } catch {
    // Fall through to search endpoint
  }

  try {
    const q = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
    const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
    if (res.ok) {
      const list = (await res.json()) as Array<{ syncedLyrics?: string; plainLyrics?: string }>;
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

export function parseLrcLyrics(rawText: string): ParsedLyricLine[] {
  if (!rawText || !String(rawText).trim()) return [];
  const lines = String(rawText).split(/\r?\n/);
  const parsed: ParsedLyricLine[] = [];
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
    return parsed.filter((p) => p.synced).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  }
  return parsed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function audiusToTrack(track: any): Track {
  const cfg = getApiConfig();
  const base = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const pp = track.user?.profile_picture;
  let artistPhoto: string | null = null;
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
    c1: '#007aff',
    c2: '#172554',
    imageUrl: track.artwork?.['480x480'] || track.artwork?.['150x150'] || null,
    url: `${base}/tracks/${track.id}/stream?app_name=${APP_NAME}`,
    source: 'audius',
    lyrics: track.description || ''
  };
}

export async function audiusFetch(path: string): Promise<Track[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const cfg = getApiConfig();
  const primary = (cfg.audiusHost || DEFAULT_AUDIUS_BASE).replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';

  try {
    const res = await fetch(`${primary}${path}${sep}app_name=${APP_NAME}`);
    if (res.ok) {
      const data = (await res.json()) as { data?: unknown[] };
      return (data.data || []).map(audiusToTrack);
    }
  } catch (err) {
    console.warn('[Audius Primary Error]', err);
  }

  try {
    const hostRes = await fetch('https://api.audius.co');
    const hostData = (await hostRes.json()) as { data?: string[] };
    const nodes = hostData?.data || [];
    for (const node of nodes.slice(0, 3)) {
      try {
        const nodeUrl = `${node.replace(/\/$/, '')}/v1`;
        const res = await fetch(`${nodeUrl}${path}${sep}app_name=${APP_NAME}`);
        if (res.ok) {
          const data = (await res.json()) as { data?: unknown[] };
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

export async function fetchTrending(limit = 32): Promise<Track[]> {
  return audiusFetch(`/tracks/trending?limit=${limit}`);
}

export async function fetchSearch(query: string, limit = 30): Promise<Track[]> {
  return audiusFetch(`/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ytToTrack(video: any): Track {
  const id = typeof video.id === 'string' ? video.id : video.id?.videoId;
  const snippet = video.snippet || {};
  const thumbs = snippet.thumbnails || {};
  return {
    id: `yt_${id}`,
    title: snippet.title || 'YouTube Music',
    artist: String(snippet.channelTitle || 'YouTube').replace(/ - Topic$/, ''),
    album: 'YouTube',
    dur: 0,
    c1: '#dc2626',
    c2: '#2b1014',
    imageUrl:
      (thumbs.maxres || thumbs.high || thumbs.medium || {}).url ||
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    videoId: id,
    source: 'youtube',
    artistPhoto: null
  };
}

const DEFAULT_PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi-libre.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.adminforge.de',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.leptons.xyz'
];

let invidiousCache: { hosts: string[]; fetchedAt: number } = { hosts: [], fetchedAt: 0 };
const ytAudioStreamCache = new Map<string, string>();

function getPipedCandidates(): string[] {
  const custom = (getApiConfig().pipedInstance || '').trim().replace(/\/$/, '');
  return custom ? [custom, ...DEFAULT_PIPED_INSTANCES.filter((h) => h !== custom)] : DEFAULT_PIPED_INSTANCES;
}

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getHealthyInvidiousInstances(): Promise<string[]> {
  if (invidiousCache.hosts.length > 0 && Date.now() - invidiousCache.fetchedAt < 900_000) {
    return invidiousCache.hosts;
  }
  try {
    const res = await fetchWithTimeout('https://api.invidious.io/instances.json?sort_by=health', 4000);
    if (res.ok) {
      const list = (await res.json()) as Array<[string, { type?: string; api?: boolean; uri?: string }]>;
      const hosts = list
        .filter((entry) => entry?.[1]?.type === 'https' && entry?.[1]?.api && entry?.[1]?.uri)
        .map((entry) => String(entry[1].uri).replace(/\/$/, ''))
        .slice(0, 5);
      if (hosts.length > 0) {
        invidiousCache = { hosts, fetchedAt: Date.now() };
        return hosts;
      }
    }
  } catch {
    // Ignore directory fetch failure
  }
  return invidiousCache.hosts;
}

const NON_MUSIC_REGEX =
  /\b(live\s*stream|livestream|live\s*24\/7|24\/7\s*live|radio\s*live|#shorts|podcast|reaction|vlog|gameplay|full\s*album|1\s*hour|2\s*hours|10\s*hours|interview|trailer|behind\s*the\s*scenes|berita|news)\b/i;

function isValidMusicSong(
  title: string,
  durationSec: number,
  isLive = false,
  isShort = false
): boolean {
  if (isLive || isShort) return false;
  // Strictly enforce standard song duration (60s to 12m) — blocks livestreams (0s), Shorts (<60s), and long VODs
  if (!Number.isFinite(durationSec) || durationSec < 60 || durationSec > 720) return false;
  if (NON_MUSIC_REGEX.test(title)) return false;
  return true;
}

const REGIONAL_YTMUSIC_QUERIES: Record<string, string[]> = {
  ID: [
    'top hits indonesia 2025 2026',
    'lagu pop indonesia viral terbaru',
    'indie pop indonesia terbaik',
    'lagu indonesia populer 2000an 2020an'
  ],
  US: [
    'billboard hot 100 songs 2025 2026',
    'top pop hits global 2026',
    'viral english songs 2025',
    'best modern pop rnb hits'
  ],
  JP: [
    'top jpop songs 2025 2026',
    'anime opening hits japan',
    'japanese city pop classics',
    'viral japan music 2025'
  ],
  KR: [
    'top kpop songs 2025 2026',
    'viral kpop hits korea',
    'kdrama ost best songs',
    'korean pop trending'
  ],
  GB: [
    'uk top 40 songs 2025 2026',
    'british indie pop hits',
    'uk chart pop music',
    'london viral hits 2025'
  ],
  GLOBAL: [
    'global top 50 songs 2025 2026',
    'worldwide viral pop hits',
    'international chart hits 2026',
    'most played songs 2025'
  ]
};

interface PipedItem {
  url?: string;
  type?: string;
  title?: string;
  uploaderName?: string;
  thumbnail?: string;
  duration?: number;
  isShort?: boolean;
  uploadedDate?: string | null;
}

function pipedItemToTrack(item: PipedItem): Track | null {
  if (item.type && item.type !== 'stream') return null;
  const rawUrl = String(item.url || '');
  const match = rawUrl.match(/v=([A-Za-z0-9_-]{11})/);
  const videoId = match ? match[1] : '';
  if (!videoId) return null;
  const dur = Number(item.duration) || 0;
  const title = String(item.title || '').trim();
  const isLive = dur <= 0 || String(item.uploadedDate || '').toLowerCase().includes('live');
  if (!title || !isValidMusicSong(title, dur, isLive, Boolean(item.isShort))) return null;
  return {
    id: `yt_${videoId}`,
    title,
    artist: String(item.uploaderName || 'YouTube Music').replace(/ - Topic$/, ''),
    album: 'YouTube Music',
    dur,
    isPreview: false,
    c1: '#dc2626',
    c2: '#2b1014',
    imageUrl: item.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    source: 'youtube',
    artistPhoto: null
  };
}

interface InvidiousItem {
  type?: string;
  videoId?: string;
  title?: string;
  author?: string;
  lengthSeconds?: number;
  liveNow?: boolean;
  isUpcoming?: boolean;
  videoThumbnails?: Array<{ url?: string; quality?: string }>;
}

function invidiousItemToTrack(item: InvidiousItem): Track | null {
  if (!item.videoId || (item.type && item.type !== 'video')) return null;
  const dur = Number(item.lengthSeconds) || 0;
  const title = String(item.title || '').trim();
  if (!title || !isValidMusicSong(title, dur, Boolean(item.liveNow || item.isUpcoming), false)) {
    return null;
  }
  const thumb =
    item.videoThumbnails?.find((t) => t.quality === 'high' || t.quality === 'medium')?.url ||
    `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
  return {
    id: `yt_${item.videoId}`,
    title,
    artist: String(item.author || 'YouTube Music').replace(/ - Topic$/, ''),
    album: 'YouTube Music',
    dur,
    isPreview: false,
    c1: '#dc2626',
    c2: '#2b1014',
    imageUrl: thumb,
    videoId: item.videoId,
    source: 'youtube',
    artistPhoto: null
  };
}

/**
 * Resolves a direct high-bitrate audio stream URL for a YouTube videoId via FOSS Piped/Invidious APIs
 * (enables native Web Audio 5-Band EQ + Android Lockscreen Media Notification with zero API key).
 */
export async function resolveYoutubeAudioStream(videoId: string): Promise<string | null> {
  if (!videoId || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  const cached = ytAudioStreamCache.get(videoId);
  if (cached) return cached;

  for (const host of getPipedCandidates().slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(`${host}/streams/${encodeURIComponent(videoId)}`, 4200);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        audioStreams?: Array<{ url?: string; mimeType?: string; bitrate?: number }>;
      };
      const streams = (data.audioStreams || []).filter((s) => Boolean(s.url));
      if (streams.length === 0) continue;
      // Prefer M4A/MP4 audio for universal Android WebView compatibility, highest bitrate first
      streams.sort((a, b) => {
        const aM4a = String(a.mimeType || '').includes('mp4') ? 1 : 0;
        const bM4a = String(b.mimeType || '').includes('mp4') ? 1 : 0;
        if (aM4a !== bM4a) return bM4a - aM4a;
        return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
      });
      const bestUrl = streams[0].url;
      if (bestUrl) {
        ytAudioStreamCache.set(videoId, bestUrl);
        return bestUrl;
      }
    } catch {
      // Failover to next Piped instance
    }
  }

  const invHosts = await getHealthyInvidiousInstances();
  for (const host of invHosts.slice(0, 3)) {
    try {
      const res = await fetchWithTimeout(`${host}/api/v1/videos/${encodeURIComponent(videoId)}`, 4200);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        adaptiveFormats?: Array<{ url?: string; type?: string; bitrate?: string | number }>;
      };
      const audioOnly = (data.adaptiveFormats || []).filter(
        (f) => f.url && String(f.type || '').startsWith('audio/')
      );
      if (audioOnly.length === 0) continue;
      audioOnly.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
      const bestUrl = audioOnly[0].url;
      if (bestUrl) {
        ytAudioStreamCache.set(videoId, bestUrl);
        return bestUrl;
      }
    } catch {
      // Failover to next Invidious instance
    }
  }
  return null;
}

/**
 * Fetches regional trending YouTube Music (uses optional YouTube API key if set, otherwise FOSS Piped/Invidious zero-API-key).
 */
export async function fetchYtTrending(region = 'ID', refreshSeed = 0): Promise<Track[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const { ytApiKey } = getApiConfig();
  const regionKey = REGIONAL_YTMUSIC_QUERIES[region] ? region : 'ID';
  const safeStore = /^[A-Z]{2}$/.test(region) ? region : 'ID';

  if (ytApiKey) {
    try {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${safeStore}&maxResults=24&key=${ytApiKey}`,
        5000
      );
      if (res.ok) {
        const data = (await res.json()) as { items?: unknown[] };
        const items = (data.items || [])
          .map(ytToTrack)
          .filter((t) => !NON_MUSIC_REGEX.test(t.title));
        if (items.length > 0) return items;
      }
    } catch {
      // Fall through to FOSS YouTube Music (filter=music_songs)
    }
  }

  // Strictly query YouTube Music songs (filter=music_songs) — zero vlogs, zero livestreams, zero Shorts
  const pool = REGIONAL_YTMUSIC_QUERIES[regionKey];
  const query = pool[Math.abs(refreshSeed) % pool.length];

  for (const host of getPipedCandidates().slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        4200
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: PipedItem[] };
      const tracks = (data.items || [])
        .map(pipedItemToTrack)
        .filter((t): t is Track => Boolean(t))
        .slice(0, 18);
      if (tracks.length > 0) return tracks;
    } catch {
      // Failover to next Piped instance
    }
  }

  // Strict music-only Invidious fallback (excludes livestreams, Shorts, and non-music videos)
  const invHosts = await getHealthyInvidiousInstances();
  for (const host of invHosts.slice(0, 3)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/api/v1/search?q=${encodeURIComponent(query + ' official audio')}&type=video`,
        4200
      );
      if (!res.ok) continue;
      const data = (await res.json()) as InvidiousItem[];
      const tracks = (data || [])
        .map(invidiousItemToTrack)
        .filter((t): t is Track => Boolean(t))
        .slice(0, 18);
      if (tracks.length > 0) return tracks;
    } catch {
      // Failover to next Invidious instance
    }
  }
  return [];
}

/**
 * Fetches native playable full-length tracks for a Spotify Chart using YouTube Music FOSS (zero broken WebView iframe).
 */
export async function fetchSpotifyChartTracks(chartTitle: string): Promise<Track[]> {
  const queryMap: Record<string, string> = {
    'Top 50 Indonesia': 'top 50 indonesia spotify hits 2025 2026',
    'Top 50 Global': 'top 50 global spotify hits 2025 2026',
    "Today's Top Hits": 'todays top hits pop 2025 2026'
  };
  const q = queryMap[chartTitle] || `${chartTitle} songs`;
  const ytSongs = await fetchYtSearch(q);
  if (ytSongs.length > 0) return ytSongs.slice(0, 12);
  return fetchPublicCatalogSearch(q, 12);
}

/**
 * Searches full-length YouTube Music tracks (uses optional YouTube API key if set, otherwise FOSS Piped/Invidious zero-API-key).
 */
export async function fetchYtSearch(query: string): Promise<Track[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const clean = query.trim();
  if (!clean) return [];
  const { ytApiKey } = getApiConfig();

  if (ytApiKey) {
    try {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(clean)}&key=${ytApiKey}`,
        5000
      );
      if (res.ok) {
        const data = (await res.json()) as { items?: unknown[] };
        const items = (data.items || []).map(ytToTrack);
        if (items.length > 0) return items;
      }
    } catch {
      // Fall through to FOSS Piped/Invidious
    }
  }

  for (const host of getPipedCandidates().slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/search?q=${encodeURIComponent(clean)}&filter=music_songs`,
        4200
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: PipedItem[] };
      const tracks = (data.items || [])
        .map(pipedItemToTrack)
        .filter((t): t is Track => Boolean(t))
        .slice(0, 20);
      if (tracks.length > 0) return tracks;
    } catch {
      // Failover to next Piped instance
    }
  }

  const invHosts = await getHealthyInvidiousInstances();
  for (const host of invHosts.slice(0, 3)) {
    try {
      const res = await fetchWithTimeout(
        `${host}/api/v1/search?q=${encodeURIComponent(clean + ' audio')}&type=video`,
        4200
      );
      if (!res.ok) continue;
      const data = (await res.json()) as InvidiousItem[];
      const tracks = (data || [])
        .map(invidiousItemToTrack)
        .filter((t): t is Track => Boolean(t))
        .slice(0, 18);
      if (tracks.length > 0) return tracks;
    } catch {
      // Failover to next Invidious instance
    }
  }
  return [];
}

export function extractYouTubeId(url: string): string {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (clean.includes('youtu.be/')) return clean.split('youtu.be/')[1].split(/[?&/]/)[0];
  if (clean.includes('/shorts/')) return clean.split('/shorts/')[1].split(/[?&/]/)[0];
  if (clean.includes('/embed/')) return clean.split('/embed/')[1].split(/[?&/]/)[0];
  if (clean.includes('v=')) return clean.split('v=')[1].split('&')[0];
  return '';
}

export function extractSpotifyEmbed(url: string): SpotifyEmbedRef | null {
  const clean = String(url || '').trim();
  if (!clean.includes('spotify.com')) return null;
  try {
    const parsed = new URL(clean);
    const parts = parsed.pathname.split('/').filter(Boolean).filter((p) => !p.startsWith('intl-'));
    const [type, id] = parts;
    if (
      type &&
      id &&
      (type === 'track' || type === 'album' || type === 'playlist' || type === 'artist' || type === 'episode')
    ) {
      return { type, id };
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export async function fetchOEmbedMeta(
  url: string,
  isSpotify = false
): Promise<{ title?: string; author_name?: string; thumbnail_url?: string } | null> {
  const endpoint = isSpotify
    ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  } catch {
    return null;
  }
}

export async function rapidDownloadMp3(videoId: string): Promise<DownloadResult> {
  const { rapidApiKey, rapidApiHost } = getApiConfig();
  if (!rapidApiKey) {
    return { ok: false, msg: 'RapidAPI Key belum diisi di menu Profil & Pengaturan API.' };
  }
  let data: { link?: string; title?: string; duration?: number; status?: string; msg?: string } = {
    msg: 'Tidak ada respons dari server API.'
  };
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
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, msg: `Koneksi gagal: ${message}` };
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

interface ItunesTrackItem {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
}

function itunesItemToTrack(item: ItunesTrackItem): Track | null {
  if (!item.trackId || !item.previewUrl) return null;
  const parsedYear = item.releaseDate ? Number(String(item.releaseDate).slice(0, 4)) : undefined;
  const releaseYear =
    parsedYear && Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2026
      ? parsedYear
      : undefined;
  const rawArt = item.artworkUrl100 || item.artworkUrl60 || null;
  const imageUrl = rawArt ? rawArt.replace(/100x100bb|60x60bb/, '600x600bb') : null;
  return {
    id: `catalog_${item.trackId}`,
    title: item.trackName || 'Untitled',
    artist: item.artistName || 'Artis Publik',
    album: item.collectionName || item.primaryGenreName || 'Katalog Publik',
    dur: 30,
    releaseYear,
    isPreview: true,
    c1: '#007aff',
    c2: '#1c1c1e',
    imageUrl,
    url: item.previewUrl,
    source: 'catalog'
  };
}

function fetchItunesJsonp(url: string): Promise<ItunesTrackItem[]> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    const cbName = `__xmusicItunesCb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const win = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = (): void => {
      delete win[cbName];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 5500);

    win[cbName] = (payload: { results?: ItunesTrackItem[] }) => {
      clearTimeout(timer);
      cleanup();
      resolve(Array.isArray(payload?.results) ? payload.results : []);
    };
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve([]);
    };
    script.src = `${url}&callback=${cbName}`;
    document.head.appendChild(script);
  });
}

async function queryItunesCatalog(
  term: string,
  limit = 25,
  signal?: AbortSignal,
  country = 'ID'
): Promise<ItunesTrackItem[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const cleanTerm = term.trim();
  if (!cleanTerm) return [];
  const safeCountry = /^[A-Z]{2}$/.test(country) ? country : 'ID';
  const url = `https://itunes.apple.com/search?media=music&entity=song&country=${safeCountry}&limit=${limit}&term=${encodeURIComponent(cleanTerm)}`;
  try {
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = (await res.json()) as { results?: ItunesTrackItem[] };
      return Array.isArray(data.results) ? data.results : [];
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return [];
  }
  if (signal?.aborted) return [];
  return fetchItunesJsonp(url);
}

/**
 * Searches the public mainstream music catalog spanning 1900-2026 (iTunes Search API + JSONP fallback).
 */
export async function fetchPublicCatalogSearch(
  query: string,
  limit = 30,
  signal?: AbortSignal,
  country = 'ID'
): Promise<Track[]> {
  const items = await queryItunesCatalog(query, limit, signal, country);
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const track = itunesItemToTrack(item);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  }
  return tracks;
}

/**
 * Fetches trending mainstream public hits for HomeView (2020-2026 Indonesia & Global).
 */
export async function fetchPublicCatalogTrending(limit = 16): Promise<Track[]> {
  return fetchPublicCatalogSearch('pop indonesia hits 2025 2026', limit);
}

/**
 * Fetches lightweight real-time smart autocomplete suggestions with title, artist, and release year.
 */
export async function fetchSmartSuggestions(
  query: string,
  signal?: AbortSignal,
  country = 'ID'
): Promise<SearchSuggestion[]> {
  const items = await queryItunesCatalog(query, 8, signal, country);
  const suggestions: SearchSuggestion[] = [];
  const seenKeys = new Set<string>();

  for (const item of items) {
    const track = itunesItemToTrack(item);
    if (!track) continue;
    const key = `${track.title.toLowerCase()}__${track.artist.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    suggestions.push({
      id: `pub_${track.id}`,
      query: `${track.title} ${track.artist}`,
      title: track.title,
      subtitle: track.releaseYear ? `${track.artist} • ${track.releaseYear}` : track.artist,
      year: track.releaseYear,
      kind: 'public',
      track
    });
  }
  return suggestions;
}

/**
 * Fetches regional viral & algorithm-tailored public hits (zero tracking; no user data leaves the device).
 */
export async function fetchRegionalViralFeed(
  config: AlgorithmConfig,
  limit = 20,
  refreshSeed = 0
): Promise<Track[]> {
  const regionObj = REGION_OPTIONS.find((r) => r.code === config.region) || REGION_OPTIONS[0];
  const eraObj =
    config.preferredEra !== 'all'
      ? ERA_PRESETS.find((e) => e.id === config.preferredEra)
      : undefined;

  const altPool = REGIONAL_YTMUSIC_QUERIES[config.region] || REGIONAL_YTMUSIC_QUERIES.ID;
  const baseQuery = refreshSeed === 0 ? regionObj.viralQuery : altPool[Math.abs(refreshSeed) % altPool.length];
  const queries: string[] = [baseQuery];
  if (config.mode === 'nostalgia') {
    queries.push('classic hits 1980s 1990s 2000s');
  } else if (eraObj) {
    queries.push(eraObj.query);
  }
  if (config.preferredGenres.length > 0) {
    queries.push(`${config.preferredGenres.slice(0, 2).join(' ')} ${regionObj.label} hits`);
  }

  const perQuery = Math.max(10, Math.ceil(limit / queries.length) + 4);
  const batches = await Promise.all(
    queries.map((q) => fetchPublicCatalogSearch(q, perQuery, undefined, regionObj.storeCode))
  );

  const merged: Track[] = [];
  const seen = new Set<string>();
  for (const list of batches) {
    for (const track of list) {
      const dedupeKey = `${track.title.toLowerCase()}__${track.artist.toLowerCase()}`;
      if (!seen.has(track.id) && !seen.has(dedupeKey)) {
        seen.add(track.id);
        seen.add(dedupeKey);
        merged.push(track);
      }
    }
  }
  return merged;
}

/**
 * 100% On-Device Privacy-First Recommendation & Viral Ranking Algorithm.
 * All taste signals remain strictly in local browser/WebView storage.
 */
export function rankTracksByAlgorithm(
  tracks: Track[],
  config: AlgorithmConfig,
  likedIds: string[],
  history: Track[],
  refreshSeed = 0
): Track[] {
  const likedSet = new Set(likedIds);
  const recentIds = new Set(history.slice(0, 12).map((h) => h.id));
  const artistAffinity = new Map<string, number>();

  if (config.personalizeFromHistory) {
    for (const h of history) {
      const key = (h.artist || '').toLowerCase().trim();
      if (key) artistAffinity.set(key, (artistAffinity.get(key) || 0) + 1);
    }
  }

  const eraObj =
    config.preferredEra !== 'all'
      ? ERA_PRESETS.find((e) => e.id === config.preferredEra)
      : undefined;
  const genreTokens = config.preferredGenres.map((g) => g.toLowerCase());

  const scored = tracks.map((track, idx) => {
    let score = Math.max(0, 40 - idx * 0.6); // Preserve regional viral base ordering

    // Mode-based era & recency weighting
    if (config.mode === 'viral' && track.releaseYear && track.releaseYear >= 2023) {
      score += 24;
    } else if (config.mode === 'nostalgia' && track.releaseYear && track.releaseYear <= 2009) {
      score += 26;
    }

    // Explicit user preferred era boost
    if (
      eraObj &&
      typeof track.releaseYear === 'number' &&
      track.releaseYear >= eraObj.minYear &&
      track.releaseYear <= eraObj.maxYear
    ) {
      score += 22;
    }

    // Preferred genres match
    if (genreTokens.length > 0) {
      const hay = `${track.title} ${track.artist} ${track.album}`.toLowerCase();
      for (const token of genreTokens) {
        if (hay.includes(token)) score += 16;
      }
    }

    // On-device personalization (strictly opt-in & local)
    if (config.personalizeFromHistory) {
      const artistKey = (track.artist || '').toLowerCase().trim();
      const affinity = artistAffinity.get(artistKey) || 0;
      if (affinity > 0) score += Math.min(20, affinity * 6);
      if (likedSet.has(track.id)) score += config.mode === 'discovery' ? -8 : 14;
    }

    // Discovery mode penalizes recently played tracks to surface fresh music
    if (config.mode === 'discovery' && recentIds.has(track.id)) {
      score -= 28;
    }

    if (refreshSeed > 0) {
      const hash = ((idx + 1) * 31 + refreshSeed * 17 + track.id.length * 13) % 19;
      score += hash - 9;
    }
    return { track, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.track);
}

interface ArchiveDoc {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  year?: string | number;
  date?: string;
}

/**
 * Searches Internet Archive Audio (100% legal, free, full-length public domain & classic recordings).
 */
export async function fetchArchiveAudioSearch(
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<Track[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const clean = query.trim();
  if (!clean) return [];
  try {
    const q = `(${clean}) AND mediatype:(audio) AND format:(VBR MP3)`;
    const url =
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
      `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=date` +
      `&sort[]=downloads+desc&rows=${limit}&page=1&output=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { response?: { docs?: ArchiveDoc[] } };
    const docs = data.response?.docs || [];
    const tracks: Track[] = [];

    for (const doc of docs.slice(0, 6)) {
      if (!doc.identifier || signal?.aborted) continue;
      try {
        const metaRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}/files`, {
          signal
        });
        if (!metaRes.ok) continue;
        const metaData = (await metaRes.json()) as {
          result?: Array<{ name?: string; format?: string; length?: string }>;
        };
        const mp3 = (metaData.result || []).find(
          (f) => f.name && /\.mp3$/i.test(f.name) && !f.name.includes('_64kb')
        );
        if (!mp3?.name) continue;

        const rawYear = doc.year ?? (doc.date ? String(doc.date).slice(0, 4) : undefined);
        const parsedYear = rawYear ? Number(rawYear) : undefined;
        const releaseYear =
          parsedYear && Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2026
            ? parsedYear
            : undefined;
        const creator = Array.isArray(doc.creator)
          ? doc.creator.join(', ')
          : doc.creator || 'Internet Archive';
        const durSec = mp3.length ? Math.round(Number(mp3.length) || 0) : 0;

        tracks.push({
          id: `archive_${doc.identifier}`,
          title: doc.title || doc.identifier,
          artist: creator,
          album: 'Internet Archive (Full)',
          dur: durSec,
          releaseYear,
          isPreview: false,
          c1: '#248a3d',
          c2: '#0b2919',
          imageUrl: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
          url: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(mp3.name)}`,
          source: 'archive'
        });
      } catch {
        // Skip unreachable archive item
      }
    }
    return tracks;
  } catch {
    return [];
  }
}
