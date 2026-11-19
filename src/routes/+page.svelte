<script>
  import { onDestroy, onMount } from 'svelte';
  import { engine } from '#lib/audio/engine.svelte.js';
  import { revokeAllTrackUrls } from '#lib/db/storage.js';
  import { appStore } from '#lib/stores/library.svelte.js';

  import DynamicBar from '#lib/components/DynamicBar.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MobileNav from '#lib/components/MobileNav.svelte';
  import PlayerBar from '#lib/components/PlayerBar.svelte';
  import QueueDrawer from '#lib/components/QueueDrawer.svelte';
  import Sidebar from '#lib/components/Sidebar.svelte';
  import Topbar from '#lib/components/Topbar.svelte';

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
    engine.destroy();
    revokeAllTrackUrls();
  });
</script>

<a href="#main-content" class="skip-link">Lewati ke konten utama</a>

<DynamicBar />

<div class="app" class:np-open={appStore.npDrawerOpen}>
  <Sidebar />

  <main id="main-content" class="panel main" tabindex="-1">
    <Topbar />

    <div class="content">
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
    </div>
  </main>

  <QueueDrawer />
  <PlayerBar />
  <MobileNav />
</div>

<button
  type="button"
  class="fab"
  aria-label="Unggah lagu baru"
  title="Upload Lagu Baru"
  onclick={() => (appStore.uploadModalOpen = true)}
>
  <Icon name="plus" size={22} />
</button>

<TrackModal />
<UploadModal />
<HubModal />
<DownloaderModal />
<EditTrackModal />
<PlaylistModal />
<ProfileModal />

<div class="toast-region" role="status" aria-live="polite" aria-atomic="true">
  {#if appStore.toastMsg}
    <div class="toast">{appStore.toastMsg}</div>
  {/if}
</div>
