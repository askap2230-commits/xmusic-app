<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import {
    Badge,
    Block,
    BlockTitle,
    Button,
    List,
    ListItem,
    Segmented,
    SegmentedButton,
    Toggle
  } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTrackInitial } from '#lib/utils/format.js';

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
    <h2 class="text-xl font-bold text-zinc-950 dark:text-white">{appStore.userProfile.name}</h2>
    <div class="text-sm font-medium text-[#007aff] dark:text-[#64d2ff]">{appStore.userProfile.handle}</div>
    <p class="text-sm text-zinc-600 dark:text-zinc-300">{appStore.userProfile.bio}</p>
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

<BlockTitle>Status Integrasi & Informasi Aplikasi</BlockTitle>
<List strong inset>
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
