<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Button,
    Chip,
    List,
    ListItem,
    Segmented,
    SegmentedButton
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  let layoutMode = $state<'list' | 'grid'>('list');
  let visibleCount = $state<number>(20);
  let brokenImages = $state<Record<string, boolean>>({});

  $effect(() => {
    void appStore.libFilter;
    visibleCount = 20;
  });

  const visibleTracks = $derived(appStore.filteredLibrary.slice(0, visibleCount));
  const activePlaylist = $derived(
    appStore.playlists.find((p) => p.id === appStore.libFilter) || null
  );

  const sectionLabel = $derived(
    activePlaylist
      ? i18n.t('library.sectionPlaylist', { name: activePlaylist.name })
      : appStore.libFilter === 'liked'
        ? i18n.t('library.sectionLiked')
        : appStore.libFilter === 'history'
          ? i18n.t('library.sectionHistory')
          : i18n.t('library.sectionOffline')
  );

  function playAll(shuffled = false): void {
    const list = appStore.filteredLibrary;
    if (list.length === 0) return;
    const queue = shuffled ? [...list].sort(() => Math.random() - 0.5) : [...list];
    engine.playTrack(queue[0], queue);
  }
</script>

<div class="mx-auto flex w-full flex-col gap-4 px-4 pt-3 pb-4">
  <!-- Unified iOS Control Surface (Zero Konsta BlockTitle/Block Margin Conflicts) -->
  <section
    class="flex flex-col gap-3 rounded-2xl border border-black/8 bg-white p-3.5 dark:border-white/10 dark:bg-[#1c1c1e]"
    aria-label={i18n.t('nav.title.library')}
  >
    <Segmented strong rounded>
      <SegmentedButton
        active={appStore.libFilter === 'local'}
        class="whitespace-nowrap text-xs"
        onclick={() => (appStore.libFilter = 'local')}
      >
        {i18n.t('library.tabOffline')}
      </SegmentedButton>
      <SegmentedButton
        active={appStore.libFilter === 'liked'}
        class="whitespace-nowrap text-xs"
        onclick={() => (appStore.libFilter = 'liked')}
      >
        {i18n.t('library.tabLiked')}
      </SegmentedButton>
      <SegmentedButton
        active={appStore.libFilter === 'history'}
        class="whitespace-nowrap text-xs"
        onclick={() => (appStore.libFilter = 'history')}
      >
        {i18n.t('library.tabHistory')}
      </SegmentedButton>
    </Segmented>

    <div class="grid grid-cols-2 gap-2.5">
      <Button
        rounded
        small
        class="min-w-0 whitespace-nowrap"
        onclick={() => (appStore.uploadModalOpen = true)}
      >
        <span class="truncate">{i18n.t('library.uploadAudio')}</span>
      </Button>
      <Button
        tonal
        rounded
        small
        class="min-w-0 whitespace-nowrap"
        onclick={() => (appStore.playlistModalOpen = true)}
      >
        <span class="truncate">{i18n.t('library.createPlaylist')}</span>
      </Button>
    </div>
  </section>

  <!-- Playlists Horizontal Rail (Edge-to-Edge Scroll, Zero Wrapping Collisions) -->
  {#if appStore.playlists.length > 0}
    <section class="flex flex-col gap-2" aria-label={i18n.t('library.yourPlaylists')}>
      <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
          {i18n.t('library.yourPlaylists')} ({appStore.playlists.length})
        </h2>
      </div>
      <div class="xmusic-hscroll -mx-4 flex items-center gap-2 px-4 py-0.5">
        {#each appStore.playlists as pl (pl.id)}
          <Chip
            outline={appStore.libFilter !== pl.id}
            class="shrink-0 cursor-pointer whitespace-nowrap {appStore.libFilter === pl.id
              ? '!bg-[#007aff] !text-white font-semibold dark:!bg-[#0a84ff]'
              : ''}"
            onclick={() => (appStore.libFilter = pl.id)}
          >
            {pl.name} ({pl.trackIds.length})
          </Chip>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Collection Section (Uniform Vertical Stack, Zero Overlap) -->
  <section class="flex flex-col gap-3" aria-label={sectionLabel}>
    <div class="flex min-h-8 items-center justify-between gap-2 px-0.5">
      <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/60 uppercase dark:text-white/60">
        {sectionLabel} ({appStore.filteredLibrary.length})
      </h2>
      {#if appStore.filteredLibrary.length > 0}
        <Button
          clear
          small
          inline
          class="shrink-0 whitespace-nowrap"
          onclick={() => (layoutMode = layoutMode === 'list' ? 'grid' : 'list')}
        >
          {layoutMode === 'list' ? i18n.t('library.viewGrid') : i18n.t('library.viewList')}
        </Button>
      {/if}
    </div>

    {#if appStore.filteredLibrary.length > 0}
      <!-- Playback Action Bar -->
      <div class="grid grid-cols-2 gap-2.5">
        <Button rounded small class="min-w-0 whitespace-nowrap" onclick={() => playAll(false)}>
          <span class="inline-flex items-center justify-center gap-1.5 truncate">
            <Icon name="play" size={14} />
            <span class="truncate">{i18n.t('library.playAll')}</span>
          </span>
        </Button>
        <Button tonal rounded small class="min-w-0 whitespace-nowrap" onclick={() => playAll(true)}>
          <span class="inline-flex items-center justify-center gap-1.5 truncate">
            <Icon name="shuffle" size={14} />
            <span class="truncate">{i18n.t('library.shuffle')}</span>
          </span>
        </Button>
      </div>

      {#if layoutMode === 'list'}
        <!-- Flush Non-Overlapping Konsta iOS List Rows (Zero Nested Buttons + Resilient Artwork) -->
        <List strong inset class="!mx-0 !my-0">
          {#each visibleTracks as track (track.id)}
            {@const isCurrent = engine.current?.id === track.id}
            <ListItem
              link
              title={track.title}
              subtitle={track.artist}
              titleWrapClass="min-w-0 flex-1"
              class="overflow-hidden {isCurrent
                ? 'bg-[#007aff]/6 dark:bg-[#0a84ff]/12'
                : ''}"
              onpointerdown={() => engine.prewarmTrack(track)}
              onclick={() => {
                engine.playTrack(track, appStore.filteredLibrary);
                appStore.openTrackModal(track, false);
              }}
            >
              {#snippet media()}
                <span
                  class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
                  style={track.imageUrl && !brokenImages[track.id]
                    ? ''
                    : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
                >
                  {#if track.imageUrl && !brokenImages[track.id]}
                    <img
                      src={track.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      class="h-full w-full object-cover"
                      onerror={() => (brokenImages = { ...brokenImages, [track.id]: true })}
                    />
                  {:else}
                    {getTrackInitial(track.title)}
                  {/if}
                </span>
              {/snippet}

              {#snippet after()}
                {#if isCurrent && engine.playing}
                  <Badge class="shrink-0 whitespace-nowrap bg-[#007aff] text-white text-[10px] dark:bg-[#0a84ff]">
                    {i18n.t('library.playing')}
                  </Badge>
                {:else if track.dur > 0}
                  <span class="shrink-0 text-xs tabular-nums text-black/50 dark:text-white/50">
                    {formatTime(track.dur)}
                  </span>
                {/if}
              {/snippet}
            </ListItem>
          {/each}
        </List>
      {:else}
        <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {#each visibleTracks as track (track.id)}
            <TrackCard {track} />
          {/each}
        </div>
      {/if}

      {#if appStore.filteredLibrary.length > visibleCount}
        <div class="flex justify-center pt-1">
          <Button tonal rounded small inline onclick={() => (visibleCount += 20)}>
            {i18n.t('library.moreCount', { count: appStore.filteredLibrary.length - visibleCount })}
          </Button>
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-center gap-3 rounded-2xl border border-black/8 bg-white px-5 py-7 text-center dark:border-white/10 dark:bg-[#1c1c1e]">
        <span class="grid h-12 w-12 place-items-center rounded-2xl bg-[#007aff]/12 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
          <Icon name="music" size={22} />
        </span>
        <div class="space-y-1">
          <h3 class="text-base font-bold text-black dark:text-white">
            {i18n.t('library.emptyTitle')}
          </h3>
          <p class="max-w-xs text-sm leading-relaxed text-black/60 dark:text-white/60">
            {i18n.t('library.emptyDesc')}
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Button rounded small inline onclick={() => (appStore.uploadModalOpen = true)}>
            {i18n.t('home.upload')}
          </Button>
          <Button
            rounded
            small
            inline
            class="!bg-[#248a3d] !text-white font-bold dark:!bg-[#30d158] dark:!text-black"
            onclick={() => appStore.createBuiltInSynthDemo()}
          >
            {i18n.t('library.createDemo')}
          </Button>
        </div>
      </div>
    {/if}
  </section>
</div>
