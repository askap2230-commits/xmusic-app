// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { engine } from '#lib/audio/engine.svelte';
import {
  fetchSearch,
  fetchSyncedLyrics,
  fetchTrending,
  fetchYtSearch,
  fetchYtTrending,
  getApiConfig,
  saveApiConfig
} from '#lib/api/services';
import { generateDemoSynthBlob } from '#lib/data/presets';
import {
  deleteLocalTrack,
  getAllLocalTracks,
  loadJSON,
  openDB,
  parseFilenameMeta,
  probeAudioDuration,
  saveJSON,
  saveLocalTrack
} from '#lib/db/storage';
import type {
  ApiConfig,
  AppView,
  DrawerTab,
  Playlist,
  RuntimeInfo,
  ThemeMode,
  Track,
  UserProfile
} from '#lib/types/music';

class AppStore {
  // Theme mode ('system' | 'light' | 'dark')
  themeMode = $state<ThemeMode>('system');
  systemPrefersDark = $state<boolean>(true);
  private themeMediaQuery: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;

  // Live network connectivity state (prevents broken Android WebView error iframes when offline)
  isOnline = $state<boolean>(true);
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  // Navigation & filtering
  view = $state<AppView>('home');
  libFilter = $state<string>('local');
  searchQuery = $state<string>('');
  searching = $state<boolean>(false);
  loadingHome = $state<boolean>(true);

  // Collections
  localTracks = $state<Track[]>([]);
  trendingTracks = $state<Track[]>([]);
  ytTracks = $state<Track[]>([]);
  searchResults = $state<Track[]>([]);
  likedIds = $state<string[]>([]);
  playlists = $state<Playlist[]>([]);

  // Runtime & profile
  runtimeInfo = $state<RuntimeInfo>({
    app_name: 'nys Xmusic',
    version: '5.0.0',
    engine: 'Tauri v2.12 + SvelteKit 3.2 + Konsta UI iOS',
    platform: 'web',
    arch: 'wasm'
  });

  userProfile = $state<UserProfile>({
    name: 'Nys',
    handle: '@nysxmusic',
    bio: 'Bikin playlist buat jalan pulang.',
    image: null
  });

  apiConfig = $state<ApiConfig>(getApiConfig());

  // Overlay & modal visibility
  npDrawerOpen = $state<boolean>(false);
  npTab = $state<DrawerTab>('queue');
  trackModalOpen = $state<boolean>(false);
  modalTrack = $state<Track | null>(null);
  modalFlipped = $state<boolean>(false);
  flippedGridIds = $state<Set<string>>(new Set());
  fetchingLyrics = $state<boolean>(false);

  uploadModalOpen = $state<boolean>(false);
  hubModalOpen = $state<boolean>(false);
  dlModalOpen = $state<boolean>(false);
  dlPrefillUrl = $state<string>('');
  editProfileOpen = $state<boolean>(false);
  editTrackOpen = $state<boolean>(false);
  editingTrack = $state<Track | null>(null);
  playlistModalOpen = $state<boolean>(false);
  targetTrackForPlaylist = $state<Track | null>(null);
  dynamicBarDismissed = $state<boolean>(false);

  // Accessible live-region toast
  toastMsg = $state<string>('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  get isDark(): boolean {
    if (this.themeMode === 'dark') return true;
    if (this.themeMode === 'light') return false;
    return this.systemPrefersDark;
  }

  get allTracks(): Track[] {
    const map = new Map<string, Track>();
    for (const track of [
      ...this.localTracks,
      ...this.searchResults,
      ...this.ytTracks,
      ...this.trendingTracks
    ]) {
      if (track?.id && !map.has(track.id)) map.set(track.id, track);
    }
    return [...map.values()];
  }

  get filteredLibrary(): Track[] {
    if (this.libFilter === 'local') return this.localTracks;
    if (this.libFilter === 'liked') {
      return this.allTracks.filter((t) => this.likedIds.includes(t.id));
    }
    if (this.libFilter === 'history') return engine.history;
    const playlist = this.playlists.find((p) => p.id === this.libFilter);
    if (playlist) {
      return this.allTracks.filter((t) => playlist.trackIds.includes(t.id));
    }
    return this.localTracks;
  }

  get activeModalTrack(): Track | null {
    if (!this.modalTrack) return null;
    return engine.current?.id === this.modalTrack.id ? engine.current : this.modalTrack;
  }

  initTheme(): void {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('nys_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.themeMode = saved;
    }
    this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark = this.themeMediaQuery.matches;
    this.themeMediaHandler = (event: MediaQueryListEvent) => {
      this.systemPrefersDark = event.matches;
      this.syncDocumentTheme();
    };
    this.themeMediaQuery.addEventListener('change', this.themeMediaHandler);
    this.syncDocumentTheme();
  }

  initConnectivity(): void {
    if (typeof window === 'undefined') return;
    this.isOnline = navigator.onLine;
    this.onlineHandler = () => {
      this.isOnline = true;
      this.showToast('Koneksi internet kembali terhubung.');
      void this.refreshOnlineFeeds();
    };
    this.offlineHandler = () => {
      this.isOnline = false;
      this.showToast('Mode Offline aktif — koleksi lokal tetap siap diputar.');
    };
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  destroyListeners(): void {
    if (this.themeMediaQuery && this.themeMediaHandler) {
      this.themeMediaQuery.removeEventListener('change', this.themeMediaHandler);
    }
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    }
  }

  syncDocumentTheme(): void {
    if (typeof document === 'undefined') return;
    const dark = this.isDark;
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    try {
      localStorage.setItem('nys_theme_mode', mode);
    } catch {
      // Ignore storage quota errors
    }
    this.syncDocumentTheme();
    const labels: Record<ThemeMode, string> = {
      light: 'Mode Terang diaktifkan',
      dark: 'Mode Gelap diaktifkan',
      system: 'Tema mengikuti sistem perangkat'
    };
    this.showToast(labels[mode]);
  }

  toggleTheme(): void {
    this.setThemeMode(this.isDark ? 'light' : 'dark');
  }

  showToast = (message: string): void => {
    this.toastMsg = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
    }, 2800);
  };

  isLiked(id: string): boolean {
    return this.likedIds.includes(id);
  }

  toggleLike(track: Track | null): void {
    if (!track) return;
    if (this.likedIds.includes(track.id)) {
      this.likedIds = this.likedIds.filter((id) => id !== track.id);
      this.showToast('Dihapus dari Favorit');
    } else {
      this.likedIds = [track.id, ...this.likedIds];
      this.showToast('Ditambahkan ke Favorit');
    }
    saveJSON('nys_liked_ids', this.likedIds);
  }

  async refreshLocalTracks(): Promise<void> {
    this.localTracks = await getAllLocalTracks();
    if (engine.queue.length === 0 && this.localTracks.length > 0) {
      engine.queue = [...this.localTracks, ...this.trendingTracks];
    }
  }

  async refreshOnlineFeeds(): Promise<void> {
    if (!this.isOnline) {
      this.loadingHome = false;
      return;
    }
    this.loadingHome = true;
    const [trending, yt] = await Promise.all([fetchTrending(32), fetchYtTrending('ID')]);
    this.trendingTracks = trending;
    this.ytTracks = yt;
    this.loadingHome = false;
    if (engine.queue.length === 0) {
      engine.queue = [...this.localTracks, ...trending];
    }
  }

  async bootstrap(): Promise<void> {
    this.initTheme();
    this.initConnectivity();
    engine.init(this.showToast);

    this.likedIds = loadJSON<string[]>('nys_liked_ids', []);
    this.playlists = loadJSON<Playlist[]>('nys_playlists', [
      { id: 'pl_default_chill', name: 'Jalan Pulang', trackIds: [], createdAt: Date.now() }
    ]);
    engine.history = loadJSON<Track[]>('nys_history', []);

    const savedProfile = loadJSON<UserProfile | null>('nys_profile', null);
    if (savedProfile) this.userProfile = savedProfile;

    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke<RuntimeInfo>('get_runtime_info');
        if (info) this.runtimeInfo = info;
      } catch {
        // Running outside Tauri shell
      }
    }

    try {
      await openDB();
      await this.refreshLocalTracks();
    } catch (err) {
      console.warn('[IndexedDB Init Warning]', err);
    }

    await this.refreshOnlineFeeds();

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  async autoFetchLyricsForTrack(track: Track | null): Promise<void> {
    if (!track || this.fetchingLyrics) return;
    if (!this.isOnline) {
      this.showToast('Mode Offline: tidak dapat mengambil lirik dari LRCLIB.');
      return;
    }
    this.fetchingLyrics = true;
    const lrc = await fetchSyncedLyrics(track.title, track.artist, track.dur);
    this.fetchingLyrics = false;

    if (lrc) {
      track.lyrics = lrc;
      if (track.source === 'local') {
        await saveLocalTrack(track);
        await this.refreshLocalTracks();
      }
      if (engine.current?.id === track.id) engine.current = { ...track };
      if (this.modalTrack?.id === track.id) this.modalTrack = { ...track };
      this.showToast('Lirik tersinkronisasi ditemukan.');
    } else {
      this.showToast('Lirik tidak ditemukan otomatis. Kamu bisa menempelkannya manual.');
    }
  }

  async createBuiltInSynthDemo(): Promise<void> {
    this.showToast('Menyintesis lagu demo lossless 44.1kHz...');
    try {
      const wavBlob = await generateDemoSynthBlob(24);
      const demoTrack: Track = {
        id: 'local_demo_synthwave',
        title: 'Midnight Drive (Built-in Synth)',
        artist: 'nys Xmusic Studio',
        album: 'Offline Lossless Synth',
        blob: wavBlob,
        dur: 24,
        c1: '#007aff',
        c2: '#1e1b4b',
        imageUrl: null,
        source: 'local',
        createdAt: Date.now(),
        lyrics: [
          '[00:00.00] nys Xmusic Built-in Procedural Synthwave',
          '[00:04.00] Ketuk dua kali kartu untuk membalik dan melihat lirik sinkron',
          '[00:08.50] Buka EQ Studio untuk mengatur 5-Band Web Audio EQ dan Limiter',
          '[00:13.00] Lirik berjalan otomatis mengikuti irama dan detik lagu',
          '[00:18.00] Ketuk baris lirik mana saja untuk melompat ke detik tersebut',
          '[00:21.50] Siap digunakan kapan saja 100% offline'
        ].join('\n')
      };
      await saveLocalTrack(demoTrack);
      await this.refreshLocalTracks();
      const hydrated = this.localTracks.find((x) => x.id === demoTrack.id);
      if (hydrated) {
        this.dynamicBarDismissed = false;
        engine.playTrack(hydrated, [...this.localTracks, ...this.trendingTracks]);
        this.openTrackModal(hydrated, false);
      }
      this.showToast('Lagu demo siap diputar. Ketuk 2x kartu untuk melihat lirik.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showToast(`Gagal membuat lagu demo: ${msg}`);
    }
  }

  openTrackModal(track: Track, startFlipped = false): void {
    this.modalTrack = track;
    this.modalFlipped = startFlipped;
    this.trackModalOpen = true;
    this.dynamicBarDismissed = false;
    if (startFlipped && !track.lyrics) {
      void this.autoFetchLyricsForTrack(track);
    }
  }

  closeTrackModal(): void {
    this.trackModalOpen = false;
    this.modalFlipped = false;
  }

  toggleModalFlip(): void {
    this.modalFlipped = !this.modalFlipped;
    const active = this.activeModalTrack;
    if (this.modalFlipped && active && !active.lyrics) {
      void this.autoFetchLyricsForTrack(active);
    }
  }

  toggleGridFlip(track: Track): void {
    const next = new Set(this.flippedGridIds);
    if (next.has(track.id)) {
      next.delete(track.id);
    } else {
      next.add(track.id);
      if (!track.lyrics) void this.autoFetchLyricsForTrack(track);
    }
    this.flippedGridIds = next;
  }

  async importLocalFiles(files: FileList | File[], coverFile: File | null = null): Promise<boolean> {
    const audioFiles = [...files].filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i.test(f.name)
    );
    if (!audioFiles.length) {
      this.showToast('Pilih file audio yang valid (MP3/M4A/WAV/OGG/FLAC).');
      return false;
    }
    this.showToast(`Memproses ${audioFiles.length} file audio...`);
    for (const file of audioFiles) {
      const meta = parseFilenameMeta(file.name);
      const dur = await probeAudioDuration(file);
      const newTrack: Track = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: meta.title,
        artist: meta.artist,
        album: 'Koleksi Offline',
        blob: file,
        coverBlob: coverFile || null,
        dur,
        c1: '#4f46e5',
        c2: '#1e1b4b',
        imageUrl: null,
        source: 'local',
        createdAt: Date.now(),
        lyrics: ''
      };
      await saveLocalTrack(newTrack);
    }
    await this.refreshLocalTracks();
    this.uploadModalOpen = false;
    this.view = 'library';
    this.libFilter = 'local';
    this.showToast(`${audioFiles.length} lagu disimpan untuk pemutaran offline.`);
    return true;
  }

  async importStreamUrl(payload: { url: string; title: string; artist: string }): Promise<boolean> {
    const cleanUrl = String(payload.url || '').trim();
    if (!cleanUrl) {
      this.showToast('Masukkan URL audio terlebih dahulu.');
      return false;
    }
    const dur = await probeAudioDuration(cleanUrl);
    await saveLocalTrack({
      id: `local_${Date.now()}`,
      title: String(payload.title || '').trim() || 'Audio Stream URL',
      artist: String(payload.artist || '').trim() || 'External Stream',
      album: 'URL Import',
      url: cleanUrl,
      dur,
      c1: '#059669',
      c2: '#064e3b',
      imageUrl: null,
      source: 'local',
      createdAt: Date.now(),
      lyrics: ''
    });
    await this.refreshLocalTracks();
    this.uploadModalOpen = false;
    this.view = 'library';
    this.showToast('Tautan lagu ditambahkan ke Perpustakaan.');
    return true;
  }

  async removeTrack(track: Track): Promise<void> {
    await deleteLocalTrack(track.id);
    await this.refreshLocalTracks();
    this.showToast(`"${track.title}" dihapus dari penyimpanan.`);
  }

  openEditTrack(track: Track): void {
    this.editingTrack = track;
    this.editTrackOpen = true;
  }

  async saveEditedTrack(payload: {
    title: string;
    artist: string;
    album: string;
    lyrics: string;
  }): Promise<void> {
    if (!this.editingTrack) return;
    const updated: Track = {
      ...this.editingTrack,
      title: payload.title.trim() || this.editingTrack.title,
      artist: payload.artist.trim() || this.editingTrack.artist,
      album: payload.album.trim() || this.editingTrack.album,
      lyrics: payload.lyrics
    };
    if (updated.source === 'local') {
      await saveLocalTrack(updated);
      await this.refreshLocalTracks();
    }
    if (engine.current?.id === updated.id) engine.current = updated;
    if (this.modalTrack?.id === updated.id) this.modalTrack = updated;
    this.editTrackOpen = false;
    this.showToast('Metadata dan lirik lagu diperbarui.');
  }

  createPlaylist(name: string): boolean {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      this.showToast('Masukkan nama playlist.');
      return false;
    }
    const playlist: Playlist = {
      id: `pl_${Date.now()}`,
      name: trimmed,
      trackIds: this.targetTrackForPlaylist ? [this.targetTrackForPlaylist.id] : [],
      createdAt: Date.now()
    };
    this.playlists = [playlist, ...this.playlists];
    saveJSON('nys_playlists', this.playlists);
    this.targetTrackForPlaylist = null;
    this.playlistModalOpen = false;
    this.showToast(`Playlist "${trimmed}" berhasil dibuat.`);
    return true;
  }

  toggleTrackInPlaylist(playlistId: string, track: Track | null): void {
    if (!track) return;
    this.playlists = this.playlists.map((pl) => {
      if (pl.id !== playlistId) return pl;
      const exists = pl.trackIds.includes(track.id);
      this.showToast(exists ? `Dihapus dari "${pl.name}"` : `Ditambahkan ke "${pl.name}"`);
      return {
        ...pl,
        trackIds: exists ? pl.trackIds.filter((id) => id !== track.id) : [...pl.trackIds, track.id]
      };
    });
    saveJSON('nys_playlists', this.playlists);
  }

  updateSearch(query: string): void {
    this.searchQuery = query;
    if (this.view !== 'search') this.view = 'search';
    if (this.searchDebounceId) clearTimeout(this.searchDebounceId);

    if (!query.trim()) {
      this.searchResults = [];
      this.searching = false;
      return;
    }

    this.searching = true;
    this.searchDebounceId = setTimeout(async () => {
      const qLow = query.toLowerCase();
      const localMatch = this.localTracks.filter(
        (t) =>
          t.title?.toLowerCase().includes(qLow) ||
          t.artist?.toLowerCase().includes(qLow) ||
          t.album?.toLowerCase().includes(qLow)
      );
      if (!this.isOnline) {
        this.searchResults = localMatch;
        this.searching = false;
        return;
      }
      const [audius, youtube] = await Promise.all([fetchSearch(query), fetchYtSearch(query)]);
      this.searchResults = [...localMatch, ...youtube, ...audius];
      this.searching = false;
    }, 320);
  }

  saveProfileSettings(profile: UserProfile, nextApiConfig: Partial<ApiConfig>): void {
    this.userProfile = {
      name: profile.name.trim() || 'Nys',
      handle: profile.handle.trim() || '@nysxmusic',
      bio: profile.bio.trim() || 'Penikmat musik.',
      image: profile.image
    };
    saveJSON('nys_profile', this.userProfile);
    this.apiConfig = saveApiConfig(nextApiConfig);
    this.editProfileOpen = false;
    this.showToast('Profil dan konfigurasi API berhasil disimpan.');
  }

  openDownloaderWithUrl(url = ''): void {
    this.dlPrefillUrl = url;
    this.dlModalOpen = true;
  }

  closeTopOverlay(): boolean {
    if (this.trackModalOpen) { this.closeTrackModal(); return true; }
    if (this.uploadModalOpen) { this.uploadModalOpen = false; return true; }
    if (this.hubModalOpen) { this.hubModalOpen = false; return true; }
    if (this.dlModalOpen) { this.dlModalOpen = false; return true; }
    if (this.editProfileOpen) { this.editProfileOpen = false; return true; }
    if (this.editTrackOpen) { this.editTrackOpen = false; return true; }
    if (this.playlistModalOpen) { this.playlistModalOpen = false; return true; }
    if (this.npDrawerOpen) { this.npDrawerOpen = false; return true; }
    if (this.view !== 'home') { this.view = 'home'; return true; }
    return false;
  }
}

export const appStore = new AppStore();
