<script>
  import { extractYouTubeId, rapidDownloadMp3 } from '#lib/api/services.js';
  import { appStore } from '#lib/stores/library.svelte.js';

  let urlInput = $state('');
  let loading = $state(false);
  let result = $state(null);

  $effect(() => {
    if (appStore.dlModalOpen && appStore.dlPrefillUrl) {
      urlInput = appStore.dlPrefillUrl;
      appStore.dlPrefillUrl = '';
    }
  });

  async function runDownloader() {
    const videoId = extractYouTubeId(urlInput) || urlInput.trim();
    if (!videoId) return appStore.showToast('Masukkan tautan YouTube yang valid.');

    loading = true;
    result = null;
    const res = await rapidDownloadMp3(videoId);
    loading = false;

    if (res.ok) {
      result = res;
      appStore.showToast('Tautan unduhan MP3 siap.');
    } else {
      appStore.showToast(`Gagal: ${res.msg}`);
    }
  }
</script>

{#if appStore.dlModalOpen}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dl-modal-title">
    <div class="modal-backdrop" onclick={() => (appStore.dlModalOpen = false)} role="presentation"></div>
    <div class="modal-card">
      <h2 id="dl-modal-title" class="modal-title">Download Lagu MP3 (API)</h2>
      <p class="modal-desc">
        Tempel tautan video YouTube untuk mengonversi dan mengunduh file MP3 menggunakan RapidAPI Key milikmu.
      </p>

      <div class="field-group">
        <label class="field-label" for="dl-url">Tautan YouTube</label>
        <input
          id="dl-url"
          class="field-input"
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          bind:value={urlInput}
        />
      </div>

      {#if loading}
        <p class="text-accent text-sm status-center" role="status">
          Menghubungi endpoint API... Mohon tunggu.
        </p>
      {/if}

      {#if result}
        <div class="success-box">
          <div class="fw-bold text-sm">{result.title}</div>
          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            class="pill-btn spotify full-w link-btn"
          >
            Klik untuk Download MP3
          </a>
        </div>
      {/if}

      <div class="modal-actions-row">
        <button type="button" class="pill-btn ghost flex-1" onclick={() => (appStore.dlModalOpen = false)}>
          Tutup
        </button>
        <button type="button" class="pill-btn spotify flex-1" disabled={loading} onclick={runDownloader}>
          Proses API
        </button>
      </div>
    </div>
  </div>
{/if}
