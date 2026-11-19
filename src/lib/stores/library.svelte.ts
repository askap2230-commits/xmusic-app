// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import { engine } from '#lib/audio/engine.svelte.ts';
import { i18n } from '#lib/i18n/index.svelte.ts';
import {
  fetchArchiveAudioSearch,
  fetchPublicCatalogSearch,
  fetchRegionalViralFeed,
  rankTracksByAlgorithm,
  fetchSearch,
  fetchSmartSuggestions,
  fetchSpotifyChartTracks,
  fetchSyncedLyrics,
  fetchTrending,
  fetchYtSearch,
  fetchYtTrending,
  getApiConfig,
  saveApiConfig
} from '#lib/api/services.ts';
import { DEFAULT_ALGORITHM_CONFIG, ERA_PRESETS, REGION_OPTIONS, generateDemoSynthBlob } from '#lib/data/presets.ts';
import {
  deleteLocalTrack,
  getAllLocalTracks,
  loadJSON,
  openDB,
  parseFilenameMeta,
  probeAudioDuration,
  saveJSON,
  saveLocalTrack
} from '#lib/db/storage.ts';
import type {
  AlgorithmConfig,
  ApiConfig,
  AppView,
  DrawerTab,
  Playlist,
  RegionOption,
  RuntimeInfo,
  SearchSuggestion,
  ThemeMode,
  Track,
  UserProfile
} from '#lib/types/music.ts';

class AppStore {
  // Theme mode ('system' | 'light' | 'dark')
  themeMode = $state<ThemeMode>('system');
  systemPrefersDark = $state<boolean>(true);
  private themeMediaQuery: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;

  // Live network connectivity state (prevents broken Android WebView error iframes when offline)
  isOnline = $state<boolean>(true);
  networkReachable = $state<boolean>(true);
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  // Navigation & filtering
  view = $state<AppView>('home');
  libFilter = $state<string>('local');
  searchQuery = $state<string>('');
  eraFilter = $state<string>('all');
  fullOnlyFilter = $state<boolean>(false);
  searchSourceFilter = $state<'all' | 'youtube' | 'audius' | 'local'>('all');
  searchSort = $state<'relevant' | 'newest' | 'longest'>('relevant');
  searchVisibleCount = $state<number>(12);
  searchLoadingMore = $state<boolean>(false);
  private searchArchiveLoaded = false;
  searching = $state<boolean>(false);
  suggesting = $state<boolean>(false);
  showSuggestions = $state<boolean>(false);
  searchSuggestions = $state<SearchSuggestion[]>([]);
  recentSearches = $state<string[]>([]);
  loadingHome = $state<boolean>(false);
  ytLoading = $state<boolean>(false);
  audiusLoading = $state<boolean>(false);
  catalogLoading = $state<boolean>(false);
  ytLoadingMore = $state<boolean>(false);
  audiusLoadingMore = $state<boolean>(false);
  catalogLoadingMore = $state<boolean>(false);
  refreshing = $state<boolean>(false);
  refreshSeed = $state<number>(0);
  private ytPage = 0;
  private audiusOffset = 0;
  private catalogPage = 0;

  // Cached Spotify Chart tabs (zero open/close clash, 0ms instant tab switching)
  activeSpotifyChartTitle = $state<string>('Top 50 Indonesia');
  spotifyChartCache = $state<Record<string, Track[]>>({});
  private spotifyChartPages: Record<string, number> = {};
  loadingSpotifyChart = $state<boolean>(false);
  spotifyChartLoadingMore = $state<boolean>(false);

  // Collections
  localTracks = $state<Track[]>([]);
  catalogTrending = $state<Track[]>([]);
  trendingTracks = $state<Track[]>([]);
  ytTracks = $state<Track[]>([]);
  searchResults = $state<Track[]>([]);
  likedIds = $state<string[]>([]);
  playlists = $state<Playlist[]>([]);

  // Runtime & profile
  runtimeInfo = $state<RuntimeInfo>({
    app_name: 'nys Xmusic',
    version: '6.17.0',
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
  algoConfig = $state<AlgorithmConfig>({ ...DEFAULT_ALGORITHM_CONFIG });

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

  // Accessible live-region toast
  toastMsg = $state<string>('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private suggestDebounceId: ReturnType<typeof setTimeout> | null = null;
  private searchAbort: AbortController | null = null;
  private suggestAbort: AbortController | null = null;

  get activeRegionOption(): RegionOption {
    return REGION_OPTIONS.find((r) => r.code === this.algoConfig.region) || REGION_OPTIONS[0];
  }

  get recommendedFeed(): Track[] {
    return rankTracksByAlgorithm(
      this.catalogTrending,
      this.algoConfig,
      this.likedIds,
      engine.history,
      this.refreshSeed
    );
  }

  get spotifyChartTracks(): Track[] {
    return this.spotifyChartCache[this.activeSpotifyChartTitle] || [];
  }

  get rankedYtFeed(): Track[] {
    return rankTracksByAlgorithm(
      this.ytTracks,
      this.algoConfig,
      this.likedIds,
      engine.history,
      this.refreshSeed
    );
  }

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
      ...this.catalogTrending,
      ...this.ytTracks,
      ...this.trendingTracks
    ]) {
      if (track?.id && !map.has(track.id)) map.set(track.id, track);
    }
    return [...map.values()];
  }

  get filteredSearchResults(): Track[] {
    let list = this.searchResults;
    if (this.searchSourceFilter !== 'all') {
      list = list.filter((t) => t.source === this.searchSourceFilter);
    }
    if (this.fullOnlyFilter) {
      list = list.filter((t) => !t.isPreview);
    }
    if (this.eraFilter !== 'all') {
      const era = ERA_PRESETS.find((e) => e.id === this.eraFilter);
      if (era) {
        list = list.filter(
          (t) =>
            typeof t.releaseYear === 'number' &&
            t.releaseYear >= era.minYear &&
            t.releaseYear <= era.maxYear
        );
      }
    }
    if (this.searchSort === 'newest') {
      return [...list].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    }
    if (this.searchSort === 'longest') {
      return [...list].sort((a, b) => (b.dur || 0) - (a.dur || 0));
    }
    return list;
  }

  get visibleSearchResults(): Track[] {
    return this.filteredSearchResults.slice(0, this.searchVisibleCount);
  }

  get hasMoreSearchResults(): boolean {
    return (
      this.filteredSearchResults.length > this.searchVisibleCount ||
      (this.isOnline && !this.searchArchiveLoaded && this.searchQuery.trim().length >= 2)
    );
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
    if (!this.modalTrack && !engine.current) return null;
    if (this.modalTrack?.spotifyId && engine.current?.id !== this.modalTrack.id) {
      return this.modalTrack;
    }
    return engine.current ?? this.modalTrack;
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
      this.networkReachable = false;
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
    if (typeof window !== 'undefined') {
      try {
        window.XmusicAndroidMedia?.setSystemBarTheme(dark);
      } catch {
        // Running outside Android WebView
      }
    }
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

  private mergeUniqueTracks(existing: Track[], incoming: Track[]): Track[] {
    const seen = new Set(existing.map((t) => t.id));
    const merged = [...existing];
    for (const track of incoming) {
      if (track?.id && !seen.has(track.id)) {
        seen.add(track.id);
        merged.push(track);
      }
    }
    return merged;
  }

  /**
   * Progressive non-blocking feed refresh: each source renders immediately as soon as it responds,
   * never stalling the UI behind a slow server.
   */
  async refreshOnlineFeeds(manual = false): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.networkReachable = false;
      this.ytLoading = false;
      this.audiusLoading = false;
      this.catalogLoading = false;
      this.refreshing = false;
      if (manual) this.showToast('Mode Offline: tidak dapat menyegarkan feed online.');
      return;
    }

    if (manual) {
      this.refreshSeed += 1;
      this.refreshing = true;
    }
    this.ytPage = this.refreshSeed;
    this.audiusOffset = manual ? (this.refreshSeed % 4) * 12 : 0;
    this.catalogPage = this.refreshSeed;

    this.ytLoading = this.ytTracks.length === 0 || manual;
    this.audiusLoading = this.trendingTracks.length === 0 || manual;
    this.catalogLoading = this.catalogTrending.length === 0 || manual;

    const ytTask = fetchYtTrending(this.algoConfig.region, this.ytPage)
      .then((yt) => {
        if (yt.length > 0) {
          this.ytTracks = yt;
          this.networkReachable = true;
          saveJSON('nys_cache_yt', yt.slice(0, 12));
          if (engine.queue.length === 0) engine.queue = [...this.localTracks, ...yt];
        }
        return yt.length;
      })
      .catch(() => 0)
      .finally(() => {
        this.ytLoading = false;
      });

    const audiusTask = fetchTrending(12, this.audiusOffset)
      .then((audius) => {
        if (audius.length > 0) {
          this.trendingTracks = audius;
          this.networkReachable = true;
          saveJSON('nys_cache_audius', audius.slice(0, 12));
          if (engine.queue.length === 0) engine.queue = [...this.localTracks, ...audius];
        }
        return audius.length;
      })
      .catch(() => 0)
      .finally(() => {
        this.audiusLoading = false;
      });

    const catalogTask = fetchRegionalViralFeed(this.algoConfig, 12, this.catalogPage)
      .then((cat) => {
        if (cat.length > 0) {
          this.catalogTrending = cat;
          this.networkReachable = true;
          saveJSON('nys_cache_catalog', cat.slice(0, 12));
        }
        return cat.length;
      })
      .catch(() => 0)
      .finally(() => {
        this.catalogLoading = false;
      });

    // Also lazily warm the active Spotify Chart tab if not cached yet
    if (!this.spotifyChartCache[this.activeSpotifyChartTitle]?.length) {
      void this.selectSpotifyChart(this.activeSpotifyChartTitle);
    }

    const [ytCount, audiusCount, catCount] = await Promise.all([ytTask, audiusTask, catalogTask]);
    this.networkReachable =
      ytCount > 0 ||
      audiusCount > 0 ||
      catCount > 0 ||
      this.ytTracks.length > 0 ||
      this.trendingTracks.length > 0 ||
      this.catalogTrending.length > 0;
    this.refreshing = false;

    if (manual) {
      this.showToast(
        this.networkReachable
          ? `Algoritma & daftar musik ${this.activeRegionOption.label} berhasil disegarkan.`
          : 'Server streaming sedang sibuk. Coba lagi sebentar lagi.'
      );
    }
  }

  async refreshYtOnly(): Promise<void> {
    if (this.ytLoading || !this.isOnline) return;
    this.ytLoading = true;
    this.ytPage += 1;
    const yt = await fetchYtTrending(this.algoConfig.region, this.ytPage);
    if (yt.length > 0) {
      this.ytTracks = yt;
      this.networkReachable = true;
      saveJSON('nys_cache_yt', yt.slice(0, 12));
      this.showToast(`Daftar YouTube Music ${this.activeRegionOption.label} disegarkan.`);
    } else {
      this.showToast('Gagal memuat daftar YouTube Music baru.');
    }
    this.ytLoading = false;
  }

  async refreshAudiusOnly(): Promise<void> {
    if (this.audiusLoading || !this.isOnline) return;
    this.audiusLoading = true;
    this.audiusOffset = (this.audiusOffset + 12) % 48;
    const audius = await fetchTrending(12, this.audiusOffset);
    if (audius.length > 0) {
      this.trendingTracks = audius;
      this.networkReachable = true;
      saveJSON('nys_cache_audius', audius.slice(0, 12));
      this.showToast('Daftar Audius Global disegarkan.');
    } else {
      this.showToast('Gagal memuat daftar Audius Global baru.');
    }
    this.audiusLoading = false;
  }

  async loadMoreYt(): Promise<void> {
    if (this.ytLoadingMore || !this.isOnline) return;
    this.ytLoadingMore = true;
    this.ytPage += 1;
    const more = await fetchYtTrending(this.algoConfig.region, this.ytPage);
    this.ytTracks = this.mergeUniqueTracks(this.ytTracks, more);
    this.ytLoadingMore = false;
    if (more.length === 0) this.showToast('Belum ada lagu YouTube Music tambahan.');
  }

  async loadMoreAudius(): Promise<void> {
    if (this.audiusLoadingMore || !this.isOnline) return;
    this.audiusLoadingMore = true;
    this.audiusOffset += 12;
    const more = await fetchTrending(12, this.audiusOffset);
    this.trendingTracks = this.mergeUniqueTracks(this.trendingTracks, more);
    this.audiusLoadingMore = false;
    if (more.length === 0) this.showToast('Semua lagu Audius trending sudah dimuat.');
  }

  async loadMoreCatalog(): Promise<void> {
    if (this.catalogLoadingMore || !this.isOnline) return;
    this.catalogLoadingMore = true;
    this.catalogPage += 1;
    const more = await fetchRegionalViralFeed(this.algoConfig, 12, this.catalogPage);
    this.catalogTrending = this.mergeUniqueTracks(this.catalogTrending, more);
    this.catalogLoadingMore = false;
    if (more.length === 0) this.showToast('Belum ada katalog tambahan.');
  }

  async selectSpotifyChart(title: string): Promise<void> {
    this.activeSpotifyChartTitle = title;
    if (this.spotifyChartCache[title]?.length > 0) {
      // Instant 0ms switch from cache (zero re-loading!)
      return;
    }
    if (!this.isOnline) {
      this.showToast('Mode Offline: tidak dapat memuat Chart Spotify.');
      return;
    }
    this.loadingSpotifyChart = true;
    this.spotifyChartPages[title] = 0;
    const tracks = await fetchSpotifyChartTracks(title, 0);
    if (tracks.length > 0) {
      this.spotifyChartCache = { ...this.spotifyChartCache, [title]: tracks };
    }
    this.loadingSpotifyChart = false;
  }

  async loadMoreSpotifyChart(): Promise<void> {
    const title = this.activeSpotifyChartTitle;
    if (this.spotifyChartLoadingMore || !this.isOnline || !title) return;
    this.spotifyChartLoadingMore = true;
    const nextPage = (this.spotifyChartPages[title] || 0) + 1;
    this.spotifyChartPages[title] = nextPage;
    const more = await fetchSpotifyChartTracks(title, nextPage);
    const existing = this.spotifyChartCache[title] || [];
    this.spotifyChartCache = {
      ...this.spotifyChartCache,
      [title]: this.mergeUniqueTracks(existing, more)
    };
    this.spotifyChartLoadingMore = false;
    if (more.length === 0) this.showToast('Semua lagu chart ini sudah dimuat.');
  }

  async bootstrap(): Promise<void> {
    i18n.init();
    this.initTheme();
    this.initConnectivity();
    engine.init(this.showToast);

    this.likedIds = loadJSON<string[]>('nys_liked_ids', []);
    this.recentSearches = loadJSON<string[]>('nys_recent_searches', []);
    const savedAlgo = loadJSON<Partial<AlgorithmConfig> | null>('nys_algo_config', null);
    if (savedAlgo) this.algoConfig = { ...DEFAULT_ALGORITHM_CONFIG, ...savedAlgo };
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

    // Stale-while-revalidate: hydrate last cached feeds in 0ms for instant startup
    const cachedYt = loadJSON<Track[]>('nys_cache_yt', []);
    const cachedAudius = loadJSON<Track[]>('nys_cache_audius', []);
    const cachedCatalog = loadJSON<Track[]>('nys_cache_catalog', []);
    if (cachedYt.length > 0) this.ytTracks = cachedYt;
    if (cachedAudius.length > 0) this.trendingTracks = cachedAudius;
    if (cachedCatalog.length > 0) this.catalogTrending = cachedCatalog;
    if (cachedYt.length > 0 || cachedAudius.length > 0 || cachedCatalog.length > 0) {
      this.networkReachable = true;
    }

    // Fire progressive non-blocking online refresh in background
    void this.refreshOnlineFeeds(false);

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

  private recordRecentSearch(query: string): void {
    const clean = query.trim();
    if (clean.length < 2) return;
    const filtered = this.recentSearches.filter((q) => q.toLowerCase() !== clean.toLowerCase());
    this.recentSearches = [clean, ...filtered].slice(0, 8);
    saveJSON('nys_recent_searches', this.recentSearches);
  }

  removeRecentSearch(query: string): void {
    this.recentSearches = this.recentSearches.filter((q) => q !== query);
    saveJSON('nys_recent_searches', this.recentSearches);
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
    saveJSON('nys_recent_searches', []);
  }

  private buildInstantSuggestions(rawQuery: string): SearchSuggestion[] {
    const qLow = rawQuery.trim().toLowerCase();
    if (!qLow) return [];
    const out: SearchSuggestion[] = [];

    // 1. Matching recent searches
    for (const recent of this.recentSearches) {
      if (recent.toLowerCase().includes(qLow) && out.length < 2) {
        out.push({
          id: `recent_${recent}`,
          query: recent,
          title: recent,
          subtitle: 'Riwayat Pencarian',
          kind: 'recent'
        });
      }
    }

    // 2. Matching eras (e.g. typing 1980, 1990, 2000, 2025, klasik)
    for (const era of ERA_PRESETS) {
      const yearNum = Number(qLow);
      const matchesYear = Number.isInteger(yearNum) && yearNum >= era.minYear && yearNum <= era.maxYear;
      if (
        matchesYear ||
        era.label.toLowerCase().includes(qLow) ||
        era.sub.toLowerCase().includes(qLow)
      ) {
        out.push({
          id: `era_${era.id}`,
          query: era.query,
          title: `Jelajahi ${era.label}`,
          subtitle: era.sub,
          kind: 'era'
        });
        break;
      }
    }

    // 3. Matching local offline tracks (0ms latency)
    for (const t of this.localTracks) {
      if (
        (t.title?.toLowerCase().includes(qLow) || t.artist?.toLowerCase().includes(qLow)) &&
        out.length < 5
      ) {
        out.push({
          id: `local_${t.id}`,
          query: `${t.title} ${t.artist}`,
          title: t.title,
          subtitle: `${t.artist} • Koleksi Offline`,
          year: t.releaseYear,
          kind: 'local',
          track: t
        });
      }
    }
    return out;
  }

  toggleFullOnly(): void {
    this.fullOnlyFilter = !this.fullOnlyFilter;
  }

  async findFullVersion(track: Track): Promise<void> {
    if (!this.isOnline) {
      this.showToast('Mode Offline: tidak dapat mencari versi penuh.');
      return;
    }
    const query = `${track.title} ${track.artist}`.trim();
    this.showToast(`Mencari versi penuh "${track.title}"...`);
    const [yt, audius, archive] = await Promise.all([
      fetchYtSearch(query),
      fetchSearch(query, 8),
      fetchArchiveAudioSearch(query, 5)
    ]);
    const fullCandidates = [...yt, ...audius, ...archive];
    if (fullCandidates.length > 0) {
      const best = fullCandidates[0];
      engine.playTrack(best, [...fullCandidates, ...this.allTracks]);
      this.openTrackModal(best, false);
      this.showToast(`Memutar versi penuh: ${best.title}`);
      return;
    }
    // Fallback: open Search view filtered to full-length results
    this.closeTrackModal();
    this.fullOnlyFilter = true;
    this.updateSearch(query, true);
    this.showToast('Menampilkan hasil pencarian lagu durasi penuh (YouTube FOSS / Audius / Archive).');
  }

  setEraFilter(eraId: string): void {
    this.eraFilter = eraId;
  }

  exploreEra(eraId: string): void {
    const era = ERA_PRESETS.find((e) => e.id === eraId);
    if (!era) return;
    this.eraFilter = era.id;
    this.showSuggestions = false;
    this.updateSearch(era.query, true);
  }

  applySuggestion(suggestion: SearchSuggestion): void {
    this.showSuggestions = false;
    if (suggestion.kind === 'era') {
      const eraId = suggestion.id.replace('era_', '');
      this.exploreEra(eraId);
      return;
    }
    if (suggestion.track && suggestion.kind === 'local') {
      engine.playTrack(suggestion.track, this.allTracks);
    }
    this.updateSearch(suggestion.query, true);
  }

  updateSearch(query: string, immediate = false): void {
    this.searchQuery = query;
    if (this.view !== 'search') this.view = 'search';
    if (this.searchDebounceId) clearTimeout(this.searchDebounceId);
    if (this.suggestDebounceId) clearTimeout(this.suggestDebounceId);
    if (this.searchAbort) this.searchAbort.abort();
    if (this.suggestAbort) this.suggestAbort.abort();

    const trimmed = query.trim();
    if (!trimmed) {
      this.searchResults = [];
      this.searchSuggestions = [];
      this.showSuggestions = false;
      this.searching = false;
      this.suggesting = false;
      this.eraFilter = 'all';
      return;
    }

    // Instant 0ms local + recent + era suggestions
    const instant = this.buildInstantSuggestions(trimmed);
    this.searchSuggestions = instant;
    this.showSuggestions = !immediate;

    // Fast 180ms live public autocomplete suggestions
    if (!immediate && this.isOnline && trimmed.length >= 2) {
      this.suggesting = true;
      const suggestController = new AbortController();
      this.suggestAbort = suggestController;
      this.suggestDebounceId = setTimeout(async () => {
        const pub = await fetchSmartSuggestions(trimmed, suggestController.signal, this.activeRegionOption.storeCode);
        if (suggestController.signal.aborted) return;
        const merged = [...instant];
        for (const item of pub) {
          if (merged.length >= 8) break;
          if (!merged.some((m) => m.title.toLowerCase() === item.title.toLowerCase())) {
            merged.push(item);
          }
        }
        this.searchSuggestions = merged;
        this.suggesting = false;
      }, 180);
    } else {
      this.suggesting = false;
    }

    // Progressive non-blocking staged search: each source streams in immediately as it finishes!
    this.searchVisibleCount = 12;
    this.searchArchiveLoaded = false;
    const qLow = trimmed.toLowerCase();
    const localMatch = this.localTracks.filter(
      (t) =>
        t.title?.toLowerCase().includes(qLow) ||
        t.artist?.toLowerCase().includes(qLow) ||
        t.album?.toLowerCase().includes(qLow)
    );
    this.searchResults = localMatch;

    if (!this.isOnline) {
      this.searching = false;
      return;
    }

    this.searching = true;
    const searchController = new AbortController();
    this.searchAbort = searchController;
    const delay = immediate ? 0 : 240;

    this.searchDebounceId = setTimeout(async () => {
      let ytList: Track[] = [];
      let audiusList: Track[] = [];
      let catalogList: Track[] = [];

      const publish = (): void => {
        if (searchController.signal.aborted) return;
        this.searchResults = this.mergeUniqueTracks(
          [...localMatch, ...ytList, ...audiusList],
          catalogList
        );
      };

      const ytTask = fetchYtSearch(trimmed).then((res) => {
        ytList = res;
        publish();
        if (res.length > 0) this.searching = false;
      });

      const audiusTask = fetchSearch(trimmed, 18).then((res) => {
        audiusList = res;
        publish();
        if (res.length > 0) this.searching = false;
      });

      const catalogTask = fetchPublicCatalogSearch(
        trimmed,
        20,
        searchController.signal,
        this.activeRegionOption.storeCode
      ).then((res) => {
        catalogList = res;
        publish();
      });

      await Promise.all([ytTask, audiusTask, catalogTask]);
      if (searchController.signal.aborted) return;
      this.searching = false;
      this.recordRecentSearch(trimmed);
    }, delay);
  }

  setSearchSourceFilter(source: 'all' | 'youtube' | 'audius' | 'local'): void {
    this.showSuggestions = false;
    this.searchSourceFilter = source;
    this.searchVisibleCount = 12;
  }

  setSearchSort(sort: 'relevant' | 'newest' | 'longest'): void {
    this.showSuggestions = false;
    this.searchSort = sort;
  }

  async loadMoreSearch(): Promise<void> {
    if (this.searchLoadingMore) return;
    if (this.filteredSearchResults.length > this.searchVisibleCount) {
      this.searchVisibleCount += 12;
      return;
    }
    const trimmed = this.searchQuery.trim();
    if (!this.isOnline || !trimmed || this.searchArchiveLoaded) return;
    this.searchLoadingMore = true;
    this.searchArchiveLoaded = true;
    const [archive, extraYt] = await Promise.all([
      fetchArchiveAudioSearch(trimmed, 8),
      fetchYtSearch(`${trimmed} official audio`)
    ]);
    this.searchResults = this.mergeUniqueTracks(this.searchResults, [...extraYt, ...archive]);
    this.searchVisibleCount += 12;
    this.searchLoadingMore = false;
    if (archive.length === 0 && extraYt.length === 0) {
      this.showToast('Semua hasil pencarian untuk kueri ini sudah ditampilkan.');
    }
  }

  updateAlgorithmConfig(partial: Partial<AlgorithmConfig>, refreshFeed = true): void {
    this.algoConfig = { ...this.algoConfig, ...partial };
    saveJSON('nys_algo_config', this.algoConfig);
    if (refreshFeed && this.isOnline) {
      void this.refreshOnlineFeeds();
    }
  }

  toggleAlgorithmGenre(genre: string): void {
    const exists = this.algoConfig.preferredGenres.includes(genre);
    const next = exists
      ? this.algoConfig.preferredGenres.filter((g) => g !== genre)
      : [...this.algoConfig.preferredGenres, genre].slice(0, 4);
    this.updateAlgorithmConfig({ preferredGenres: next }, true);
  }

  resetAlgorithmConfig(): void {
    this.algoConfig = { ...DEFAULT_ALGORITHM_CONFIG };
    saveJSON('nys_algo_config', this.algoConfig);
    this.showToast('Algoritma musik direset ke pengaturan awal.');
    if (this.isOnline) {
      void this.refreshOnlineFeeds();
    }
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
