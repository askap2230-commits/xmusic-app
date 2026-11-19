<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { Button, Card } from 'konsta/svelte';
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

  function handleCoverActivate() {
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

<article class="xmusic-flip-scene">
  <div class="xmusic-flip-inner" class:is-flipped={isFlipped}>
    <!-- FRONT FACE -->
    <div class="xmusic-flip-face">
      <Card
        margin="m-0"
        contentWrapPadding="p-2.5"
        class="border {isPlaying
          ? 'border-[#007aff] dark:border-[#0a84ff]'
          : 'border-black/10 dark:border-white/10'} transition-colors"
      >
        <div class="relative">
          <button
            type="button"
            class="block w-full overflow-hidden rounded-xl text-left"
            onclick={handleCoverActivate}
            aria-label="Putar {track.title} oleh {track.artist}"
          >
            <span
              class="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl"
              style={track.imageUrl
                ? ''
                : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
            >
              {#if track.imageUrl}
                <img
                  src={track.imageUrl}
                  alt="Sampul {track.title}"
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                <span class="text-4xl font-extrabold text-white/95">
                  {getTrackInitial(track.title)}
                </span>
              {/if}
              <span class="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                {track.dur ? formatTime(track.dur) : track.album || 'Stream'}
              </span>
            </span>
          </button>

          <div class="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/75 text-white hover:bg-black"
              aria-label="Balik kartu lirik {track.title}"
              onclick={() => appStore.toggleGridFlip(track)}
            >
              <Icon name="flip" size={14} />
            </button>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/75 hover:bg-black {isLiked
                ? 'text-[#ff375f]'
                : 'text-white'}"
              aria-label={isLiked ? `Hapus ${track.title} dari favorit` : `Tambahkan ${track.title} ke favorit`}
              aria-pressed={isLiked}
              onclick={() => appStore.toggleLike(track)}
            >
              <Icon name={isLiked ? 'heart-filled' : 'heart'} size={14} />
            </button>
            {#if track.source === 'local'}
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full bg-black/75 text-white hover:bg-black"
                aria-label="Edit detail {track.title}"
                onclick={() => appStore.openEditTrack(track)}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full bg-black/75 text-white hover:bg-black"
                aria-label="Hapus {track.title}"
                onclick={() => appStore.removeTrack(track)}
              >
                <Icon name="trash" size={14} />
              </button>
            {/if}
          </div>
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-semibold text-zinc-950 dark:text-white">{track.title}</h3>
            <p class="truncate text-xs text-zinc-600 dark:text-zinc-300">{track.artist}</p>
          </div>
          <button
            type="button"
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-950 text-white active:scale-95 dark:bg-white dark:text-black"
            aria-label={isPlaying ? `Jeda ${track.title}` : `Putar ${track.title}`}
            onclick={() => engine.playTrack(track, appStore.allTracks)}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
          </button>
        </div>
      </Card>
    </div>

    <!-- BACK FACE (SYNCED LYRICS) -->
    <div class="xmusic-flip-face xmusic-flip-back" aria-hidden={!isFlipped}>
      <Card
        margin="m-0"
        contentWrapPadding="p-3"
        class="flex h-full flex-col border border-[#007aff] dark:border-[#0a84ff]"
      >
        <div class="mb-2 flex items-center justify-between gap-1">
          <div class="min-w-0">
            <div class="truncate text-xs font-bold text-zinc-950 dark:text-white">{track.title}</div>
            <div class="truncate text-[11px] text-[#007aff] dark:text-[#64d2ff]">{track.artist}</div>
          </div>
          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-zinc-900 dark:bg-white/10 dark:text-white"
            aria-label="Kembalikan kartu {track.title}"
            onclick={() => appStore.toggleGridFlip(track)}
          >
            <Icon name="flip" size={14} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto text-xs leading-relaxed">
          {#if parsedLyrics.length > 0}
            {#each parsedLyrics as line, idx}
              <div
                class="rounded-md px-1.5 py-0.5 {idx === activeLyricIdx
                  ? 'bg-[#007aff]/15 font-bold text-zinc-950 dark:bg-[#0a84ff]/25 dark:text-white'
                  : 'text-zinc-600 dark:text-zinc-300'}"
              >
                {line.text}
              </div>
            {/each}
          {:else}
            <p class="mt-6 text-center text-xs text-zinc-600 dark:text-zinc-300">
              {appStore.fetchingLyrics
                ? 'Mencari lirik...'
                : 'Ketuk "Buka Penuh" untuk mencari atau menulis lirik.'}
            </p>
          {/if}
        </div>

        <div class="mt-2">
          <Button tonal rounded small onclick={() => appStore.openTrackModal(track, true)}>
            Buka Penuh
          </Button>
        </div>
      </Card>
    </div>
  </div>
</article>
