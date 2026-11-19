<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import { onDestroy, onMount } from 'svelte';
  import {
    Badge,
    Fab,
    Link,
    Navbar,
    Page,
    Searchbar,
    Tabbar,
    TabbarLink,
    Toast,
    ToolbarPane
  } from 'konsta/svelte';

  import { engine } from '#lib/audio/engine.svelte.js';
  import { revokeAllTrackUrls } from '#lib/db/storage.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { formatTime } from '#lib/utils/format.js';

  import DynamicBar from '#lib/components/DynamicBar.svelte';
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

  const navTitle = $derived.by(() => {
    const titles = {
      home: 'nys Xmusic',
      search: 'Cari Musik',
      library: 'Perpustakaan',
      eq: 'EQ Studio',
      profile: 'Profil'
    };
    return titles[appStore.view] || 'nys Xmusic';
  });

  function handlePopState() {
    if (appStore.closeTopOverlay()) {
      window.history.pushState({ page: 'root' }, '');
    }
  }

  function handleGlobalKeydown(event) {
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
    appStore.destroyTheme();
    engine.destroy();
    revokeAllTrackUrls();
  });
</script>

<a href="#main-content" class="skip-link">Lewati ke konten utama</a>

<DynamicBar />

<Page class="pb-40">
  <Navbar title={navTitle} large={appStore.view === 'home'} class="top-0 sticky z-30">
    {#snippet right()}
      <div class="flex items-center gap-1">
        {#if engine.sleepMinutes !== 0}
          <Link onclick={() => (appStore.view = 'eq')} aria-label="Sleep Timer aktif">
            <Badge class="bg-[#007aff] text-white text-xs dark:bg-[#0a84ff]">
              {engine.sleepMinutes === -1 ? 'Akhir' : formatTime(engine.sleepRemainingSec)}
            </Badge>
          </Link>
        {/if}

        <Link
          iconOnly
          onclick={() => appStore.toggleTheme()}
          aria-label={appStore.isDark ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
        >
          <Icon name={appStore.isDark ? 'sun' : 'moon'} size={20} />
        </Link>

        <Link
          iconOnly
          onclick={() => (appStore.hubModalOpen = true)}
          aria-label="Buka Hub Spotify dan YouTube"
        >
          <Icon name="link" size={20} />
        </Link>

        <Link
          iconOnly
          onclick={() => (appStore.npDrawerOpen = !appStore.npDrawerOpen)}
          aria-label="Buka antrean putar dan lirik"
        >
          <Icon name="queue" size={20} />
        </Link>
      </div>
    {/snippet}

    {#snippet subnavbar()}
      {#if appStore.view === 'search'}
        <Searchbar
          placeholder="Cari lagu, artis, atau genre..."
          value={appStore.searchQuery}
          onInput={(e) => appStore.updateSearch(e.target.value)}
          onClear={() => appStore.updateSearch('')}
        />
      {/if}
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

  <Fab
    class="fixed right-4 bottom-36 z-30"
    onclick={() => (appStore.uploadModalOpen = true)}
    aria-label="Unggah lagu baru"
  >
    {#snippet icon()}
      <Icon name="plus" size={22} />
    {/snippet}
  </Fab>

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
