<script>
  import { appStore } from '#lib/stores/library.svelte.js';
  import Icon from './Icon.svelte';
</script>

<nav class="panel mobile-nav" aria-label="Navigasi seluler">
  <button
    type="button"
    class="m-nav-item"
    class:active={appStore.view === 'home'}
    aria-current={appStore.view === 'home' ? 'page' : undefined}
    onclick={() => (appStore.view = 'home')}
  >
    <Icon name="home" size={19} />
    <span>Beranda</span>
  </button>

  <button
    type="button"
    class="m-nav-item"
    class:active={appStore.view === 'search'}
    aria-current={appStore.view === 'search' ? 'page' : undefined}
    onclick={() => (appStore.view = 'search')}
  >
    <Icon name="search" size={19} />
    <span>Cari</span>
  </button>

  <button
    type="button"
    class="m-nav-item"
    class:active={appStore.view === 'library'}
    aria-current={appStore.view === 'library' ? 'page' : undefined}
    onclick={() => (appStore.view = 'library')}
  >
    <Icon name="library" size={19} />
    <span>Pustaka</span>
  </button>

  <button
    type="button"
    class="m-nav-item"
    class:active={appStore.view === 'eq'}
    aria-current={appStore.view === 'eq' ? 'page' : undefined}
    onclick={() => (appStore.view = 'eq')}
  >
    <Icon name="eq" size={19} />
    <span>EQ Studio</span>
  </button>

  <button
    type="button"
    class="m-nav-item m-nav-accent"
    onclick={() => (appStore.hubModalOpen = true)}
  >
    <Icon name="link" size={19} />
    <span>Hub/DL</span>
  </button>

  <button
    type="button"
    class="m-nav-item"
    class:active={appStore.view === 'profile'}
    aria-current={appStore.view === 'profile' ? 'page' : undefined}
    onclick={() => (appStore.view = 'profile')}
  >
    <Icon name="profile" size={19} />
    <span>Profil</span>
  </button>
</nav>
