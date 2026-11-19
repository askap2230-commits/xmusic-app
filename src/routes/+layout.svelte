<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { App } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<App theme="ios" safeAreas dark={appStore.isDark}>
  {@render children()}
</App>
