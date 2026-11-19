<script>
  import { appStore } from '#lib/stores/library.svelte.js';

  let newName = $state('');

  function handleCreate(event) {
    event.preventDefault();
    if (appStore.createPlaylist(newName)) {
      newName = '';
    }
  }
</script>

{#if appStore.playlistModalOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="playlist-modal-title">
    <div
      class="modal-backdrop"
      onclick={() => {
        appStore.playlistModalOpen = false;
        appStore.targetTrackForPlaylist = null;
      }}
      role="presentation"
    ></div>

    <div class="modal-card">
      <h2 id="playlist-modal-title" class="modal-title">Kelola Playlist Kustom</h2>

      {#if appStore.targetTrackForPlaylist}
        <p class="text-accent text-xs status-note">
          Pilih playlist untuk lagu: <strong>{appStore.targetTrackForPlaylist.title}</strong>
        </p>
        <div class="stack-xs playlist-picker">
          {#each appStore.playlists as pl (pl.id)}
            {@const inPlaylist = pl.trackIds.includes(appStore.targetTrackForPlaylist.id)}
            <button
              type="button"
              class="chip chip-row-btn"
              class:active={inPlaylist}
              aria-pressed={inPlaylist}
              onclick={() => appStore.toggleTrackInPlaylist(pl.id, appStore.targetTrackForPlaylist)}
            >
              <span>{pl.name}</span>
              <span>{inPlaylist ? 'Terdaftar' : '+ Tambah'}</span>
            </button>
          {/each}
        </div>
      {/if}

      <form onsubmit={handleCreate}>
        <div class="field-group">
          <label class="field-label" for="pl-name">Buat Playlist Baru</label>
          <input
            id="pl-name"
            class="field-input"
            type="text"
            placeholder="Contoh: Fokus Kerja / Senja"
            bind:value={newName}
          />
        </div>
        <div class="modal-actions-row">
          <button
            type="button"
            class="pill-btn ghost flex-1"
            onclick={() => {
              appStore.playlistModalOpen = false;
              appStore.targetTrackForPlaylist = null;
            }}
          >
            Tutup
          </button>
          <button type="submit" class="pill-btn primary flex-1">Buat Playlist</button>
        </div>
      </form>
    </div>
  </div>
{/if}
