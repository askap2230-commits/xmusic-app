<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { EQ_PRESETS } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { formatTime, getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';
</script>

<header class="topbar">
  <div class="search-box">
    <Icon name="search" size={16} />
    <label for="global-search-input" class="sr-only">Cari lagu, artis, atau genre</label>
    <input
      id="global-search-input"
      type="search"
      placeholder="Cari lagu, artis, atau genre..."
      value={appStore.searchQuery}
      oninput={(e) => appStore.updateSearch(e.currentTarget.value)}
    />
  </div>

  <div class="topbar-actions">
    {#if engine.sleepMinutes !== 0}
      <button
        type="button"
        class="status-pill"
        onclick={() => (appStore.view = 'eq')}
        aria-label="Pengaturan Sleep Timer aktif"
      >
        <Icon name="moon" size={14} />
        <span>{engine.sleepMinutes === -1 ? 'Akhir Lagu' : formatTime(engine.sleepRemainingSec)}</span>
      </button>
    {/if}

    <button
      type="button"
      class="status-pill d-only"
      onclick={() => (appStore.view = 'eq')}
      aria-label="Buka Equalizer 5-Band"
    >
      <Icon name="eq" size={14} />
      <span>{engine.eqEnabled ? EQ_PRESETS[engine.eqPreset]?.name || 'Custom' : 'EQ Off'}</span>
    </button>

    <button
      type="button"
      class="user-chip"
      aria-label="Profil dan pengaturan API"
      onclick={() => (appStore.view = 'profile')}
      style={appStore.userProfile.image ? `background-image:url(${appStore.userProfile.image})` : ''}
    >
      {appStore.userProfile.image ? '' : getTrackInitial(appStore.userProfile.name)}
    </button>
  </div>
</header>
