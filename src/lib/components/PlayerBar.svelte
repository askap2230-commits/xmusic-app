<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Progressbar } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from './Icon.svelte';

  let imgFailed = $state<boolean>(false);

  $effect(() => {
    void engine.current?.imageUrl;
    imgFailed = false;
  });

  const progressFraction = $derived(
    engine.duration > 0 ? Math.min(1, engine.position / engine.duration) : 0
  );
</script>

<!-- Shown cleanly only when a track is active, docked above Konsta v5.5 Floating iOS Tabbar -->
{#if engine.current}
  <footer
    class="xmusic-gpu-layer fixed right-3 left-3 bottom-[calc(86px+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-4xl overflow-hidden rounded-[22px] border border-black/10 bg-ios-light-surface-1/95 shadow-xl dark:border-white/12 dark:bg-ios-dark-surface-1/95 dark:shadow-2xl"
    aria-label="Pemutar audio mini"
  >
    <Progressbar progress={progressFraction} class="!h-0.5" />

    <div class="flex items-center gap-2.5 px-3 py-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
        onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
        aria-label="Buka detail {engine.current.title}"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
          style={engine.current.imageUrl && !imgFailed
            ? ''
            : `background: linear-gradient(135deg, ${engine.current.c1 || '#007aff'}, ${engine.current.c2 || '#18181b'})`}
        >
          {#if engine.current.imageUrl && !imgFailed}
            <img
              src={engine.current.imageUrl}
              alt=""
              class="h-full w-full object-cover"
              onerror={() => (imgFailed = true)}
            />
          {:else}
            {getTrackInitial(engine.current.title)}
          {/if}
        </span>

        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-black dark:text-white">
            {engine.current.title}
          </span>
          <span class="block truncate text-xs text-black/60 dark:text-white/60">
            {engine.current.artist} • {formatTime(engine.position)} / {formatTime(engine.duration)}
          </span>
        </span>
      </button>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full bg-black text-white active:scale-95 dark:bg-white dark:text-black"
          aria-label={engine.playing ? 'Jeda' : 'Putar'}
          onclick={() => engine.togglePlay()}
        >
          <Icon name={engine.playing ? 'pause' : 'play'} size={17} />
        </button>

        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-black/80 active:scale-95 dark:bg-white/10 dark:text-white/85"
          aria-label="Lagu berikutnya"
          onclick={() => engine.next(false)}
        >
          <Icon name="next" size={16} />
        </button>

        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-black/70 active:scale-95 dark:bg-white/10 dark:text-white/75"
          aria-label="Hentikan dan tutup pemutar"
          onclick={() => engine.stopTrack()}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  </footer>
{/if}
