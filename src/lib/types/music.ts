// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

export type TrackSource = 'local' | 'audius' | 'archive' | 'catalog' | 'youtube' | 'spotify';
export type RepeatMode = 'off' | 'all' | 'one';
export type ThemeMode = 'system' | 'light' | 'dark';
export type UiStyleMode = 'liquid-glass' | 'editorial';
export type AppView = 'home' | 'search' | 'library' | 'eq' | 'profile';
export type DrawerTab = 'queue' | 'lyrics';

export type MusicRegion = 'ID' | 'US' | 'JP' | 'KR' | 'GB' | 'GLOBAL';
export type AlgorithmMode = 'viral' | 'balanced' | 'discovery' | 'nostalgia';

export interface RegionOption {
  code: MusicRegion;
  storeCode: string;
  label: string;
  viralQuery: string;
}

export interface AlgorithmConfig {
  region: MusicRegion;
  mode: AlgorithmMode;
  preferredEra: string;
  preferredGenres: string[];
  personalizeFromHistory: boolean;
}


export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  dur: number;
  source: TrackSource;
  releaseYear?: number;
  isPreview?: boolean;
  c1?: string;
  c2?: string;
  imageUrl?: string | null;
  artistPhoto?: string | null;
  url?: string;
  blob?: Blob;
  coverBlob?: Blob | null;
  lyrics?: string;
  createdAt?: number;
  playedAt?: number;
  videoId?: string;
  spotifyId?: string;
  spotifyType?: 'track' | 'album' | 'playlist' | 'artist' | 'episode';
}

export interface EraPreset {
  id: string;
  label: string;
  sub: string;
  minYear: number;
  maxYear: number;
  query: string;
  accent: string;
  bg: string;
}

export interface SearchSuggestion {
  id: string;
  query: string;
  title: string;
  subtitle: string;
  year?: number;
  kind: 'recent' | 'local' | 'public' | 'era';
  track?: Track;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  bio: string;
  image: string | null;
  bannerImage?: string | null;
  bannerVideoUrl?: string | null;
}

export interface ApiConfig {
  rapidApiKey: string;
  rapidApiHost: string;
  ytApiKey: string;
  spotifyClientId: string;
  spotifyClientSecret: string;
  audiusHost: string;
  pipedInstance: string;
}

export interface RuntimeInfo {
  app_name: string;
  version: string;
  engine: string;
  platform: string;
  arch: string;
}

export interface EqBand {
  freq: number;
  label: string;
  sub: string;
  type: BiquadFilterType;
}

export interface EqPreset {
  name: string;
  preamp: number;
  gains: [number, number, number, number, number];
}

export interface CategoryItem {
  label: string;
  sub: string;
  accent: string;
  bg: string;
  q: string;
}

export interface SpotifyChart {
  id: string;
  title: string;
}

export interface SleepOption {
  label: string;
  minutes: number;
}

export interface ParsedLyricLine {
  time: number | null;
  text: string;
  synced: boolean;
}

export interface SpotifyEmbedRef {
  type: 'track' | 'album' | 'playlist' | 'artist' | 'episode';
  id: string;
}

export interface HubMeta {
  via: string;
  title: string;
  artist: string;
  album: string;
  dur: number;
  imageUrl: string | null;
  previewUrl?: string | null;
}

export interface DownloadResult {
  ok: boolean;
  link?: string;
  title?: string;
  duration?: number;
  msg?: string;
}

export interface ResolvedAudioStream {
  url: string;
  userAgent?: string;
  backupStreams?: Array<{ url: string; userAgent?: string }>;
}

export interface NativeAndroidPlaybackState {
  active: boolean;
  playing: boolean;
  trackId: string;
  positionMs: number;
  durationMs: number;
}

export interface AndroidMediaBridge {
  updateNowPlaying(
    title: string,
    artist: string,
    album: string,
    isPlaying: boolean,
    durationMs: number,
    positionMs: number
  ): void;
  clearNotification(): void;
  setSystemBarTheme(isDark: boolean): void;
  playNativeUrl?(
    trackId: string,
    title: string,
    artist: string,
    album: string,
    url: string,
    userAgent: string,
    startMs: number,
    volume: number
  ): void;
  pauseNative?(): void;
  resumeNative?(): void;
  stopNative?(): void;
  seekNative?(positionMs: number): void;
  setNativeVolume?(volume: number): void;
  getNativeStateJson?(): string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    XmusicAndroidMedia?: AndroidMediaBridge;
    __xmusicMediaAction?: (
      action:
        | 'togglePlay'
        | 'play'
        | 'pause'
        | 'next'
        | 'prev'
        | 'stop'
        | 'duck'
        | 'unduck'
        | 'appResumed'
        | 'nativePlaying'
        | 'nativePaused'
        | 'nativeEnded'
        | 'nativeError'
    ) => void;
    __xmusicSeekMs?: (positionMs: number) => void;
    webkitAudioContext?: typeof AudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  }
}
