# System Architecture — nys Xmusic v6.12.0

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

- **`package.json`** owns the canonical SemVer `"version": "6.12.0"`.
- **`src-tauri/tauri.conf.json`** declares `"version": "../package.json"`, which Tauri v2 resolves automatically during Android and Desktop bundling ([Tauri Configuration Reference](https://v2.tauri.app/reference/config/)).
- **`src-tauri/Cargo.toml`** and **`src/lib/stores/library.svelte.ts`** mirror `"6.12.0"` for Rust crate metadata and web fallback runtime info.
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

## 4. YouTube Music Background Playback & Zero-Stuck Recovery

- **Direct Native `<audio>` Priority (`directAudioEl`)**: `src-tauri/src/lib.rs` (`ytm_resolve_audio`) prioritizes `ANDROID_VR` (with `X-YouTube-Client-Name`/`X-YouTube-Client-Version` headers) followed by `IOS`, `ANDROID`, and `TVHTML5`. Whenever a direct stream resolves while `ytBridge` is active, `AudioEngine` hands off seamlessly to `directAudioEl` at the exact live timestamp (`resumeAt`), avoiding cross-origin iframe suspension on screen-off or app switching.
- **Android WebView Background Keep-Alive (`MainActivity.kt`)**: While `XmusicMediaService.isPlayingNow` is true, `onPause()`/`onStop()` re-assert `dispatchWindowVisibilityChanged(View.VISIBLE)`, `onResume()`, and `resumeTimers()` (immediate + 250ms delayed) so Chromium WebView does not suspend background media decoders; `onResume()` dispatches `appResumed` to reconcile playback immediately on return.
- **Zombie IFrame & Expired-URL Self-Healing**: `ytAudioStreamCache` enforces a 30-minute TTL with explicit invalidation (`invalidateYoutubeAudioCache`). On stalled resume (including frozen `BUFFERING` state `3` or `0.00s` progress over 2.0s), `retryYoutubeAudio(true)` calls `ytBridge.destroy()` to wipe the DOM slot and rebuild cleanly at the saved timestamp.
