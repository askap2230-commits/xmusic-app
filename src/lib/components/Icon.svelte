<!-- Copyright 2026 Azka Putra | SPDX-License-Identifier: AGPL-3.0-or-later -->
<script module lang="ts">
  export type IconName =
    | 'home'
    | 'search'
    | 'library'
    | 'eq'
    | 'download'
    | 'link'
    | 'profile'
    | 'play'
    | 'pause'
    | 'prev'
    | 'next'
    | 'shuffle'
    | 'repeat'
    | 'heart'
    | 'heart-filled'
    | 'flip'
    | 'plus'
    | 'close'
    | 'edit'
    | 'trash'
    | 'queue'
    | 'folder'
    | 'volume'
    | 'mute'
    | 'music'
    | 'moon'
    | 'sun'
    | 'wifi-off'
    | 'upload'
    | 'key'
    | 'spark'
    | 'refresh'
    | 'more'
    | 'video';
</script>

<script lang="ts">
  let { name, size = 18 }: { name: IconName; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'home'}
    <path d="M3 10.4 12 3l9 7.4V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-3.6-3.6" />
  {:else if name === 'library'}
    <path d="M4 5h4v15H4zM10 5h4v15h-4zM16 5l4 1v14h-4z" />
  {:else if name === 'eq'}
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  {:else if name === 'download'}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  {:else if name === 'link'}
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  {:else if name === 'profile'}
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  {:else if name === 'play'}
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
  {:else if name === 'pause'}
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
  {:else if name === 'prev'}
    <rect x="5" y="5" width="2.2" height="14" rx="1" fill="currentColor" stroke="none" />
    <path d="M19 5.6v12.8L8.5 12z" fill="currentColor" stroke="none" />
  {:else if name === 'next'}
    <rect x="16.8" y="5" width="2.2" height="14" rx="1" fill="currentColor" stroke="none" />
    <path d="M5 5.6v12.8L15.5 12z" fill="currentColor" stroke="none" />
  {:else if name === 'shuffle'}
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5m-1-1 6 6M4 4l5 5" />
  {:else if name === 'repeat'}
    <path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
  {:else if name === 'heart'}
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  {:else if name === 'heart-filled'}
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" stroke="none" />
  {:else if name === 'flip'}
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'close'}
    <path d="M18 6 6 18M6 6l12 12" />
  {:else if name === 'edit'}
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  {:else if name === 'trash'}
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  {:else if name === 'queue'}
    <path d="M4 6h12M4 12h12M4 18h8M18 12v7M21 15.5h-6" />
  {:else if name === 'folder'}
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  {:else if name === 'volume'}
    <path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14" />
  {:else if name === 'mute'}
    <path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" />
  {:else if name === 'music'}
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  {:else if name === 'moon'}
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  {:else if name === 'sun'}
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  {:else if name === 'wifi-off'}
    <path d="M2 2l20 20" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
    <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
    <path d="M5 13a10 10 0 0 1 5.24-2.76" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  {:else if name === 'upload'}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  {:else if name === 'key'}
    <circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 9-9M17 6l3 3" />
  {:else if name === 'refresh'}
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  {:else if name === 'spark'}
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
  {:else if name === 'more'}
    <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
  {:else if name === 'video'}
    <rect x="2.5" y="5" width="14" height="14" rx="2.5" />
    <path d="m16.5 10 5-3v10l-5-3z" fill="currentColor" stroke="none" />
  {/if}
</svg>
