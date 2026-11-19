# Changelog

All notable changes to **nys Xmusic** are documented in this file.

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
