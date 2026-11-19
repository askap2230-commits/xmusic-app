<script>
  import { appStore } from '#lib/stores/library.svelte.js';

  let uploadTab = $state('file');
  let urlInput = $state('');
  let urlTitle = $state('');
  let urlArtist = $state('');
  let pendingCoverFile = $state(null);
  let coverFileName = $state('Belum ada gambar sampul');

  async function onFilesSelected(files) {
    if (!files?.length) return;
    const ok = await appStore.importLocalFiles(files, pendingCoverFile);
    if (ok) {
      pendingCoverFile = null;
      coverFileName = 'Belum ada gambar sampul';
    }
  }

  async function onSubmitUrl(event) {
    event.preventDefault();
    const ok = await appStore.importStreamUrl({
      url: urlInput,
      title: urlTitle,
      artist: urlArtist
    });
    if (ok) {
      urlInput = '';
      urlTitle = '';
      urlArtist = '';
    }
  }
</script>

{#if appStore.uploadModalOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
    <div class="modal-backdrop" onclick={() => (appStore.uploadModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h2 id="upload-modal-title" class="modal-title">Tambah Musik ke Perpustakaan</h2>
      <p class="modal-desc">
        Pilih file audio dari perangkatmu (100% offline) atau tempel URL stream MP3 langsung.
      </p>

      <div class="tab-row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={uploadTab === 'file'}
          class="chip flex-1"
          class:active={uploadTab === 'file'}
          onclick={() => (uploadTab = 'file')}
        >
          File Lokal (MP3/WAV/FLAC)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={uploadTab === 'url'}
          class="chip flex-1"
          class:active={uploadTab === 'url'}
          onclick={() => (uploadTab = 'url')}
        >
          URL Stream
        </button>
      </div>

      {#if uploadTab === 'file'}
        <label class="dropzone">
          <span class="dropzone-title">Pilih File Lagu (Mendukung Banyak File)</span>
          <span class="dropzone-sub">Format: MP3, M4A, WAV, OGG, FLAC, AAC, OPUS</span>
          <input
            type="file"
            accept="audio/*"
            multiple
            class="sr-only"
            onchange={(e) => onFilesSelected(e.currentTarget.files)}
          />
        </label>

        <label class="dropzone dropzone-secondary">
          <span class="text-accent fw-bold text-sm">+ Gambar Sampul Album (Opsional)</span>
          <span class="dropzone-sub">{coverFileName}</span>
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            onchange={(e) => {
              if (e.currentTarget.files?.length) {
                pendingCoverFile = e.currentTarget.files[0];
                coverFileName = pendingCoverFile.name;
              }
            }}
          />
        </label>
      {:else}
        <form onsubmit={onSubmitUrl}>
          <div class="field-group">
            <label class="field-label" for="up-url">URL Audio Langsung (.mp3 / stream)</label>
            <input id="up-url" class="field-input" type="url" required placeholder="https://..." bind:value={urlInput} />
          </div>
          <div class="field-group">
            <label class="field-label" for="up-title">Judul Lagu</label>
            <input id="up-title" class="field-input" type="text" placeholder="Judul lagu" bind:value={urlTitle} />
          </div>
          <div class="field-group">
            <label class="field-label" for="up-artist">Nama Artis</label>
            <input id="up-artist" class="field-input" type="text" placeholder="Nama artis" bind:value={urlArtist} />
          </div>
          <button type="submit" class="pill-btn spotify full-w">Simpan URL ke Perpustakaan</button>
        </form>
      {/if}

      <div class="modal-actions-end">
        <button type="button" class="pill-btn ghost" onclick={() => (appStore.uploadModalOpen = false)}>
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
