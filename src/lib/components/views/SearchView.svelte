<script>
  import { CATEGORIES } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import TrackCard from '../TrackCard.svelte';
</script>

<section class="section" aria-labelledby="search-heading">
  <div class="section-head">
    <h1 id="search-heading" class="view-title">
      {appStore.searchQuery ? `Hasil Pencarian "${appStore.searchQuery}"` : 'Cari Lagu & Artis'}
    </h1>
  </div>

  {#if !appStore.searchQuery.trim()}
    <div class="category-grid">
      {#each CATEGORIES as cat}
        <button
          type="button"
          class="category-card"
          style="--cat-bg:{cat.bg}; --cat-accent:{cat.accent};"
          onclick={() => appStore.updateSearch(cat.q)}
        >
          <span class="category-title">{cat.label}</span>
          <span class="category-sub">{cat.sub}</span>
        </button>
      {/each}
    </div>
  {:else if appStore.searching}
    <p class="text-muted text-sm" role="status">Mencari "{appStore.searchQuery}"...</p>
  {:else if appStore.searchResults.length > 0}
    <div class="grid">
      {#each appStore.searchResults as track (track.id)}
        <TrackCard {track} />
      {/each}
    </div>
  {:else}
    <p class="text-muted text-sm">
      Tidak ditemukan lagu yang cocok dengan "{appStore.searchQuery}".
    </p>
  {/if}
</section>
