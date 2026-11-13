<script>
  import { onMount } from 'svelte';
  import { engine } from '#lib/audio/engine.svelte.js';
  import {
    EQ_BANDS,
    EQ_PRESETS,
    CATEGORIES,
    SPOTIFY_CHARTS,
    SPEED_OPTIONS,
    SLEEP_OPTIONS,
    generateDemoSynthBlob
  } from '#lib/data/presets.js';
  import {
    openDB,
    saveLocalTrack,
    getAllLocalTracks,
    deleteLocalTrack,
    probeAudioDuration,
    parseFilenameMeta,
    loadJSON,
    saveJSON
  } from '#lib/db/storage.js';
  import {
    getApiConfig,
    saveApiConfig,
    fetchTrending,
    fetchSearch,
    fetchYtTrending,
    fetchYtSearch,
    extractYouTubeId,
    extractSpotifyEmbed,
    fetchOEmbedMeta,
    fetchSpotifyMetadata,
    fetchSyncedLyrics,
    parseLrcLyrics,
    rapidDownloadMp3
  } from '#lib/api/services.js';

  // Svelte 5 Runes State
  let view = $state('home');
  let libFilter = $state('local');
  let searchQuery = $state('');
  let searching = $state(false);
  let loadingHome = $state(true);

  let localTracks = $state([]);
  let trendingTracks = $state([]);
  let ytTracks = $state([]);
  let searchResults = $state([]);
  let likedIds = $state([]);
  let playlists = $state([]);
  let runtimeInfo = $state({
    app_name: 'nys Xmusic',
    version: '2.0.0',
    engine: 'Tauri v2.12 + SvelteKit 3.2 (Svelte 5 Runes)'
  });

  // Drawer, Flip Card & Modals
  let npDrawerOpen = $state(false);
  let npTab = $state('queue');
  let trackModalOpen = $state(false);
  let modalTrack = $state(null);
  let modalFlipped = $state(false);
  let flippedGridIds = $state(new Set());
  let fetchingLyrics = $state(false);
  let lyricsScrollEl = $state(null);

  let uploadModalOpen = $state(false);
  let uploadTab = $state('file');
  let hubModalOpen = $state(false);
  let dlModalOpen = $state(false);
  let editProfileOpen = $state(false);
  let editTrackOpen = $state(false);
  let playlistModalOpen = $state(false);
  let dynamicBarDismissed = $state(false);

  // Toast
  let toastMsg = $state('');
  let toastTimer = null;

  // Upload Form
  let urlInput = $state('');
  let urlTitle = $state('');
  let urlArtist = $state('');
  let pendingCoverFile = $state(null);
  let coverFileName = $state('Belum ada gambar sampul');

  // Hub Form (Spotify API + YouTube)
  let hubUrlInput = $state('');
  let hubEmbedType = $state(null);
  let hubVideoId = $state('');
  let hubSpotify = $state(null);
  let hubMeta = $state(null);
  let hubDetecting = $state(false);
  let hubMessage = $state('');
  let hubSaving = $state(false);

  // Downloader Form
  let dlUrlInput = $state('');
  let dlLoading = $state(false);
  let dlResult = $state(null);

  // Edit Track / Lyrics Form
  let editingTrack = $state(null);
  let editTitle = $state('');
  let editArtist = $state('');
  let editAlbum = $state('');
  let editLyrics = $state('');

  // Playlist Form
  let newPlaylistName = $state('');
  let targetTrackForPlaylist = $state(null);

  // User Profile & API Config
  let userProfile = $state({
    name: 'Nys',
    handle: '@nysxmusic',
    bio: 'Bikin playlist buat jalan pulang.',
    image: null
  });
  let emName = $state('');
  let emHandle = $state('');
  let emBio = $state('');
  let emImagePreview = $state(null);

  let apiConfig = $state(getApiConfig());

  // Visualizer Canvas Ref
  let vizCanvas = $state(null);
  let vizRaf = null;

  // Double-Tap Detection Map untuk layar sentuh Android
  let lastTapMap = new Map();

  let allTracks = $derived.by(() => {
    const map = new Map();
    for (const t of [...localTracks, ...searchResults, ...ytTracks, ...trendingTracks]) {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    }
    return [...map.values()];
  });

  let filteredLibrary = $derived.by(() => {
    if (libFilter === 'local') return localTracks;
    if (libFilter === 'liked') return allTracks.filter((t) => likedIds.includes(t.id));
    if (libFilter === 'history') return engine.history;
    const pl = playlists.find((p) => p.id === libFilter);
    if (pl) return allTracks.filter((t) => pl.trackIds.includes(t.id));
    return localTracks;
  });

  // Lirik sinkron untuk lagu yang tampil di Track Modal
  let activeModalTrack = $derived(
    modalTrack && engine.current?.id === modalTrack.id ? engine.current : modalTrack
  );

  let parsedModalLyrics = $derived.by(() => parseLrcLyrics(activeModalTrack?.lyrics || ''));

  let activeLyricIndex = $derived.by(() => {
    const lines = parsedModalLyrics;
    if (!lines.length || !lines[0]?.synced) return -1;
    const pos = engine.current?.id === activeModalTrack?.id ? engine.position : 0;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= pos + 0.15) idx = i;
      else break;
    }
    return idx;
  });

  // Auto-scroll lirik sinkron mengikuti irama lagu saat kartu dibalik
  $effect(() => {
    if (modalFlipped && activeLyricIndex >= 0 && lyricsScrollEl) {
      const targetEl = lyricsScrollEl.querySelector(`[data-lrc-idx="${activeLyricIndex}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  function showToast(msg) {
    toastMsg = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastMsg = '';
    }, 2600);
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 19) return 'Selamat sore';
    return 'Selamat malam';
  }

  function isLiked(id) {
    return likedIds.includes(id);
  }

  function toggleLike(track, e) {
    if (e) e.stopPropagation();
    if (!track) return;
    if (likedIds.includes(track.id)) {
      likedIds = likedIds.filter((x) => x !== track.id);
      showToast('Dihapus dari Favorit');
    } else {
      likedIds = [track.id, ...likedIds];
      showToast('Ditambahkan ke Favorit ❤️');
    }
    saveJSON('nys_liked_ids', likedIds);
  }

  async function refreshLocalTracks() {
    localTracks = await getAllLocalTracks();
    if (engine.queue.length === 0 && localTracks.length > 0) {
      engine.queue = [...localTracks, ...trendingTracks];
    }
  }

  async function autoFetchLyricsForTrack(track) {
    if (!track || fetchingLyrics) return;
    fetchingLyrics = true;
    const lrc = await fetchSyncedLyrics(track.title, track.artist, track.dur);
    fetchingLyrics = false;
    if (lrc) {
      track.lyrics = lrc;
      if (track.source === 'local') {
        await saveLocalTrack(track);
        await refreshLocalTracks();
      }
      if (engine.current?.id === track.id) {
        engine.current = { ...track };
      }
      if (modalTrack?.id === track.id) {
        modalTrack = { ...track };
      }
      showToast('Lirik tersinkronisasi ditemukan!');
    } else {
      showToast('Lirik belum ditemukan otomatis. Kamu bisa menempelkannya manual.');
    }
  }

  async function createBuiltInSynthDemo() {
    showToast('Menyintesis lagu demo stereo 44.1kHz...');
    try {
      const wavBlob = await generateDemoSynthBlob(24);
      const demoTrack = {
        id: 'local_demo_synthwave',
        title: 'Midnight Drive (Built-in Synth)',
        artist: 'nys Xmusic Studio',
        album: 'Offline Synth Engine',
        blob: wavBlob,
        dur: 24,
        c1: '#38bdf8',
        c2: '#4f46e5',
        imageUrl: null,
        source: 'local',
        createdAt: Date.now(),
        lyrics:
          '[00:00.00] 🎵 nys Xmusic Built-in Procedural Synthwave\n[00:04.00] Ketuk dua kali kartu untuk membalik & melihat lirik sinkron\n[00:08.50] Buka Studio Equalizer untuk mengatur 5-Band Web Audio EQ\n[00:13.00] Lirik berjalan otomatis mengikuti irama dan detik lagu\n[00:18.00] Ketuk baris lirik mana saja untuk melompat ke detik tersebut\n[00:21.50] Siap digunakan kapan saja 100% offline!'
      };
      await saveLocalTrack(demoTrack);
      await refreshLocalTracks();
      const hydrated = localTracks.find((x) => x.id === demoTrack.id);
      if (hydrated) {
        engine.playTrack(hydrated, [...localTracks, ...trendingTracks]);
        openTrackModal(hydrated);
      }
      showToast('Lagu demo siap diputar! Ketuk 2x kartu untuk melihat lirik.');
    } catch (e) {
      showToast('Gagal membuat lagu demo: ' + e.message);
    }
  }

  function openTrackModal(track, startFlipped = false) {
    modalTrack = track;
    modalFlipped = startFlipped;
    trackModalOpen = true;
    startVizLoop();
    if (startFlipped && !track.lyrics) {
      autoFetchLyricsForTrack(track);
    }
  }

  function closeTrackModal() {
    trackModalOpen = false;
    modalFlipped = false;
    cancelAnimationFrame(vizRaf);
  }

  function toggleModalFlip() {
    modalFlipped = !modalFlipped;
    if (modalFlipped && activeModalTrack && !activeModalTrack.lyrics) {
      autoFetchLyricsForTrack(activeModalTrack);
    }
  }

  function handleModalDoubleTap(e) {
    if (e.target.closest('button, input, textarea, .progress, .lyric-line')) return;
    toggleModalFlip();
  }

  function toggleGridFlip(track, e) {
    if (e) e.stopPropagation();
    const next = new Set(flippedGridIds);
    if (next.has(track.id)) {
      next.delete(track.id);
    } else {
      next.add(track.id);
      if (!track.lyrics) autoFetchLyricsForTrack(track);
    }
    flippedGridIds = next;
  }

  function handleCardInteraction(track) {
    const now = Date.now();
    const last = lastTapMap.get(track.id) || 0;
    lastTapMap.set(track.id, now);
    if (now - last < 320) {
      // Double-tap / double-click: balik kartu grid & putar lagu!
      lastTapMap.set(track.id, 0);
      if (engine.current?.id !== track.id) {
        engine.playTrack(track, allTracks);
      }
      toggleGridFlip(track);
      return;
    }
    const isPlayingThis = engine.current?.id === track.id && engine.playing;
    if (!isPlayingThis) {
      engine.playTrack(track, [...localTracks, ...trendingTracks, ...searchResults]);
    }
    openTrackModal(track, false);
  }

  function startVizLoop() {
    cancelAnimationFrame(vizRaf);
    const renderFrame = (now) => {
      if (!trackModalOpen) return;
      if (vizCanvas) {
        const ctx = vizCanvas.getContext('2d');
        const w = vizCanvas.clientWidth || 320;
        const h = vizCanvas.clientHeight || 480;
        if (vizCanvas.width !== w || vizCanvas.height !== h) {
          vizCanvas.width = w;
          vizCanvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);
        const bars = engine.getSpectrum(28, now);
        const bw = w / bars.length;
        for (let i = 0; i < bars.length; i++) {
          const val = bars[i];
          const bh = Math.max(4, val * (h * 0.28));
          ctx.fillStyle = `rgba(185, 203, 255, ${0.12 + val * 0.38})`;
          ctx.fillRect(i * bw + 2, h - bh, Math.max(2, bw - 4), bh);
        }
      }
      vizRaf = requestAnimationFrame(renderFrame);
    };
    vizRaf = requestAnimationFrame(renderFrame);
  }

  async function handleFileUpload(files) {
    const audioFiles = [...files].filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i.test(f.name)
    );
    if (!audioFiles.length) {
      showToast('Pilih file audio yang valid (MP3/M4A/WAV/OGG/FLAC)');
      return;
    }
    showToast(`Memproses ${audioFiles.length} file audio...`);
    for (const file of audioFiles) {
      const meta = parseFilenameMeta(file.name);
      const dur = await probeAudioDuration(file);
      const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newTrack = {
        id,
        title: meta.title,
        artist: meta.artist,
        album: 'Koleksi Offline',
        blob: file,
        coverBlob: pendingCoverFile || null,
        dur,
        c1: '#6366f1',
        c2: '#1e1b4b',
        imageUrl: null,
        source: 'local',
        createdAt: Date.now(),
        lyrics: ''
      };
      await saveLocalTrack(newTrack);
    }
    await refreshLocalTracks();
    uploadModalOpen = false;
    pendingCoverFile = null;
    coverFileName = 'Belum ada gambar sampul';
    view = 'library';
    libFilter = 'local';
    showToast(`${audioFiles.length} lagu berhasil disimpan untuk offline!`);
  }

  async function handleUrlUpload() {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return showToast('Masukkan URL audio terlebih dahulu');
    const dur = await probeAudioDuration(cleanUrl);
    await saveLocalTrack({
      id: 'local_' + Date.now(),
      title: urlTitle.trim() || 'Audio Stream URL',
      artist: urlArtist.trim() || 'External Stream',
      album: 'URL Import',
      url: cleanUrl,
      dur,
      c1: '#10b981',
      c2: '#064e3b',
      imageUrl: null,
      source: 'local',
      createdAt: Date.now(),
      lyrics: ''
    });
    await refreshLocalTracks();
    urlInput = '';
    urlTitle = '';
    urlArtist = '';
    uploadModalOpen = false;
    view = 'library';
    showToast('Tautan lagu berhasil ditambahkan ke Perpustakaan!');
  }

  async function removeTrack(track, e) {
    if (e) e.stopPropagation();
    await deleteLocalTrack(track.id);
    await refreshLocalTracks();
    showToast(`"${track.title}" dihapus dari penyimpanan.`);
  }

  function openEditTrackModal(track, e) {
    if (e) e.stopPropagation();
    editingTrack = track;
    editTitle = track.title || '';
    editArtist = track.artist || '';
    editAlbum = track.album || '';
    editLyrics = track.lyrics || '';
    editTrackOpen = true;
  }

  async function saveEditedTrack() {
    if (!editingTrack) return;
    editingTrack.title = editTitle.trim() || editingTrack.title;
    editingTrack.artist = editArtist.trim() || editingTrack.artist;
    editingTrack.album = editAlbum.trim() || editingTrack.album;
    editingTrack.lyrics = editLyrics;
    if (editingTrack.source === 'local') {
      await saveLocalTrack(editingTrack);
      await refreshLocalTracks();
    }
    if (engine.current?.id === editingTrack.id) {
      engine.current = { ...editingTrack };
    }
    if (modalTrack?.id === editingTrack.id) {
      modalTrack = { ...editingTrack };
    }
    editTrackOpen = false;
    showToast('Metadata & lirik lagu diperbarui!');
  }

  function createPlaylist() {
    const name = newPlaylistName.trim();
    if (!name) return showToast('Masukkan nama playlist');
    const pl = {
      id: 'pl_' + Date.now(),
      name,
      trackIds: targetTrackForPlaylist ? [targetTrackForPlaylist.id] : [],
      createdAt: Date.now()
    };
    playlists = [pl, ...playlists];
    saveJSON('nys_playlists', playlists);
    newPlaylistName = '';
    targetTrackForPlaylist = null;
    playlistModalOpen = false;
    showToast(`Playlist "${name}" dibuat!`);
  }

  function toggleTrackInPlaylist(pl, track) {
    if (!track) return;
    if (pl.trackIds.includes(track.id)) {
      pl.trackIds = pl.trackIds.filter((id) => id !== track.id);
      showToast(`Dihapus dari "${pl.name}"`);
    } else {
      pl.trackIds = [...pl.trackIds, track.id];
      showToast(`Ditambahkan ke "${pl.name}"`);
    }
    playlists = [...playlists];
    saveJSON('nys_playlists', playlists);
  }

  let searchTimeout = null;
  function onSearchInput(q) {
    searchQuery = q;
    if (view !== 'search') view = 'search';
    clearTimeout(searchTimeout);
    if (!q.trim()) {
      searchResults = [];
      searching = false;
      return;
    }
    searching = true;
    searchTimeout = setTimeout(async () => {
      const [aud, yt] = await Promise.all([fetchSearch(q), fetchYtSearch(q)]);
      const qLow = q.toLowerCase();
      const localMatch = localTracks.filter(
        (t) =>
          t.title?.toLowerCase().includes(qLow) ||
          t.artist?.toLowerCase().includes(qLow) ||
          t.album?.toLowerCase().includes(qLow)
      );
      searchResults = [...localMatch, ...yt, ...aud];
      searching = false;
    }, 360);
  }

  function runCategorySearch(q) {
    view = 'search';
    onSearchInput(q);
  }

  async function processHubLink() {
    const url = hubUrlInput.trim();
    if (!url) return showToast('Masukkan tautan Spotify atau YouTube');
    hubEmbedType = null;
    hubVideoId = '';
    hubSpotify = null;
    hubMeta = null;
    hubMessage = '';

    const sp = extractSpotifyEmbed(url);
    if (sp) {
      hubSpotify = sp;
      hubEmbedType = 'spotify';
      hubDetecting = true;
      hubMessage = 'Mendeteksi gambar sampul, judul lagu, dan artis dari Spotify...';
      const meta = await fetchSpotifyMetadata(sp.type, sp.id, url);
      hubDetecting = false;
      if (meta) {
        hubMeta = meta;
        hubMessage = `Terdeteksi (${meta.via}): ${meta.title} — ${meta.artist}`;
      } else {
        hubMessage = 'Pemutar Spotify dimuat. Isi Spotify Client ID & Secret di Pengaturan API untuk deteksi metadata penuh.';
      }
      return;
    }

    const ytId = extractYouTubeId(url);
    if (ytId) {
      hubVideoId = ytId;
      hubEmbedType = 'youtube';
      hubDetecting = true;
      const oembed = await fetchOEmbedMeta(url, false);
      hubDetecting = false;
      hubMeta = {
        via: 'YouTube oEmbed',
        title: oembed?.title || 'YouTube Music',
        artist: oembed?.author_name || 'YouTube',
        album: 'YouTube Hub',
        dur: 0,
        imageUrl: oembed?.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      };
      hubMessage = `Terdeteksi: ${hubMeta.title} — ${hubMeta.artist}`;
      return;
    }

    hubMessage = 'Tautan tidak dikenali. Gunakan URL lagu/playlist Spotify atau video YouTube.';
  }

  async function saveHubToLibrary() {
    const url = hubUrlInput.trim();
    if (!url) return;
    hubSaving = true;
    const isSp = hubEmbedType === 'spotify';
    let meta = hubMeta;
    if (!meta && isSp && hubSpotify) {
      meta = await fetchSpotifyMetadata(hubSpotify.type, hubSpotify.id, url);
    }

    const title = meta?.title || (isSp ? `Spotify ${hubSpotify.type}` : 'YouTube Music');
    const artist = meta?.artist || (isSp ? 'Spotify' : 'YouTube');
    const imageUrl = meta?.imageUrl || (hubVideoId ? `https://img.youtube.com/vi/${hubVideoId}/hqdefault.jpg` : null);

    // Otomatis cari lirik sinkron LRC berdasarkan nama lagu & artis yang terdeteksi!
    const syncedLyrics = await fetchSyncedLyrics(title, artist, meta?.dur || 0);

    const t = {
      id: 'embed_' + Date.now(),
      title,
      artist,
      album: meta?.album || (isSp ? 'Spotify Hub' : 'YouTube Hub'),
      imageUrl,
      c1: isSp ? '#1DB954' : '#ef4444',
      c2: '#0b0b12',
      dur: meta?.dur || 0,
      source: 'local',
      createdAt: Date.now(),
      lyrics: syncedLyrics || '',
      videoId: hubVideoId || undefined,
      spotifyId: hubSpotify?.id || undefined,
      spotifyType: hubSpotify?.type || undefined
    };
    await saveLocalTrack(t);
    await refreshLocalTracks();
    hubSaving = false;
    hubModalOpen = false;
    view = 'library';
    openTrackModal(t, false);
    showToast(syncedLyrics ? 'Lagu, sampul & lirik sinkron berhasil disimpan!' : 'Lagu & sampul berhasil disimpan ke Koleksi!');
  }

  async function runApiDownloader(videoIdOrUrl) {
    const vid = extractYouTubeId(videoIdOrUrl) || videoIdOrUrl;
    if (!vid) return showToast('Masukkan tautan YouTube yang valid');
    dlLoading = true;
    dlResult = null;
    const res = await rapidDownloadMp3(vid);
    dlLoading = false;
    if (res.ok) {
      dlResult = res;
      showToast('Tautan unduhan MP3 siap!');
    } else {
      showToast('Gagal: ' + res.msg);
    }
  }

  function openProfileEditor() {
    emName = userProfile.name;
    emHandle = userProfile.handle;
    emBio = userProfile.bio;
    emImagePreview = userProfile.image;
    editProfileOpen = true;
  }

  function saveProfileAndApi() {
    userProfile = {
      name: emName.trim() || 'Nys',
      handle: emHandle.trim() || '@nysxmusic',
      bio: emBio.trim() || 'Penikmat musik.',
      image: emImagePreview
    };
    saveJSON('nys_profile', userProfile);
    saveApiConfig(apiConfig);
    editProfileOpen = false;
    showToast('Profil & API Key (termasuk Spotify) disimpan!');
  }

  onMount(async () => {
    engine.init(showToast);
    likedIds = loadJSON('nys_liked_ids', []);
    playlists = loadJSON('nys_playlists', [
      { id: 'pl_default_chill', name: 'Jalan Pulang', trackIds: [], createdAt: Date.now() }
    ]);
    engine.history = loadJSON('nys_history', []);
    const savedProf = loadJSON('nys_profile', null);
    if (savedProf) userProfile = savedProf;

    if (window.__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const info = await invoke('get_runtime_info');
        if (info) runtimeInfo = info;
      } catch {
        // browser mode
      }
    }

    try {
      await openDB();
      await refreshLocalTracks();
    } catch (e) {
      console.warn('IndexedDB warning:', e);
    }

    const [trending, yt] = await Promise.all([fetchTrending(32), fetchYtTrending('ID')]);
    trendingTracks = trending;
    ytTracks = yt;
    loadingHome = false;
    if (engine.queue.length === 0) {
      engine.queue = [...localTracks, ...trending];
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    window.history.pushState({ page: 'root' }, '');
    window.addEventListener('popstate', () => {
      let handled = false;
      if (trackModalOpen) { closeTrackModal(); handled = true; }
      else if (uploadModalOpen) { uploadModalOpen = false; handled = true; }
      else if (hubModalOpen) { hubModalOpen = false; handled = true; }
      else if (dlModalOpen) { dlModalOpen = false; handled = true; }
      else if (editProfileOpen) { editProfileOpen = false; handled = true; }
      else if (editTrackOpen) { editTrackOpen = false; handled = true; }
      else if (playlistModalOpen) { playlistModalOpen = false; handled = true; }
      else if (npDrawerOpen) { npDrawerOpen = false; handled = true; }
      else if (view !== 'home') { view = 'home'; handled = true; }
      if (handled) window.history.pushState({ page: 'root' }, '');
    });
  });
</script>

{#snippet trackCardItem(t)}
  {@const active = engine.current?.id === t.id && engine.playing}
  {@const isFlipped = flippedGridIds.has(t.id)}
  {@const gridLrc = parseLrcLyrics(t.lyrics || '')}
  {@const gridActiveIdx = (() => {
    if (!gridLrc.length || !gridLrc[0]?.synced || engine.current?.id !== t.id) return -1;
    let idx = -1;
    for (let i = 0; i < gridLrc.length; i++) {
      if (gridLrc[i].time <= engine.position + 0.15) idx = i;
      else break;
    }
    return idx;
  })()}

  <div class="grid-flip-card">
    <div class="grid-flip-inner {isFlipped ? 'is-flipped' : ''}">
      <!-- SISI DEPAN KARTU -->
      <div
        class="card flip-face {active ? 'playing' : ''}"
        onclick={() => handleCardInteraction(t)}
        ondblclick={(e) => { e.stopPropagation(); if (engine.current?.id !== t.id) engine.playTrack(t, allTracks); toggleGridFlip(t, e); }}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleCardInteraction(t)}
      >
        <div class="album-art" style={t.imageUrl ? '' : `background: linear-gradient(135deg, ${t.c1 || '#6366f1'}, ${t.c2 || '#1e1b4b'})`}>
          {#if t.imageUrl}
            <img src={t.imageUrl} alt={t.title} loading="lazy" />
          {:else}
            <div class="local-cover-text">{(t.title || '?')[0].toUpperCase()}</div>
          {/if}
          <span class="art-meta">{t.dur ? fmt(t.dur) : (t.album || 'Stream')}</span>
        </div>

        <div class="card-actions-top">
          <button class="card-mini-btn" title="Balik Kartu (Lirik)" onclick={(e) => toggleGridFlip(t, e)}>↻</button>
          <button class="card-mini-btn {isLiked(t.id) ? 'liked' : ''}" title="Favorit" onclick={(e) => toggleLike(t, e)}>
            {isLiked(t.id) ? '♥' : '♡'}
          </button>
          {#if t.source === 'local'}
            <button class="card-mini-btn" title="Edit Lagu / Lirik" onclick={(e) => openEditTrackModal(t, e)}>✎</button>
            <button class="card-mini-btn" title="Hapus" onclick={(e) => removeTrack(t, e)}>×</button>
          {/if}
        </div>

        <h3>{t.title}</h3>
        <p>{t.artist}</p>

        <button class="card-play" title="Putar" onclick={(e) => { e.stopPropagation(); engine.playTrack(t, allTracks); }}>
          {#if active}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
          {/if}
        </button>
      </div>

      <!-- SISI BELAKANG KARTU (LIRIK SINKRON SESUAI IRAMA) -->
      <div
        class="grid-flip-back"
        ondblclick={(e) => toggleGridFlip(t, e)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && toggleGridFlip(t, e)}
      >
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;">
          <div style="min-width:0;">
            <div style="font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{t.title}</div>
            <div style="font-size:10px;color:var(--accent);">{t.artist}</div>
          </div>
          <button class="card-mini-btn" onclick={(e) => toggleGridFlip(t, e)} title="Kembali">↻</button>
        </div>

        <div style="flex:1;overflow-y:auto;font-size:11.5px;line-height:1.55;padding:4px 0;">
          {#if gridLrc.length > 0}
            {#each gridLrc as line, i}
              <div
                style="padding:3px 5px;border-radius:6px;margin-bottom:3px;color:{i === gridActiveIdx ? '#fff' : 'rgba(255,255,255,.52)'};font-weight:{i === gridActiveIdx ? '800' : '500'};background:{i === gridActiveIdx ? 'rgba(185,203,255,.2)' : 'transparent'};"
              >
                {line.text}
              </div>
            {/each}
          {:else}
            <div style="color:var(--muted);font-size:11px;text-align:center;margin-top:24px;">
              {fetchingLyrics ? 'Mencari lirik...' : 'Ketuk "Buka Penuh" untuk mencari atau menulis lirik.'}
            </div>
          {/if}
        </div>

        <div style="display:flex;gap:5px;margin-top:6px;">
          <button class="chip" style="flex:1;padding:5px;font-size:10.5px;" onclick={(e) => { e.stopPropagation(); openTrackModal(t, true); }}>
            Buka Penuh
          </button>
        </div>
      </div>
    </div>
  </div>
{/snippet}

<div class="bg" aria-hidden="true">
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="blob b3"></div>
</div>

<!-- DYNAMIC ISLAND FLOATING BAR -->
{#if engine.current && !dynamicBarDismissed}
  <div class="dynamic-bar {engine.playing ? '' : 'paused'}" onclick={() => openTrackModal(engine.current)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openTrackModal(engine.current)}>
    <span class="db-pulse"></span>
    <div style="min-width:0;flex:1;">
      <div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{engine.current.title}</div>
      <div style="font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        {engine.current.artist} {engine.eqEnabled && engine.eqPreset !== 'flat' ? `• EQ: ${EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}` : ''}
      </div>
    </div>
    <button class="play-btn" style="width:30px;height:30px;" onclick={(e) => { e.stopPropagation(); engine.togglePlay(); }}>
      {#if engine.playing}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
      {/if}
    </button>
    <button class="icon-btn" style="width:24px;height:24px;" onclick={(e) => { e.stopPropagation(); dynamicBarDismissed = true; }}>✕</button>
  </div>
{/if}

<div class="app {npDrawerOpen ? 'np-open' : ''}">
  <!-- DESKTOP SIDEBAR -->
  <aside class="sidebar">
    <nav class="glass side-nav">
      <div class="brand">
        <span class="brand-mark">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3z"/></svg>
        </span>
        <span class="brand-name">nys Xmusic</span>
        <span class="brand-badge">SK3</span>
      </div>

      <div class="nav-container">
        <button class="nav-item {view === 'home' ? 'active' : ''}" onclick={() => (view = 'home')}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.4 12 3l9 7.4V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
          <span>Beranda</span>
        </button>
        <button class="nav-item {view === 'search' ? 'active' : ''}" onclick={() => (view = 'search')}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.6-3.6"/></svg>
          <span>Cari Musik</span>
        </button>
        <button class="nav-item {view === 'library' ? 'active' : ''}" onclick={() => (view = 'library')}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5h4V21H3zM9 4.5h4V21H9zM15 4.5h3.4a1 1 0 0 1 1 .9L20.4 21h-3.9z"/></svg>
          <span>Perpustakaan ({localTracks.length})</span>
        </button>
        <button class="nav-item {view === 'eq' ? 'active' : ''}" onclick={() => (view = 'eq')}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>
          <span>Equalizer & Audio</span>
        </button>
        <button class="nav-item" style="color:var(--spotify);" onclick={() => (dlModalOpen = true)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          <span>API Downloader</span>
        </button>
        <button class="nav-item" onclick={() => (hubModalOpen = true)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>Hub Spotify & YT</span>
        </button>
      </div>
    </nav>

    <div class="glass side-lib">
      <div class="lib-head">
        <button class="lib-title" onclick={() => (view = 'library')}>
          <span>Koleksi Cepat</span>
        </button>
        <div style="display:flex;gap:4px;">
          <button class="icon-btn" title="Buat Playlist" onclick={() => (playlistModalOpen = true)}>📁</button>
          <button class="icon-btn" title="Upload MP3 / URL" onclick={() => (uploadModalOpen = true)}>＋</button>
        </div>
      </div>

      <ul class="lib-list">
        {#each localTracks.slice(0, 14) as t (t.id)}
          <li class="lib-item {engine.current?.id === t.id ? 'playing' : ''}" onclick={() => handleCardInteraction(t)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && handleCardInteraction(t)}>
            <div class="lib-thumb" style={t.imageUrl ? `background-image:url(${t.imageUrl})` : `background:linear-gradient(135deg,${t.c1 || '#6366f1'},${t.c2 || '#1e1b4b'})`}>
              {#if !t.imageUrl}
                <span style="font-weight:800;color:#fff;font-size:14px;">{(t.title || '?')[0].toUpperCase()}</span>
              {/if}
            </div>
            <div class="lib-info">
              <div class="lib-name">{t.title}</div>
              <div class="lib-sub">{t.artist}</div>
            </div>
          </li>
        {:else}
          <li style="padding:12px 8px;font-size:12px;color:var(--muted);line-height:1.5;">
            Belum ada lagu lokal. Klik <b>＋</b> untuk upload MP3 atau buat lagu demo synth.
          </li>
        {/each}
      </ul>
    </div>
  </aside>

  <!-- MAIN VIEWPORT -->
  <main class="glass main">
    <header class="topbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.6-3.6"/></svg>
        <input
          type="text"
          placeholder="Cari lagu, artis, atau genre..."
          value={searchQuery}
          oninput={(e) => onSearchInput(e.currentTarget.value)}
        />
      </div>
      <div class="topbar-spacer"></div>
      {#if engine.sleepMinutes !== 0}
        <button class="status-pill" onclick={() => (view = 'eq')} title="Sleep Timer Aktif">
          🌙 {engine.sleepMinutes === -1 ? 'Akhir Lagu' : fmt(engine.sleepRemainingSec)}
        </button>
      {/if}
      <button class="status-pill d-only" onclick={() => (view = 'eq')} title="5-Band Equalizer">
        🎛️ {engine.eqEnabled ? (EQ_PRESETS[engine.eqPreset]?.name || 'Custom') : 'EQ Off'}
      </button>
      <button
        class="user-chip"
        title="Profil & Pengaturan API"
        onclick={() => (view = 'profile')}
        style={userProfile.image ? `background-image:url(${userProfile.image})` : ''}
      >
        {userProfile.image ? '' : (userProfile.name || 'N')[0].toUpperCase()}
      </button>
    </header>

    <div class="content">
      {#if view === 'home'}
        <section class="hero">
          <div style="font-size:11.5px;font-weight:700;color:var(--accent);margin-bottom:8px;">
            nys Xmusic v2.0 • {greeting()}, {userProfile.name}
          </div>
          <h1>Audio Jernih, Tanpa Kompromi.</h1>
          <p>
            Ketuk <b>2x kartu lagu</b> untuk membalik dan melihat lirik sinkron sesuai irama. Tempel tautan Spotify di Hub Musik untuk deteksi sampul & artis otomatis.
          </p>
          <div class="hero-actions">
            <button class="pill-btn primary" onclick={() => (uploadModalOpen = true)}>📤 Upload MP3 / URL</button>
            <button class="pill-btn spotify" onclick={createBuiltInSynthDemo}>🎹 Putar Lagu Demo (0 KB)</button>
            <button class="pill-btn ghost" onclick={() => (hubModalOpen = true)}>🔗 Hub Spotify & YT</button>
            <button class="pill-btn ghost" onclick={() => (view = 'eq')}>🎛️ Equalizer</button>
          </div>
        </section>

        {#if localTracks.length > 0}
          <section class="section">
            <div class="section-head">
              <h2>Koleksi Offline Kamu ({localTracks.length})</h2>
              <button class="chip" onclick={() => { view = 'library'; libFilter = 'local'; }}>Lihat Semua →</button>
            </div>
            <div class="grid">
              {#each localTracks.slice(0, 6) as t (t.id)}
                {@render trackCardItem(t)}
              {/each}
            </div>
          </section>
        {/if}

        <section class="section">
          <div class="section-head">
            <h2>Eksplorasi Genre & Suasana</h2>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:10px;">
            {#each CATEGORIES as c}
              <button
                style="background:linear-gradient(135deg,{c.g1},{c.g2});border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:15px;text-align:left;color:#fff;cursor:pointer;"
                onclick={() => runCategorySearch(c.q)}
              >
                <div style="font-size:14.5px;font-weight:800;">{c.label}</div>
                <div style="font-size:11.5px;color:rgba(255,255,255,.72);margin-top:3px;">{c.sub}</div>
              </button>
            {/each}
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h2>Trending Streaming (Audius Global)</h2>
          </div>
          {#if loadingHome}
            <p style="color:var(--muted);font-size:13.5px;">Memuat daftar lagu trending...</p>
          {:else if trendingTracks.length > 0}
            <div class="grid">
              {#each trendingTracks.slice(0, 24) as t (t.id)}
                {@render trackCardItem(t)}
              {/each}
            </div>
          {:else}
            <p style="color:var(--muted);font-size:13.5px;">
              Sedang offline atau server streaming tidak terjangkau. Gunakan koleksi offline atau tombol <b>Putar Lagu Demo</b> di atas.
            </p>
          {/if}
        </section>

        {#if ytTracks.length > 0}
          <section class="section">
            <div class="section-head"><h2>Trending YouTube Music Indonesia</h2></div>
            <div class="grid">
              {#each ytTracks as t (t.id)}
                {@render trackCardItem(t)}
              {/each}
            </div>
          </section>
        {/if}

        <section class="section">
          <div class="section-head"><h2>Chart Resmi Spotify</h2></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;">
            {#each SPOTIFY_CHARTS as p}
              <iframe
                title={p.title}
                style="border-radius:14px;border:0;"
                src="https://open.spotify.com/embed/playlist/{p.id}?theme=0"
                width="100%"
                height="352"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              ></iframe>
            {/each}
          </div>
        </section>

      {:else if view === 'search'}
        <section class="section">
          <div class="section-head">
            <h2>{searchQuery ? `Hasil Pencarian "${searchQuery}"` : 'Cari Lagu & Artis'}</h2>
          </div>
          {#if !searchQuery.trim()}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:10px;">
              {#each CATEGORIES as c}
                <button
                  style="background:linear-gradient(135deg,{c.g1},{c.g2});border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:15px;text-align:left;color:#fff;cursor:pointer;"
                  onclick={() => runCategorySearch(c.q)}
                >
                  <div style="font-size:14.5px;font-weight:800;">{c.label}</div>
                  <div style="font-size:11.5px;color:rgba(255,255,255,.72);margin-top:3px;">{c.sub}</div>
                </button>
              {/each}
            </div>
          {:else if searching}
            <p style="color:var(--muted);font-size:13.5px;">Mencari "{searchQuery}"...</p>
          {:else if searchResults.length > 0}
            <div class="grid">
              {#each searchResults as t (t.id)}
                {@render trackCardItem(t)}
              {/each}
            </div>
          {:else}
            <p style="color:var(--muted);font-size:13.5px;">Tidak ditemukan lagu yang cocok dengan "{searchQuery}".</p>
          {/if}
        </section>

      {:else if view === 'library'}
        <section class="section">
          <div class="section-head">
            <h2>Perpustakaan & Playlist Kamu</h2>
            <div style="display:flex;gap:8px;">
              <button class="pill-btn ghost" style="padding:7px 14px;font-size:12px;" onclick={() => (playlistModalOpen = true)}>＋ Buat Playlist</button>
              <button class="pill-btn primary" style="padding:7px 14px;font-size:12px;" onclick={() => (uploadModalOpen = true)}>＋ Upload Lagu</button>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
            <button class="chip {libFilter === 'local' || libFilter === 'all' ? 'active' : ''}" onclick={() => (libFilter = 'local')}>
              Lagu Offline ({localTracks.length})
            </button>
            <button class="chip {libFilter === 'liked' ? 'active' : ''}" onclick={() => (libFilter = 'liked')}>
              ♥ Favorit ({likedIds.length})
            </button>
            <button class="chip {libFilter === 'history' ? 'active' : ''}" onclick={() => (libFilter = 'history')}>
              🕒 Riwayat Putar ({engine.history.length})
            </button>
            {#each playlists as pl (pl.id)}
              <button class="chip {libFilter === pl.id ? 'active' : ''}" onclick={() => (libFilter = pl.id)}>
                📁 {pl.name} ({pl.trackIds.length})
              </button>
            {/each}
          </div>

          {#if filteredLibrary.length > 0}
            <div class="grid">
              {#each filteredLibrary as t (t.id)}
                {@render trackCardItem(t)}
              {/each}
            </div>
          {:else}
            <div class="eq-rack" style="text-align:center;padding:34px 20px;">
              <div style="font-size:16px;font-weight:700;margin-bottom:6px;">Belum ada lagu di kategori ini</div>
              <p style="font-size:13px;color:var(--muted);margin-bottom:18px;">
                Upload file MP3/M4A/WAV lokal dari perangkatmu atau buat lagu demo synthwave secara instan.
              </p>
              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="pill-btn primary" onclick={() => (uploadModalOpen = true)}>📤 Upload File Audio</button>
                <button class="pill-btn spotify" onclick={createBuiltInSynthDemo}>🎹 Buat Lagu Demo Offline</button>
              </div>
            </div>
          {/if}
        </section>

      {:else if view === 'eq'}
        <section class="section">
          <div class="section-head">
            <h2>Studio Equalizer 5-Band & Efek Audio</h2>
            <button class="pill-btn {engine.eqEnabled ? 'spotify' : 'ghost'}" onclick={() => engine.toggleEq()}>
              {engine.eqEnabled ? '● Equalizer Aktif' : '○ Equalizer Nonaktif'}
            </button>
          </div>

          <div class="eq-rack">
            <div style="font-size:13px;color:var(--muted);">
              Diproses real-time menggunakan <b>Web Audio API BiquadFilterNode</b> tanpa distorsi.
            </div>

            <div class="eq-presets">
              {#each Object.entries(EQ_PRESETS) as [key, p]}
                <button class="chip {engine.eqPreset === key ? 'active' : ''}" onclick={() => engine.setPreset(key)}>
                  {p.name}
                </button>
              {/each}
            </div>

            <div class="eq-sliders-grid">
              <div class="eq-col">
                <span class="eq-db">{engine.preamp > 0 ? `+${engine.preamp}` : engine.preamp} dB</span>
                <input
                  class="eq-range"
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={engine.preamp}
                  oninput={(e) => engine.setPreamp(e.currentTarget.value)}
                />
                <span class="eq-freq">Preamp</span>
                <span class="eq-sub">Master Gain</span>
              </div>

              {#each EQ_BANDS as band, idx}
                <div class="eq-col">
                  <span class="eq-db">{engine.gains[idx] > 0 ? `+${engine.gains[idx]}` : engine.gains[idx]} dB</span>
                  <input
                    class="eq-range"
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={engine.gains[idx]}
                    oninput={(e) => engine.setBandGain(idx, e.currentTarget.value)}
                  />
                  <span class="eq-freq">{band.label}</span>
                  <span class="eq-sub">{band.sub}</span>
                </div>
              {/each}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:18px;">
              <div style="background:rgba(0,0,0,.25);padding:14px;border-radius:14px;">
                <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:8px;">
                  <span>Keseimbangan Stereo (Balance L/R)</span>
                  <span style="color:var(--accent);">{engine.pan === 0 ? 'Center' : engine.pan < 0 ? `L ${Math.round(Math.abs(engine.pan)*100)}%` : `R ${Math.round(engine.pan*100)}%`}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  style="width:100%;accent-color:var(--accent);"
                  value={engine.pan}
                  oninput={(e) => engine.setPan(e.currentTarget.value)}
                />
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px;">
                  <span>Kiri (L)</span>
                  <button style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;" onclick={() => engine.setPan(0)}>Reset Center</button>
                  <span>Kanan (R)</span>
                </div>
              </div>

              <div style="background:rgba(0,0,0,.25);padding:14px;border-radius:14px;">
                <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:8px;">
                  <span>Kecepatan Putar (Speed & Pitch)</span>
                  <span style="color:var(--spotify);">{engine.playbackRate}x</span>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                  {#each SPEED_OPTIONS as spd}
                    <button class="chip {engine.playbackRate === spd ? 'active' : ''}" style="padding:4px 10px;font-size:11.5px;" onclick={() => engine.setSpeed(spd)}>
                      {spd}x
                    </button>
                  {/each}
                </div>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);cursor:pointer;">
                  <input type="checkbox" checked={engine.preservesPitch} onchange={() => engine.togglePreservesPitch()} />
                  <span>Pertahankan Nada Vokal (Matikan untuk efek Slowed / Nightcore)</span>
                </label>
              </div>
            </div>
          </div>

          <div class="eq-rack">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px;font-weight:800;">🌙 Sleep Timer</h3>
                <p style="font-size:12.5px;color:var(--muted);margin-top:2px;">
                  Musik mengecil secara halus (fade-out) lalu berhenti otomatis.
                </p>
              </div>
              {#if engine.sleepMinutes !== 0}
                <span class="status-pill">
                  Aktif: {engine.sleepMinutes === -1 ? 'Akhir Lagu' : fmt(engine.sleepRemainingSec)}
                </span>
              {/if}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              {#each SLEEP_OPTIONS as opt}
                <button class="chip {engine.sleepMinutes === opt.minutes ? 'active' : ''}" onclick={() => engine.setSleepTimer(opt.minutes)}>
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
        </section>

      {:else if view === 'profile'}
        <section class="hero" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;">
          <div
            style="width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font-size:38px;font-weight:800;color:#05060a;background:linear-gradient(135deg,#b9cbff,#6366f1 55%,#d946ef);background-size:cover;background-position:center;flex-shrink:0;{userProfile.image ? `background-image:url(${userProfile.image});color:transparent;` : ''}"
          >
            {userProfile.image ? '' : (userProfile.name || 'N')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:200px;">
            <h1 style="font-size:26px;">{userProfile.name}</h1>
            <div style="font-size:13px;color:var(--accent);margin-top:2px;">{userProfile.handle}</div>
            <p style="margin-top:8px;">{userProfile.bio}</p>
            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
              <button class="pill-btn primary" onclick={openProfileEditor}>🔑 Edit Profil & Spotify API Key</button>
              <button class="pill-btn ghost" onclick={() => (view = 'eq')}>🎛️ Pengaturan Equalizer</button>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2>Status API & Informasi Sistem</h2></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;">
            <div class="eq-rack" style="margin:0;">
              <div style="font-size:11.5px;color:var(--muted);">Spotify Web API v1</div>
              <div style="font-size:15px;font-weight:800;margin-top:6px;color:{apiConfig.spotifyClientId && apiConfig.spotifyClientSecret ? '#4ade80' : '#f59e0b'};">
                {apiConfig.spotifyClientId && apiConfig.spotifyClientSecret ? '● API Key Terpasang' : '○ Mode Fallback (oEmbed)'}
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px;">Klik "Edit Profil & Spotify API Key" di atas untuk mengisi Client ID & Secret.</div>
            </div>
            <div class="eq-rack" style="margin:0;">
              <div style="font-size:11.5px;color:var(--muted);">Koleksi & Playlist</div>
              <div style="font-size:22px;font-weight:800;margin-top:4px;">{localTracks.length} Lagu • {likedIds.length} ♥</div>
            </div>
            <div class="eq-rack" style="margin:0;">
              <div style="font-size:11.5px;color:var(--muted);">Mesin Aplikasi</div>
              <div style="font-size:14px;font-weight:700;margin-top:6px;color:var(--accent);">{runtimeInfo.engine}</div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">Versi {runtimeInfo.version} Production</div>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </main>

  <!-- RIGHT DRAWER: ANTREAN PUTAR (QUEUE) & LIRIK SINKRON -->
  <aside class="glass nowplaying">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:6px;">
        <button class="chip {npTab === 'queue' ? 'active' : ''}" onclick={() => (npTab = 'queue')}>
          Antrean ({engine.queue.length})
        </button>
        <button class="chip {npTab === 'lyrics' ? 'active' : ''}" onclick={() => (npTab = 'lyrics')}>
          Lirik Sinkron
        </button>
      </div>
      <button class="icon-btn" onclick={() => (npDrawerOpen = false)}>✕</button>
    </div>

    {#if npTab === 'queue'}
      <div style="font-size:12px;color:var(--muted);display:flex;justify-content:space-between;align-items:center;">
        <span>Daftar Putar Berikutnya</span>
        {#if engine.queue.length > 0}
          <button style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11.5px;" onclick={() => (engine.queue = [])}>
            Bersihkan
          </button>
        {/if}
      </div>
      <ul class="lib-list" style="padding-bottom:12px;">
        {#each engine.queue as qTrack, idx (qTrack.id + '_' + idx)}
          <li class="lib-item {engine.current?.id === qTrack.id ? 'playing' : ''}" onclick={() => engine.playTrack(qTrack)}>
            <div class="lib-thumb" style={qTrack.imageUrl ? `background-image:url(${qTrack.imageUrl})` : `background:linear-gradient(135deg,${qTrack.c1 || '#6366f1'},${qTrack.c2 || '#1e1b4b'})`}>
              {#if !qTrack.imageUrl}
                <span style="font-weight:800;color:#fff;font-size:13px;">{(qTrack.title || '?')[0].toUpperCase()}</span>
              {/if}
            </div>
            <div class="lib-info">
              <div class="lib-name">{qTrack.title}</div>
              <div class="lib-sub">{qTrack.artist}</div>
            </div>
            <button
              class="icon-btn"
              style="width:26px;height:26px;font-size:13px;"
              title="Hapus dari antrean"
              onclick={(e) => {
                e.stopPropagation();
                engine.queue = engine.queue.filter((_, i) => i !== idx);
              }}
            >×</button>
          </li>
        {:else}
          <li style="padding:12px;font-size:12.5px;color:var(--muted);">Antrean kosong. Pilih lagu untuk mulai memutar.</li>
        {/each}
      </ul>
    {:else}
      {#if engine.current}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div style="min-width:0;">
            <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{engine.current.title}</div>
            <div style="font-size:12px;color:var(--muted);">{engine.current.artist}</div>
          </div>
          <button class="chip" onclick={() => openEditTrackModal(engine.current)}>✎ Edit</button>
        </div>
        <div style="flex:1;overflow-y:auto;white-space:pre-wrap;font-size:13.5px;line-height:1.75;color:#e2e8f0;padding:12px;background:rgba(0,0,0,.28);border-radius:14px;">
          {engine.current.lyrics || 'Belum ada lirik. Ketuk 2x kartu lagu untuk mencari lirik otomatis dari LRCLIB atau tempel manual.'}
        </div>
      {:else}
        <p style="font-size:12.5px;color:var(--muted);">Putar sebuah lagu untuk melihat liriknya.</p>
      {/if}
    {/if}
  </aside>

  <!-- BOTTOM PLAYER BAR -->
  <footer class="glass player">
    <div class="np-left" onclick={() => engine.current && openTrackModal(engine.current)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && engine.current && openTrackModal(engine.current)}>
      <div class="np-art" style={engine.current?.imageUrl ? '' : `background:linear-gradient(135deg,${engine.current?.c1 || '#334155'},${engine.current?.c2 || '#0f172a'})`}>
        {#if engine.current?.imageUrl}
          <img src={engine.current.imageUrl} alt="" />
        {:else if engine.current}
          <div style="font-size:20px;font-weight:800;color:#fff;">{(engine.current.title || '?')[0].toUpperCase()}</div>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        {/if}
      </div>
      <div class="np-meta">
        <span class="np-title">{engine.current?.title || 'Belum ada lagu diputar'}</span>
        <span class="np-artist">{engine.current?.artist || 'Ketuk 2x kartu untuk lirik'}</span>
      </div>
      {#if engine.current}
        <button class="icon-btn d-only" title="Favorit" onclick={(e) => toggleLike(engine.current, e)} style="color:{isLiked(engine.current.id) ? '#f43f5e' : 'var(--muted)'}">
          {isLiked(engine.current.id) ? '♥' : '♡'}
        </button>
      {/if}
    </div>

    <div class="np-center">
      <div class="controls">
        <button class="icon-btn {engine.shuffle ? 'active' : ''}" title="Shuffle" onclick={() => engine.toggleShuffle()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5m-1-1 6 6M4 4l5 5"/></svg>
        </button>
        <button class="icon-btn" title="Sebelumnya" onclick={() => engine.prev()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.2" height="14" rx="1"/><path d="M19 5.6v12.8L8.5 12z"/></svg>
        </button>
        <button class="play-btn" title="Putar / Jeda" onclick={() => engine.togglePlay()}>
          {#if engine.playing}
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
          {/if}
        </button>
        <button class="icon-btn" title="Berikutnya" onclick={() => engine.next(false)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="16.8" y="5" width="2.2" height="14" rx="1"/><path d="M5 5.6v12.8L15.5 12z"/></svg>
        </button>
        <button class="icon-btn {engine.repeat !== 'off' ? 'active' : ''}" title="Repeat" onclick={() => engine.cycleRepeat()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          {#if engine.repeat === 'one'}
            <span class="repeat-badge">1</span>
          {/if}
        </button>
      </div>

      <div class="seek-row">
        <span class="time">{fmt(engine.position)}</span>
        <div
          class="progress"
          onclick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            engine.seekTo((e.clientX - r.left) / r.width);
          }}
          role="slider"
          tabindex="0"
          aria-valuenow={Math.round(engine.position)}
          aria-valuemin="0"
          aria-valuemax={Math.round(engine.duration || 100)}
          onkeydown={(e) => {
            if (e.key === 'ArrowRight') engine.seekTo((engine.position + 5) / (engine.duration || 1));
            if (e.key === 'ArrowLeft') engine.seekTo((engine.position - 5) / (engine.duration || 1));
          }}
        >
          <div class="progress-fill" style="width:{engine.duration ? Math.min(100, (engine.position / engine.duration) * 100) : 0}%"></div>
        </div>
        <span class="time">{fmt(engine.duration)}</span>
      </div>
    </div>

    <div class="np-right">
      <button class="play-btn m-only" onclick={() => engine.togglePlay()}>
        {#if engine.playing}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
        {/if}
      </button>

      <div class="d-only" style="display:flex;align-items:center;gap:6px;width:110px;">
        <button class="icon-btn" style="width:28px;height:28px;" onclick={() => engine.toggleMute()}>
          {engine.muted || engine.volume === 0 ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.02"
          style="width:72px;accent-color:#fff;cursor:pointer;"
          value={engine.muted ? 0 : engine.volume}
          oninput={(e) => engine.setVolume(e.currentTarget.value)}
        />
      </div>

      <button class="icon-btn {npDrawerOpen ? 'active' : ''}" title="Antrean Putar & Lirik" onclick={() => (npDrawerOpen = !npDrawerOpen)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h12M4 12h12M4 18h8M18 12v7M21 15.5h-6"/></svg>
      </button>
    </div>
  </footer>

  <!-- MOBILE NAVIGATION BAR -->
  <nav class="glass mobile-nav">
    <button class="m-nav-item {view === 'home' ? 'active' : ''}" onclick={() => (view = 'home')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.4 12 3l9 7.4V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
      <span>Beranda</span>
    </button>
    <button class="m-nav-item {view === 'search' ? 'active' : ''}" onclick={() => (view = 'search')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.6-3.6"/></svg>
      <span>Cari</span>
    </button>
    <button class="m-nav-item {view === 'library' ? 'active' : ''}" onclick={() => (view = 'library')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4.5h4V21H3zM9 4.5h4V21H9zM15 4.5h3.4a1 1 0 0 1 1 .9L20.4 21h-3.9z"/></svg>
      <span>Pustaka</span>
    </button>
    <button class="m-nav-item {view === 'eq' ? 'active' : ''}" onclick={() => (view = 'eq')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/></svg>
      <span>EQ Studio</span>
    </button>
    <button class="m-nav-item" onclick={() => (hubModalOpen = true)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <span style="color:#1DB954;">Hub/DL</span>
    </button>
    <button class="m-nav-item {view === 'profile' ? 'active' : ''}" onclick={() => (view = 'profile')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Profil</span>
    </button>
  </nav>
</div>

<button class="fab" title="Upload Lagu Baru" onclick={() => (uploadModalOpen = true)}>
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 5v14M5 12h14"/></svg>
</button>

<!-- FULL TRACK CARD MODAL DENGAN 3D FLIP 2X KETUK & LIRIK SINKRON -->
{#if trackModalOpen && activeModalTrack}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={closeTrackModal} role="presentation"></div>
    <div class="flip-scene" style="width:min(360px,calc(100vw - 28px));z-index:1;">
      <div class="flip-inner {modalFlipped ? 'is-flipped' : ''}" ondblclick={handleModalDoubleTap}>
        <!-- SISI DEPAN KARTU PEMUTAR -->
        <div class="track-card flip-face" style="width:100%;">
          <div
            class="tc-bg-blur"
            style={activeModalTrack.imageUrl
              ? `background-image:url(${activeModalTrack.imageUrl})`
              : `background:linear-gradient(135deg,${activeModalTrack.c1 || '#6366f1'},${activeModalTrack.c2 || '#1e1b4b'})`}
          ></div>
          <canvas class="tc-viz" bind:this={vizCanvas}></canvas>

          <div class="tc-content">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font-size:10.5px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;">
                Ketuk 2x Kartu → Lirik Sinkron
              </span>
              <div style="display:flex;gap:5px;">
                <button
                  class="icon-btn"
                  style="width:30px;height:30px;background:rgba(0,0,0,.45);"
                  title="Balik Kartu ke Lirik"
                  onclick={toggleModalFlip}
                >↻</button>
                <button
                  class="icon-btn"
                  style="width:30px;height:30px;background:rgba(0,0,0,.45);"
                  title="Tambah ke Playlist"
                  onclick={() => {
                    targetTrackForPlaylist = activeModalTrack;
                    playlistModalOpen = true;
                  }}
                >📁</button>
                <button
                  class="icon-btn"
                  style="width:30px;height:30px;background:rgba(0,0,0,.45);color:{isLiked(activeModalTrack.id) ? '#f43f5e' : '#fff'};"
                  title="Favorit"
                  onclick={(e) => toggleLike(activeModalTrack, e)}
                >{isLiked(activeModalTrack.id) ? '♥' : '♡'}</button>
                <button class="icon-btn" style="width:30px;height:30px;background:rgba(0,0,0,.45);" onclick={closeTrackModal}>✕</button>
              </div>
            </div>

            {#if activeModalTrack.videoId}
              <div style="width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;margin-bottom:14px;background:#000;">
                <iframe
                  title={activeModalTrack.title}
                  width="100%"
                  height="100%"
                  style="border:0;"
                  src="https://www.youtube.com/embed/{activeModalTrack.videoId}?autoplay=1&playsinline=1&rel=0"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            {:else if activeModalTrack.spotifyId}
              <div style="margin-bottom:14px;border-radius:14px;overflow:hidden;">
                <iframe
                  title={activeModalTrack.title}
                  style="border-radius:12px;border:0;"
                  src="https://open.spotify.com/embed/{activeModalTrack.spotifyType || 'track'}/{activeModalTrack.spotifyId}?theme=0"
                  width="100%"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                ></iframe>
              </div>
            {:else}
              <div
                class="tc-cover-wrapper"
                style={activeModalTrack.imageUrl ? '' : `background:linear-gradient(135deg,${activeModalTrack.c1 || '#6366f1'},${activeModalTrack.c2 || '#1e1b4b'})`}
              >
                {#if activeModalTrack.imageUrl}
                  <img src={activeModalTrack.imageUrl} alt={activeModalTrack.title} />
                {:else}
                  <div class="local-cover-text" style="font-size:68px;">{(activeModalTrack.title || '?')[0].toUpperCase()}</div>
                {/if}
              </div>
            {/if}

            <div style="font-size:20px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{activeModalTrack.title}</div>
            <div style="font-size:14px;color:var(--muted);margin-top:2px;">{activeModalTrack.artist}</div>

            {#if !activeModalTrack.videoId && !activeModalTrack.spotifyId}
              <div style="margin-top:16px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:6px;">
                  <span>{fmt(engine.position)}</span>
                  <span>-{fmt(Math.max(0, (engine.duration || 0) - engine.position))}</span>
                </div>
                <div
                  class="progress"
                  style="height:7px;"
                  onclick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    engine.seekTo((e.clientX - r.left) / r.width);
                  }}
                  role="slider"
                  tabindex="0"
                  aria-valuenow={Math.round(engine.position)}
                  aria-valuemin="0"
                  aria-valuemax={Math.round(engine.duration || 100)}
                  onkeydown={(e) => {
                    if (e.key === 'ArrowRight') engine.seekTo((engine.position + 5) / (engine.duration || 1));
                    if (e.key === 'ArrowLeft') engine.seekTo((engine.position - 5) / (engine.duration || 1));
                  }}
                >
                  <div class="progress-fill" style="width:{engine.duration ? Math.min(100, (engine.position / engine.duration) * 100) : 0}%"></div>
                </div>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;">
                <button class="icon-btn {engine.shuffle ? 'active' : ''}" onclick={() => engine.toggleShuffle()} title="Shuffle">🔀</button>
                <button class="icon-btn" onclick={() => engine.prev()} title="Sebelumnya">⏮</button>
                <button class="play-btn" style="width:52px;height:52px;" onclick={() => engine.togglePlay()}>
                  {#if engine.playing}
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>
                  {:else}
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>
                  {/if}
                </button>
                <button class="icon-btn" onclick={() => engine.next(false)} title="Berikutnya">⏭</button>
                <button class="icon-btn {engine.repeat !== 'off' ? 'active' : ''}" onclick={() => engine.cycleRepeat()} title="Ulangi">
                  🔁{#if engine.repeat === 'one'}<span class="repeat-badge">1</span>{/if}
                </button>
              </div>

              <div style="display:flex;align-items:center;gap:10px;margin-top:14px;">
                <span style="font-size:12px;color:var(--muted);">🔈</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  style="flex:1;accent-color:#fff;cursor:pointer;"
                  value={engine.volume}
                  oninput={(e) => engine.setVolume(e.currentTarget.value)}
                />
                <span style="font-size:12px;color:var(--muted);">🔊</span>
              </div>
            {/if}

            <div style="display:flex;gap:8px;margin-top:14px;justify-content:center;flex-wrap:wrap;">
              <button class="chip" onclick={toggleModalFlip}>
                ↻ Balik Kartu (Lirik)
              </button>
              <button class="chip" onclick={() => { closeTrackModal(); view = 'eq'; }}>
                🎛️ {EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}
              </button>
              {#if activeModalTrack.videoId}
                <button class="chip" style="color:var(--spotify);" onclick={() => { closeTrackModal(); dlUrlInput = `https://youtu.be/${activeModalTrack.videoId}`; dlModalOpen = true; }}>
                  ⬇ Unduh MP3
                </button>
              {/if}
            </div>
          </div>
        </div>

        <!-- SISI BELAKANG KARTU PEMUTAR (SYNCED LYRICS MENGIKUTI IRAMA) -->
        <div class="track-card flip-face flip-face-back" style="width:100%;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
            <div style="min-width:0;">
              <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{activeModalTrack.title}</div>
              <div style="font-size:11.5px;color:var(--accent);">{activeModalTrack.artist} • Lirik Sinkron</div>
            </div>
            <div style="display:flex;gap:5px;">
              <button class="icon-btn" style="width:30px;height:30px;background:rgba(255,255,255,.1);" title="Cari Lirik Otomatis" onclick={() => autoFetchLyricsForTrack(activeModalTrack)}>🔍</button>
              <button class="icon-btn" style="width:30px;height:30px;background:rgba(255,255,255,.1);" title="Edit / Tempel Lirik" onclick={() => openEditTrackModal(activeModalTrack)}>✎</button>
              <button class="icon-btn" style="width:30px;height:30px;background:rgba(255,255,255,.1);" title="Balik ke Depan" onclick={toggleModalFlip}>↻</button>
            </div>
          </div>

          <div class="lyrics-scroll" bind:this={lyricsScrollEl}>
            {#if fetchingLyrics}
              <div style="text-align:center;color:var(--accent);margin-top:60px;font-size:13.5px;">
                Mencari lirik sinkron dari LRCLIB...
              </div>
            {:else if parsedModalLyrics.length > 0}
              {#each parsedModalLyrics as line, idx}
                <div
                  class="lyric-line {idx === activeLyricIndex ? 'active' : ''}"
                  data-lrc-idx={idx}
                  onclick={() => {
                    if (line.synced && engine.duration > 0 && engine.current?.id === activeModalTrack.id) {
                      engine.seekTo(line.time / engine.duration);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === 'Enter' && line.synced && engine.duration > 0) {
                      engine.seekTo(line.time / engine.duration);
                    }
                  }}
                >
                  {#if line.synced}
                    <span style="font-size:10px;opacity:0.45;margin-right:6px;">{fmt(line.time)}</span>
                  {/if}
                  {line.text}
                </div>
              {/each}
            {:else}
              <div style="text-align:center;color:var(--muted);margin-top:46px;padding:0 12px;line-height:1.6;font-size:13px;">
                Belum ada lirik untuk lagu ini.<br><br>
                <button class="pill-btn spotify" style="padding:8px 14px;font-size:12px;" onclick={() => autoFetchLyricsForTrack(activeModalTrack)}>
                  🔍 Cari Lirik Sinkron Otomatis
                </button>
              </div>
            {/if}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(255,255,255,.1);">
            <span style="font-size:11px;color:var(--muted);">{fmt(engine.position)} / {fmt(engine.duration)}</span>
            <button class="chip" onclick={toggleModalFlip}>↻ Kembali ke Sampul</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL UPLOAD MP3 / URL -->
{#if uploadModalOpen}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (uploadModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:19px;font-weight:800;margin-bottom:4px;">Tambah Musik ke Perpustakaan</h3>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:16px;">
        Pilih file audio dari perangkatmu (bisa diputar 100% offline) atau tempel URL stream MP3.
      </p>

      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="chip {uploadTab === 'file' ? 'active' : ''}" style="flex:1;" onclick={() => (uploadTab = 'file')}>📁 File Lokal (MP3/WAV/FLAC)</button>
        <button class="chip {uploadTab === 'url' ? 'active' : ''}" style="flex:1;" onclick={() => (uploadTab = 'url')}>🔗 URL Stream</button>
      </div>

      {#if uploadTab === 'file'}
        <label style="display:block;padding:22px;border:2px dashed rgba(255,255,255,.22);border-radius:16px;text-align:center;cursor:pointer;margin-bottom:12px;background:rgba(255,255,255,.03);">
          <div style="font-size:14px;font-weight:700;">Klik untuk Pilih File Lagu (Bisa Banyak Sekaligus)</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px;">Mendukung MP3, M4A, WAV, OGG, FLAC, AAC</div>
          <input type="file" accept="audio/*" multiple style="display:none;" onchange={(e) => handleFileUpload(e.currentTarget.files)} />
        </label>

        <label style="display:block;padding:14px;border:1px dashed rgba(255,255,255,.18);border-radius:14px;text-align:center;cursor:pointer;margin-bottom:12px;">
          <div style="font-size:12.5px;font-weight:700;color:var(--accent);">+ Gambar Sampul Album (Opsional)</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">{coverFileName}</div>
          <input
            type="file"
            accept="image/*"
            style="display:none;"
            onchange={(e) => {
              if (e.currentTarget.files?.length) {
                pendingCoverFile = e.currentTarget.files[0];
                coverFileName = pendingCoverFile.name;
              }
            }}
          />
        </label>
      {:else}
        <div class="field-group">
          <label class="field-label" for="up-url">URL Audio Langsung (.mp3 / stream)</label>
          <input id="up-url" class="field-input" type="url" placeholder="https://..." bind:value={urlInput} />
        </div>
        <div class="field-group">
          <label class="field-label" for="up-title">Judul Lagu</label>
          <input id="up-title" class="field-input" type="text" placeholder="Judul lagu" bind:value={urlTitle} />
        </div>
        <div class="field-group">
          <label class="field-label" for="up-artist">Nama Artis</label>
          <input id="up-artist" class="field-input" type="text" placeholder="Nama artis" bind:value={urlArtist} />
        </div>
        <button class="pill-btn spotify" style="width:100%;margin-top:6px;" onclick={handleUrlUpload}>Simpan URL ke Perpustakaan</button>
      {/if}

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button class="pill-btn ghost" onclick={() => (uploadModalOpen = false)}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL HUB MUSIK (SPOTIFY WEB API DETECTOR & YOUTUBE) -->
{#if hubModalOpen}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (hubModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:19px;font-weight:800;margin-bottom:4px;">Hub Musik (Spotify API & YouTube)</h3>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">
        Tempel link Spotify untuk mendeteksi gambar sampul, judul lagu, artis, dan lirik sinkron otomatis.
      </p>

      <div class="field-group">
        <label class="field-label" for="hub-url">Tautan Spotify / YouTube</label>
        <input id="hub-url" class="field-input" type="url" placeholder="https://open.spotify.com/track/... atau https://youtu.be/..." bind:value={hubUrlInput} />
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <button class="pill-btn primary" style="flex:1;" disabled={hubDetecting} onclick={processHubLink}>
          {hubDetecting ? 'Mendeteksi...' : 'Deteksi & Muat'}
        </button>
        <button class="pill-btn ghost" onclick={() => { hubModalOpen = false; openProfileEditor(); }}>🔑 API Key</button>
      </div>

      {#if hubMeta}
        <div style="display:flex;gap:12px;align-items:center;padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;margin-bottom:12px;">
          {#if hubMeta.imageUrl}
            <img src={hubMeta.imageUrl} alt={hubMeta.title} style="width:58px;height:58px;border-radius:10px;object-fit:cover;flex-shrink:0;" />
          {/if}
          <div style="min-width:0;flex:1;">
            <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{hubMeta.title}</div>
            <div style="font-size:12px;color:var(--accent);">{hubMeta.artist}</div>
            <div style="font-size:10.5px;color:var(--muted);margin-top:2px;">Terdeteksi via {hubMeta.via}</div>
          </div>
        </div>
      {/if}

      {#if hubMessage}
        <div style="font-size:12px;color:var(--accent);margin-bottom:10px;">{hubMessage}</div>
      {/if}

      {#if hubEmbedType === 'spotify' && hubSpotify}
        <iframe
          title="Spotify Preview"
          style="border-radius:12px;border:0;margin-bottom:12px;"
          src="https://open.spotify.com/embed/{hubSpotify.type}/{hubSpotify.id}?theme=0"
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        ></iframe>
      {:else if hubEmbedType === 'youtube' && hubVideoId}
        <iframe
          title="YouTube Preview"
          width="100%"
          height="200"
          style="border-radius:12px;border:0;margin-bottom:12px;"
          src="https://www.youtube.com/embed/{hubVideoId}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      {/if}

      {#if hubEmbedType}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="pill-btn spotify" style="width:100%;" disabled={hubSaving} onclick={saveHubToLibrary}>
            {hubSaving ? 'Menyimpan Sampul & Lirik...' : '＋ Simpan Sampul, Lagu & Lirik ke Koleksi'}
          </button>
          {#if hubVideoId}
            <button class="pill-btn ghost" style="width:100%;" onclick={() => runApiDownloader(hubVideoId)}>
              ⬇ Konversi & Unduh MP3 via API
            </button>
          {/if}
        </div>
      {/if}

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button class="pill-btn ghost" onclick={() => (hubModalOpen = false)}>Tutup</button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL API DOWNLOADER -->
{#if dlModalOpen}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (dlModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:19px;font-weight:800;margin-bottom:4px;">Download Lagu MP3 (API)</h3>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">
        Tempel tautan video YouTube untuk mengonversi dan mengunduh file MP3.
      </p>

      <div class="field-group">
        <label class="field-label" for="dl-url">Tautan YouTube</label>
        <input id="dl-url" class="field-input" type="url" placeholder="https://youtube.com/watch?v=..." bind:value={dlUrlInput} />
      </div>

      {#if dlLoading}
        <div style="padding:14px;text-align:center;color:var(--accent);font-size:13px;">
          Menghubungi endpoint API... Mohon tunggu.
        </div>
      {/if}

      {#if dlResult}
        <div style="padding:14px;background:rgba(29,185,84,.12);border:1px solid rgba(29,185,84,.35);border-radius:14px;margin-bottom:14px;">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">{dlResult.title}</div>
          <a
            href={dlResult.link}
            target="_blank"
            rel="noopener noreferrer"
            class="pill-btn spotify"
            style="width:100%;text-decoration:none;"
          >⬇ Klik untuk Download MP3</a>
        </div>
      {/if}

      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="pill-btn ghost" style="flex:1;" onclick={() => (dlModalOpen = false)}>Tutup</button>
        <button class="pill-btn spotify" style="flex:1;" disabled={dlLoading} onclick={() => runApiDownloader(dlUrlInput)}>
          Proses API
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL EDIT METADATA & LIRIK LRC -->
{#if editTrackOpen && editingTrack}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (editTrackOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:12px;">Edit Detail & Lirik Sinkron (LRC)</h3>
      <div class="field-group">
        <label class="field-label" for="et-title">Judul Lagu</label>
        <input id="et-title" class="field-input" type="text" bind:value={editTitle} />
      </div>
      <div class="field-group">
        <label class="field-label" for="et-artist">Nama Artis</label>
        <input id="et-artist" class="field-input" type="text" bind:value={editArtist} />
      </div>
      <div class="field-group">
        <label class="field-label" for="et-album">Album / Kategori</label>
        <input id="et-album" class="field-input" type="text" bind:value={editAlbum} />
      </div>
      <div class="field-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <label class="field-label" for="et-lyrics" style="margin:0;">Lirik LRC ([mm:ss.xx] Baris)</label>
          <button
            class="chip"
            style="padding:3px 9px;font-size:11px;"
            onclick={async () => {
              const found = await fetchSyncedLyrics(editTitle, editArtist, editingTrack.dur || 0);
              if (found) { editLyrics = found; showToast('Lirik LRC ditemukan!'); }
              else showToast('Lirik tidak ditemukan di LRCLIB.');
            }}
          >🔍 Auto-Cari LRCLIB</button>
        </div>
        <textarea id="et-lyrics" class="field-textarea" placeholder="[00:12.50] Contoh lirik sinkron..." bind:value={editLyrics}></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="pill-btn ghost" style="flex:1;" onclick={() => (editTrackOpen = false)}>Batal</button>
        <button class="pill-btn spotify" style="flex:1;" onclick={saveEditedTrack}>Simpan Perubahan</button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL PLAYLIST -->
{#if playlistModalOpen}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (playlistModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:6px;">Kelola Playlist Kustom</h3>
      {#if targetTrackForPlaylist}
        <p style="font-size:12.5px;color:var(--accent);margin-bottom:12px;">
          Pilih playlist untuk lagu: <b>{targetTrackForPlaylist.title}</b>
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          {#each playlists as pl (pl.id)}
            <button
              class="chip {pl.trackIds.includes(targetTrackForPlaylist.id) ? 'active' : ''}"
              style="display:flex;justify-content:space-between;width:100%;padding:10px 14px;"
              onclick={() => toggleTrackInPlaylist(pl, targetTrackForPlaylist)}
            >
              <span>📁 {pl.name}</span>
              <span>{pl.trackIds.includes(targetTrackForPlaylist.id) ? '✓ Terdaftar' : '＋ Tambah'}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="field-group">
        <label class="field-label" for="pl-name">Buat Playlist Baru</label>
        <input id="pl-name" class="field-input" type="text" placeholder="Contoh: Fokus Kerja / Senja" bind:value={newPlaylistName} />
      </div>
      <div style="display:flex;gap:8px;">
        <button class="pill-btn ghost" style="flex:1;" onclick={() => { playlistModalOpen = false; targetTrackForPlaylist = null; }}>Tutup</button>
        <button class="pill-btn primary" style="flex:1;" onclick={createPlaylist}>Buat Playlist</button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL EDIT PROFIL & KONFIGURASI API KEYS (TERMASUK SPOTIFY API KEY) -->
{#if editProfileOpen}
  <div class="modal-overlay">
    <div class="modal-backdrop" onclick={() => (editProfileOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h3 style="font-size:18px;font-weight:800;margin-bottom:12px;">Edit Profil & Konfigurasi API</h3>

      <div style="text-align:center;margin-bottom:14px;">
        <label class="pill-btn ghost" style="cursor:pointer;font-size:12px;">
          📷 Pilih Foto Profil
          <input
            type="file"
            accept="image/*"
            style="display:none;"
            onchange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => (emImagePreview = reader.result);
                reader.readAsDataURL(file);
              }
            }}
          />
        </label>
      </div>

      <div class="field-group">
        <label class="field-label" for="pr-name">Nama Tampilan</label>
        <input id="pr-name" class="field-input" type="text" bind:value={emName} />
      </div>
      <div class="field-group">
        <label class="field-label" for="pr-handle">Username</label>
        <input id="pr-handle" class="field-input" type="text" bind:value={emHandle} />
      </div>
      <div class="field-group">
        <label class="field-label" for="pr-bio">Bio Singkat</label>
        <input id="pr-bio" class="field-input" type="text" bind:value={emBio} />
      </div>

      <div style="margin:18px 0 8px;font-size:12px;font-weight:800;color:#1DB954;text-transform:uppercase;">
        Spotify Web API (Deteksi Sampul HD, Judul & Artis)
      </div>
      <div class="field-group">
        <label class="field-label" for="api-sp-id">Spotify Client ID</label>
        <input id="api-sp-id" class="field-input" type="text" placeholder="Masukkan Client ID dari developer.spotify.com" bind:value={apiConfig.spotifyClientId} />
      </div>
      <div class="field-group">
        <label class="field-label" for="api-sp-sec">Spotify Client Secret</label>
        <input id="api-sp-sec" class="field-input" type="password" placeholder="Masukkan Client Secret Spotify" bind:value={apiConfig.spotifyClientSecret} />
      </div>

      <div style="margin:14px 0 8px;font-size:12px;font-weight:800;color:var(--accent);text-transform:uppercase;">
        API Tambahan (YouTube & Downloader)
      </div>
      <div class="field-group">
        <label class="field-label" for="api-rapid">RapidAPI Key (youtube-mp36)</label>
        <input id="api-rapid" class="field-input" type="text" bind:value={apiConfig.rapidApiKey} />
      </div>
      <div class="field-group">
        <label class="field-label" for="api-yt">YouTube Data API v3 Key (Opsional)</label>
        <input id="api-yt" class="field-input" type="text" placeholder="AIzaSy..." bind:value={apiConfig.ytApiKey} />
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="pill-btn ghost" style="flex:1;" onclick={() => (editProfileOpen = false)}>Batal</button>
        <button class="pill-btn spotify" style="flex:1;" onclick={saveProfileAndApi}>Simpan Pengaturan</button>
      </div>
    </div>
  </div>
{/if}

{#if toastMsg}
  <div class="toast">{toastMsg}</div>
{/if}
