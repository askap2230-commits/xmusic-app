<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { parseLrcLyrics } from '#lib/api/services.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';

  let { track } = $props();
  let lastTapAt = 0;

  const isPlaying = $derived(engine.current?.id === track.id && engine.playing);
  const isFlipped = $derived(appStore.flippedGridIds.has(track.id));
  const isLiked = $derived(appStore.isLiked(track.id));
  const parsedLyrics = $derived(isFlipped ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    isFlipped && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );

  function handleFrontActivate() {
    const now = Date.now();
    if (now - lastTapAt < 320) {
      lastTapAt = 0;
      if (engine.current?.id !== track.id) {
        engine.playTrack(track, appStore.allTracks);
      }
      appStore.toggleGridFlip(track);
      return;
    }
    lastTapAt = now;

    if (!isPlaying) {
      engine.playTrack(track, appStore.allTracks);
    }
    appStore.openTrackModal(track, false);
  }
</script>

<article class="grid-flip-card">
  <div class="grid-flip-inner" class:is-flipped={isFlipped}>
    <!-- FRONT FACE -->
    <div class="card flip-face" class:playing={isPlaying}>
      <button
        type="button"
        class="card-cover-btn"
        onclick={handleFrontActivate}
        aria-label="Putar {track.title} oleh {track.artist}"
      >
        <span
          class="album-art"
          style={track.imageUrl
            ? ''
            : `background: linear-gradient(135deg, ${track.c1 || '#3b82f6'}, ${track.c2 || '#172554'})`}
        >
          {#if track.imageUrl}
            <img src={track.imageUrl} alt="Sampul {track.title}" loading="lazy" decoding="async" />
          {:else}
            <span class="local-cover-text">{getTrackInitial(track.title)}</span>
          {/if}
          <span class="art-meta">{track.dur ? formatTime(track.dur) : track.album || 'Stream'}</span>
        </span>
      </button>

      <div class="card-actions-top">
        <button
          type="button"
          class="card-mini-btn"
          aria-label="Balik kartu untuk lirik {track.title}"
          title="Balik Kartu (Lirik)"
          onclick={() => appStore.toggleGridFlip(track)}
        >
          <Icon name="flip" size={14} />
        </button>

        <button
          type="button"
          class="card-mini-btn"
          class:liked={isLiked}
          aria-label={isLiked ? `Hapus ${track.title} dari favorit` : `Tambahkan ${track.title} ke favorit`}
          aria-pressed={isLiked}
          onclick={() => appStore.toggleLike(track)}
        >
          <Icon name={isLiked ? 'heart-filled' : 'heart'} size={14} />
        </button>

        {#if track.source === 'local'}
          <button
            type="button"
            class="card-mini-btn"
            aria-label="Edit detail dan lirik {track.title}"
            title="Edit Lagu / Lirik"
            onclick={() => appStore.openEditTrack(track)}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            type="button"
            class="card-mini-btn"
            aria-label="Hapus {track.title}"
            title="Hapus"
            onclick={() => appStore.removeTrack(track)}
          >
            <Icon name="trash" size={14} />
          </button>
        {/if}
      </div>

      <div class="card-footer">
        <div class="card-meta">
          <h3 class="card-title">{track.title}</h3>
          <p class="card-artist">{track.artist}</p>
        </div>

        <button
          type="button"
          class="card-play"
          aria-label={isPlaying ? `Jeda ${track.title}` : `Putar ${track.title}`}
          onclick={() => engine.playTrack(track, appStore.allTracks)}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
        </button>
      </div>
    </div>

    <!-- BACK FACE (SYNCED LYRICS) -->
    <div class="grid-flip-back" aria-hidden={!isFlipped}>
      <div class="flip-back-head">
        <div class="min-w-0">
          <div class="truncate fw-bold text-sm">{track.title}</div>
          <div class="text-accent text-xs truncate">{track.artist}</div>
        </div>
        <button
          type="button"
          class="card-mini-btn"
          aria-label="Kembalikan kartu {track.title}"
          onclick={() => appStore.toggleGridFlip(track)}
        >
          <Icon name="flip" size={14} />
        </button>
      </div>

      <div class="flip-back-lyrics">
        {#if parsedLyrics.length > 0}
          {#each parsedLyrics as line, idx}
            <div class="mini-lyric-line" class:active={idx === activeLyricIdx}>
              {line.text}
            </div>
          {/each}
        {:else}
          <p class="flip-back-empty">
            {appStore.fetchingLyrics
              ? 'Mencari lirik...'
              : 'Ketuk "Buka Penuh" untuk mencari atau menulis lirik.'}
          </p>
        {/if}
      </div>

      <button
        type="button"
        class="chip chip-full"
        onclick={() => appStore.openTrackModal(track, true)}
      >
        Buka Penuh
      </button>
    </div>
  </div>
</article>
