# AGENTS.md — Strict AI Agentic & Vibe Coding Contract

This document defines **non-negotiable architectural and design rules** for all AI coding assistants (Antigravity, Claude Code, Cursor, GitHub Copilot, Codex, etc.) editing `nys Xmusic`. Violating any rule below is considered a build-breaking regression.

---

## 1. Absolute UI/UX Contract: Konsta UI Svelte (iOS Theme Only)

1. **Official Library & Theme Lock**:
   - The application MUST use **[Konsta UI for Svelte](https://konstaui.com/svelte)** (`konsta ^5.5.0`) with **Tailwind CSS v4** (`@tailwindcss/vite`).
   - Root layout (`src/routes/+layout.svelte`) MUST wrap the entire app in `<App theme="ios" safeAreas dark={appStore.isDark}>` supporting real Light, Dark, and System theme modes.
   - **NEVER** switch `theme="ios"` to `"material"`, **NEVER** remove `safeAreas`, and ALWAYS style every custom element with dual light/dark Tailwind utilities (`text-zinc-950 dark:text-white`, `bg-white dark:bg-[#1c1c1e]`, `border-black/10 dark:border-white/10`) so both Light and Dark modes pass WCAG 2.2 AA.
2. **Official Konsta CSS Import Order (`src/app.css`)**:
   - `src/app.css` MUST begin with:
     ```css
     @import "tailwindcss";
     @import "konsta/svelte/theme.css";
     ```
   - **NEVER** add global `* { margin: 0; padding: 0; }` resets or custom layout grids that fight Konsta UI's `Page`, `Navbar`, `Tabbar`, `List`, `Block`, `Panel`, or `Popup` components.
   - **NEVER** add generic AI-slop neon gradients, stacked `backdrop-filter: blur(22px)` glass boxes, or unrequested decorative blobs.
3. **Use Native Konsta UI Components First**:
   - Navigation: `Page`, `Navbar`, `Searchbar`, `Tabbar`, `ToolbarPane`, `TabbarLink`, `Link`.
   - Containers & Lists: `Block`, `BlockTitle`, `Card`, `List`, `ListItem`, `ListInput`.
   - Controls & Overlays: `Button`, `Chip`, `Badge`, `Segmented`, `SegmentedButton`, `Toggle`, `Range`, `Progressbar`, `Preloader`, `Fab`, `Panel`, `Popup`, `Toast`.
   - Use **Svelte 5 Snippets** (`{#snippet left()}`, `{#snippet right()}`, `{#snippet subnavbar()}`, `{#snippet icon()}`, `{#snippet media()}`, `{#snippet after()}`) as specified by Konsta UI v5.5 Svelte docs.

---

- **SvelteKit 3 + TypeScript 6 Strictness**:
  - `package.json` MUST pin `"typescript": "^6.0.0"` (exact peer required by `@sveltejs/kit@3.4.x`; do NOT downgrade to TS 5 or jump to TS 7 until `svelte-check` supports it).
  - `tsconfig.json` MUST extend `"$app/tsconfig"` (NOT legacy `./.svelte-kit/tsconfig.json`) with explicit `"include": ["src", "test"]` and `"exclude": ["src/service-worker", "src-tauri", "dist"]`. NEVER override `paths` or `types` in `tsconfig.json`.
  - Every `#lib/*` subpath import MUST include its explicit file extension (e.g., `#lib/stores/library.svelte.ts`, `#lib/types/music.ts`, `#lib/components/Icon.svelte`).
  - Exported types inside `.svelte` files MUST live in `<script module lang="ts">`, never in the instance `<script lang="ts">`.

## 2. Package Manager, Versioning & Licensing Rules

1. **pnpm Only**:
   - ALWAYS use `pnpm` (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm exec tauri ...`).
   - NEVER switch `tauri.conf.json` or `.github/workflows/*.yml` back to `npm` or `yarn`.
2. **Single Source of Truth Versioning**:
   - `src-tauri/tauri.conf.json` MUST keep `"version": "../package.json"` ([Tauri Configuration Reference](https://v2.tauri.app/reference/config/)).
   - `src-tauri/src/lib.rs` MUST read the runtime version from `app.package_info().version.to_string()`.
   - To bump the app version, edit **only** `"version"` in `package.json` (and optionally mirror in `Cargo.toml` for crate metadata).
3. **AGPL-3.0-or-later + Google `addlicense` (Author: Azka Putra)**:
   - Every source code file (`.js`, `.mjs`, `.svelte`, `.css`, `.html`, `.rs`, `.py`, `.yml`, `.toml`) MUST include the header defined in `.license-header.txt`:
     - `Copyright 2026 Azka Putra`
     - `SPDX-License-Identifier: AGPL-3.0-or-later`
   - After creating or modifying any file, run `pnpm license:apply` and verify with `pnpm license:check` (and `addlicense -check -f .license-header.txt ...` in CI).

---

## 3. Code Quality, Performance & Security Rules

- **English Source Code / Indonesian UI Copy**: All filenames, identifiers, comments, scripts, and YAML steps MUST be in English; end-user UI strings remain natural Indonesian.
- **Svelte 5 Runes Only**: Use `$state`, `$derived`, `$effect`, `$props`. Never use Svelte 4 syntax (`export let`, `$:`, `on:click`, `<slot>`).
- **Zero Mobile Lag**:
  - Keep `AudioEngine` position sync throttled (`150ms`) — never mutate `$state` inside 60fps `requestAnimationFrame`.
  - Parse LRC lyrics lazily on flipped grid cards (`TrackCard.svelte`).
  - Pause Canvas FFT rendering when `document.hidden`, card is flipped, or `prefers-reduced-motion: reduce`.
- **Zero Hardcoded Secrets**: Never commit API keys (`Spotify`, `RapidAPI`, `YouTube`).
- **Manual-Only CI & Reproducible Builds**:
  - Keep `.github/workflows/*.yml` strictly `workflow_dispatch` (never add `push:` or `pull_request:`).
  - Never remove `SOURCE_DATE_EPOCH`, `RUSTFLAGS="--remap-path-prefix=..."`, `isPreserveFileTimestamps = false`, `isReproducibleFileOrder = true`, or `dependenciesInfo { includeInApk = false }`.

---

## 4. WCAG 2.2 AA & WebQual 4.0 Mandatory Verification

- [ ] `src/app.html` allows pinch-to-zoom (never add `user-scalable=no` or `maximum-scale=1`).
- [ ] Every icon-only button has `type="button"` and explicit `aria-label`; no nested interactive controls.
- [ ] Primary green CTA buttons (`#30d158`) use dark text (`#000000`, `> 10:1` contrast), never white text.
- [ ] Toast feedback renders in `role="status" aria-live="polite"`; loading states use `<Preloader />`.
- [ ] All checks pass: `pnpm license:check`, `pnpm build`, Python `py_compile`, and YAML manual-only trigger check.

---

## 5. Layout Overlap Prevention, TypeScript & Android Media Notification Rules (v5.0)

1. **Zero Overlap on Konsta UI v5.5 iOS**:
   - **NEVER** apply `!my-2` or `!mt-0` to `<Block>` immediately after `<BlockTitle>` — Konsta UI's native margins prevent title clipping.
   - Keep `<Page class="pb-52">` so scrolled content clears both the floating `PlayerBar` (`bottom-[calc(86px+env(safe-area-inset-bottom,0px))]`) and Konsta v5.5's floating Liquid Glass `Tabbar`.
   - **NEVER** re-add a bottom-right `<Fab>` that collides with `PlayerBar` playback controls.
   - **NEVER** render external `<iframe>`s (Spotify/YouTube) when `!appStore.isOnline`; always show a native Konsta `<Block strong inset>` offline fallback card.
2. **100% Strict TypeScript**:
   - All application modules in `src/` MUST be `.ts` or `<script lang="ts">` `.svelte` files (`allowJs: false`, `strict: true` in `tsconfig.json`).
   - Run `pnpm check` (`svelte-check`) before every build.
3. **Audiophile DSP & Native Android Media Notification**:
   - Keep the mastering `DynamicsCompressorNode` anti-clipping limiter and `latencyHint: 'playback'` intact in `src/lib/audio/engine.svelte.ts`.
   - Keep `XmusicMediaService.kt`, `MainActivity.kt` (`XmusicAndroidMedia` bridge), and ProGuard `@JavascriptInterface` keep rules in `scripts/optimize-android-gradle.py`.

- **Konsta UI v5.5 iOS Polish & Zero-Overlap Rules**:
  - NEVER put more than 1 icon button inside `<Navbar>` `{#snippet left()}` or `{#snippet right()}` (Konsta v5.5 iOS 26 wraps each side in a single Liquid Glass capsule; multiple icons get cramped).
  - NEVER add a floating top DynamicBar over `<Navbar>`. `PlayerBar` docks cleanly above the floating `<Tabbar>` only when `engine.current` is active, and MUST include a Stop/Close (`X`) button (`engine.stopTrack()`).
  - NEVER apply global `:focus-visible` blue outlines on touch screens — scope keyboard focus rings to `@media (hover: hover) and (pointer: fine)` and keep `-webkit-tap-highlight-color: transparent`.
  - ALWAYS attach `onerror` artwork fallback on every track cover `<img>` and NEVER auto-mount external Spotify `<iframe>`s on `HomeView` (use on-demand Konsta `<List>` items gated by `appStore.isOnline && appStore.networkReachable`).
  - ALWAYS sync native Android status/navigation bars via `window.XmusicAndroidMedia?.setSystemBarTheme(isDark)` and `themes.xml` (`#F2F2F7` light / `#000000` dark — never default Material purple).
