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
    Searchbar
  } from 'konsta/svelte';
  import { engine } from '#lib/audio/engine.svelte.ts';
  import { CATEGORIES, ERA_PRESETS, TRENDING_QUERIES } from '#lib/data/presets.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import Icon from '../Icon.svelte';
  import TrackCard from '../TrackCard.svelte';

  const SOURCE_TABS: Array<{ id: 'all' | 'youtube' | 'audius' | 'local'; label: string }> = [
    { id: 'all', label: 'Semua' },
    { id: 'youtube', label: 'YouTube Music' },
    { id: 'audius', label: 'Audius' },
    { id: 'local', label: 'Lokal' }
  ];
</script>

<Block class="!mb-2">
  <Searchbar
    placeholder="Cari lagu, artis, atau tahun (1900–2026)..."
    value={appStore.searchQuery}
    onInput={(e: Event) => appStore.updateSearch((e.target as HTMLInputElement).value)}
    onClear={() => appStore.updateSearch('')}
  />
</Block>

<!-- Smart Real-Time Autocomplete Suggestions -->
{#if appStore.showSuggestions && appStore.searchQuery.trim().length > 0 && (appStore.searchSuggestions.length > 0 || appStore.suggesting)}
  <div class="mb-2">
    <List strong inset class="!my-1">
      {#if appStore.suggesting && appStore.searchSuggestions.length === 0}
        <ListItem title="Mencari sugesti real-time...">
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
            onclick={() => appStore.applySuggestion(sug)}
          >
            {#snippet media()}
              <span class="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-[#007aff] dark:bg-white/10 dark:text-[#64d2ff]">
                <Icon name={sug.kind === 'era' ? 'spark' : sug.track ? 'music' : 'search'} size={15} />
              </span>
            {/snippet}
            {#snippet after()}
              <div class="flex items-center gap-1.5">
                {#if sug.year}
                  <Badge class="bg-black/10 text-black text-[11px] dark:bg-white/15 dark:text-white">
                    {sug.year}
                  </Badge>
                {/if}
                {#if sug.track}
                  <button
                    type="button"
                    class="grid h-8 w-8 place-items-center rounded-full bg-[#007aff] text-white active:scale-95 dark:bg-[#0a84ff]"
                    aria-label="Putar {sug.title}"
                    onclick={(e: MouseEvent) => {
                      e.stopPropagation();
                      if (sug.track) {
                        appStore.showSuggestions = false;
                        engine.playTrack(sug.track, appStore.allTracks);
                        appStore.openTrackModal(sug.track, false);
                      }
                    }}
                  >
                    <Icon name="play" size={13} />
                  </button>
                {/if}
              </div>
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
      Sedang offline: pencarian hanya menampilkan lagu dari koleksi lokal perangkatmu.
    </p>
  </Block>
{/if}

{#if !appStore.searchQuery.trim()}
  {#if appStore.recentSearches.length > 0}
    <BlockTitle class="flex items-center justify-between">
      <span>Pencarian Terakhir</span>
      <Button clear small inline onclick={() => appStore.clearRecentSearches()}>
        Hapus
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

  <BlockTitle>Populer Dicari</BlockTitle>
  <div class="xmusic-hscroll flex gap-2 px-4 py-1">
    {#each TRENDING_QUERIES as term}
      <Chip outline class="shrink-0 cursor-pointer" onclick={() => appStore.updateSearch(term, true)}>
        {term}
      </Chip>
    {/each}
  </div>

  <BlockTitle>Jelajah Lintas Era (1900–2026)</BlockTitle>
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

  <BlockTitle>Telusuri Genre & Suasana</BlockTitle>
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
  <!-- Compact Horizontal Source Filter Rail -->
  <div class="xmusic-hscroll flex items-center gap-2 px-4 pt-1 pb-1.5">
    <Chip
      outline={!appStore.fullOnlyFilter}
      class="shrink-0 cursor-pointer {appStore.fullOnlyFilter
        ? '!bg-[#248a3d] !text-white font-semibold dark:!bg-[#30d158] dark:!text-black'
        : ''}"
      onclick={() => appStore.toggleFullOnly()}
    >
      Hanya Penuh
    </Chip>

    {#each SOURCE_TABS as tab (tab.id)}
      <Chip
        outline={appStore.searchSourceFilter !== tab.id}
        class="shrink-0 cursor-pointer {appStore.searchSourceFilter === tab.id
          ? '!bg-[#007aff] !text-white font-semibold'
          : ''}"
        onclick={() => appStore.setSearchSourceFilter(tab.id)}
      >
        {tab.label}
      </Chip>
    {/each}
  </div>

  <!-- Compact Horizontal Era Filter Rail -->
  <div class="xmusic-hscroll flex items-center gap-2 px-4 pb-2">
    <Chip
      outline={appStore.eraFilter !== 'all'}
      class="shrink-0 cursor-pointer {appStore.eraFilter === 'all'
        ? '!bg-[#007aff] !text-white font-semibold'
        : ''}"
      onclick={() => appStore.setEraFilter('all')}
    >
      Semua Era
    </Chip>
    {#each ERA_PRESETS as era (era.id)}
      <Chip
        outline={appStore.eraFilter !== era.id}
        class="shrink-0 cursor-pointer {appStore.eraFilter === era.id
          ? '!bg-[#007aff] !text-white font-semibold'
          : ''}"
        onclick={() => appStore.setEraFilter(era.id)}
      >
        {era.label}
      </Chip>
    {/each}
  </div>

  <BlockTitle class="flex items-center justify-between">
    <span class="truncate">
      Hasil "{appStore.searchQuery}" ({appStore.filteredSearchResults.length})
    </span>
    {#if appStore.searching}
      <Preloader class="w-4 h-4 shrink-0" />
    {/if}
  </BlockTitle>

  <Block class="space-y-3">
    {#if appStore.searching && appStore.visibleSearchResults.length === 0}
      <div class="flex items-center gap-3 py-6 text-sm text-black/65 dark:text-white/65" role="status">
        <Preloader class="w-5 h-5" />
        <span>Mencari lagu di YouTube Music, Audius & Katalog 1900–2026...</span>
      </div>
    {:else if appStore.visibleSearchResults.length > 0}
      <div class="xmusic-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each appStore.visibleSearchResults as track (track.id)}
          <TrackCard {track} />
        {/each}
      </div>

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
            {appStore.searchLoadingMore ? 'Memuat hasil lainnya...' : 'Muat Lebih Banyak'}
          </Button>
        </div>
      {/if}
    {:else}
      <Block strong inset class="!mx-0 space-y-2.5">
        <p class="text-sm text-black/65 dark:text-white/65">
          Tidak ditemukan lagu yang cocok pada filter ini untuk "{appStore.searchQuery}".
        </p>
        {#if appStore.eraFilter !== 'all' || appStore.searchSourceFilter !== 'all' || appStore.fullOnlyFilter}
          <Button
            tonal
            rounded
            small
            inline
            onclick={() => {
              appStore.setEraFilter('all');
              appStore.setSearchSourceFilter('all');
              appStore.fullOnlyFilter = false;
            }}
          >
            Reset Semua Filter
          </Button>
        {/if}
      </Block>
    {/if}
  </Block>
{/if}
