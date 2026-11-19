<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import {
    Badge,
    Button,
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

  $effect(() => {
    if (appStore.isOnline && appStore.visibleSearchResults.length > 0) {
      engine.prewarmTracks(appStore.visibleSearchResults, 4);
    }
  });

  function openAndPlay(track: Track): void {
    appStore.showSuggestions = false;
    engine.playTrack(track, appStore.filteredSearchResults);
    appStore.openTrackModal(track, false);
  }

  function handleSearchSubmit(event: SubmitEvent): void {
    event.preventDefault();
    appStore.showSuggestions = false;
    if (appStore.searchQuery.trim()) {
      appStore.updateSearch(appStore.searchQuery, true);
    }
  }
</script>

<div class="mx-auto flex w-full flex-col gap-4 px-4 pt-3 pb-4">
  <!-- Search Input Header (Clean Container, Zero Extra Block Margin) -->
  <form class="w-full" role="search" onsubmit={handleSearchSubmit}>
    <Searchbar
      placeholder={i18n.t('search.placeholder')}
      value={appStore.searchQuery}
      onInput={(e: Event) => appStore.updateSearch((e.target as HTMLInputElement).value)}
      onClear={() => appStore.updateSearch('')}
    />
  </form>

  <!-- Real-Time Smart Suggestions Panel (Bounded, Scrollable, Non-Overlapping) -->
  {#if appStore.showSuggestions && appStore.searchQuery.trim().length > 0 && (appStore.searchSuggestions.length > 0 || appStore.suggesting)}
    <section class="flex flex-col gap-1.5" aria-label={i18n.t('search.suggesting')}>
      <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <span class="flex items-center gap-2 text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
          {#if appStore.suggesting}
            <Preloader class="w-3.5 h-3.5" />
          {/if}
          <span>{i18n.t('search.suggesting')}</span>
        </span>
        <Button clear small inline onclick={() => (appStore.showSuggestions = false)}>
          {i18n.t('search.hideSuggestions')}
        </Button>
      </div>

      <List strong inset class="!mx-0 !my-0 max-h-72 overflow-y-auto">
        {#each appStore.searchSuggestions as sug (sug.id)}
          <ListItem
            title={sug.title}
            subtitle={sug.subtitle}
            titleWrapClass="min-w-0 flex-1"
            class="cursor-pointer overflow-hidden"
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
      </List>
    </section>
  {/if}

  <!-- Offline Notice Banner -->
  {#if !appStore.isOnline}
    <div class="flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3.5 dark:border-white/10 dark:bg-[#1c1c1e]">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#007aff]/15 text-[#007aff] dark:bg-[#0a84ff]/20 dark:text-[#64d2ff]">
        <Icon name="wifi-off" size={18} />
      </span>
      <p class="min-w-0 flex-1 text-xs leading-relaxed text-black/65 dark:text-white/65">
        {i18n.t('search.offlineNotice')}
      </p>
    </div>
  {/if}

  {#if !appStore.searchQuery.trim()}
    <!-- Empty Search Discovery Hub -->
    {#if appStore.recentSearches.length > 0}
      <section class="flex flex-col gap-2">
        <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
          <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
            {i18n.t('search.recent')}
          </h2>
          <Button clear small inline onclick={() => appStore.clearRecentSearches()}>
            {i18n.t('search.clear')}
          </Button>
        </div>
        <div class="xmusic-hscroll -mx-4 flex items-center gap-2 px-4 py-0.5">
          {#each appStore.recentSearches as recent (recent)}
            <Chip
              outline
              deleteButton
              class="shrink-0 cursor-pointer whitespace-nowrap"
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
      </section>
    {/if}

    <section class="flex flex-col gap-2">
      <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
          {i18n.t('search.trending')}
        </h2>
      </div>
      <div class="xmusic-hscroll -mx-4 flex items-center gap-2 px-4 py-0.5">
        {#each TRENDING_QUERIES as term}
          <Chip
            outline
            class="shrink-0 cursor-pointer whitespace-nowrap"
            onclick={() => appStore.updateSearch(term, true)}
          >
            {term}
          </Chip>
        {/each}
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
          {i18n.t('search.eraExplore')}
        </h2>
      </div>
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {#each ERA_PRESETS as era (era.id)}
          <button
            type="button"
            class="flex h-full min-h-[72px] w-full flex-col justify-center rounded-2xl border border-black/8 bg-white p-3.5 text-left shadow-xs transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#1c1c1e]"
            onclick={() => appStore.exploreEra(era.id)}
          >
            <span class="flex w-full items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                style="background-color: {era.accent};"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-white">
                {era.label}
              </span>
            </span>
            <span class="mt-1 block w-full truncate text-xs text-black/55 dark:text-white/55">
              {era.sub}
            </span>
          </button>
        {/each}
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
        <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
          {i18n.t('search.genreExplore')}
        </h2>
      </div>
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {#each CATEGORIES as cat}
          <button
            type="button"
            class="flex h-full min-h-[72px] w-full flex-col justify-center rounded-2xl border border-black/8 bg-white p-3.5 text-left shadow-xs transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#1c1c1e]"
            onclick={() => appStore.updateSearch(cat.q, true)}
          >
            <span class="flex w-full items-center gap-2">
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                style="background-color: {cat.accent};"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-white">
                {cat.label}
              </span>
            </span>
            <span class="mt-1 block w-full truncate text-xs text-black/55 dark:text-white/55">
              {cat.sub}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {:else}
    <!-- Filter Controls Group (Source Rail + Era Rail + Sort Bar) -->
    <section class="flex flex-col gap-2.5">
      <!-- Source Filter Rail -->
      <div class="xmusic-hscroll -mx-4 flex items-center gap-2 px-4 py-0.5">
        <Chip
          outline={!appStore.fullOnlyFilter}
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.fullOnlyFilter
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
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.searchSourceFilter === 'all'
            ? '!bg-[#007aff] !text-white font-semibold'
            : ''}"
          onclick={() => appStore.setSearchSourceFilter('all')}
        >
          {i18n.t('search.sourceAll')}
        </Chip>

        <Chip
          outline={appStore.searchSourceFilter !== 'youtube'}
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.searchSourceFilter === 'youtube'
            ? '!bg-[#007aff] !text-white font-semibold'
            : ''}"
          onclick={() => appStore.setSearchSourceFilter('youtube')}
        >
          YouTube Music
        </Chip>

        <Chip
          outline={appStore.searchSourceFilter !== 'audius'}
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.searchSourceFilter === 'audius'
            ? '!bg-[#007aff] !text-white font-semibold'
            : ''}"
          onclick={() => appStore.setSearchSourceFilter('audius')}
        >
          Audius
        </Chip>

        <Chip
          outline={appStore.searchSourceFilter !== 'local'}
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.searchSourceFilter === 'local'
            ? '!bg-[#007aff] !text-white font-semibold'
            : ''}"
          onclick={() => appStore.setSearchSourceFilter('local')}
        >
          {i18n.t('search.sourceLocal')}
        </Chip>
      </div>

      <!-- Era Filter Rail -->
      <div class="xmusic-hscroll -mx-4 flex items-center gap-2 px-4 py-0.5">
        <Chip
          outline={appStore.eraFilter !== 'all'}
          class="shrink-0 cursor-pointer whitespace-nowrap {appStore.eraFilter === 'all'
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
            class="shrink-0 cursor-pointer whitespace-nowrap {appStore.eraFilter === era.id
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

      <!-- Functional Sort Bar (Single-Line Aligned Segmented Control) -->
      <Segmented strong rounded class="w-full">
        <SegmentedButton
          active={appStore.searchSort === 'relevant'}
          class="min-w-0 px-1.5 text-xs whitespace-nowrap"
          onclick={() => appStore.setSearchSort('relevant')}
        >
          {i18n.t('search.sortRelevant')}
        </SegmentedButton>
        <SegmentedButton
          active={appStore.searchSort === 'newest'}
          class="min-w-0 px-1.5 text-xs whitespace-nowrap"
          onclick={() => appStore.setSearchSort('newest')}
        >
          {i18n.t('search.sortNewest')}
        </SegmentedButton>
        <SegmentedButton
          active={appStore.searchSort === 'longest'}
          class="min-w-0 px-1.5 text-xs whitespace-nowrap"
          onclick={() => appStore.setSearchSort('longest')}
        >
          {i18n.t('search.sortLongest')}
        </SegmentedButton>
      </Segmented>
    </section>

    <!-- Results Header Row with Layout Toggle -->
    <div class="flex min-h-7 items-center justify-between gap-2 px-0.5">
      <h2 class="min-w-0 flex-1 truncate text-xs font-bold tracking-wide text-black/55 uppercase dark:text-white/55">
        {i18n.t('search.results', {
          query: appStore.searchQuery,
          count: appStore.filteredSearchResults.length
        })}
      </h2>
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
    </div>

    {#if appStore.searching && appStore.visibleSearchResults.length === 0}
      <div
        class="flex items-center justify-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-8 text-sm text-black/65 dark:border-white/10 dark:bg-[#1c1c1e] dark:text-white/65"
        role="status"
      >
        <Preloader class="w-5 h-5" />
        <span>{i18n.t('search.searching')}</span>
      </div>
    {:else if appStore.visibleSearchResults.length > 0}
      <!-- Top Result Spotlight Card (List Mode, Balanced Mobile Proportions) -->
      {#if layoutMode === 'list' && topTrack}
        <div
          class="flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#1c1c1e]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-bold tracking-wide text-[#007aff] uppercase dark:text-[#64d2ff]">
              {i18n.t('search.topResult')}
            </span>
            <div class="flex shrink-0 items-center gap-1.5">
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

          <div class="flex items-center gap-3">
            <span
              class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl text-base font-bold text-white shadow-xs"
              style={topTrack.imageUrl && !brokenImages[topTrack.id]
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
              <div class="truncate text-sm font-bold text-black dark:text-white">
                {topTrack.title}
              </div>
              <div class="mt-0.5 truncate text-xs text-black/60 dark:text-white/60">
                {topTrack.artist}{#if topTrack.releaseYear} • {topTrack.releaseYear}{/if}
              </div>
            </div>

            <button
              type="button"
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#007aff] text-white shadow-xs transition-transform active:scale-95 dark:bg-[#0a84ff]"
              aria-label={`${i18n.t('search.playNow')} ${topTrack.title}`}
              onpointerdown={() => engine.prewarmTrack(topTrack)}
              onclick={() => openAndPlay(topTrack)}
            >
              <Icon name="play" size={16} />
            </button>
          </div>
        </div>
      {/if}

      {#if layoutMode === 'list'}
        {#if restTracks.length > 0}
          <List strong inset class="!mx-0 !my-0 overflow-hidden">
            {#each restTracks as track (track.id)}
              <ListItem
                title={track.title}
                subtitle={track.releaseYear ? `${track.artist} • ${track.releaseYear}` : track.artist}
                titleWrapClass="min-w-0 flex-1"
                class="cursor-pointer overflow-hidden"
                onpointerdown={() => engine.prewarmTrack(track)}
                onclick={() => openAndPlay(track)}
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
        <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {#each appStore.visibleSearchResults as track (track.id)}
            <TrackCard {track} />
          {/each}
        </div>
      {/if}

      {#if appStore.hasMoreSearchResults}
        <div class="flex justify-center pt-1">
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
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-start gap-3 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
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
      </div>
    {/if}
  {/if}
</div>
