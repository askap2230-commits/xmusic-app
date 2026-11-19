<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';
</script>

<aside class="sidebar" aria-label="Navigasi utama">
  <nav class="panel side-nav" aria-label="Menu aplikasi">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <Icon name="music" size={16} />
      </span>
      <span class="brand-name">nys Xmusic</span>
      <span class="brand-badge">v3</span>
    </div>

    <div class="nav-list">
      <button
        type="button"
        class="nav-item"
        class:active={appStore.view === 'home'}
        aria-current={appStore.view === 'home' ? 'page' : undefined}
        onclick={() => (appStore.view = 'home')}
      >
        <Icon name="home" size={18} />
        <span>Beranda</span>
      </button>

      <button
        type="button"
        class="nav-item"
        class:active={appStore.view === 'search'}
        aria-current={appStore.view === 'search' ? 'page' : undefined}
        onclick={() => (appStore.view = 'search')}
      >
        <Icon name="search" size={18} />
        <span>Cari Musik</span>
      </button>

      <button
        type="button"
        class="nav-item"
        class:active={appStore.view === 'library'}
        aria-current={appStore.view === 'library' ? 'page' : undefined}
        onclick={() => (appStore.view = 'library')}
      >
        <Icon name="library" size={18} />
        <span>Perpustakaan ({appStore.localTracks.length})</span>
      </button>

      <button
        type="button"
        class="nav-item"
        class:active={appStore.view === 'eq'}
        aria-current={appStore.view === 'eq' ? 'page' : undefined}
        onclick={() => (appStore.view = 'eq')}
      >
        <Icon name="eq" size={18} />
        <span>Equalizer & Audio</span>
      </button>

      <button
        type="button"
        class="nav-item nav-item-accent"
        onclick={() => appStore.openDownloaderWithUrl()}
      >
        <Icon name="download" size={18} />
        <span>API Downloader</span>
      </button>

      <button
        type="button"
        class="nav-item"
        onclick={() => (appStore.hubModalOpen = true)}
      >
        <Icon name="link" size={18} />
        <span>Hub Spotify & YT</span>
      </button>
    </div>
  </nav>

  <section class="panel side-lib" aria-label="Koleksi cepat">
    <div class="lib-head">
      <button type="button" class="lib-title-btn" onclick={() => (appStore.view = 'library')}>
        Koleksi Cepat
      </button>
      <div class="row-gap-xs">
        <button
          type="button"
          class="icon-btn icon-btn-sm"
          aria-label="Buat playlist baru"
          title="Buat Playlist"
          onclick={() => (appStore.playlistModalOpen = true)}
        >
          <Icon name="folder" size={16} />
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-sm"
          aria-label="Unggah MP3 atau URL"
          title="Upload MP3 / URL"
          onclick={() => (appStore.uploadModalOpen = true)}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>

    <ul class="lib-list">
      {#each appStore.localTracks.slice(0, 14) as track (track.id)}
        <li>
          <button
            type="button"
            class="lib-item"
            class:playing={engine.current?.id === track.id}
            onclick={() => {
              engine.playTrack(track, appStore.allTracks);
              appStore.openTrackModal(track, false);
            }}
          >
            <span
              class="lib-thumb"
              style={track.imageUrl
                ? `background-image:url(${track.imageUrl})`
                : `background:linear-gradient(135deg,${track.c1 || '#3b82f6'},${track.c2 || '#172554'})`}
            >
              {#if !track.imageUrl}
                <span class="thumb-initial">{getTrackInitial(track.title)}</span>
              {/if}
            </span>
            <span class="lib-info">
              <span class="lib-name">{track.title}</span>
              <span class="lib-sub">{track.artist}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="lib-empty">
          Belum ada lagu lokal. Klik tombol tambah untuk mengunggah MP3 atau buat lagu demo synth.
        </li>
      {/each}
    </ul>
  </section>
</aside>
