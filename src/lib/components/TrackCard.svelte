<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Button, Card } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { parseLrcLyrics } from '#lib/api/services.ts';
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { Track } from '#lib/types/music.ts';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from './Icon.svelte';

  let { track }: { track: Track } = $props();
  let lastTapAt = 0;
  let imgFailed = $state<boolean>(false);

  $effect(() => {
    void track.imageUrl;
    imgFailed = false;
  });

  const isPlaying = $derived(engine.current?.id === track.id && engine.playing);
  const isFlipped = $derived(appStore.flippedGridIds.has(track.id));
  const isLiked = $derived(appStore.isLiked(track.id));
  const parsedLyrics = $derived(isFlipped ? parseLrcLyrics(track.lyrics || '') : []);
  const activeLyricIdx = $derived(
    isFlipped && engine.current?.id === track.id
      ? findActiveLyricIndex(parsedLyrics, engine.position)
      : -1
  );

  function handleCoverActivate(): void {
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

    if (!isPlaying || engine.audioResolveFailed) {
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
        contentWrapPadding="p-2.5"
        class="!m-0 border {isPlaying
          ? 'border-[#007aff] dark:border-[#0a84ff]'
          : 'border-black/10 dark:border-white/10'} transition-colors"
      >
        <div class="relative">
          <button
            type="button"
            class="block w-full overflow-hidden rounded-xl text-left"
            onpointerdown={() => engine.prewarmTrack(track)}
            onclick={handleCoverActivate}
            aria-label="Putar {track.title} oleh {track.artist}"
          >
            <span
              class="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl"
              style={track.imageUrl && !imgFailed
                ? ''
                : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
            >
              {#if track.imageUrl && !imgFailed}
                <img
                  src={track.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                  onerror={() => (imgFailed = true)}
                />
              {:else}
                <span class="text-4xl font-extrabold text-white/95">
                  {getTrackInitial(track.title)}
                </span>
              {/if}
              <span
                class="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide {track.isPreview
                  ? 'bg-[#ff9f0a]/90 text-black'
                  : 'bg-[#248a3d]/90 text-white'}"
              >
                {track.isPreview ? i18n.t('common.preview30s') : i18n.t('common.full')}
              </span>
              <span
                class="absolute bottom-2 left-2 truncate rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white {track.source === 'local'
                  ? 'max-w-[calc(100%-88px)]'
                  : 'max-w-[calc(100%-16px)]'}"
              >
                {track.releaseYear ? `${track.releaseYear} • ` : ''}{track.dur ? formatTime(track.dur) : track.album || 'Stream'}
              </span>
            </span>
          </button>

          <div class="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-95"
              aria-label="Balik kartu lirik {track.title}"
              onclick={() => appStore.toggleGridFlip(track)}
            >
              <Icon name="flip" size={14} />
            </button>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/70 active:scale-95 {isLiked
                ? 'text-[#ff375f]'
                : 'text-white'}"
              aria-label={isLiked ? `Hapus ${track.title} dari favorit` : `Tambahkan ${track.title} ke favorit`}
              aria-pressed={isLiked}
              onclick={() => appStore.toggleLike(track)}
            >
              <Icon name={isLiked ? 'heart-filled' : 'heart'} size={14} />
            </button>
          </div>

          {#if track.source === 'local'}
            <div class="absolute right-2 bottom-2 flex gap-1.5">
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-95"
                aria-label="Edit detail {track.title}"
                onclick={() => appStore.openEditTrack(track)}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white active:scale-95"
                aria-label="Hapus {track.title}"
                onclick={() => appStore.removeTrack(track)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          {/if}
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-semibold text-black dark:text-white">{track.title}</h3>
            <p class="truncate text-xs text-black/60 dark:text-white/60">{track.artist}</p>
          </div>
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white active:scale-95 dark:bg-white dark:text-black"
            aria-label={isPlaying ? `Jeda ${track.title}` : `Putar ${track.title}`}
            onpointerdown={() => engine.prewarmTrack(track)}
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
        contentWrap={false}
        class="!m-0 flex h-full min-h-0 flex-col overflow-hidden border border-[#007aff] dark:border-[#0a84ff]"
      >
        <div class="flex h-full min-h-0 flex-col p-3">
        <div class="mb-2 flex shrink-0 items-center justify-between gap-1">
          <div class="min-w-0">
            <div class="truncate text-xs font-bold text-black dark:text-white">{track.title}</div>
            <div class="truncate text-[11px] text-[#007aff] dark:text-[#64d2ff]">{track.artist}</div>
          </div>
          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-black dark:bg-white/10 dark:text-white"
            aria-label="Kembalikan kartu {track.title}"
            onclick={() => appStore.toggleGridFlip(track)}
          >
            <Icon name="flip" size={14} />
          </button>
        </div>

        <div class="xmusic-vscroll min-h-0 flex-1 text-xs leading-relaxed">
          {#if parsedLyrics.length > 0}
            {#each parsedLyrics as line, idx}
              <div
                class="rounded-md px-1.5 py-0.5 {idx === activeLyricIdx
                  ? 'bg-[#007aff]/15 font-bold text-black dark:bg-[#0a84ff]/25 dark:text-white'
                  : 'text-black/60 dark:text-white/65'}"
              >
                {line.text}
              </div>
            {/each}
          {:else}
            <p class="mt-6 text-center text-xs text-black/60 dark:text-white/65">
              {appStore.fetchingLyrics
                ? i18n.t('player.fetchingLyrics')
                : i18n.t('player.noLyrics')}
            </p>
          {/if}
        </div>

        <div class="mt-2">
          <Button tonal rounded small onclick={() => appStore.openTrackModal(track, true)}>
            {i18n.t('player.openFull')}
          </Button>
        </div>
        </div>
      </Card>
    </div>
  </div>
</article>
