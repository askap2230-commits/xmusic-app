<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { App } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.ts';

  let { children }: { children: Snippet } = $props();
  const isAndroidRuntime = $derived(
    typeof navigator === 'undefined' ||
      /Android/i.test(navigator.userAgent) ||
      typeof window !== 'undefined' && Boolean(window.XmusicAndroidMedia)
  );
</script>

<App theme="ios" safeAreas dark={appStore.isDark}>
  {#if !isAndroidRuntime}
    <div class="mx-auto max-w-md px-4 pt-3 text-center text-[11px] font-medium text-black/60 dark:text-white/60">
      nys Xmusic • Dioptimalkan khusus untuk Android (iOS 26 Liquid Glass UI)
    </div>
  {/if}
  {@render children()}
</App>
