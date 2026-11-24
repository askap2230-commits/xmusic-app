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
    <!-- FRONT FACE: FULL-CARD COVER OVERLAY -->
    <div class="xmusic-flip-face">
      <Card
        contentWrap={false}
        class="!m-0 overflow-hidden rounded-2xl border {isPlaying
          ? 'border-[#007aff] dark:border-[#0a84ff]'
          : 'border-black/10 dark:border-white/10'} transition-colors"
      >
        <div class="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900">
          <button
            type="button"
            class="block h-full w-full text-left"
            onpointerdown={() => engine.prewarmTrack(track)}
            onclick={handleCoverActivate}
            aria-label="Putar {track.title} oleh {track.artist}"
          >
            <span
              class="xmusic-art-transition relative grid h-full w-full place-items-center overflow-hidden"
              style={track.imageUrl && !imgFailed
                ? ''
                : `background: linear-gradient(155deg, ${track.c1 || '#007aff'}, ${track.c2 || '#18181b'})`}
            >
              {#if track.imageUrl && !imgFailed}
                <img
                  src={track.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover transition-transform duration-500 ease-out {isPlaying
                    ? 'scale-105'
                    : 'scale-100'}"
                  onerror={() => (imgFailed = true)}
                />
              {:else}
                <span class="text-5xl font-extrabold text-white/35">
                  {getTrackInitial(track.title)}
                </span>
              {/if}
            </span>
          </button>

          <!-- Full-card readability gradient overlay -->
          <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/90"
            aria-hidden="true"
          ></div>

          <!-- Top-left Full/30s badge -->
          <span
            class="pointer-events-none absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide {track.isPreview
              ? 'bg-[#ff9f0a]/90 text-black'
              : 'bg-[#248a3d]/90 text-white'}"
          >
            {track.isPreview ? i18n.t('common.preview30s') : i18n.t('common.full')}
          </span>

          <!-- Top-right max 2 action buttons (Flip & Heart) -->
          <div class="absolute top-2.5 right-2.5 flex gap-1.5">
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white active:scale-95"
              aria-label="Balik kartu lirik {track.title}"
              onclick={() => appStore.toggleGridFlip(track)}
            >
              <Icon name="flip" size={14} />
            </button>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-black/55 active:scale-95 {isLiked
                ? 'text-[#ff375f]'
                : 'text-white'}"
              aria-label={isLiked ? `Hapus ${track.title} dari favorit` : `Tambahkan ${track.title} ke favorit`}
              aria-pressed={isLiked}
              onclick={() => appStore.toggleLike(track)}
            >
              <Icon name={isLiked ? 'heart-filled' : 'heart'} size={14} />
            </button>
          </div>

          <!-- Bottom Overlay Metadata & Play Button -->
          <div class="pointer-events-none absolute right-2.5 bottom-2.5 left-2.5 flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-1.5">
              <span
                class="truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90 {track.source === 'local'
                  ? 'max-w-[calc(100%-88px)]'
                  : 'max-w-full'}"
              >
                {track.releaseYear ? `${track.releaseYear} • ` : ''}{track.dur ? formatTime(track.dur) : track.album || 'Stream'}
              </span>

              {#if track.source === 'local'}
                <div class="pointer-events-auto flex shrink-0 gap-1">
                  <button
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white active:scale-95"
                    aria-label="Edit detail {track.title}"
                    onclick={() => appStore.openEditTrack(track)}
                  >
                    <Icon name="edit" size={13} />
                  </button>
                  <button
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white active:scale-95"
                    aria-label="Hapus {track.title}"
                    onclick={() => appStore.removeTrack(track)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              {/if}
            </div>

            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-sm font-bold text-white">{track.title}</h3>
                <p class="truncate text-xs text-white/75">{track.artist}</p>
              </div>
              <button
                type="button"
                class="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black shadow-md active:scale-95"
                aria-label={isPlaying ? `Jeda ${track.title}` : `Putar ${track.title}`}
                onpointerdown={() => engine.prewarmTrack(track)}
                onclick={() => engine.playTrack(track, appStore.allTracks)}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- BACK FACE (SYNCED LYRICS) -->
    <div class="xmusic-flip-face xmusic-flip-back" aria-hidden={!isFlipped}>
      <Card
        contentWrap={false}
        class="!m-0 flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#007aff] dark:border-[#0a84ff]"
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
