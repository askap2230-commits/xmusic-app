<script>
  import {
    extractSpotifyEmbed,
    extractYouTubeId,
    fetchOEmbedMeta,
    fetchSpotifyMetadata,
    fetchSyncedLyrics
  } from '#lib/api/services.js';
  import { saveLocalTrack } from '#lib/db/storage.js';
  import { appStore } from '#lib/stores/library.svelte.js';

  let hubUrlInput = $state('');
  let hubEmbedType = $state(null);
  let hubVideoId = $state('');
  let hubSpotify = $state(null);
  let hubMeta = $state(null);
  let hubDetecting = $state(false);
  let hubMessage = $state('');
  let hubSaving = $state(false);

  async function processHubLink() {
    const url = hubUrlInput.trim();
    if (!url) return appStore.showToast('Masukkan tautan Spotify atau YouTube.');

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
        hubMessage =
          'Pemutar Spotify dimuat. Isi Spotify Client ID & Secret di Pengaturan API untuk deteksi metadata penuh.';
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

    const isSpotify = hubEmbedType === 'spotify';
    let meta = hubMeta;
    if (!meta && isSpotify && hubSpotify) {
      meta = await fetchSpotifyMetadata(hubSpotify.type, hubSpotify.id, url);
    }

    const title = meta?.title || (isSpotify ? `Spotify ${hubSpotify.type}` : 'YouTube Music');
    const artist = meta?.artist || (isSpotify ? 'Spotify' : 'YouTube');
    const imageUrl =
      meta?.imageUrl || (hubVideoId ? `https://img.youtube.com/vi/${hubVideoId}/hqdefault.jpg` : null);

    const syncedLyrics = await fetchSyncedLyrics(title, artist, meta?.dur || 0);

    const track = {
      id: `embed_${Date.now()}`,
      title,
      artist,
      album: meta?.album || (isSpotify ? 'Spotify Hub' : 'YouTube Hub'),
      imageUrl,
      c1: isSpotify ? '#1DB954' : '#dc2626',
      c2: '#0a0b0f',
      dur: meta?.dur || 0,
      source: 'local',
      createdAt: Date.now(),
      lyrics: syncedLyrics || '',
      videoId: hubVideoId || undefined,
      spotifyId: hubSpotify?.id || undefined,
      spotifyType: hubSpotify?.type || undefined
    };

    await saveLocalTrack(track);
    await appStore.refreshLocalTracks();
    hubSaving = false;
    appStore.hubModalOpen = false;
    appStore.view = 'library';
    appStore.openTrackModal(track, false);
    appStore.showToast(
      syncedLyrics
        ? 'Lagu, sampul, dan lirik sinkron berhasil disimpan.'
        : 'Lagu dan sampul berhasil disimpan ke Koleksi.'
    );
  }
</script>

{#if appStore.hubModalOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="hub-modal-title">
    <div class="modal-backdrop" onclick={() => (appStore.hubModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h2 id="hub-modal-title" class="modal-title">Hub Musik (Spotify API & YouTube)</h2>
      <p class="modal-desc">
        Tempel link Spotify atau YouTube untuk mendeteksi sampul HD, judul lagu, artis, dan lirik sinkron otomatis.
      </p>

      <div class="field-group">
        <label class="field-label" for="hub-url">Tautan Spotify / YouTube</label>
        <input
          id="hub-url"
          class="field-input"
          type="url"
          placeholder="https://open.spotify.com/track/... atau https://youtu.be/..."
          bind:value={hubUrlInput}
        />
      </div>

      <div class="modal-actions-row">
        <button type="button" class="pill-btn primary flex-1" disabled={hubDetecting} onclick={processHubLink}>
          {hubDetecting ? 'Mendeteksi...' : 'Deteksi & Muat'}
        </button>
        <button
          type="button"
          class="pill-btn ghost"
          onclick={() => {
            appStore.hubModalOpen = false;
            appStore.editProfileOpen = true;
          }}
        >
          API Key
        </button>
      </div>

      {#if hubMeta}
        <div class="meta-preview-card">
          {#if hubMeta.imageUrl}
            <img src={hubMeta.imageUrl} alt="Sampul {hubMeta.title}" class="meta-preview-img" />
          {/if}
          <div class="min-w-0 flex-1">
            <div class="truncate fw-bold text-sm">{hubMeta.title}</div>
            <div class="text-accent text-xs truncate">{hubMeta.artist}</div>
            <div class="text-muted text-xs">Terdeteksi via {hubMeta.via}</div>
          </div>
        </div>
      {/if}

      {#if hubMessage}
        <p class="text-accent text-xs status-note" role="status">{hubMessage}</p>
      {/if}

      {#if hubEmbedType === 'spotify' && hubSpotify}
        <iframe
          title="Spotify Preview"
          class="embed-frame"
          src="https://open.spotify.com/embed/{hubSpotify.type}/{hubSpotify.id}?theme=0"
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        ></iframe>
      {:else if hubEmbedType === 'youtube' && hubVideoId}
        <iframe
          title="YouTube Preview"
          class="embed-frame"
          width="100%"
          height="200"
          src="https://www.youtube.com/embed/{hubVideoId}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      {/if}

      {#if hubEmbedType}
        <div class="stack-sm">
          <button type="button" class="pill-btn spotify full-w" disabled={hubSaving} onclick={saveHubToLibrary}>
            {hubSaving ? 'Menyimpan Sampul & Lirik...' : 'Simpan Sampul, Lagu & Lirik ke Koleksi'}
          </button>
          {#if hubVideoId}
            <button
              type="button"
              class="pill-btn ghost full-w"
              onclick={() => {
                appStore.hubModalOpen = false;
                appStore.openDownloaderWithUrl(`https://youtu.be/${hubVideoId}`);
              }}
            >
              Konversi & Unduh MP3 via API
            </button>
          {/if}
        </div>
      {/if}

      <div class="modal-actions-end">
        <button type="button" class="pill-btn ghost" onclick={() => (appStore.hubModalOpen = false)}>
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
