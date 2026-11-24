<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { Preloader, Tabbar, TabbarLink, ToolbarPane } from 'konsta/svelte';
  import { parseLrcLyrics } from '#lib/api/services.ts';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { AppView } from '#lib/types/music.ts';
  import { findActiveLyricIndex, formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from './Icon.svelte';

  let { onSwitchTab }: { onSwitchTab: (view: AppView) => void } = $props();
  let imgFailed = $state<boolean>(false);
  let navTrackEl = $state<HTMLDivElement | null>(null);
  let draggingLens = $state<boolean>(false);
  let dragLensIdx = $state<number>(0);

  $effect(() => {
    void engine.current?.imageUrl;
    imgFailed = false;
  });

  const progressPct = $derived(
    engine.duration > 0 ? Math.min(100, Math.max(0, (engine.position / engine.duration) * 100)) : 0
  );
  const isLoadingAudio = $derived(engine.resolvingAudio || engine.buffering);

  const liveLyricLine = $derived.by(() => {
    const raw = engine.current?.lyrics;
    if (!raw) return '';
    const parsed = parseLrcLyrics(raw);
    if (parsed.length === 0) return '';
    const idx = findActiveLyricIndex(parsed, engine.position);
    return idx >= 0 ? parsed[idx]?.text || '' : '';
  });

  const NAV_TABS: Array<{ id: AppView; icon: 'home' | 'search' | 'library' | 'eq' | 'profile'; labelKey: 'nav.home' | 'nav.search' | 'nav.library' | 'nav.eq' | 'nav.profile' }> = [
    { id: 'home', icon: 'home', labelKey: 'nav.home' },
    { id: 'search', icon: 'search', labelKey: 'nav.search' },
    { id: 'library', icon: 'library', labelKey: 'nav.library' },
    { id: 'eq', icon: 'eq', labelKey: 'nav.eq' },
    { id: 'profile', icon: 'profile', labelKey: 'nav.profile' }
  ];

  const activeTabIndex = $derived(
    Math.max(0, NAV_TABS.findIndex((t) => t.id === appStore.view))
  );
  const displayedLensIndex = $derived(draggingLens ? dragLensIdx : activeTabIndex);

  function computeLensPosFromClientX(clientX: number): number {
    if (!navTrackEl) return activeTabIndex;
    const rect = navTrackEl.getBoundingClientRect();
    if (rect.width <= 0) return activeTabIndex;
    const rel = Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width));
    return Math.max(0, Math.min(4, rel * 5 - 0.5));
  }

  function handleLensPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    draggingLens = true;
    dragLensIdx = computeLensPosFromClientX(e.clientX);
    (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }

  function handleLensPointerMove(e: PointerEvent): void {
    if (!draggingLens) return;
    dragLensIdx = computeLensPosFromClientX(e.clientX);
    const hoveredTab = NAV_TABS[Math.round(dragLensIdx)];
    if (hoveredTab && hoveredTab.id !== appStore.view) {
      onSwitchTab(hoveredTab.id);
    }
  }

  function handleLensPointerUp(e: PointerEvent): void {
    if (!draggingLens) return;
    const finalIdx = Math.round(computeLensPosFromClientX(e.clientX));
    draggingLens = false;
    const target = NAV_TABS[Math.max(0, Math.min(NAV_TABS.length - 1, finalIdx))];
    if (target) {
      onSwitchTab(target.id);
    }
  }
</script>

{#if appStore.uiStyle === 'liquid-glass'}
  <!-- Unified iOS 26 Liquid Glass Dock: Music Player + Sliding Optical Lens Navigation Bar in ONE glass capsule -->
  <div
    class="xmusic-gpu-layer fixed right-2.5 bottom-[calc(10px+env(safe-area-inset-bottom,0px))] left-2.5 z-40 mx-auto max-w-xl overflow-hidden xmusic-liquid-glass transition-all duration-300 {engine.current
      ? 'rounded-[34px]'
      : 'rounded-full'}"
    style={engine.current?.c1 ? `border-color: ${engine.current.c1}66;` : ''}
    role="region"
    aria-label="Pemutar musik dan navigasi lensa"
  >
    {#if engine.current}
      <!-- Top Specular Progress Line -->
      <div class="h-[3px] w-full bg-black/8 dark:bg-white/10">
        <div
          class="h-full transition-[width] duration-200 ease-linear"
          style="width: {progressPct}%; background: {engine.current.c1 || '#007aff'};"
        ></div>
      </div>

      <!-- Integrated Mini Music Player Section -->
      <div class="flex items-center gap-3 px-4 pt-3 pb-2.5">
        <button
          type="button"
          class="xmusic-spring-tap flex min-w-0 flex-1 items-center gap-2.5 text-left"
          onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
          aria-label="Buka pemutar penuh {engine.current.title}"
        >
          <span
            class="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl text-sm font-bold text-white shadow-sm ring-1 ring-white/25"
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
            <span class="block truncate text-[14px] font-bold tracking-tight text-black dark:text-white">
              {engine.current.title}
            </span>
            <span class="block truncate text-[12px] tabular-nums text-black/65 dark:text-white/70">
              {#if liveLyricLine}
                <span class="font-semibold" style="color: {engine.current.c1 || '#0a84ff'};">
                  ♪ {liveLyricLine}
                </span>
              {:else}
                {engine.current.artist} • {formatTime(engine.position)} / {formatTime(engine.duration)}
              {/if}
            </span>
          </span>
        </button>

        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="xmusic-spring-tap grid h-10 w-10 place-items-center rounded-full text-white shadow-sm"
            style="background: {engine.current.c1 || '#007aff'};"
            aria-label={engine.playing ? 'Jeda' : 'Putar'}
            onclick={() => engine.togglePlay()}
          >
            {#if isLoadingAudio}
              <Preloader class="h-4 w-4 !text-white" />
            {:else}
              <Icon name={engine.playing ? 'pause' : 'play'} size={16} />
            {/if}
          </button>

          <button
            type="button"
            class="xmusic-spring-tap grid h-9 w-9 place-items-center rounded-full bg-black/6 text-black/80 dark:bg-white/12 dark:text-white/90"
            aria-label="Lagu berikutnya"
            onclick={() => engine.next(false)}
          >
            <Icon name="next" size={15} />
          </button>

          <button
            type="button"
            class="xmusic-spring-tap grid h-9 w-9 place-items-center rounded-full bg-black/6 text-black/65 dark:bg-white/12 dark:text-white/75"
            aria-label="Tutup pemutar"
            onclick={() => engine.stopTrack()}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      <!-- Subtle Specular Divider inside the Unified Glass Capsule -->
      <div class="mx-3.5 h-px bg-black/8 dark:bg-white/12" aria-hidden="true"></div>
    {/if}

    <!-- Integrated iOS 26 Sliding Optical Lens Navigation Bar (Tap or Slide Finger Across Tabs) -->
    <nav class="px-2 py-2 select-none" aria-label="Navigasi utama">
      <div
        bind:this={navTrackEl}
        class="xmusic-lens-track touch-pan-y"
        style="--lens-idx: {displayedLensIndex};"
        onpointerdown={handleLensPointerDown}
        onpointermove={handleLensPointerMove}
        onpointerup={handleLensPointerUp}
        onpointercancel={() => (draggingLens = false)}
      >
        <!-- Sliding Refractive Liquid Glass Lens Indicator -->
        <div
          class="xmusic-lens-glider"
          class:is-dragging={draggingLens}
          style={engine.current?.c1
            ? `box-shadow: inset 0 2px 3px rgba(255,255,255,0.65), 0 6px 20px ${engine.current.c1}44;`
            : ''}
          aria-hidden="true"
        ></div>

        {#each NAV_TABS as tab (tab.id)}
          {@const isActive = appStore.view === tab.id}
          <button
            type="button"
            class="relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-bold tracking-tight transition-transform duration-200 {isActive
              ? 'scale-105 text-black dark:text-white'
              : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'}"
            style={isActive && engine.current?.c1 ? `color: ${engine.current.c1};` : ''}
            aria-current={isActive ? 'page' : undefined}
            onclick={() => onSwitchTab(tab.id)}
          >
            <Icon name={tab.icon} size={22} />
            <span class="max-w-[64px] truncate">{i18n.t(tab.labelKey)}</span>
          </button>
        {/each}
      </div>
    </nav>
  </div>
{:else}
  <!-- Editorial Mode: Clean Docked Music Bar + Standard Bottom Tabbar -->
  {#if engine.current}
    <footer
      class="xmusic-gpu-layer fixed right-3 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-3 z-30 mx-auto max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-ios-light-surface-1/95 shadow-lg dark:border-white/12 dark:bg-ios-dark-surface-1/95"
      aria-label="Pemutar audio mini"
    >
      <div class="h-0.5 w-full bg-black/10 dark:bg-white/10">
        <div class="h-full bg-[#007aff] dark:bg-[#0a84ff]" style="width: {progressPct}%;"></div>
      </div>
      <div class="flex items-center gap-2.5 px-3 py-2">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 text-left"
          onclick={() => engine.current && appStore.openTrackModal(engine.current, false)}
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
            style={engine.current.imageUrl && !imgFailed
              ? ''
              : `background: linear-gradient(135deg, ${engine.current.c1 || '#007aff'}, ${engine.current.c2 || '#18181b'})`}
          >
            {#if engine.current.imageUrl && !imgFailed}
              <img src={engine.current.imageUrl} alt="" class="h-full w-full object-cover" onerror={() => (imgFailed = true)} />
            {:else}
              {getTrackInitial(engine.current.title)}
            {/if}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-black dark:text-white">{engine.current.title}</span>
            <span class="block truncate text-xs text-black/60 dark:text-white/60">
              {liveLyricLine ? `♪ ${liveLyricLine}` : `${engine.current.artist} • ${formatTime(engine.position)} / ${formatTime(engine.duration)}`}
            </span>
          </span>
        </button>
        <div class="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"
            onclick={() => engine.togglePlay()}
          >
            {#if isLoadingAudio}
              <Preloader class="h-4 w-4" />
            {:else}
              <Icon name={engine.playing ? 'pause' : 'play'} size={16} />
            {/if}
          </button>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/80 dark:bg-white/10 dark:text-white/85"
            onclick={() => engine.next(false)}
          >
            <Icon name="next" size={15} />
          </button>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/75"
            onclick={() => engine.stopTrack()}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
    </footer>
  {/if}

  <Tabbar labels icons class="xmusic-gpu-layer fixed bottom-0 left-0 z-40">
    <ToolbarPane>
      {#each NAV_TABS as tab (tab.id)}
        <TabbarLink
          active={appStore.view === tab.id}
          label={i18n.t(tab.labelKey)}
          onclick={() => onSwitchTab(tab.id)}
        >
          {#snippet icon()}
            <Icon name={tab.icon} size={22} />
          {/snippet}
        </TabbarLink>
      {/each}
    </ToolbarPane>
  </Tabbar>
{/if}
