<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Block,
    BlockTitle,
    Button,
    Card,
    Chip,
    List,
    ListItem,
    Preloader,
    Searchbar,
    Segmented,
    SegmentedButton
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { CATEGORIES, ERA_PRESETS, TRENDING_QUERIES } from '#lib/data/presets.ts';
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { Track } from '#lib/types/music.ts';
  import { formatTime, getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  let layoutMode = $state<'list' | 'grid'>('list');
  let brokenImages = $state<Record<string, boolean>>({});

  const topTrack = $derived(appStore.visibleSearchResults[0] || null);
  const restTracks = $derived(
    layoutMode === 'list'
      ? appStore.visibleSearchResults.slice(1)
      : appStore.visibleSearchResults
  );

  function openAndPlay(track: Track): void {
    appStore.showSuggestions = false;
    engine.playTrack(track, appStore.filteredSearchResults);
    appStore.openTrackModal(track, false);
  }
</script>

<!-- Search Input Header -->
<Block class="!mb-2">
  <Searchbar
    placeholder={i18n.t('search.placeholder')}
    value={appStore.searchQuery}
    onInput={(e: Event) => appStore.updateSearch((e.target as HTMLInputElement).value)}
    onClear={() => appStore.updateSearch('')}
  />
</Block>

<!-- Real-Time Smart Suggestions Dropdown (Clean, Non-Overlapping, Dismissible) -->
{#if appStore.showSuggestions && appStore.searchQuery.trim().length > 0 && (appStore.searchSuggestions.length > 0 || appStore.suggesting)}
  <div class="mb-2">
    <div class="flex items-center justify-end px-4">
      <Button clear small inline onclick={() => (appStore.showSuggestions = false)}>
        {i18n.t('search.hideSuggestions')}
      </Button>
    </div>
    <List strong inset class="!my-1">
      {#if appStore.suggesting && appStore.searchSuggestions.length === 0}
        <ListItem title={i18n.t('search.suggesting')}>
          {#snippet media()}
            <Preloader class="w-4 h-4" />
          {/snippet}
        </ListItem>
      {:else}
        {#each appStore.searchSuggestions as sug (sug.id)}
          <ListItem
            link
            title={sug.title}
            subtitle={sug.subtitle}
            titleWrapClass="min-w-0"
            class="overflow-hidden"
            onclick={() => appStore.applySuggestion(sug)}
          >
            {#snippet media()}
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-[#007aff] dark:bg-white/10 dark:text-[#64d2ff]">
                <Icon name={sug.kind === 'era' ? 'spark' : sug.track ? 'music' : 'search'} size={15} />
              </span>
            {/snippet}
            {#snippet after()}
              {#if sug.year}
                <Badge class="shrink-0 bg-black/10 text-black text-[11px] dark:bg-white/15 dark:text-white">
                  {sug.year}
                </Badge>
              {/if}
            {/snippet}
          </ListItem>
        {/each}
      {/if}
    </List>
  </div>
{/if}

{#if !appStore.isOnline}
  <Block strong inset class="flex items-center gap-3">
    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
      <Icon name="wifi-off" size={18} />
    </span>
    <p class="text-xs text-black/65 dark:text-white/65">
      {i18n.t('search.offlineNotice')}
    </p>
  </Block>
{/if}

{#if !appStore.searchQuery.trim()}
  <!-- Empty Search Discovery Hub -->
  {#if appStore.recentSearches.length > 0}
    <BlockTitle class="flex items-center justify-between">
      <span>{i18n.t('search.recent')}</span>
      <Button clear small inline onclick={() => appStore.clearRecentSearches()}>
        {i18n.t('search.clear')}
      </Button>
    </BlockTitle>
    <div class="xmusic-hscroll flex gap-2 px-4 py-1">
      {#each appStore.recentSearches as recent (recent)}
        <Chip
          outline
          deleteButton
          class="shrink-0 cursor-pointer"
          onclick={() => appStore.updateSearch(recent, true)}
          onDelete={(e: Event) => {
            e.stopPropagation();
            appStore.removeRecentSearch(recent);
          }}
        >
          {recent}
        </Chip>
      {/each}
    </div>
  {/if}

  <BlockTitle>{i18n.t('search.trending')}</BlockTitle>
  <div class="xmusic-hscroll flex gap-2 px-4 py-1">
    {#each TRENDING_QUERIES as term}
      <Chip outline class="shrink-0 cursor-pointer" onclick={() => appStore.updateSearch(term, true)}>
        {term}
      </Chip>
    {/each}
  </div>

  <BlockTitle>{i18n.t('search.eraExplore')}</BlockTitle>
  <Block>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {#each ERA_PRESETS as era (era.id)}
        <button
          type="button"
          class="w-full text-left active:scale-[0.98] transition-transform"
          onclick={() => appStore.exploreEra(era.id)}
        >
          <Card
            contentWrapPadding="p-3.5"
            class="!m-0 h-full border border-black/8 dark:border-white/10"
          >
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                style="background-color: {era.accent};"
                aria-hidden="true"
              ></span>
              <span class="truncate text-sm font-semibold text-black dark:text-white">
                {era.label}
              </span>
            </div>
            <div class="mt-1 truncate text-xs text-black/55 dark:text-white/55">
              {era.sub}
            </div>
          </Card>
        </button>
      {/each}
    </div>
  </Block>

  <BlockTitle>{i18n.t('search.genreExplore')}</BlockTitle>
  <Block>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {#each CATEGORIES as cat}
        <button
          type="button"
          class="w-full text-left active:scale-[0.98] transition-transform"
          onclick={() => appStore.updateSearch(cat.q, true)}
        >
          <Card
            contentWrapPadding="p-3.5"
            class="!m-0 h-full border border-black/8 dark:border-white/10"
          >
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                style="background-color: {cat.accent};"
                aria-hidden="true"
              ></span>
              <span class="truncate text-sm font-semibold text-black dark:text-white">
                {cat.label}
              </span>
            </div>
            <div class="mt-1 truncate text-xs text-black/55 dark:text-white/55">
              {cat.sub}
            </div>
          </Card>
        </button>
      {/each}
    </div>
  </Block>
{:else}
  <!-- Clean Source Filter Rail -->
  <div class="xmusic-hscroll flex items-center gap-2 px-4 pt-1 pb-1.5">
    <Chip
      outline={!appStore.fullOnlyFilter}
      class="shrink-0 cursor-pointer {appStore.fullOnlyFilter
        ? '!bg-[#248a3d] !text-white font-semibold dark:!bg-[#30d158] dark:!text-black'
        : ''}"
      onclick={() => {
        appStore.showSuggestions = false;
        appStore.toggleFullOnly();
      }}
    >
      {i18n.t('search.fullOnly')}
    </Chip>

    <Chip
      outline={appStore.searchSourceFilter !== 'all'}
      class="shrink-0 cursor-pointer {appStore.searchSourceFilter === 'all'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => appStore.setSearchSourceFilter('all')}
    >
      {i18n.t('search.sourceAll')}
    </Chip>

    <Chip
      outline={appStore.searchSourceFilter !== 'youtube'}
      class="shrink-0 cursor-pointer {appStore.searchSourceFilter === 'youtube'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => appStore.setSearchSourceFilter('youtube')}
    >
      YouTube Music
    </Chip>

    <Chip
      outline={appStore.searchSourceFilter !== 'audius'}
      class="shrink-0 cursor-pointer {appStore.searchSourceFilter === 'audius'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => appStore.setSearchSourceFilter('audius')}
    >
      Audius
    </Chip>

    <Chip
      outline={appStore.searchSourceFilter !== 'local'}
      class="shrink-0 cursor-pointer {appStore.searchSourceFilter === 'local'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => appStore.setSearchSourceFilter('local')}
    >
      {i18n.t('search.sourceLocal')}
    </Chip>
  </div>

  <!-- Clean Era Filter Rail -->
  <div class="xmusic-hscroll flex items-center gap-2 px-4 pb-2">
    <Chip
      outline={appStore.eraFilter !== 'all'}
      class="shrink-0 cursor-pointer {appStore.eraFilter === 'all'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => {
        appStore.showSuggestions = false;
        appStore.setEraFilter('all');
      }}
    >
      {i18n.t('search.allEras')}
    </Chip>
    {#each ERA_PRESETS as era (era.id)}
      <Chip
        outline={appStore.eraFilter !== era.id}
        class="shrink-0 cursor-pointer {appStore.eraFilter === era.id
          ? '!bg-[#007aff] !text-white font-semibold'
          : ''}"
        onclick={() => {
          appStore.showSuggestions = false;
          appStore.setEraFilter(era.id);
        }}
      >
        {era.label}
      </Chip>
    {/each}
  </div>

  <!-- Functional Sort Bar (Relevant / Newest / Full Length) -->
  <Block class="!my-1.5">
    <Segmented strong rounded>
      <SegmentedButton
        active={appStore.searchSort === 'relevant'}
        onclick={() => appStore.setSearchSort('relevant')}
      >
        {i18n.t('search.sortRelevant')}
      </SegmentedButton>
      <SegmentedButton
        active={appStore.searchSort === 'newest'}
        onclick={() => appStore.setSearchSort('newest')}
      >
        {i18n.t('search.sortNewest')}
      </SegmentedButton>
      <SegmentedButton
        active={appStore.searchSort === 'longest'}
        onclick={() => appStore.setSearchSort('longest')}
      >
        {i18n.t('search.sortLongest')}
      </SegmentedButton>
    </Segmented>
  </Block>

  <!-- Results Header with Layout Toggle (List / Grid) -->
  <BlockTitle class="flex items-center justify-between gap-2">
    <span class="min-w-0 flex-1 truncate">
      {i18n.t('search.results', {
        query: appStore.searchQuery,
        count: appStore.filteredSearchResults.length
      })}
    </span>
    <div class="flex shrink-0 items-center gap-2">
      {#if appStore.searching}
        <Preloader class="w-4 h-4" />
      {/if}
      {#if appStore.visibleSearchResults.length > 0}
        <Button
          clear
          small
          inline
          onclick={() => (layoutMode = layoutMode === 'list' ? 'grid' : 'list')}
        >
          {layoutMode === 'list' ? i18n.t('library.viewGrid') : i18n.t('library.viewList')}
        </Button>
      {/if}
    </div>
  </BlockTitle>

  {#if appStore.searching && appStore.visibleSearchResults.length === 0}
    <Block>
      <div class="flex items-center gap-3 py-6 text-sm text-black/65 dark:text-white/65" role="status">
        <Preloader class="w-5 h-5" />
        <span>{i18n.t('search.searching')}</span>
      </div>
    </Block>
  {:else if appStore.visibleSearchResults.length > 0}
    <!-- Top Result Spotlight Card (List Mode) -->
    {#if layoutMode === 'list' && topTrack}
      <Block class="!my-2">
        <Card contentWrapPadding="p-3.5" class="!m-0 border border-black/10 dark:border-white/10">
          <div class="mb-2 text-[11px] font-bold tracking-wide text-[#007aff] uppercase dark:text-[#64d2ff]">
            {i18n.t('search.topResult')}
          </div>
          <div class="flex items-center gap-3">
            <span
              class="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-bold text-white shadow-sm"
              style={topTrack.imageUrl
                ? ''
                : `background: linear-gradient(135deg, ${topTrack.c1 || '#007aff'}, ${topTrack.c2 || '#1c1c1e'})`}
            >
              {#if topTrack.imageUrl && !brokenImages[topTrack.id]}
                <img
                  src={topTrack.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full object-cover"
                  onerror={() => (brokenImages[topTrack.id] = true)}
                />
              {:else}
                {getTrackInitial(topTrack.title)}
              {/if}
            </span>

            <div class="min-w-0 flex-1">
              <div class="truncate text-base font-bold text-black dark:text-white">
                {topTrack.title}
              </div>
              <div class="truncate text-xs text-black/60 dark:text-white/60">
                {topTrack.artist}
                {#if topTrack.releaseYear}• {topTrack.releaseYear}{/if}
              </div>
              <div class="mt-1.5 flex items-center gap-1.5">
                <Badge
                  class="{topTrack.isPreview
                    ? 'bg-[#ff9f0a]/90 text-black'
                    : 'bg-[#248a3d] text-white'} text-[10px]"
                >
                  {topTrack.isPreview ? i18n.t('common.preview30s') : i18n.t('common.full')}
                </Badge>
                {#if topTrack.dur > 0}
                  <span class="text-xs tabular-nums text-black/50 dark:text-white/50">
                    {formatTime(topTrack.dur)}
                  </span>
                {/if}
              </div>
            </div>

            <Button rounded small inline class="shrink-0" onclick={() => openAndPlay(topTrack)}>
              <span class="inline-flex items-center gap-1">
                <Icon name="play" size={13} />
                <span>{i18n.t('search.playNow')}</span>
              </span>
            </Button>
          </div>
        </Card>
      </Block>
    {/if}

    {#if layoutMode === 'list'}
      {#if restTracks.length > 0}
        <List strong inset class="!my-2">
          {#each restTracks as track (track.id)}
            <ListItem
              link
              title={track.title}
              subtitle={track.releaseYear ? `${track.artist} • ${track.releaseYear}` : track.artist}
              titleWrapClass="min-w-0"
              class="overflow-hidden"
              onclick={() => openAndPlay(track)}
            >
              {#snippet media()}
                <span
                  class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-white"
                  style={track.imageUrl
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
                      onerror={() => (brokenImages[track.id] = true)}
                    />
                  {:else}
                    {getTrackInitial(track.title)}
                  {/if}
                </span>
              {/snippet}

              {#snippet after()}
                <div class="flex shrink-0 items-center gap-1.5">
                  <Badge
                    class="{track.isPreview
                      ? 'bg-[#ff9f0a]/90 text-black'
                      : 'bg-[#248a3d] text-white'} text-[10px]"
                  >
                    {track.isPreview ? i18n.t('common.preview30s') : i18n.t('common.full')}
                  </Badge>
                  {#if track.dur > 0}
                    <span class="text-xs tabular-nums text-black/50 dark:text-white/50">
                      {formatTime(track.dur)}
                    </span>
                  {/if}
                </div>
              {/snippet}
            </ListItem>
          {/each}
        </List>
      {/if}
    {:else}
      <Block class="!my-2">
        <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {#each appStore.visibleSearchResults as track (track.id)}
            <TrackCard {track} />
          {/each}
        </div>
      </Block>
    {/if}

    {#if appStore.hasMoreSearchResults}
      <Block class="!mt-2 flex justify-center">
        <Button
          tonal
          rounded
          small
          inline
          disabled={appStore.searchLoadingMore}
          onclick={() => appStore.loadMoreSearch()}
        >
          {appStore.searchLoadingMore ? i18n.t('home.loadingMore') : i18n.t('home.loadMore')}
        </Button>
      </Block>
    {/if}
  {:else}
    <Block strong inset class="space-y-2.5">
        <p class="text-sm text-black/65 dark:text-white/65">
          {i18n.t('search.noResults', { query: appStore.searchQuery })}
        </p>
        {#if appStore.eraFilter !== 'all' || appStore.searchSourceFilter !== 'all' || appStore.fullOnlyFilter || appStore.searchSort !== 'relevant'}
          <Button
            tonal
            rounded
            small
            inline
            onclick={() => {
              appStore.setEraFilter('all');
              appStore.setSearchSourceFilter('all');
              appStore.setSearchSort('relevant');
              appStore.fullOnlyFilter = false;
            }}
          >
            {i18n.t('search.resetFilters')}
          </Button>
        {/if}
    </Block>
  {/if}
{/if}
