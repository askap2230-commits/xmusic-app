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
   - Controls & Overlays: `Button`, `Chip`, `Badge`, `Segmented`, `SegmentedButton`, `Toggle`, `Range`, `Progressbar`, `Preloader`, `Panel`, `Popup`, `Toast`.
   - Use **Svelte 5 Snippets** (`{#snippet left()}`, `{#snippet right()}`, `{#snippet subnavbar()}`, `{#snippet icon()}`, `{#snippet media()}`, `{#snippet after()}`) as specified by Konsta UI v5.5 Svelte docs.
4. **SvelteKit 3 + TypeScript 6 Strictness**:
   - `package.json` MUST pin `"typescript": "^6.0.0"` (exact peer required by `@sveltejs/kit@3.4.x`; do NOT downgrade to TS 5 or jump to TS 7 until `svelte-check` supports it).
   - `tsconfig.json` MUST extend `"$app/tsconfig"` (NOT legacy `./.svelte-kit/tsconfig.json`) with explicit `"include": ["src", "test"]` and `"exclude": ["src/service-worker", "src-tauri", "dist"]`. NEVER override `paths` or `types` in `tsconfig.json`.
   - Every `#lib/*` subpath import MUST include its explicit file extension (e.g., `#lib/stores/library.svelte.ts`, `#lib/types/music.ts`, `#lib/components/Icon.svelte`).
   - Exported types inside `.svelte` files MUST live in `<script module lang="ts">`, never in the instance `<script lang="ts">`.

---

## 2. Package Manager, Versioning & Licensing Rules

1. **pnpm Only**:
   - ALWAYS use `pnpm` (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm exec tauri ...`).
   - NEVER switch `tauri.conf.json` or `.github/workflows/*.yml` back to `npm` or `yarn`.
2. **Single Source of Truth Versioning**:
   - `src-tauri/tauri.conf.json` MUST keep `"version": "../package.json"` ([Tauri Configuration Reference](https://v2.tauri.app/reference/config/)).
   - `src-tauri/src/lib.rs` MUST read the runtime version from `app.package_info().version.to_string()`.
   - When bumping the app version, update `"version"` in `package.json`, mirror it in `src-tauri/Cargo.toml` and `src/lib/stores/library.svelte.ts` (`runtimeInfo.version` web fallback), add a matching `## [<version>] - YYYY-MM-DD` section to `CHANGELOG.md`, and keep `README.md`, `ARCHITECTURE.md`, `CI_CD_GUIDE.md`, and `WCAG_ACCESSIBILITY.md` synchronized.
3. **AGPL-3.0-or-later + Google `addlicense` (Author: Azka Putra)**:
   - Every source code file (`.js`, `.mjs`, `.ts`, `.svelte`, `.css`, `.html`, `.rs`, `.py`, `.yml`, `.toml`) MUST include the header defined in `.license-header.txt`:
     - `Copyright 2026 Azka Putra`
     - `SPDX-License-Identifier: AGPL-3.0-or-later`
   - After creating or modifying any file, run `pnpm license:apply` and verify with `pnpm license:check` (and `addlicense -check -f .license-header.txt ...` in CI).

---

## 3. Code Quality, CI/CD Resilience, Performance & Security Rules

- **English Source Code / Indonesian UI Copy**: All filenames, identifiers, comments, scripts, and YAML steps MUST be in English; end-user UI strings remain natural Indonesian (with full `en.ts` / `id.ts` i18n parity).
- **Svelte 5 Runes Only**: Use `$state`, `$derived`, `$effect`, `$props`. Never use Svelte 4 syntax (`export let`, `$:`, `on:click`, `<slot>`).
- **Zero-APT `build-apk.yml` & Zero-Dependency Python Build Scripts (HARD RULE)**:
  - **NEVER** add `sudo apt-get update`, `sudo apt-get install`, or `pip install` steps to `.github/workflows/build-apk.yml`. GitHub Actions `ubuntu-24.04` APT mirrors intermittently return HTTP `503 Service Unavailable` / exit code `100`, causing fatal APK build failures.
  - All build scripts under `scripts/` (`sync-android-icons.py`, `optimize-android-gradle.py`, `license-manager.py`) MUST run with **100% Python 3 standard library only**. Optional third-party libraries (such as `PIL`/Pillow) may ONLY be imported inside `try ... except ImportError` with a complete, tested stdlib fallback (`--stdlib-only`).
  - Any Linux desktop dependency installation in `.github/workflows/ci-verify.yml` MUST keep the resilient retry loop (`-o Acquire::Retries=5`, `--fix-missing`, timeout flags, backoff, and automatic `archive.ubuntu.com` mirror failover).
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
- [ ] All checks pass: `pnpm license:check`, `pnpm check`, `pnpm build`, Python `py_compile`, `python3 scripts/sync-android-icons.py --stdlib-only`, and YAML manual-only trigger check.

---

## 5. Layout Overlap Prevention, TypeScript & Android Media Notification Rules

1. **Zero Overlap on Konsta UI v5.5 iOS**:
   - **NEVER** apply `!my-2` or `!mt-0` to `<Block>` immediately after `<BlockTitle>` — Konsta UI's native margins prevent title clipping.
   - Keep `SearchView.svelte` and `LibraryView.svelte` wrapped in a uniform `flex-col gap-4 px-4` container with `<List strong inset class="!mx-0 !my-0">` and `titleWrapClass="min-w-0 flex-1"` (never mix `<BlockTitle>` `-mb-6` with custom `!my-2` blocks or horizontal rails).
   - Keep `TrackCard.svelte` top-right overlay limited to max 2 circular buttons (`flip`, `heart`); place local-track `edit`/`trash` actions at `bottom-2 right-2` with matching duration pill `max-w-[calc(100%-88px)]` so badges never collide on 360px 2-column grids.
   - Keep `<Page class="pb-52">` so scrolled content clears both the floating `PlayerBar` (`bottom-[calc(86px+env(safe-area-inset-bottom,0px))]`) and Konsta v5.5's floating Liquid Glass `Tabbar`.
   - **NEVER** re-add a bottom-right `<Fab>` that collides with `PlayerBar` playback controls.
   - **NEVER** render external `<iframe>`s (Spotify/YouTube) when `!appStore.isOnline`; always show a native Konsta `<Block strong inset>` offline fallback card.
2. **100% Strict TypeScript**:
   - All application modules in `src/` MUST be `.ts` or `<script lang="ts">` `.svelte` files (`allowJs: false`, `strict: true` in `tsconfig.json`).
   - Run `pnpm check` (`svelte-check`) before every build.
3. **Audiophile DSP & Native Android Media Notification**:
   - Keep the mastering `DynamicsCompressorNode` anti-clipping limiter and `latencyHint: 'playback'` intact in `src/lib/audio/engine.svelte.ts`.
   - Keep `XmusicMediaService.kt`, `MainActivity.kt` (`XmusicAndroidMedia` bridge), and ProGuard `@JavascriptInterface` keep rules in `scripts/optimize-android-gradle.py`.
   - **NEVER** re-add `AudioManager.requestAudioFocus(...)` inside `XmusicMediaService.kt` (Chromium WebView's internal `AudioFocusDelegate` owns AudioFocus; dual focus causes fatal play/pause ping-pong loops).
   - **True Native Android Background Audio Service Contract (v6.29.0)**:
     - YouTube Music background playback on Android MUST run through `XmusicMediaService`'s native **AndroidX Media3 `ExoPlayer` (`1.11.1` + `media3-exoplayer-hls`)** (`DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true)` preserving `User-Agent`/`Origin`/`Referer` across `googlevideo.com` 302 redirects + `C.WAKE_MODE_NETWORK` + Main-Thread 500ms `@Volatile` position mirror) — NEVER revert to legacy `android.media.MediaPlayer` (which drops headers on redirects and fails on YouTube fMP4/HLS) or rely on cross-origin YouTube `<iframe>` for background playback — NEVER rely solely on cross-origin YouTube `<iframe>` (`YT.Player`) for background/screen-off/app-close playback.
     - Keep `src-tauri/src/lib.rs` (`ytm_resolve_audio`) using the verified late-2026 client chain **`VISIONOS` (`1.02` -> `1.03` (visionOS `26.5.23O471`, Safari `26.0`) -> `ANDROID` sdkless (`20.10.38`), `clientId: 101`, full Apple `RealityDevice17,1` / `visionOS` context fields) -> `ANDROID_VR` (`1.65.10`, `androidSdkVersion: 32`)**, returning `YtmResolvedAudio { url, user_agent }` after a live `Range: bytes=0-1` HTTP 200/206 probe — NEVER revert to retired `VISIONOS 0.1`, `IOS`, `ANDROID`, or `TVHTML5_SIMPLY_EMBEDDED_PLAYER` clients, and ALWAYS attach `User-Agent`, `Origin`, and `Referer` headers to `googlevideo.com` requests in `XmusicMediaService.kt`.
     - Keep `MainActivity.onDestroy()` preserving `XmusicMediaService` whenever `XmusicMediaService.isNativePlaying` is true, AND NEVER call `window.XmusicAndroidMedia?.clearNotification()` inside `AudioEngine.destroy()` while `usingNativeAndroid` is true (or `+page.svelte` `onDestroy` will kill `ExoPlayer` the instant the app is closed!), and keep `handleForegroundResume()` syncing live state from `getNativeStateJson()` without restarting or resetting playback to `0:00`.
     - In `ytPlayerBridge.ts`, NEVER call `loadVideoById()` again immediately after creating a fresh `YT.Player` with `initialVideoId` + `playerVars.start` (prevents double-load reset to `0:00`).
     - Keep `XmusicMediaService`'s `MediaSession.Callback.onSeekTo(pos)` forwarding seeks to BOTH native `ExoPlayer` (`handleNativeSeek`) AND WebView (`MainActivity.dispatchSeekAction` -> `window.__xmusicSeekMs`) with `SystemClock.elapsedRealtime()` in `PlaybackState` so the Android notification duration slider stays 100% functional.
4. **Konsta UI v5.5 iOS Polish & Privacy-First Rules**:
   - NEVER put more than 1 icon button inside `<Navbar>` `{#snippet left()}` or `{#snippet right()}` (Konsta v5.5 iOS 26 wraps each side in a single Liquid Glass capsule; multiple icons get cramped).
   - NEVER add a floating top DynamicBar over `<Navbar>`. `PlayerBar` docks cleanly above the floating `<Tabbar>` only when `engine.current` is active, and MUST include a Stop/Close (`X`) button (`engine.stopTrack()`).
   - NEVER apply global `:focus-visible` blue outlines on touch screens — scope keyboard focus rings to `@media (hover: hover) and (pointer: fine)` and keep `-webkit-tap-highlight-color: transparent`.
   - ALWAYS attach `onerror` artwork fallback on every track cover `<img>` and NEVER auto-mount external Spotify `<iframe>`s on `HomeView` (use on-demand Konsta `<List>` items gated by `appStore.isOnline && appStore.networkReachable`).
   - ALWAYS sync native Android status/navigation bars via `window.XmusicAndroidMedia?.setSystemBarTheme(isDark)` and `themes.xml` (`#F2F2F7` light / `#000000` dark — never default Material purple).
   - NEVER use raw `<button style="background:#...; border-left:...">` dark boxes for Genre or Era cards — ALWAYS use native Konsta UI `<Card contentWrapPadding="p-3.5" class="!m-0 ...">` so Light Mode and Dark Mode stay 100% consistent with Konsta UI v5.5 iOS.
   - Keep `rankTracksByAlgorithm` and `algoConfig` 100% on-device (`localStorage` only, zero telemetry or user data sent to external servers).
   - Keep Smart Search logic modular inside `src/lib/search/smartSearch.ts` (typo-tolerant Damerau-Levenshtein scoring, multi-source `Semua` blending across YouTube Music / Audius / Catalog / Archive / Local, and dynamic on-device `Populer Dicari`), and keep `HlsMediaSource` / `ProgressiveMediaSource` explicit in `XmusicMediaService.kt` with Media3 ProGuard rules so R8 full mode never strips stream factories.
   - ALWAYS keep `appStore.activeModalTrack` reactive to `engine.current` (except for standalone Spotify embeds) so `TrackModal.svelte` immediately updates artwork, metadata, and synced lyrics on auto-next, repeat, and lockscreen Next/Prev.
   - ALWAYS set `contentWrap={false}` on Konsta `<Card>` back-face lyrics containers (`TrackModal.svelte`, `TrackCard.svelte`) with an inner `<div class="flex h-full min-h-0 flex-col">` + `.xmusic-vscroll` (`min-h-0 flex-1 overflow-y-auto touch-pan-y`), and scroll only `lyricsScrollEl` via `scrollTo` (pausing auto-scroll for 4.5s on user touch/wheel).
