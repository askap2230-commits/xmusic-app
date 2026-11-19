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
        Edit Profil & API Key
      </Button>
      <Button tonal rounded small inline onclick={() => (appStore.view = 'eq')}>
        EQ Studio
      </Button>
    </div>
  </div>
</Block>

<BlockTitle>Tampilan & Tema (iOS)</BlockTitle>
<List strong inset>
  <ListItem
    label
    title="Mode Gelap (Dark Mode)"
    subtitle={appStore.themeMode === 'system'
      ? `Mengikuti sistem (${appStore.isDark ? 'Gelap' : 'Terang'})`
      : appStore.isDark
        ? 'Aktif (Mode Gelap iOS)'
        : 'Nonaktif (Mode Terang iOS)'}
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
            Otomatis
          </SegmentedButton>
          <SegmentedButton
            active={appStore.themeMode === 'light'}
            onclick={() => appStore.setThemeMode('light')}
          >
            Terang
          </SegmentedButton>
          <SegmentedButton
            active={appStore.themeMode === 'dark'}
            onclick={() => appStore.setThemeMode('dark')}
          >
            Gelap
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>
</List>

<BlockTitle>Algoritma Musik & Privasi (100% Lokal)</BlockTitle>
<List strong inset>
  <ListItem
    label
    title="Personalisasi Lokal (On-Device)"
    subtitle={appStore.algoConfig.personalizeFromHistory
      ? 'Diproses lokal dari riwayat & favorit tanpa pelacakan server'
      : 'Mode Privasi Penuh: hanya tampilkan chart viral regional'}
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
        <div class="mb-2 text-sm font-medium text-black dark:text-white">Mode Rekomendasi</div>
        <Segmented strong rounded>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'viral'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'viral' }, true)}
          >
            Viral
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'balanced'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'balanced' }, true)}
          >
            Seimbang
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'discovery'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'discovery' }, true)}
          >
            Baru
          </SegmentedButton>
          <SegmentedButton
            active={appStore.algoConfig.mode === 'nostalgia'}
            onclick={() => appStore.updateAlgorithmConfig({ mode: 'nostalgia' }, true)}
          >
            Nostalgia
          </SegmentedButton>
        </Segmented>
      </div>
    {/snippet}
  </ListItem>

  <ListItem>
    {#snippet inner()}
      <div class="w-full py-1">
        <div class="mb-2 text-sm font-medium text-black dark:text-white">Region Katalog & Viral</div>
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
        <div class="mb-2 text-sm font-medium text-black dark:text-white">Prioritas Era Musik</div>
        <div class="flex flex-wrap gap-1.5">
        <Chip
          outline={appStore.algoConfig.preferredEra !== 'all'}
          class="cursor-pointer {appStore.algoConfig.preferredEra === 'all'
            ? '!bg-[#007aff] !text-white font-semibold'
            : ''}"
          onclick={() => appStore.updateAlgorithmConfig({ preferredEra: 'all' }, true)}
        >
          Semua Era
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
        <div class="mb-2 text-sm font-medium text-black dark:text-white">Minat Genre (Maks. 4)</div>
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

  <ListItem title="Privasi & Data Algoritma" subtitle="Zero telemetri • tersimpan hanya di perangkat">
    {#snippet after()}
      <Button tonal rounded small inline onclick={() => appStore.resetAlgorithmConfig()}>
        Reset
      </Button>
    {/snippet}
  </ListItem>
</List>

<BlockTitle>Status Integrasi & Informasi Aplikasi</BlockTitle>
<List strong inset>
  <ListItem title="Koneksi Jaringan" subtitle="Status deteksi real-time aplikasi">
    {#snippet after()}
      <Badge
        class={appStore.isOnline
          ? 'bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black'
          : 'bg-zinc-600 text-white font-bold'}
      >
        {appStore.isOnline ? 'Online' : 'Offline'}
      </Badge>
    {/snippet}
  </ListItem>

  <ListItem title="Spotify Web API v1" subtitle="Deteksi sampul HD, judul, artis & durasi">
    {#snippet after()}
      <Badge
        class={hasSpotifyApi
          ? 'bg-[#248a3d] text-white font-bold dark:bg-[#30d158] dark:!text-black'
          : 'bg-[#b25000] text-white font-bold dark:bg-[#ff9f0a] dark:!text-black'}
      >
        {hasSpotifyApi ? 'Aktif' : 'oEmbed'}
      </Badge>
    {/snippet}
  </ListItem>

  <ListItem
    title="Koleksi & Favorit"
    subtitle="{appStore.playlists.length} playlist tersimpan lokal"
    after="{appStore.localTracks.length} Lagu • {appStore.likedIds.length} ♥"
  />

  <ListItem
    title="Mesin Aplikasi"
    subtitle={appStore.runtimeInfo.engine}
    after="v{appStore.runtimeInfo.version}"
  />

  <ListItem
    title="Platform & Arsitektur"
    after="{appStore.runtimeInfo.platform} / {appStore.runtimeInfo.arch}"
  />

  <ListItem
    title="Lisensi & Hak Cipta"
    subtitle="Copyright 2026 Azka Putra"
    after="AGPL-3.0"
  />
</List>
