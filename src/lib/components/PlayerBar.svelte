<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { Progressbar } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { formatTime, getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';

  const progressFraction = $derived(
    engine.duration > 0 ? Math.min(1, engine.position / engine.duration) : 0
  );
</script>

<footer
  class="fixed right-2 left-2 bottom-[calc(58px+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-xl dark:border-white/12 dark:bg-[#1c1c1e]/95 dark:shadow-2xl"
  aria-label="Pemutar audio mini"
>
  <Progressbar progress={progressFraction} class="!h-0.5" />

  <div class="flex items-center gap-2.5 px-3 py-2">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      disabled={!engine.current}
      onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
      aria-label={engine.current ? `Buka detail ${engine.current.title}` : 'Belum ada lagu diputar'}
    >
      <span
        class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
        style={engine.current?.imageUrl
          ? ''
          : `background: linear-gradient(135deg, ${engine.current?.c1 || '#3f3f46'}, ${engine.current?.c2 || '#18181b'})`}
      >
        {#if engine.current?.imageUrl}
          <img src={engine.current.imageUrl} alt="" class="h-full w-full object-cover" />
        {:else if engine.current}
          {getTrackInitial(engine.current.title)}
        {:else}
          <Icon name="music" size={18} />
        {/if}
      </span>

      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-zinc-950 dark:text-white">
          {engine.current?.title || 'Belum ada lagu diputar'}
        </span>
        <span class="block truncate text-xs text-zinc-600 dark:text-zinc-300">
          {#if engine.current}
            {engine.current.artist} • {formatTime(engine.position)} / {formatTime(engine.duration)}
          {:else}
            Ketuk 2x kartu untuk lirik sinkron
          {/if}
        </span>
      </span>
    </button>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="hidden h-11 w-11 place-items-center rounded-full text-zinc-700 hover:bg-black/5 sm:grid dark:text-zinc-200 dark:hover:bg-white/10"
        aria-label="Lagu sebelumnya"
        onclick={() => engine.prev()}
      >
        <Icon name="prev" size={18} />
      </button>

      <button
        type="button"
        class="grid h-11 w-11 place-items-center rounded-full bg-zinc-950 text-white active:scale-95 dark:bg-white dark:text-black"
        aria-label={engine.playing ? 'Jeda' : 'Putar'}
        onclick={() => engine.togglePlay()}
      >
        <Icon name={engine.playing ? 'pause' : 'play'} size={18} />
      </button>

      <button
        type="button"
        class="grid h-11 w-11 place-items-center rounded-full text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
        aria-label="Lagu berikutnya"
        onclick={() => engine.next(false)}
      >
        <Icon name="next" size={18} />
      </button>

      <button
        type="button"
        class="hidden h-11 w-11 place-items-center rounded-full text-zinc-700 hover:bg-black/5 md:grid dark:text-zinc-200 dark:hover:bg-white/10"
        aria-label="Buka antrean putar"
        onclick={() => (appStore.npDrawerOpen = !appStore.npDrawerOpen)}
      >
        <Icon name="queue" size={18} />
      </button>
    </div>
  </div>
</footer>
