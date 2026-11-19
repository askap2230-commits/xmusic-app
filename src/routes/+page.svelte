<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    Link,
    Navbar,
    Page,
    Tabbar,
    TabbarLink,
    Toast,
    ToolbarPane
  } from 'konsta/svelte';

  import { engine } from '#lib/audio/engine.svelte.ts';
  import { revokeAllTrackUrls } from '#lib/db/storage.ts';
  import { appStore } from '#lib/stores/library.svelte.ts';
  import type { AppView } from '#lib/types/music.ts';
  import { formatTime } from '#lib/utils/format.ts';

  import Icon from '#lib/components/Icon.svelte';
  import PlayerBar from '#lib/components/PlayerBar.svelte';
  import QueueDrawer from '#lib/components/QueueDrawer.svelte';

  import EqualizerView from '#lib/components/views/EqualizerView.svelte';
  import HomeView from '#lib/components/views/HomeView.svelte';
  import LibraryView from '#lib/components/views/LibraryView.svelte';
  import ProfileView from '#lib/components/views/ProfileView.svelte';
  import SearchView from '#lib/components/views/SearchView.svelte';

  import DownloaderModal from '#lib/components/modals/DownloaderModal.svelte';
  import EditTrackModal from '#lib/components/modals/EditTrackModal.svelte';
  import HubModal from '#lib/components/modals/HubModal.svelte';
  import PlaylistModal from '#lib/components/modals/PlaylistModal.svelte';
  import ProfileModal from '#lib/components/modals/ProfileModal.svelte';
  import TrackModal from '#lib/components/modals/TrackModal.svelte';
  import UploadModal from '#lib/components/modals/UploadModal.svelte';

  const VIEW_TITLES: Record<AppView, string> = {
    home: 'nys Xmusic',
    search: 'Cari Musik',
    library: 'Perpustakaan',
    eq: 'EQ Studio',
    profile: 'Profil'
  };

  const navTitle = $derived(VIEW_TITLES[appStore.view]);
  const navSubtitle = $derived(
    engine.sleepMinutes !== 0
      ? `Sleep Timer: ${engine.sleepMinutes === -1 ? 'Akhir Lagu' : formatTime(engine.sleepRemainingSec)}`
      : undefined
  );

  function handlePopState(): void {
    if (appStore.closeTopOverlay()) {
      window.history.pushState({ page: 'root' }, '');
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      appStore.closeTopOverlay();
    }
  }

  onMount(async () => {
    await appStore.bootstrap();
    window.history.pushState({ page: 'root' }, '');
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleGlobalKeydown);
    }
    appStore.destroyListeners();
    engine.destroy();
    revokeAllTrackUrls();
  });
</script>

<a href="#main-content" class="skip-link">Lewati ke konten utama</a>

<Page class={engine.current ? 'pb-48' : 'pb-28'}>
  <!-- One dedicated single-action iOS glass button per side: zero cramped multi-icon pills -->
  <Navbar
    title={navTitle}
    subtitle={navSubtitle}
    large={appStore.view === 'home'}
    class="top-0 sticky z-30"
  >
    {#snippet left()}
      <Link
        iconOnly
        onclick={() => appStore.toggleTheme()}
        aria-label={appStore.isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
      >
        <Icon name={appStore.isDark ? 'sun' : 'moon'} size={20} />
      </Link>
    {/snippet}

    {#snippet right()}
      <Link
        iconOnly
        onclick={() => (appStore.npDrawerOpen = !appStore.npDrawerOpen)}
        aria-label="Buka antrean putar dan lirik"
      >
        <Icon name="queue" size={20} />
      </Link>
    {/snippet}
  </Navbar>

  <main id="main-content" tabindex="-1" class="mx-auto w-full max-w-6xl">
    {#if appStore.view === 'home'}
      <HomeView />
    {:else if appStore.view === 'search'}
      <SearchView />
    {:else if appStore.view === 'library'}
      <LibraryView />
    {:else if appStore.view === 'eq'}
      <EqualizerView />
    {:else if appStore.view === 'profile'}
      <ProfileView />
    {/if}
  </main>

  <PlayerBar />

  <Tabbar labels icons class="left-0 bottom-0 fixed z-40">
    <ToolbarPane>
      <TabbarLink
        active={appStore.view === 'home'}
        label="Beranda"
        onclick={() => (appStore.view = 'home')}
      >
        {#snippet icon()}
          <Icon name="home" size={22} />
        {/snippet}
      </TabbarLink>

      <TabbarLink
        active={appStore.view === 'search'}
        label="Cari"
        onclick={() => (appStore.view = 'search')}
      >
        {#snippet icon()}
          <Icon name="search" size={22} />
        {/snippet}
      </TabbarLink>

      <TabbarLink
        active={appStore.view === 'library'}
        label="Pustaka"
        onclick={() => (appStore.view = 'library')}
      >
        {#snippet icon()}
          <Icon name="library" size={22} />
        {/snippet}
      </TabbarLink>

      <TabbarLink
        active={appStore.view === 'eq'}
        label="EQ Studio"
        onclick={() => (appStore.view = 'eq')}
      >
        {#snippet icon()}
          <Icon name="eq" size={22} />
        {/snippet}
      </TabbarLink>

      <TabbarLink
        active={appStore.view === 'profile'}
        label="Profil"
        onclick={() => (appStore.view = 'profile')}
      >
        {#snippet icon()}
          <Icon name="profile" size={22} />
        {/snippet}
      </TabbarLink>
    </ToolbarPane>
  </Tabbar>
</Page>

<QueueDrawer />
<TrackModal />
<UploadModal />
<HubModal />
<DownloaderModal />
<EditTrackModal />
<PlaylistModal />
<ProfileModal />

<div role="status" aria-live="polite" aria-atomic="true">
  <Toast position="center" opened={Boolean(appStore.toastMsg)}>
    {appStore.toastMsg}
  </Toast>
</div>
