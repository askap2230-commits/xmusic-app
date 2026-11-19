# Changelog

All notable changes to **nys Xmusic** are documented in this file.

## [3.0.0] — 2026-11-19 (Major Production Overhaul)

### Architecture & Code Quality
- Refactored monolithic 2,042-line `src/routes/+page.svelte` into 18 focused Svelte 5 Runes components (`views/`, `modals/`, `Icon`, `DynamicBar`, `Sidebar`, `Topbar`, `MobileNav`, `PlayerBar`, `QueueDrawer`, `TrackCard`) and a centralized reactive store (`src/lib/stores/library.svelte.js`), reducing `+page.svelte` to ~105 lines.
- Removed dead duplicate `xmusic-tauri/` subfolder (including nested `.git` metadata and stale `dist/` artifacts).
- Standardized 100% of source code, comments, Rust docs, Python scripts, and GitHub workflows to clean English.
- Upgraded `src-tauri/Cargo.toml` to Tauri `2.12`, Rust Edition `2024`, and MSRV `1.90` with full release size optimizations (`opt-level = "z"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`).

### Performance & Mobile Optimization
- Eliminated 60fps Svelte reactivity churn in `AudioEngine` by throttling reactive `position` sync to `150ms` (`~6.6Hz`).
- Replaced heavy stacked `backdrop-filter: blur(22px)` glass panels and animated blur blobs with the zero-overdraw **Studio Obsidian** design system.
- Added lazy LRC parsing in `TrackCard.svelte` (parsed only when flipped) and `content-visibility: auto` on track grids.
- Added automatic FFT visualizer pause when the tab is hidden, card is flipped, or `prefers-reduced-motion: reduce` is active.
- Enabled the compact floating `DynamicBar` across both mobile and desktop viewports with proper safe-area insets.

### Accessibility (WCAG 2.2 AA)
- Removed `maximum-scale=1, user-scalable=no` from `src/app.html` to restore user pinch-to-zoom.
- Audited and upgraded all text/button foreground-background pairs to meet WCAG AA/AAA (`#04140a` ink on `#1db954` Spotify green, `#9ca3b8` muted text on `#12151f` surfaces).
- Replaced raw emoji icon buttons with accessible inline SVG icons (`Icon.svelte`) and explicit `aria-label` / `aria-pressed` / `aria-current` attributes.
- Eliminated nested interactive `<button>` elements inside track cards, added skip-to-content navigation, global `Escape` modal dismissal, and `aria-live="polite"` toast announcements.

### Security
- Removed hardcoded `rapidApiKey` from `src/lib/api/services.js`; API keys now default to empty and are masked (`type="password"`) in `ProfileModal.svelte`.

### CI/CD (GitHub Actions 2026)
- Converted `.github/workflows/build-apk.yml` to **manual-only** (`workflow_dispatch`) — removed automatic `push` triggers.
- Added manual-only `.github/workflows/ci-verify.yml` for fast frontend + Rust verification.
- Upgraded all workflow actions to verified 2026 Node 24 releases: `actions/checkout@v7`, `actions/setup-node@v6`, `actions/setup-java@v6` (Temurin 21), `gradle/actions/setup-gradle@v6`, `actions/cache@v5`, `actions/upload-artifact@v7` (`archive: false` direct APK download), `softprops/action-gh-release@v3`, and `Swatinem/rust-cache@v2`.
- Added `python3-pil` installation on `ubuntu-24.04` to guarantee reliable Android Adaptive Icon generation.

### Documentation
- Added complete documentation suite: `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `CI_CD_GUIDE.md`, `WCAG_ACCESSIBILITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md`.

---

## [2.0.7] — 2026-11-13
- Initial Tauri v2.12 + SvelteKit 3 production Android APK release (`~2.8 MB` `aarch64`) with Spotify Web API, LRCLIB synced lyrics, and 5-band Web Audio EQ.
