<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';
</script>

<aside class="panel nowplaying" aria-label="Antrean putar dan lirik">
  <div class="drawer-head">
    <div class="row-gap-xs" role="tablist" aria-label="Panel kanan">
      <button
        type="button"
        role="tab"
        aria-selected={appStore.npTab === 'queue'}
        class="chip"
        class:active={appStore.npTab === 'queue'}
        onclick={() => (appStore.npTab = 'queue')}
      >
        Antrean ({engine.queue.length})
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={appStore.npTab === 'lyrics'}
        class="chip"
        class:active={appStore.npTab === 'lyrics'}
        onclick={() => (appStore.npTab = 'lyrics')}
      >
        Lirik Sinkron
      </button>
    </div>

    <button
      type="button"
      class="icon-btn icon-btn-sm"
      aria-label="Tutup panel antrean"
      onclick={() => (appStore.npDrawerOpen = false)}
    >
      <Icon name="close" size={16} />
    </button>
  </div>

  {#if appStore.npTab === 'queue'}
    <div class="drawer-subhead">
      <span>Daftar Putar Berikutnya</span>
      {#if engine.queue.length > 0}
        <button type="button" class="text-btn" onclick={() => (engine.queue = [])}>
          Bersihkan
        </button>
      {/if}
    </div>

    <ul class="lib-list">
      {#each engine.queue as qTrack, idx (`${qTrack.id}_${idx}`)}
        <li class="queue-row">
          <button
            type="button"
            class="lib-item"
            class:playing={engine.current?.id === qTrack.id}
            onclick={() => engine.playTrack(qTrack)}
          >
            <span
              class="lib-thumb"
              style={qTrack.imageUrl
                ? `background-image:url(${qTrack.imageUrl})`
                : `background:linear-gradient(135deg,${qTrack.c1 || '#3b82f6'},${qTrack.c2 || '#172554'})`}
            >
              {#if !qTrack.imageUrl}
                <span class="thumb-initial">{getTrackInitial(qTrack.title)}</span>
              {/if}
            </span>
            <span class="lib-info">
              <span class="lib-name">{qTrack.title}</span>
              <span class="lib-sub">{qTrack.artist}</span>
            </span>
          </button>

          <button
            type="button"
            class="icon-btn icon-btn-sm"
            aria-label="Hapus {qTrack.title} dari antrean"
            onclick={() => {
              engine.queue = engine.queue.filter((_, i) => i !== idx);
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </li>
      {:else}
        <li class="lib-empty">Antrean kosong. Pilih lagu untuk mulai memutar.</li>
      {/each}
    </ul>
  {:else if engine.current}
    <div class="drawer-lyrics-head">
      <div class="min-w-0">
        <div class="truncate fw-bold">{engine.current.title}</div>
        <div class="text-muted text-sm truncate">{engine.current.artist}</div>
      </div>
      <button type="button" class="chip" onclick={() => appStore.openEditTrack(engine.current)}>
        <Icon name="edit" size={13} />
        <span>Edit</span>
      </button>
    </div>

    <div class="drawer-lyrics-box">
      {engine.current.lyrics ||
        'Belum ada lirik. Ketuk 2x kartu lagu untuk mencari lirik otomatis dari LRCLIB atau tempel manual.'}
    </div>
  {:else}
    <p class="lib-empty">Putar sebuah lagu untuk melihat liriknya.</p>
  {/if}
</aside>
