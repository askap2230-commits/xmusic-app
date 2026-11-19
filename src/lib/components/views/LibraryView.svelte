<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Block,
    BlockTitle,
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

<!-- Clean, Zero-Overlap iOS Library Header: Short Single-Line Segmented Labels -->
<Block strong inset class="space-y-3">
  <Segmented strong rounded>
    <SegmentedButton
      active={appStore.libFilter === 'local'}
      onclick={() => (appStore.libFilter = 'local')}
    >
      {i18n.t('library.tabOffline')}
    </SegmentedButton>
    <SegmentedButton
      active={appStore.libFilter === 'liked'}
      onclick={() => (appStore.libFilter = 'liked')}
    >
      {i18n.t('library.tabLiked')}
    </SegmentedButton>
    <SegmentedButton
      active={appStore.libFilter === 'history'}
      onclick={() => (appStore.libFilter = 'history')}
    >
      {i18n.t('library.tabHistory')}
    </SegmentedButton>
  </Segmented>

  <div class="grid grid-cols-2 gap-2.5">
    <Button rounded small onclick={() => (appStore.uploadModalOpen = true)}>
      {i18n.t('library.uploadAudio')}
    </Button>
    <Button tonal rounded small onclick={() => (appStore.playlistModalOpen = true)}>
      {i18n.t('library.createPlaylist')}
    </Button>
  </div>
</Block>

<!-- Playlists Horizontal Rail (Zero Wrapping Collisions) -->
{#if appStore.playlists.length > 0}
  <BlockTitle>{i18n.t('library.yourPlaylists')} ({appStore.playlists.length})</BlockTitle>
  <div class="xmusic-hscroll flex items-center gap-2 px-4 py-1">
    {#each appStore.playlists as pl (pl.id)}
      <Chip
        outline={appStore.libFilter !== pl.id}
        class="shrink-0 cursor-pointer {appStore.libFilter === pl.id
          ? '!bg-[#007aff] !text-white font-semibold dark:!bg-[#0a84ff]'
          : ''}"
        onclick={() => (appStore.libFilter = pl.id)}
      >
        {pl.name} ({pl.trackIds.length})
      </Chip>
    {/each}
  </div>
{/if}

<!-- Section Header with Guaranteed Truncation & Non-Colliding Layout Toggle -->
<BlockTitle class="flex items-center justify-between gap-2">
  <span class="min-w-0 flex-1 truncate">
    {sectionLabel} ({appStore.filteredLibrary.length})
  </span>
  {#if appStore.filteredLibrary.length > 0}
    <Button
      clear
      small
      inline
      class="shrink-0"
      onclick={() => (layoutMode = layoutMode === 'list' ? 'grid' : 'list')}
    >
      {layoutMode === 'list' ? i18n.t('library.viewGrid') : i18n.t('library.viewList')}
    </Button>
  {/if}
</BlockTitle>

{#if appStore.filteredLibrary.length > 0}
  <Block class="!my-2 grid grid-cols-2 gap-2.5">
    <Button rounded small onclick={() => playAll(false)}>
      <span class="inline-flex items-center gap-1.5">
        <Icon name="play" size={14} />
        <span>{i18n.t('library.playAll')}</span>
      </span>
    </Button>
    <Button tonal rounded small onclick={() => playAll(true)}>
      <span class="inline-flex items-center gap-1.5">
        <Icon name="shuffle" size={14} />
        <span>{i18n.t('library.shuffle')}</span>
      </span>
    </Button>
  </Block>

  {#if layoutMode === 'list'}
    <!-- Clean Non-Overlapping Konsta iOS List Rows (Zero Nested Buttons!) -->
    <List strong inset class="!my-2">
      {#each visibleTracks as track (track.id)}
        {@const isCurrent = engine.current?.id === track.id}
        <ListItem
          link
          title={track.title}
          subtitle={track.artist}
          titleWrapClass="min-w-0"
          class="overflow-hidden"
          onclick={() => {
            engine.playTrack(track, appStore.filteredLibrary);
            appStore.openTrackModal(track, false);
          }}
        >
          {#snippet media()}
            <span
              class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
              style={track.imageUrl
                ? ''
                : `background: linear-gradient(135deg, ${track.c1 || '#007aff'}, ${track.c2 || '#1c1c1e'})`}
            >
              {#if track.imageUrl}
                <img
                  src={track.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                />
              {:else}
                {getTrackInitial(track.title)}
              {/if}
            </span>
          {/snippet}

          {#snippet after()}
            {#if isCurrent && engine.playing}
              <Badge class="shrink-0 bg-[#007aff] text-white text-[10px]">
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
    <Block class="!my-2">
      <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each visibleTracks as track (track.id)}
          <TrackCard {track} />
        {/each}
      </div>
    </Block>
  {/if}

  {#if appStore.filteredLibrary.length > visibleCount}
    <Block class="!mt-2 flex justify-center">
      <Button tonal rounded small inline onclick={() => (visibleCount += 20)}>
        {i18n.t('library.moreCount', { count: appStore.filteredLibrary.length - visibleCount })}
      </Button>
    </Block>
  {/if}
{:else}
  <Block strong inset class="space-y-3 text-center">
    <h3 class="text-base font-bold text-black dark:text-white">{i18n.t('library.emptyTitle')}</h3>
    <p class="text-sm text-black/60 dark:text-white/60">
      {i18n.t('library.emptyDesc')}
    </p>
    <div class="flex flex-wrap justify-center gap-2 pt-1">
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
  </Block>
{/if}
