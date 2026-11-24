# System Architecture — nys Xmusic v6.27.0

## 1. Layered Architecture

```text
+-----------------------------------------------------------------------+
|                       Tauri v2.12 Native Shell                        |
|   src-tauri/tauri.conf.json ("version": "../package.json")            |
|   src-tauri/src/lib.rs (get_runtime_info, http_get_json, ytm_search)  |
+----------------------------------^------------------------------------+
                                   | @tauri-apps/api/core
+----------------------------------v------------------------------------+
|       Konsta UI v5.5 (iOS Theme) + Tailwind CSS v4 + SvelteKit 3      |
|  +layout.svelte (<App theme="ios" safeAreas dark={appStore.isDark}>)  |
|  +page.svelte   (<Page>, <Navbar>, <Tabbar>, <Toast>)                 |
|  ├── views/     HomeView, SearchView, LibraryView, Equalizer, Profile |
|  ├── modals/    TrackModal, Upload, Hub, Downloader, Edit, Playlist,  |
|  │              ProfileModal (all Konsta <Popup> + <ListInput>)       |
|  └── components PlayerBar, QueueDrawer (<Panel>),                     |
|                 TrackCard (<Card> + 3D flip), Icon                    |
+-------------------+-------------------------+-------------------------+
                    |                         |
       +------------v-----------+   +---------v----------+
       | Centralized Runes Store|   | Web Audio DSP      |
       | library.svelte.ts      |   | engine.svelte.ts   |
       | - Tracks & Playlists   |   | - 5-Band EQ        |
       | - Search & Modals      |   | - 150ms Sync Loop  |
       | - Profile & API Config |   | - FFT & MediaSess. |
       +------------+-----------+   +--------------------+
                    |
       +------------v-----------+   +--------------------+
       | IndexedDB v2 Storage   |   | External APIs      |
       | db/storage.ts          |   | api/services.ts    |
       | - Blob & ObjectURL Map |   | - Audius / Deezer  |
       +------------------------+   | - LRCLIB / YouTube |
                                    +--------------------+
```

## 2. Single Source of Truth Versioning

- **`package.json`** owns the canonical SemVer `"version": "6.27.0"`.
- **`src-tauri/tauri.conf.json`** declares `"version": "../package.json"`, which Tauri v2 resolves automatically during Android and Desktop bundling ([Tauri Configuration Reference](https://v2.tauri.app/reference/config/)).
- **`src-tauri/Cargo.toml`** and **`src/lib/stores/library.svelte.ts`** mirror `"6.27.0"` for Rust crate metadata and web fallback runtime info.
- **`src-tauri/src/lib.rs`** exposes `app.package_info().version.to_string()` via `get_runtime_info`.
- **`.github/workflows/build-apk.yml`** reads `require('./package.json').version` to construct the dynamic release APK filename `Xmusic-v<version>-android-<abi>-release.apk` and default GitHub Release tag `v<version>`.

## 3. Reproducible Build & Zero-APT CI Architecture

1. **Zero-Dependency Python Build Scripts**:
   - `scripts/sync-android-icons.py`, `scripts/optimize-android-gradle.py`, and `scripts/license-manager.py` run using **Python 3 standard library only** (`sync-android-icons.py` includes a built-in pure-Python PNG codec, area-averaging resizer, and anti-aliased circle mask, with optional Pillow fast-path).
   - `.github/workflows/build-apk.yml` never invokes `apt-get` or `pip`, eliminating Ubuntu 24.04 mirror `503 Service Unavailable` failures.
2. **Deterministic Rust Compilation**:
   - `Cargo.toml` release profile sets `codegen-units = 1`, `lto = "fat"`, `opt-level = "z"`, `panic = "abort"`, `strip = true`, `incremental = false`.
   - CI exports `RUSTFLAGS="--remap-path-prefix=$PWD=. --remap-path-prefix=$HOME=/home/builder"` so absolute runner paths never leak into `.so` binaries.
3. **Deterministic Android Gradle Packaging**:
   - `scripts/optimize-android-gradle.py` configures `isPreserveFileTimestamps = false` and `isReproducibleFileOrder = true` on all `AbstractArchiveTask` instances ([Gradle User Manual](https://docs.gradle.org/current/kotlin-dsl/gradle/org.gradle.api.tasks.bundling/-abstract-archive-task/is-reproducible-file-order.html)).
   - Disables `dependenciesInfo { includeInApk = false; includeInBundle = false }` to eliminate Google Play's non-reproducible signing block.
   - Enforces `TZ=UTC`, `LC_ALL=C.UTF-8`, and `SOURCE_DATE_EPOCH` from the latest Git commit timestamp.
4. **Cryptographic Verification**:
   - Every build outputs `Xmusic-v<version>-android-<abi>-release.apk` alongside `.sha256` and `.sha512` checksums.

## 4. True Native Android Background Playback (`XmusicMediaService` AndroidX Media3 ExoPlayer)

- **Range-Verified Rust InnerTube Resolver (`src-tauri/src/lib.rs`)**: `ytm_resolve_audio` tries `VISIONOS` (`1.02` -> `1.03` -> `1.01`, `clientId: 101`, full `RealityDevice17,1` device fields) and `ANDROID_VR` (`1.65.10`) with explicit `X-YouTube-Client-Name`/`X-YouTube-Client-Version` headers and probes each candidate URL with `Range: bytes=0-1` (HTTP 200/206) before returning `YtmResolvedAudio { url, user_agent }` — rejecting HTTP 403 streams before playback starts.
- **Native Foreground Service `MediaPlayer` (`XmusicMediaService.kt`)**: On Android, `AudioEngine` streams verified YouTube Music audio directly inside `XmusicMediaService`'s native `android.media.MediaPlayer` (`AudioAttributes.USAGE_MEDIA`, `setWakeMode(PARTIAL_WAKE_LOCK)`, `WifiLock`, and `setDataSource(ctx, uri, headers)` with matching `User-Agent`, `Origin`, and `Referer` headers for `googlevideo.com`). Because playback runs inside the `mediaPlayback` Foreground Service rather than WebView, audio continues uninterrupted when the screen turns off, when switching apps, or when `MainActivity` is closed (`onDestroy()` preserves the service while `isNativePlaying` is true).
- **Zero-Reset Foreground Re-Sync**: Reopening Xmusic reads live state from `window.XmusicAndroidMedia.getNativeStateJson()` (`active`, `playing`, `trackId`, `positionMs`, `durationMs`) and syncs UI controls without interrupting or resetting audio to `0:00`. Lockscreen Play/Pause/Seek operate directly inside `XmusicMediaService` even when WebView is closed.
