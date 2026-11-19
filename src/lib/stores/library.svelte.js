// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Centralized Svelte 5 Runes application store for Xmusic.
 * Coordinates library tracks, playlists, favorites, search, profile, modals, and toasts.
 */
import { engine } from '#lib/audio/engine.svelte.js';
import {
  fetchSearch,
  fetchSyncedLyrics,
  fetchTrending,
  fetchYtSearch,
  fetchYtTrending,
  getApiConfig,
  saveApiConfig
} from '#lib/api/services.js';
import { generateDemoSynthBlob } from '#lib/data/presets.js';
import {
  deleteLocalTrack,
  getAllLocalTracks,
  loadJSON,
  openDB,
  parseFilenameMeta,
  probeAudioDuration,
  saveJSON,
  saveLocalTrack
} from '#lib/db/storage.js';

class AppStore {
  // Theme mode ('system' | 'light' | 'dark')
  themeMode = $state('system');
  systemPrefersDark = $state(true);
  themeMediaQuery = null;
  themeMediaHandler = null;

  // Navigation & filtering
  view = $state('home'); // 'home' | 'search' | 'library' | 'eq' | 'profile'
  libFilter = $state('local');
  searchQuery = $state('');
  searching = $state(false);
  loadingHome = $state(true);

  // Collections
  localTracks = $state([]);
  trendingTracks = $state([]);
  ytTracks = $state([]);
  searchResults = $state([]);
  likedIds = $state([]);
  playlists = $state([]);

  // Runtime & profile
  runtimeInfo = $state({
    app_name: 'nys Xmusic',
    version: '4.0.0',
    engine: 'Tauri v2.12 + SvelteKit 3.2 + Konsta UI iOS',
    platform: 'web',
    arch: 'wasm'
  });

  userProfile = $state({
    name: 'Nys',
    handle: '@nysxmusic',
    bio: 'Bikin playlist buat jalan pulang.',
    image: null
  });

  apiConfig = $state(getApiConfig());

  // Overlay & modal visibility
  npDrawerOpen = $state(false);
  npTab = $state('queue');
  trackModalOpen = $state(false);
  modalTrack = $state(null);
  modalFlipped = $state(false);
  flippedGridIds = $state(new Set());
  fetchingLyrics = $state(false);

  uploadModalOpen = $state(false);
  hubModalOpen = $state(false);
  dlModalOpen = $state(false);
  dlPrefillUrl = $state('');
  editProfileOpen = $state(false);
  editTrackOpen = $state(false);
  editingTrack = $state(null);
  playlistModalOpen = $state(false);
  targetTrackForPlaylist = $state(null);
  dynamicBarDismissed = $state(false);

  // Accessible live-region toast
  toastMsg = $state('');
  toastTimer = null;
  searchDebounceId = null;

  get isDark() {
    if (this.themeMode === 'dark') return true;
    if (this.themeMode === 'light') return false;
    return this.systemPrefersDark;
  }

  initTheme() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('nys_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.themeMode = saved;
    }
    this.themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark = this.themeMediaQuery.matches;
    this.themeMediaHandler = (event) => {
      this.systemPrefersDark = event.matches;
      this.syncDocumentTheme();
    };
    this.themeMediaQuery.addEventListener('change', this.themeMediaHandler);
    this.syncDocumentTheme();
  }

  destroyTheme() {
    if (this.themeMediaQuery && this.themeMediaHandler) {
      this.themeMediaQuery.removeEventListener('change', this.themeMediaHandler);
    }
  }

  syncDocumentTheme() {
    if (typeof document === 'undefined') return;
    const dark = this.isDark;
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  }

  setThemeMode(mode) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    this.themeMode = mode;
    try {
      localStorage.setItem('nys_theme_mode', mode);
    } catch {}
    this.syncDocumentTheme();
    const labels = {
      light: 'Mode Terang diaktifkan',
      dark: 'Mode Gelap diaktifkan',
      system: 'Tema mengikuti sistem perangkat'
    };
    this.showToast(labels[mode]);
  }

  toggleTheme() {
    this.setThemeMode(this.isDark ? 'light' : 'dark');
  }

  get allTracks() {
    const map = new Map();
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

  get filteredLibrary() {
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

  get activeModalTrack() {
    if (!this.modalTrack) return null;
    return engine.current?.id === this.modalTrack.id ? engine.current : this.modalTrack;
  }

  showToast = (message) => {
    this.toastMsg = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMsg = '';
    }, 2800);
  };

  isLiked(id) {
    return this.likedIds.includes(id);
  }

  toggleLike(track) {
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

  async refreshLocalTracks() {
    this.localTracks = await getAllLocalTracks();
    if (engine.queue.length === 0 && this.localTracks.length > 0) {
      engine.queue = [...this.localTracks, ...this.trendingTracks];
    }
  }

  async bootstrap() {
    this.initTheme();
    engine.init(this.showToast);
    this.likedIds = loadJSON('nys_liked_ids', []);
    this.playlists = loadJSON('nys_playlists', [
      { id: 'pl_default_chill', name: 'Jalan Pulang', trackIds: [], createdAt: Date.now() }
    ]);
    engine.history = loadJSON('nys_history', []);

    const savedProfile = loadJSON('nys_profile', null);
    if (savedProfile) this.userProfile = savedProfile;

    if (window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke('get_runtime_info');
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

    const [trending, yt] = await Promise.all([fetchTrending(32), fetchYtTrending('ID')]);
    this.trendingTracks = trending;
    this.ytTracks = yt;
    this.loadingHome = false;

    if (engine.queue.length === 0) {
      engine.queue = [...this.localTracks, ...trending];
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  async autoFetchLyricsForTrack(track) {
    if (!track || this.fetchingLyrics) return;
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

  async createBuiltInSynthDemo() {
    this.showToast('Menyintesis lagu demo stereo 44.1kHz...');
    try {
      const wavBlob = await generateDemoSynthBlob(24);
      const demoTrack = {
        id: 'local_demo_synthwave',
        title: 'Midnight Drive (Built-in Synth)',
        artist: 'nys Xmusic Studio',
        album: 'Offline Synth Engine',
        blob: wavBlob,
        dur: 24,
        c1: '#0284c7',
        c2: '#1e1b4b',
        imageUrl: null,
        source: 'local',
        createdAt: Date.now(),
        lyrics: [
          '[00:00.00] nys Xmusic Built-in Procedural Synthwave',
          '[00:04.00] Ketuk dua kali kartu untuk membalik dan melihat lirik sinkron',
          '[00:08.50] Buka Studio Equalizer untuk mengatur 5-Band Web Audio EQ',
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
      this.showToast(`Gagal membuat lagu demo: ${err.message}`);
    }
  }

  openTrackModal(track, startFlipped = false) {
    this.modalTrack = track;
    this.modalFlipped = startFlipped;
    this.trackModalOpen = true;
    this.dynamicBarDismissed = false;
    if (startFlipped && !track.lyrics) {
      this.autoFetchLyricsForTrack(track);
    }
  }

  closeTrackModal() {
    this.trackModalOpen = false;
    this.modalFlipped = false;
  }

  toggleModalFlip() {
    this.modalFlipped = !this.modalFlipped;
    const active = this.activeModalTrack;
    if (this.modalFlipped && active && !active.lyrics) {
      this.autoFetchLyricsForTrack(active);
    }
  }

  toggleGridFlip(track) {
    const next = new Set(this.flippedGridIds);
    if (next.has(track.id)) {
      next.delete(track.id);
    } else {
      next.add(track.id);
      if (!track.lyrics) this.autoFetchLyricsForTrack(track);
    }
    this.flippedGridIds = next;
  }

  async importLocalFiles(files, coverFile = null) {
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
      const newTrack = {
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

  async importStreamUrl({ url, title, artist }) {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) {
      this.showToast('Masukkan URL audio terlebih dahulu.');
      return false;
    }
    const dur = await probeAudioDuration(cleanUrl);
    await saveLocalTrack({
      id: `local_${Date.now()}`,
      title: String(title || '').trim() || 'Audio Stream URL',
      artist: String(artist || '').trim() || 'External Stream',
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

  async removeTrack(track) {
    await deleteLocalTrack(track.id);
    await this.refreshLocalTracks();
    this.showToast(`"${track.title}" dihapus dari penyimpanan.`);
  }

  openEditTrack(track) {
    this.editingTrack = track;
    this.editTrackOpen = true;
  }

  async saveEditedTrack({ title, artist, album, lyrics }) {
    if (!this.editingTrack) return;
    const updated = {
      ...this.editingTrack,
      title: title.trim() || this.editingTrack.title,
      artist: artist.trim() || this.editingTrack.artist,
      album: album.trim() || this.editingTrack.album,
      lyrics
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

  createPlaylist(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      this.showToast('Masukkan nama playlist.');
      return false;
    }
    const playlist = {
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

  toggleTrackInPlaylist(playlistId, track) {
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

  updateSearch(query) {
    this.searchQuery = query;
    if (this.view !== 'search') this.view = 'search';
    clearTimeout(this.searchDebounceId);

    if (!query.trim()) {
      this.searchResults = [];
      this.searching = false;
      return;
    }

    this.searching = true;
    this.searchDebounceId = setTimeout(async () => {
      const [audius, youtube] = await Promise.all([fetchSearch(query), fetchYtSearch(query)]);
      const qLow = query.toLowerCase();
      const localMatch = this.localTracks.filter(
        (t) =>
          t.title?.toLowerCase().includes(qLow) ||
          t.artist?.toLowerCase().includes(qLow) ||
          t.album?.toLowerCase().includes(qLow)
      );
      this.searchResults = [...localMatch, ...youtube, ...audius];
      this.searching = false;
    }, 340);
  }

  saveProfileSettings(profile, nextApiConfig) {
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

  openDownloaderWithUrl(url = '') {
    this.dlPrefillUrl = url;
    this.dlModalOpen = true;
  }

  closeTopOverlay() {
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
