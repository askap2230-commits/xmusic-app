<script>
  import { fetchSyncedLyrics } from '#lib/api/services.js';
  import { appStore } from '#lib/stores/library.svelte.js';

  let title = $state('');
  let artist = $state('');
  let album = $state('');
  let lyrics = $state('');
  let searchingLrc = $state(false);

  $effect(() => {
    if (appStore.editTrackOpen && appStore.editingTrack) {
      title = appStore.editingTrack.title || '';
      artist = appStore.editingTrack.artist || '';
      album = appStore.editingTrack.album || '';
      lyrics = appStore.editingTrack.lyrics || '';
    }
  });

  async function autoFindLrc() {
    if (!appStore.editingTrack || searchingLrc) return;
    searchingLrc = true;
    const found = await fetchSyncedLyrics(title, artist, appStore.editingTrack.dur || 0);
    searchingLrc = false;
    if (found) {
      lyrics = found;
      appStore.showToast('Lirik LRC ditemukan.');
    } else {
      appStore.showToast('Lirik tidak ditemukan di LRCLIB.');
    }
  }

  function handleSave(event) {
    event.preventDefault();
    appStore.saveEditedTrack({ title, artist, album, lyrics });
  }
</script>

{#if appStore.editTrackOpen && appStore.editingTrack}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-track-title">
    <div class="modal-backdrop" onclick={() => (appStore.editTrackOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h2 id="edit-track-title" class="modal-title">Edit Detail & Lirik Sinkron (LRC)</h2>
      <form onsubmit={handleSave}>
        <div class="field-group">
          <label class="field-label" for="et-title">Judul Lagu</label>
          <input id="et-title" class="field-input" type="text" required bind:value={title} />
        </div>
        <div class="field-group">
          <label class="field-label" for="et-artist">Nama Artis</label>
          <input id="et-artist" class="field-input" type="text" bind:value={artist} />
        </div>
        <div class="field-group">
          <label class="field-label" for="et-album">Album / Kategori</label>
          <input id="et-album" class="field-input" type="text" bind:value={album} />
        </div>
        <div class="field-group">
          <div class="field-label-row">
            <label class="field-label" for="et-lyrics">Lirik LRC ([mm:ss.xx] Baris)</label>
            <button type="button" class="chip chip-sm" disabled={searchingLrc} onclick={autoFindLrc}>
              {searchingLrc ? 'Mencari...' : 'Auto-Cari LRCLIB'}
            </button>
          </div>
          <textarea
            id="et-lyrics"
            class="field-textarea"
            placeholder="[00:12.50] Contoh lirik sinkron..."
            bind:value={lyrics}
          ></textarea>
        </div>

        <div class="modal-actions-row">
          <button type="button" class="pill-btn ghost flex-1" onclick={() => (appStore.editTrackOpen = false)}>
            Batal
          </button>
          <button type="submit" class="pill-btn spotify flex-1">Simpan Perubahan</button>
        </div>
      </form>
    </div>
  </div>
{/if}
