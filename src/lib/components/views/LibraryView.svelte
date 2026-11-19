<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';
</script>

<section class="section" aria-labelledby="library-heading">
  <div class="section-head">
    <h1 id="library-heading" class="view-title">Perpustakaan & Playlist Kamu</h1>
    <div class="row-gap-sm">
      <button
        type="button"
        class="pill-btn ghost pill-btn-sm"
        onclick={() => (appStore.playlistModalOpen = true)}
      >
        <Icon name="folder" size={15} />
        <span>Buat Playlist</span>
      </button>
      <button
        type="button"
        class="pill-btn primary pill-btn-sm"
        onclick={() => (appStore.uploadModalOpen = true)}
      >
        <Icon name="plus" size={15} />
        <span>Upload Lagu</span>
      </button>
    </div>
  </div>

  <div class="chip-row" role="tablist" aria-label="Filter perpustakaan">
    <button
      type="button"
      role="tab"
      aria-selected={appStore.libFilter === 'local'}
      class="chip"
      class:active={appStore.libFilter === 'local'}
      onclick={() => (appStore.libFilter = 'local')}
    >
      Lagu Offline ({appStore.localTracks.length})
    </button>

    <button
      type="button"
      role="tab"
      aria-selected={appStore.libFilter === 'liked'}
      class="chip"
      class:active={appStore.libFilter === 'liked'}
      onclick={() => (appStore.libFilter = 'liked')}
    >
      Favorit ({appStore.likedIds.length})
    </button>

    <button
      type="button"
      role="tab"
      aria-selected={appStore.libFilter === 'history'}
      class="chip"
      class:active={appStore.libFilter === 'history'}
      onclick={() => (appStore.libFilter = 'history')}
    >
      Riwayat Putar ({engine.history.length})
    </button>

    {#each appStore.playlists as pl (pl.id)}
      <button
        type="button"
        role="tab"
        aria-selected={appStore.libFilter === pl.id}
        class="chip"
        class:active={appStore.libFilter === pl.id}
        onclick={() => (appStore.libFilter = pl.id)}
      >
        {pl.name} ({pl.trackIds.length})
      </button>
    {/each}
  </div>

  {#if appStore.filteredLibrary.length > 0}
    <div class="grid">
      {#each appStore.filteredLibrary as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <div class="surface-card empty-state">
      <h2>Belum ada lagu di kategori ini</h2>
      <p class="text-muted text-sm">
        Upload file MP3/M4A/WAV lokal dari perangkatmu atau buat lagu demo synthwave secara instan.
      </p>
      <div class="empty-actions">
        <button type="button" class="pill-btn primary" onclick={() => (appStore.uploadModalOpen = true)}>
          <Icon name="upload" size={16} />
          <span>Upload File Audio</span>
        </button>
        <button type="button" class="pill-btn spotify" onclick={() => appStore.createBuiltInSynthDemo()}>
          <Icon name="spark" size={16} />
          <span>Buat Lagu Demo Offline</span>
        </button>
      </div>
    </div>
  {/if}
</section>
