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
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import { getTrackInitial } from '#lib/utils/format.ts';

  const hasSpotifyApi = $derived(
    Boolean(appStore.apiConfig.spotifyClientId && appStore.apiConfig.spotifyClientSecret)
  );
</script>

<Block strong inset class="flex flex-wrap items-center gap-4">
  <div
    class="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#007aff] bg-cover bg-center text-3xl font-extrabold text-white dark:bg-[#0a84ff]"
    style={appStore.userProfile.image
      ? `background-image:url(${appStore.userProfile.image}); color:transparent;`
      : ''}
    aria-hidden="true"
  >
    {appStore.userProfile.image ? '' : getTrackInitial(appStore.userProfile.name)}
  </div>

  <div class="min-w-[200px] flex-1 space-y-1">
    <h2 class="text-xl font-bold text-black dark:text-white">{appStore.userProfile.name}</h2>
    <div class="text-sm font-medium text-[#007aff] dark:text-[#64d2ff]">{appStore.userProfile.handle}</div>
    <p class="text-sm text-black/65 dark:text-white/65">{appStore.userProfile.bio}</p>
    <div class="flex flex-wrap gap-2 pt-2">
      <Button rounded small inline onclick={() => (appStore.editProfileOpen = true)}>
        {i18n.t('profile.editApi')}
      </Button>
      <Button tonal rounded small inline onclick={() => (appStore.view = 'eq')}>
        {i18n.t('nav.eq')}
      </Button>
    </div>
  </div>
</Block>

<!-- Multi-Language Selector (i18n: Indonesia / English) -->
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
        <Segmented strong rounded>
          <SegmentedButton
            active={i18n.locale === 'id'}
            onclick={() => i18n.setLocale('id')}
          >
            Indonesia
          </SegmentedButton>
          <SegmentedButton
            active={i18n.locale === 'en'}
            onclick={() => i18n.setLocale('en')}
          >
            English
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-1 text-sm font-medium text-black dark:text-white">
          Gaya Tampilan Antarmuka
        </div>
        <div class="mb-2.5 text-xs text-black/55 dark:text-white/55">
          Pilih efek kaca transparan adaptif (Liquid Glass iOS 26) atau tampilan Editorial tajam
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
