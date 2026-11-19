<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script>
  import '../app.css';
  import { App } from 'konsta/svelte';
  import { appStore } from '#lib/stores/library.svelte.js';

  let { children } = $props();
</script>

<App theme="ios" safeAreas dark={appStore.isDark}>
  {@render children()}
</App>
