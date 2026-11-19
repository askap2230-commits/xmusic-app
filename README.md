# nys Xmusic v5.0 — Native iOS-Themed Music Player (Konsta UI + Tauri v2.12 + pnpm)

**nys Xmusic** is a lightweight, offline-first Android and Desktop music player authored by **Azka Putra** and licensed under **GNU AGPL-3.0-or-later**. Built with [Tauri v2.12](https://v2.tauri.app/blog/tauri-2.12/), SvelteKit 3 (Svelte 5 Runes), [Konsta UI v5.5 for Svelte](https://konstaui.com/svelte) (**iOS Theme**), Tailwind CSS v4, and `pnpm`.

## Key Capabilities

- **Authentic Konsta UI iOS Theme**: Native iOS navigation (`Navbar`, `Tabbar`, `ToolbarPane`, `Panel`, `Popup`, `Card`, `List`, `ListInput`, `Range`, `Toggle`, `Segmented`, `Searchbar`, `Fab`, `Toast`) powered by Tailwind CSS v4 with zero custom CSS conflicts and zero AI-slop aesthetics.
- **Offline-First Audio & 5-Band Studio EQ**: Local `MP3`/`M4A`/`WAV`/`OGG`/`FLAC`/`AAC`/`OPUS` import into IndexedDB v2, real-time 5-band `BiquadFilterNode` EQ, stereo L/R balance, playback speed/pitch control, fade-out Sleep Timer, and 0 KB procedural WAV demo synth.
- **3D Flip Synced Lyrics & Music Hub**: Double-tap any track card or full player popup to flip for LRCLIB time-synced LRC lyrics with tap-to-seek, plus Audius v1 streaming, Spotify Web API v1 (with oEmbed fallback), YouTube Music, and user-configured RapidAPI MP3 converter.
- **WCAG 2.2 AA & WebQual 4.0 Compliant**: High-contrast iOS dark surfaces, pinch-to-zoom enabled, `>= 44px` touch targets, keyboard navigation, ARIA live regions, and `prefers-reduced-motion` support.
- **Deterministic Reproducible Builds & Dynamic APK Naming**: Single-source versioning (`tauri.conf.json -> ../package.json`), `SOURCE_DATE_EPOCH`, Rust `--remap-path-prefix`, Gradle reproducible archives, `Xmusic-v<ver>-android-<abi>-release.apk` + `.sha256` checksum.

## Tech Stack (2026 Verified)

| Layer | Technology | Standard / Version |
| :--- | :--- | :--- |
| Package Manager | `pnpm` | `pnpm@10.12.1` (Node `24` LTS) |
| UI Library | [Konsta UI Svelte](https://konstaui.com/svelte) | `konsta ^5.5.0` (**iOS Theme absolute**) + `tailwindcss ^4.1.0` |
| Frontend | SvelteKit 3 + Svelte 5 Runes + Vite 8 | `@sveltejs/kit ^3.2.0`, `svelte ^5.57.3`, `vite ^8.0.12` |
| Native Runtime | [Tauri v2](https://v2.tauri.app/blog/tauri-2.12/) | `2.12.x` (Rust `2024`, MSRV `1.90`, `"version": "../package.json"`) |
| License & Headers | GNU AGPL-3.0-or-later + [Google addlicense](https://github.com/google/addlicense) | `Copyright 2026 Azka Putra` |
| CI/CD | Manual-Only GitHub Actions (`workflow_dispatch`) | Node 24 native actions + reproducible APK pipeline |

## Local Development (pnpm)

```bash
# 1. Install dependencies (fast, deduplicated pnpm store)
pnpm install

# 2. Start web dev server
pnpm dev

# 3. Build static production bundle
pnpm build

# 4. Verify or auto-apply AGPL-3.0 license headers
pnpm license:check
pnpm license:apply

# 5. Run Tauri desktop shell (requires Rust >= 1.90)
pnpm exec tauri dev
```

## Manual APK Build (GitHub Actions)

Automatic push builds are **disabled**. Run manually via:
- **GitHub Website**: **Actions** → **Build Reproducible Android APK (Manual)** → **Run workflow**
- **GitHub CLI**: `gh workflow run build-apk.yml -f target_arch=aarch64 -f publish_release=true`

## Documentation Index

- **[AGENTS.md](./AGENTS.md)** — Mandatory engineering contract for AI coding agents & vibe coding (Konsta UI iOS, pnpm, AGPL-3.0, reproducible builds).
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Layer boundaries, single-source versioning, and performance design.
- **[CI_CD_GUIDE.md](./CI_CD_GUIDE.md)** — Manual GitHub Web UI / CLI build guide, reproducible build verification, and 2026 action versions.
- **[WCAG_ACCESSIBILITY.md](./WCAG_ACCESSIBILITY.md)** — Strict WCAG 2.2 AA & WebQual 4.0 compliance matrix.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Code style, `addlicense` workflow, and security policy.
- **[CHANGELOG.md](./CHANGELOG.md)** — Version history (`v5.0.0`).
- **[LICENSE](./LICENSE)** — GNU AGPL v3.0-or-later (`Copyright 2026 Azka Putra`).
