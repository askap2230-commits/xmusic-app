<script>
  import { engine } from '#lib/audio/engine.svelte.js';
  import { EQ_PRESETS } from '#lib/data/presets.js';
  import { appStore } from '#lib/stores/library.svelte.js';
  import { getTrackInitial } from '#lib/utils/format.js';
  import Icon from './Icon.svelte';
</script>

{#if engine.current && !appStore.dynamicBarDismissed}
  <div class="dynamic-bar" class:is-paused={!engine.playing} role="region" aria-label="Sedang diputar">
    <button
      type="button"
      class="dynamic-bar-main"
      onclick={() => appStore.openTrackModal(engine.current, false)}
      aria-label="Buka pemutar layar penuh untuk {engine.current.title}"
    >
      <span
        class="dynamic-bar-art"
        style={engine.current.imageUrl
          ? ''
          : `background: linear-gradient(135deg, ${engine.current.c1 || '#3b82f6'}, ${engine.current.c2 || '#172554'})`}
      >
        {#if engine.current.imageUrl}
          <img src={engine.current.imageUrl} alt="" />
        {:else}
          <span>{getTrackInitial(engine.current.title)}</span>
        {/if}
      </span>
      <span class="dynamic-bar-meta">
        <span class="dynamic-bar-title">{engine.current.title}</span>
        <span class="dynamic-bar-sub">
          {engine.current.artist}{engine.eqEnabled && engine.eqPreset !== 'flat'
            ? ` • ${EQ_PRESETS[engine.eqPreset]?.name || 'Custom'}`
            : ''}
        </span>
      </span>
    </button>

    <div class="dynamic-bar-actions">
      <button
        type="button"
        class="play-btn play-btn-sm"
        onclick={() => engine.togglePlay()}
        aria-label={engine.playing ? 'Jeda lagu' : 'Putar lagu'}
      >
        <Icon name={engine.playing ? 'pause' : 'play'} size={14} />
      </button>
      <button
        type="button"
        class="icon-btn icon-btn-sm"
        onclick={() => (appStore.dynamicBarDismissed = true)}
        aria-label="Tutup bilah mengambang"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  </div>
{/if}
