# Changelog

All notable changes to **nys Xmusic** are documented in this file.

## [5.6.0] - 2026-11-19

### Performance & UX Upgrades
- **Parallel Racing (`Promise.any`) & Fastest-Host Caching**: Replaced slow sequential Piped/Invidious fallback loops with parallel `Promise.any` racing (3s timeout) and automatic `fastestPipedHost` memory caching — cutting YouTube Music search and audio stream resolution from 15–25s down to ~0.5–1.5s.
- **Progressive Non-Blocking Feed Loading & 0ms Startup Cache**: Removed monolithic `Promise.all` blocking on `HomeView`. Each section (`YouTube Music`, `Audius Global`, `Chart Populer Spotify`, `Katalog 1900–2026`) renders progressively as soon as it responds, backed by a stale-while-revalidate `localStorage` cache for instant 0ms startup.
- **Real Pagination ("Muat Lebih Banyak")**: Added working **Muat Lebih Banyak** buttons at the bottom of every music section (`loadMoreYt`, `loadMoreAudius`, `loadMoreSpotifyChart`, `loadMoreCatalog`) with deduplicated appending.
- **True Audio-Only YouTube Music Player**: Fixed `TrackModal` so clicking any YouTube Music track NEVER auto-mounts a YouTube Video iframe; it always stays in the native iOS Audio Player with live stream resolution status (`resolvingAudio`), 5-Band EQ, and an opt-in fallback only if public audio proxies are busy.
- **Redesigned Spotify Charts (Konsta Segmented Tabs + Instant Cache)**: Replaced the clashing open/close accordion with native Konsta `<Segmented>` tabs (`Top 50 ID`, `Top 50 Global`, `Top Hits`) backed by per-chart caching (`spotifyChartCache`) for 0ms instant tab switching.
- **Automatic Changelog in GitHub Releases**: Updated `.github/workflows/build-apk.yml` to automatically extract the current version's `CHANGELOG.md` notes into every GitHub Release above the SHA-256/SHA-512 reproducible build table.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.6.0` (`Xmusic-v5.6.0-android-<abi>-release.apk`).

## [5.5.0] - 2026-11-19

### Changed & Fixed
- **Strict Pure YouTube Music Filter (`filter=music_songs`)**: Eliminated regular YouTube videos, vlogs, Shorts, podcasts, and livestreams from `fetchYtTrending` and `fetchYtSearch` using Piped's official YouTube Music `music_songs` endpoint plus strict duration (60s–12m) and non-music keyword validation.
- **Native Playable Spotify Integration (Zero Broken WebView Embeds)**: Removed broken Spotify `<iframe>` web-in-app embeds from `HomeView`, `HubModal`, and `TrackModal`. Tapping any Spotify Chart (`Top 50 Indonesia`, `Top 50 Global`, `Today's Top Hits`) or pasting a Spotify track link now resolves and plays full-length audio natively inside Xmusic with 5-Band EQ and synced lyrics.
- **Working Algorithm Refresh (`refreshSeed`)**: Added a live **Segarkan** button in `HomeView` that rotates regional music queries and algorithm rankings cleanly with real-time loading feedback.
- **Cleaner Industry-Standard Home Layout**: Reordered `HomeView` so full-length music (`Koleksi Offline`, `YouTube Music`, `Audius Global`) appears first, compacted Era & Genre explorers into clean Konsta `<Chip>` rows, and moved 30-second public catalog previews to the bottom section.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.5.0` (`Xmusic-v5.5.0-android-<abi>-release.apk`).

## [5.4.0] - 2026-11-19

### Added
- **Zero-API-Key FOSS YouTube Music Engine (Piped + Invidious)**: Integrated multi-instance FOSS YouTube Music search (`filter=music_songs`), regional trending (`/trending?region=...`), and direct high-bitrate audio stream resolution (`/streams/{videoId}` + dynamic Invidious failover via `api.invidious.io`) — works out of the box with **zero Google/YouTube API key**, just like LibreTube and FreeTube.
- **Native Web Audio EQ & Lockscreen Controls for YouTube Music**: Resolved direct audio streams play natively inside `<audio>` with full 5-Band EQ, mastering limiter, and Android foreground media notification, with automatic fallback to official YouTube Embed if proxy streams are busy.
- **Custom Piped Instance Setting**: Added optional custom Piped API instance URL in `ProfileModal` and live FOSS status badge in `ProfileView`.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.4.0` (`Xmusic-v5.4.0-android-<abi>-release.apk`).

## [5.3.0] - 2026-11-19

### Added
- **Full-Length Audio Prioritization & Internet Archive Source**: Prioritized full-length audio sources (`Local Offline`, `YouTube Music`, `Audius Global`, and newly integrated `Internet Archive Audio` for full-length classic/public-domain tracks) ahead of 30-second public catalog previews.
- **Transparent `Full` vs `30d` Badges**: Added crisp `Full` (green) and `30d` (amber) duration indicators on every `TrackCard` so users immediately distinguish full-length tracks from 30-second previews.
- **Filter "Hanya Lagu Penuh" & One-Tap "Cari Versi Penuh"**: Added a `Hanya Lagu Penuh` filter chip in `SearchView` and a one-tap `Cari Versi Penuh (YouTube / Audius)` action button inside `TrackModal` whenever a 30-second preview is opened.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.3.0` (`Xmusic-v5.3.0-android-<abi>-release.apk`).

## [5.2.0] - 2026-11-19

### Added
- **Privacy-First On-Device Music Algorithm (`rankTracksByAlgorithm`)**: Added a configurable local recommendation and regional viral ranking engine (`AlgorithmConfig`) with 6 regions (`ID`, `US`, `JP`, `KR`, `GB`, `GLOBAL`), 4 modes (`Viral`, `Seimbang`, `Baru`, `Nostalgia`), preferred era/genre weights, and an opt-in local personalization toggle (`personalizeFromHistory`) — zero telemetry, 100% stored on-device.
- **Konsta UI v5.5 iOS Card Consistency**: Replaced all legacy hardcoded dark genre and era boxes in `HomeView` and `SearchView` with native Konsta UI `<Card>` components that adapt cleanly to both iOS Light and iOS Dark surfaces.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.2.0` (automatically reflected in `tauri.conf.json`, Rust `package_info()`, and APK filename `Xmusic-v5.2.0-android-<abi>-release.apk`).

## [5.1.0] - 2026-11-19

### Added
- **Public Mainstream Music Catalog (1900–2026)**: Integrated Apple's free public iTunes Search API (with automatic JSONP fallback) alongside Audius Global and YouTube Music, unlocking mainstream Indonesian and global songs from 1900 through 2026 with exact release year badges (`releaseYear`), 600x600 HD cover art, and Web Audio 5-Band EQ playback.
- **Cross-Era Explorer (1900–2026)**: Added 7 curated era cards (`2020–2026`, `2010-an`, `2000-an`, `1990-an`, `1980-an`, `1970-an`, `Klasik 1900–1969`) on `HomeView` and interactive Era Filter Chips in `SearchView`.
- **Smart Real-Time Search Suggestions**: Added a debounced (180ms) `AbortController`-backed autocomplete engine combining 0ms local/recent/era suggestions with live public song & artist suggestions, release year badges, one-tap quick play, and persistent recent searches.
- **Version Bump**: Upgraded single-source version in `package.json` to `5.1.0` (automatically reflected in `tauri.conf.json`, Rust `package_info()`, and dynamic APK filenames `Xmusic-v5.1.0-android-<abi>-release.apk`).

## [5.0.0] — 2026-11-19 (Strict TypeScript, Pixel-Perfect Konsta UI iOS, Audiophile DSP & Native Android Media Notification)

- **SvelteKit 3.4 + TypeScript 6.0 CI Compliance**:
  - Updated `tsconfig.json` to extend SvelteKit 3's generated `$app/tsconfig` with explicit `include`/`exclude` arrays (resolving `tsconfig_extends_missing` and missing `.svelte-kit/tsconfig.json` in `svelte-check`).
  - Upgraded `typescript` to `^6.0.0` in `package.json` to satisfy `@sveltejs/kit@3.4.x` peer dependency with zero warnings.
  - Added standard `src/app.d.ts` ambient type declarations, appended explicit `.ts` file extensions to all `#lib/*` subpath imports across 24 files, and moved `export type IconName` in `Icon.svelte` into `<script module lang="ts">`.

- **Native Android Status Bar & Pure Konsta UI v5.5 iOS Polish**:
  - Eliminated Android Material's purple status bar via dynamic `themes.xml` / `values-night/themes.xml` patching and real-time `MainActivity.setSystemBarTheme(isDark)` bridge (`#F2F2F7` Light / `#000000` Dark).
  - Removed touch blue-box focus outline (`-webkit-tap-highlight-color: transparent`, desktop keyboard-only `:focus-visible`).
  - Removed overlapping top `DynamicBar` and separated `<Navbar>` slots to 1 dedicated iOS 26 glass button per side (Theme toggle on left, Queue on right; Flip on left, Close on right in `TrackModal`).
  - Added dedicated Stop/Close (`engine.stopTrack()`) button on both `PlayerBar` and `TrackModal`, moved `TrackModal` spectrum to a non-overlapping 30fps throttled strip, added `onerror` artwork fallbacks, and converted Spotify Charts to on-demand Konsta `<List>` items to eliminate offline `net::ERR_NAME_NOT_RESOLVED` WebView errors.

### UI/UX & Konsta UI v5.5 iOS Fixes
- Eliminated all layout overlaps observed on Android devices: removed colliding bottom-right `<Fab>`, elevated floating `PlayerBar` cleanly above Konsta v5.5's floating Liquid Glass `Tabbar` (`bottom: 86px + safe-area`), and increased `<Page>` bottom clearance to `pb-52`.
- Restored native Konsta UI `<BlockTitle>` spacing (removed conflicting `!my-2` overrides) so section headings never clip into cards below.
- Balanced top-right `Navbar` icon capsule padding and moved `<Searchbar>` cleanly into `SearchView` so titles never collide.
- Added live `isOnline` connectivity monitoring with native Konsta UI iOS offline fallback cards for Audius, Spotify Charts, YouTube, and Hub embeds — eliminating broken Android WebView error icons when offline.

### Audiophile DSP & Native Android Media Notification
- Upgraded `AudioEngine` with `latencyHint: 'playback'`, a transparent mastering `DynamicsCompressorNode` anti-clipping limiter (toggleable in `EQ Studio`), a one-tap **Reset ke Flat (Lossless)** control, and real-time `MediaSession.setPositionState`.
- Injected native Kotlin `XmusicMediaService.kt` (`MediaSession` + `Notification.MediaStyle` + Foreground Service `mediaPlayback`) and `MainActivity.kt` (`window.XmusicAndroidMedia` JS bridge + Android 13 `POST_NOTIFICATIONS` permission + R8 ProGuard keep rules) via `scripts/optimize-android-gradle.py`.

### 100% Strict TypeScript Migration
- Replaced `jsconfig.json` with strict `tsconfig.json` (`strict: true`, `allowJs: false`, `noUnusedLocals: true`, `noUnusedParameters: true`).
- Migrated all `src/lib/*`, `src/routes/+layout.ts`, `vite.config.ts`, and every `.svelte` component to strict TypeScript (`<script lang="ts">`) with centralized domain interfaces in `src/lib/types/music.ts`.
- Added `pnpm check` (`svelte-check`) to both `.github/workflows/ci-verify.yml` and `.github/workflows/build-apk.yml`.


## [4.0.0] — 2026-11-19 (Konsta UI iOS Overhaul, pnpm, AGPL-3.0 & Reproducible Builds)

### UI/UX Major Overhaul (Konsta UI v5.5 iOS Theme)
- Replaced custom CSS layout shell with official **[Konsta UI v5.5 for Svelte](https://konstaui.com/svelte)** (`<App theme="ios" safeAreas dark>`) and **Tailwind CSS v4** (`@tailwindcss/vite`).
- Rebuilt all 5 views, 7 modals, queue drawer, mini-player, and navigation using native Konsta UI iOS components (`Page`, `Navbar`, `Searchbar`, `Tabbar`, `ToolbarPane`, `TabbarLink`, `Panel`, `Popup`, `Card`, `Block`, `BlockTitle`, `List`, `ListItem`, `ListInput`, `Button`, `Chip`, `Badge`, `Segmented`, `Toggle`, `Range`, `Progressbar`, `Preloader`, `Fab`, `Toast`).
- Eliminated conflicting global CSS resets while preserving 3D flip synced LRC lyrics, 5-band Web Audio EQ sliders, `content-visibility: auto`, WCAG 2.2 AA contrast/focus/touch-target standards, and WebQual 4.0 quality criteria.

### Package Manager & Licensing
- Migrated project and CI workflows from `npm` to **`pnpm`** (`pnpm@10.12.1`) for faster, lighter local development and deduplicated caching.
- Adopted **GNU AGPL-3.0-or-later** license (`LICENSE`) with author **Azka Putra** across `package.json`, `src-tauri/Cargo.toml`, and all source files.
- Added `.license-header.txt`, `scripts/license-manager.py`, and **Google `addlicense`** automated header verification in both `.github/workflows/build-apk.yml` and `.github/workflows/ci-verify.yml`.

### Single-Source Versioning, Dynamic APK Naming & Reproducible Builds
- Configured `src-tauri/tauri.conf.json` with `"version": "../package.json"` and updated `src-tauri/src/lib.rs` to read `app.package_info().version.to_string()` directly.
- Replaced static `Xmusic.apk` output with dynamic, descriptive artifact naming: `Xmusic-v<version>-android-<abi>-release.apk` plus cryptographic `.sha256`, `.sha512`, signing certificate SHA-256 fingerprint, exact byte size, `SOURCE_DATE_EPOCH`, Git SHA, and toolchain attestation table published directly in every GitHub Release.
- Added authentic iOS **Light / Dark / System** theme switching (anti-FOUC bootstrapper in `app.html`, 1-tap `Navbar` Sun/Moon button, and 3-way `Segmented` + `Toggle` in `ProfileView`) with full dual-mode WCAG 2.2 AA contrast.
- Enforced mandatory **deterministic reproducible builds** via `SOURCE_DATE_EPOCH`, `TZ=UTC`, `LC_ALL=C.UTF-8`, Rust `--remap-path-prefix`, Gradle `isPreserveFileTimestamps = false`, `isReproducibleFileOrder = true`, and disabled `dependenciesInfo` signing block.

---

## [3.0.0] — 2026-11-19
- Modular Svelte 5 Runes architecture refactor, 150ms throttled `AudioEngine`, WCAG 2.2 AA baseline, and manual-only 2026 GitHub Actions workflows.
