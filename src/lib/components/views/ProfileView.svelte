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
    SegmentedButton,
    Toggle
  } from 'konsta/svelte';
  import { ALGORITHM_GENRES, ERA_PRESETS, REGION_OPTIONS } from '#lib/data/presets.ts';
  import { i18n, type Locale } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { getTrackInitial } from '#lib/utils/format.ts';
  import Icon from '../Icon.svelte';

  const hasSpotifyApi = $derived(
    Boolean(appStore.apiConfig.spotifyClientId && appStore.apiConfig.spotifyClientSecret)
  );

  const LOCALE_OPTIONS: Array<{ code: Locale; label: string }> = [
    { code: 'en', label: 'English (Global)' },
    { code: 'id', label: 'Indonesia' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'es', label: 'Español' },
    { code: 'ar', label: 'العربية' }
  ];
</script>

<!-- TikTok-Mod Style Hero Profile Banner Card (Supports Custom Video Banner & Custom Cover Photo) -->
<div class="mx-4 mt-3 overflow-hidden rounded-[28px] border border-white/35 shadow-xl xmusic-liquid-glass dark:border-white/15">
  <!-- Full-Bleed Banner Media Area -->
  <div class="relative h-44 w-full overflow-hidden bg-zinc-900 sm:h-52">
    {#if appStore.userProfile.bannerVideoUrl}
      <video
        src={appStore.userProfile.bannerVideoUrl}
        autoplay
        muted
        loop
        playsinline
        class="h-full w-full object-cover object-center"
      ></video>
    {:else if appStore.userProfile.bannerImage}
      <img
        src={appStore.userProfile.bannerImage}
        alt="Profile Banner"
        class="h-full w-full object-cover object-center"
      />
    {:else}
      <div
        class="h-full w-full"
        style="background: linear-gradient(135deg, var(--xmusic-accent, #007aff) 0%, #312e81 52%, #09090b 100%);"
      ></div>
    {/if}

    <!-- Subtle top & bottom gradient scrim for crisp contrast -->
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75"
      aria-hidden="true"
    ></div>

    <!-- Floating Quick Customize Banner Button -->
    <button
      type="button"
      class="xmusic-spring-tap xmusic-glass-pill absolute top-3 right-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-md"
      onclick={() => (appStore.editProfileOpen = true)}
    >
      <Icon name="video" size={14} />
      <span>Custom Banner</span>
    </button>
  </div>

  <!-- Profile Avatar, Identity & Stats Row -->
  <div class="relative px-5 pb-5">
    <div class="-mt-11 mb-3 flex items-end justify-between gap-3">
      <div
        class="grid h-22 w-22 shrink-0 place-items-center rounded-full border-4 border-white/90 bg-[#007aff] bg-cover bg-center text-3xl font-black text-white shadow-lg dark:border-zinc-900 dark:bg-[#0a84ff]"
        style={appStore.userProfile.image
          ? `background-image:url(${appStore.userProfile.image}); color:transparent;`
          : ''}
        aria-hidden="true"
      >
        {appStore.userProfile.image ? '' : getTrackInitial(appStore.userProfile.name)}
      </div>

      <div class="flex flex-wrap gap-2 pb-1">
        <Button rounded small inline onclick={() => (appStore.editProfileOpen = true)}>
          {i18n.t('profile.editApi')}
        </Button>
        <Button tonal rounded small inline onclick={() => (appStore.view = 'eq')}>
          {i18n.t('nav.eq')}
        </Button>
      </div>
    </div>

    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-extrabold tracking-tight text-black dark:text-white">
          {appStore.userProfile.name}
        </h2>
        <span class="rounded-full bg-[#007aff]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#007aff] dark:bg-[#0a84ff]/25 dark:text-[#64d2ff]">
          PRO AUDIO
        </span>
      </div>
      <div class="text-xs font-semibold text-[#007aff] dark:text-[#64d2ff]">
        {appStore.userProfile.handle}
      </div>
      <p class="pt-0.5 text-sm leading-relaxed text-black/75 dark:text-white/75">
        {appStore.userProfile.bio}
      </p>
    </div>

    <!-- Clean 3-Column Profile Stats Strip -->
    <div class="mt-4 grid grid-cols-3 divide-x divide-black/10 rounded-2xl bg-black/5 py-2.5 text-center dark:divide-white/10 dark:bg-white/8">
      <div>
        <div class="text-base font-extrabold tabular-nums text-black dark:text-white">
          {appStore.localTracks.length}
        </div>
        <div class="text-[11px] font-medium text-black/60 dark:text-white/60">Tracks</div>
      </div>
      <div>
        <div class="text-base font-extrabold tabular-nums text-black dark:text-white">
          {appStore.likedIds.length}
        </div>
        <div class="text-[11px] font-medium text-black/60 dark:text-white/60">Favorites</div>
      </div>
      <div>
        <div class="text-base font-extrabold tabular-nums text-black dark:text-white">
          {appStore.playlists.length}
        </div>
        <div class="text-[11px] font-medium text-black/60 dark:text-white/60">Playlists</div>
      </div>
    </div>
  </div>
</div>

<!-- International Multi-Language & Liquid Glass Style Selector -->
<BlockTitle>{i18n.t('profile.languageSection')}</BlockTitle>
<List strong inset>
  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-1 text-sm font-medium text-black dark:text-white">
          {i18n.t('profile.languageTitle')}
        </div>
        <div class="mb-2.5 text-xs text-black/55 dark:text-white/55">
          {i18n.t('profile.languageSub')}
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each LOCALE_OPTIONS as loc (loc.code)}
            <Chip
              outline={i18n.locale !== loc.code}
              class="cursor-pointer {i18n.locale === loc.code
                ? '!bg-[#007aff] !text-white font-semibold'
                : ''}"
              onclick={() => i18n.setLocale(loc.code)}
            >
              {loc.label}
            </Chip>
          {/each}
        </div>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-1 text-sm font-medium text-black dark:text-white">
          Interface Visual Style
        </div>
        <div class="mb-2.5 text-xs text-black/55 dark:text-white/55">
          iOS 27 Liquid Glass adaptive refraction or crisp Editorial layout
        </div>
        <Segmented strong rounded>
          <SegmentedButton
            active={appStore.uiStyle === 'liquid-glass'}
            onclick={() => appStore.setUiStyle('liquid-glass')}
          >
            Liquid Glass
          </SegmentedButton>
          <SegmentedButton
            active={appStore.uiStyle === 'editorial'}
            onclick={() => appStore.setUiStyle('editorial')}
          >
            Editorial
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>
</List>

<BlockTitle>{i18n.t('profile.appearanceSection')}</BlockTitle>
<List strong inset>
  <ListItem
    label
    title={i18n.t('profile.darkMode')}
    subtitle={appStore.themeMode === 'system'
      ? i18n.t('profile.themeAutoStatus', {
          mode: appStore.isDark ? i18n.t('profile.themeDark') : i18n.t('profile.themeLight')
        })
      : appStore.isDark
        ? i18n.t('profile.themeDarkActive')
        : i18n.t('profile.themeLightActive')}
  >
    {#snippet after()}
      <Toggle
        component="div"
        checked={appStore.isDark}
        onChange={() => appStore.toggleTheme()}
      />
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <Segmented strong rounded>
          <SegmentedButton
            active={appStore.themeMode === 'system'}
            onclick={() => appStore.setThemeMode('system')}
          >
            {i18n.t('profile.themeAuto')}
          </SegmentedButton>
          <SegmentedButton
            active={appStore.themeMode === 'light'}
            onclick={() => appStore.setThemeMode('light')}
          >
            {i18n.t('profile.themeLight')}
          </SegmentedButton>
          <SegmentedButton
            active={appStore.themeMode === 'dark'}
            onclick={() => appStore.setThemeMode('dark')}
          >
            {i18n.t('profile.themeDark')}
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>
</List>

<BlockTitle>{i18n.t('profile.algoSection')}</BlockTitle>
<List strong inset>
  <ListItem
    label
    title={i18n.t('profile.personalizeTitle')}
    subtitle={appStore.algoConfig.personalizeFromHistory
      ? i18n.t('profile.personalizeOn')
      : i18n.t('profile.personalizeOff')}
  >
    {#snippet after()}
      <Toggle
        component="div"
        checked={appStore.algoConfig.personalizeFromHistory}
        onChange={() =>
          appStore.updateAlgorithmConfig(
            { personalizeFromHistory: !appStore.algoConfig.personalizeFromHistory },
            false
          )}
      />
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-2 text-sm font-medium text-black dark:text-white">
          {i18n.t('profile.algoMode')}
        </div>
        <Segmented strong rounded>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'viral'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'viral' }, true)}
          >
            {i18n.t('profile.modeViral')}
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'balanced'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'balanced' }, true)}
          >
            {i18n.t('profile.modeBalanced')}
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'discovery'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'discovery' }, true)}
          >
            {i18n.t('profile.modeDiscovery')}
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'nostalgia'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'nostalgia' }, true)}
          >
            {i18n.t('profile.modeNostalgia')}
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-2 text-sm font-medium text-black dark:text-white">
          {i18n.t('profile.regionLabel')}
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each REGION_OPTIONS as reg (reg.code)}
            <Chip
              outline={appStore.algoConfig.region !== reg.code}
              class="cursor-pointer {appStore.algoConfig.region === reg.code
                ? '!bg-[#007aff] !text-white font-semibold'
                : ''}"
              onclick={() => appStore.updateAlgorithmConfig({ region: reg.code }, true)}
            >
              {reg.label}
            </Chip>
          {/each}
        </div>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-2 text-sm font-medium text-black dark:text-white">
          {i18n.t('profile.eraPriority')}
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Chip
            outline={appStore.algoConfig.preferredEra !== 'all'}
            class="cursor-pointer {appStore.algoConfig.preferredEra === 'all'
              ? '!bg-[#007aff] !text-white font-semibold'
              : ''}"
            onclick={() => appStore.updateAlgorithmConfig({ preferredEra: 'all' }, true)}
          >
            {i18n.t('search.allEras')}
          </Chip>
          {#each ERA_PRESETS as era (era.id)}
            <Chip
              outline={appStore.algoConfig.preferredEra !== era.id}
              class="cursor-pointer {appStore.algoConfig.preferredEra === era.id
                ? '!bg-[#007aff] !text-white font-semibold'
                : ''}"
              onclick={() => appStore.updateAlgorithmConfig({ preferredEra: era.id }, true)}
            >
              {era.label}
            </Chip>
          {/each}
        </div>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-2 text-sm font-medium text-black dark:text-white">
          {i18n.t('profile.genreInterest')}
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each ALGORITHM_GENRES as genre}
            {@const selected = appStore.algoConfig.preferredGenres.includes(genre)}
            <Chip
              outline={!selected}
              class="cursor-pointer {selected ? '!bg-[#007aff] !text-white font-semibold' : ''}"
              onclick={() => appStore.toggleAlgorithmGenre(genre)}
            >
              {genre}
            </Chip>
          {/each}
        </div>
      </div>
    {/snippet}
  </ListItem>

  <ListItem title={i18n.t('profile.privacyTitle')} subtitle={i18n.t('profile.privacySub')}>
    {#snippet after()}
      <Button tonal rounded small inline onclick={() => appStore.resetAlgorithmConfig()}>
        {i18n.t('profile.resetBtn')}
      </Button>
    {/snippet}
  </ListItem>
</List>

<BlockTitle>{i18n.t('profile.statusSection')}</BlockTitle>
<List strong inset>
  <ListItem title={i18n.t('profile.networkStatus')} subtitle={i18n.t('profile.networkSub')}>
    {#snippet after()}
      <Badge
        class={appStore.isOnline
          ? 'bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black'
          : 'bg-zinc-600 text-white font-bold'}
      >
        {appStore.isOnline ? i18n.t('profile.online') : i18n.t('profile.offline')}
      </Badge>
    {/snippet}
  </ListItem>

  <ListItem title={i18n.t('profile.ytFossTitle')} subtitle={i18n.t('profile.ytFossSub')}>
    {#snippet after()}
      <Badge class="bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black">
        {i18n.t('profile.active')}
      </Badge>
    {/snippet}
  </ListItem>

  <ListItem title="Spotify Web API v1" subtitle="HD cover, title, artist & metadata">
    {#snippet after()}
      <Badge
        class={hasSpotifyApi
          ? 'bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black'
          : 'bg-[#b25000] text-white font-bold dark:bg-[#ff9f0a] dark:!text-black'}
      >
        {hasSpotifyApi ? i18n.t('profile.active') : 'oEmbed'}
      </Badge>
    {/snippet}
  </ListItem>

  <ListItem
    title={i18n.t('profile.collectionFav')}
    subtitle="{appStore.playlists.length} playlists"
    after="{appStore.localTracks.length} • {appStore.likedIds.length} ♥"
  />

  <ListItem
    title={i18n.t('profile.appEngine')}
    subtitle={appStore.runtimeInfo.engine}
    after="v{appStore.runtimeInfo.version}"
  />

  <ListItem
    title={i18n.t('profile.platformArch')}
    after="{appStore.runtimeInfo.platform} / {appStore.runtimeInfo.arch}"
  />

  <ListItem
    title={i18n.t('profile.licenseTitle')}
    subtitle="Copyright 2026 Azka Putra"
    after="AGPL-3.0"
  />
</List>
