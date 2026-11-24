<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
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
  import { i18n } from '#lib/i18n/index.svelte.ts';
  import type { TranslationKey } from '#lib/i18n/index.svelte.ts';
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

  const VIEW_TITLE_KEYS: Record<AppView, TranslationKey> = {
    home: 'nav.title.home',
    search: 'nav.title.search',
    library: 'nav.title.library',
    eq: 'nav.title.eq',
    profile: 'nav.title.profile'
  };

  const TAB_ORDER: Record<AppView, number> = {
    home: 0,
    search: 1,
    library: 2,
    eq: 3,
    profile: 4
  };

  // Lazy keep-alive tab registry: only Home mounts at startup; visited tabs stay cached for 0.5ms instant switching
  let mountedViews = $state<Record<AppView, boolean>>({
    home: true,
    search: false,
    library: false,
    eq: false,
    profile: false
  });
  let navDirection = $state<'left' | 'right'>('right');
  let lastView: AppView = 'home';
  const scrollMemory: Record<AppView, number> = {
    home: 0,
    search: 0,
    library: 0,
    eq: 0,
    profile: 0
  };

  const navTitle = $derived(i18n.t(VIEW_TITLE_KEYS[appStore.view]));
  const navSubtitle = $derived(
    engine.sleepMinutes !== 0
      ? `${i18n.t('nav.sleepTimerPrefix')}: ${
          engine.sleepMinutes === -1
            ? i18n.t('nav.sleepEndOfTrack')
            : formatTime(engine.sleepRemainingSec)
        }`
      : engine.current && engine.playing
        ? `${engine.current.title} • ${engine.current.artist}`
        : undefined
  );

  // Adaptive Theme Color: sync CSS accent variables with active track's cover colors
  $effect(() => {
    if (typeof document === 'undefined') return;
    const c1 = engine.current?.c1 || '#007aff';
    const c2 = engine.current?.c2 || '#5e5ce6';
    document.documentElement.style.setProperty('--xmusic-accent', c1);
    document.documentElement.style.setProperty('--xmusic-accent-2', c2);
  });

  // Track directional transition & scroll memory whenever appStore.view changes (from Tabbar OR in-app links)
  $effect(() => {
    const current = appStore.view;
    if (!mountedViews[current]) {
      mountedViews = { ...mountedViews, [current]: true };
    }
    if (current !== lastView) {
      if (typeof window !== 'undefined') {
        scrollMemory[lastView] = window.scrollY;
      }
      navDirection = TAB_ORDER[current] >= TAB_ORDER[lastView] ? 'right' : 'left';
      lastView = current;
      void tick().then(() => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: scrollMemory[current] || 0, behavior: 'instant' });
        }
      });
    }
  });

  function switchTab(next: AppView): void {
    if (appStore.view === next) {
      if (typeof window !== 'undefined') {
        scrollMemory[next] = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    appStore.view = next;
  }

  function paneClass(viewName: AppView): string {
    if (appStore.view !== viewName) return 'hidden';
    return navDirection === 'right'
      ? 'xmusic-tab-pane xmusic-tab-active-right'
      : 'xmusic-tab-pane xmusic-tab-active-left';
  }

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

<a href="#main-content" class="skip-link">{i18n.t('nav.skip')}</a>

<Page class={engine.current ? 'pb-48' : 'pb-28'}>
  {#if appStore.uiStyle === 'liquid-glass'}
    <div class="xmusic-ambient-aura" aria-hidden="true"></div>
  {/if}

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
        aria-label={appStore.isDark ? i18n.t('nav.themeToLight') : i18n.t('nav.themeToDark')}
      >
        <Icon name={appStore.isDark ? 'sun' : 'moon'} size={20} />
      </Link>
    {/snippet}

    {#snippet right()}
      <Link
        iconOnly
        onclick={() => (appStore.npDrawerOpen = !appStore.npDrawerOpen)}
        aria-label={i18n.t('nav.openQueue')}
      >
        <Icon name="queue" size={20} />
      </Link>
    {/snippet}
  </Navbar>

  <main id="main-content" tabindex="-1" class="mx-auto w-full max-w-6xl overflow-x-clip">
    {#if mountedViews.home}
      <section class={paneClass('home')} aria-hidden={appStore.view !== 'home'}>
        <HomeView />
      </section>
    {/if}

    {#if mountedViews.search}
      <section class={paneClass('search')} aria-hidden={appStore.view !== 'search'}>
        <SearchView />
      </section>
    {/if}

    {#if mountedViews.library}
      <section class={paneClass('library')} aria-hidden={appStore.view !== 'library'}>
        <LibraryView />
      </section>
    {/if}

    {#if mountedViews.eq}
      <section class={paneClass('eq')} aria-hidden={appStore.view !== 'eq'}>
        <EqualizerView />
      </section>
    {/if}

    {#if mountedViews.profile}
      <section class={paneClass('profile')} aria-hidden={appStore.view !== 'profile'}>
        <ProfileView />
      </section>
    {/if}
  </main>

  <PlayerBar />

  {#if appStore.uiStyle === 'liquid-glass'}
    <nav
      class="xmusic-gpu-layer fixed right-3 bottom-[calc(10px+env(safe-area-inset-bottom,0px))] left-3 z-40 mx-auto max-w-md rounded-full border border-white/25 px-2 py-1.5 xmusic-liquid-glass dark:border-white/15"
      aria-label="Navigasi utama"
    >
      <div class="grid grid-cols-5 items-center gap-1">
        {#each [
          { id: 'home', icon: 'home', label: i18n.t('nav.home') },
          { id: 'search', icon: 'search', label: i18n.t('nav.search') },
          { id: 'library', icon: 'library', label: i18n.t('nav.library') },
          { id: 'eq', icon: 'eq', label: i18n.t('nav.eq') },
          { id: 'profile', icon: 'profile', label: i18n.t('nav.profile') }
        ] as tab (tab.id)}
          {@const isActive = appStore.view === tab.id}
          <button
            type="button"
            class="xmusic-spring-tap flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition-all {isActive
              ? 'bg-black/10 text-black shadow-xs dark:bg-white/16 dark:text-white'
              : 'text-black/60 dark:text-white/60'}"
            style={isActive && engine.current?.c1 ? `color: ${engine.current.c1};` : ''}
            aria-current={isActive ? 'page' : undefined}
            onclick={() => switchTab(tab.id as AppView)}
          >
            <Icon name={tab.icon as any} size={20} />
            <span class="truncate max-w-[56px]">{tab.label}</span>
          </button>
        {/each}
      </div>
    </nav>
  {:else}
    <Tabbar labels icons class="xmusic-gpu-layer left-0 bottom-0 fixed z-40">
      <ToolbarPane>
        <TabbarLink
          active={appStore.view === 'home'}
          label={i18n.t('nav.home')}
          onclick={() => switchTab('home')}
        >
          {#snippet icon()}
            <Icon name="home" size={22} />
          {/snippet}
        </TabbarLink>

        <TabbarLink
          active={appStore.view === 'search'}
          label={i18n.t('nav.search')}
          onclick={() => switchTab('search')}
        >
          {#snippet icon()}
            <Icon name="search" size={22} />
          {/snippet}
        </TabbarLink>

        <TabbarLink
          active={appStore.view === 'library'}
          label={i18n.t('nav.library')}
          onclick={() => switchTab('library')}
        >
          {#snippet icon()}
            <Icon name="library" size={22} />
          {/snippet}
        </TabbarLink>

        <TabbarLink
          active={appStore.view === 'eq'}
          label={i18n.t('nav.eq')}
          onclick={() => switchTab('eq')}
        >
          {#snippet icon()}
            <Icon name="eq" size={22} />
          {/snippet}
        </TabbarLink>

        <TabbarLink
          active={appStore.view === 'profile'}
          label={i18n.t('nav.profile')}
          onclick={() => switchTab('profile')}
        >
          {#snippet icon()}
            <Icon name="profile" size={22} />
          {/snippet}
        </TabbarLink>
      </ToolbarPane>
    </Tabbar>
  {/if}
</Page>


<!-- Offscreen 1x1 audio-only host for official YouTube IFrame Player API -->
<div id="xmusic-yt-audio-host" class="pointer-events-none fixed bottom-0 left-0 z-0 h-[200px] w-[200px] opacity-[0.001]" aria-hidden="true"></div>

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
