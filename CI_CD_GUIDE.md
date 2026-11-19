# CI/CD & Manual Build Guide (2026 Verified)

This repository uses **manual-only GitHub Actions workflows** (`workflow_dispatch`). Pushing commits to `main` or any branch will **never** trigger automatic APK builds or releases.

---

## 1. Available Workflows

| Workflow File | Purpose | Trigger |
| :--- | :--- | :--- |
| `.github/workflows/build-apk.yml` | Builds, zipaligns, signs (`v1+v2+v3`), uploads `Xmusic.apk`, and optionally publishes a GitHub Release | Manual only (`workflow_dispatch`) |
| `.github/workflows/ci-verify.yml` | Fast health check: Vite frontend build + Python script syntax check + Rust `fmt`/`check`/`clippy` | Manual only (`workflow_dispatch`) |

---

## 2. How to Trigger a Build Manually

### Option A: Via GitHub Website (Browser)
1. Open your repository on GitHub (e.g., `https://github.com/askap2230-commits/xmusic-app`).
2. Click the **Actions** tab in the top navigation bar.
3. In the left sidebar, select **Build Optimized Android APK (Manual)**.
4. Click the **Run workflow** button on the right.
5. Configure the inputs:
   - **target_arch**: Choose `aarch64` (default — fastest build & smallest `~2.5–3.5 MB` APK for modern 64-bit Android phones) or `universal` (all CPU architectures).
   - **publish_release**: Checked (`true`) to publish to GitHub Releases, or unchecked (`false`) for Actions Artifact only.
   - **release_tag**: Leave blank for automatic `v3.0.<run_number>`, or type a custom tag such as `v3.0.0`.
6. Click the green **Run workflow** button.
7. Once complete, download `Xmusic.apk` directly from the **Artifacts** section (no extra `.zip` wrapper thanks to `upload-artifact@v7` `archive: false`) or from **Releases**.

### Option B: Via GitHub CLI (`gh`) Command
```bash
# Build smallest aarch64 APK and publish a GitHub Release
gh workflow run build-apk.yml -f target_arch=aarch64 -f publish_release=true

# Build aarch64 APK with a specific release tag
gh workflow run build-apk.yml -f target_arch=aarch64 -f publish_release=true -f release_tag=v3.0.0

# Build universal APK without creating a GitHub Release (artifact only)
gh workflow run build-apk.yml -f target_arch=universal -f publish_release=false

# Run fast code verification check
gh workflow run ci-verify.yml
```

> **Tip for GitHub Web UI Uploaders**: GitHub's browser **Upload files** dialog skips hidden dot-folders like `.github/`. To update workflows from the browser, open `.github/workflows/build-apk.yml` directly on GitHub, click the pencil (**Edit this file**) icon, paste the updated YAML, and commit.

---

## 3. Verified 2026 GitHub Actions & Toolchain Dependencies

Every action and runtime in `.github/workflows/` has been verified against official 2026 releases (100% Node.js 24 native — zero deprecated Node 20 actions):

| Component | Pinned Version | Official Reference (2026) |
| :--- | :--- | :--- |
| Runner OS | `ubuntu-24.04` | GitHub-hosted Ubuntu 24.04 LTS |
| Checkout | `actions/checkout@v7` | [Tauri v2 GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) & [actions/checkout Releases](https://github.com/actions/checkout/releases) |
| Node.js Setup | `actions/setup-node@v6` (Node `24` LTS) | [Tauri v2 GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) |
| Java Setup | `actions/setup-java@v6` (Temurin `21` LTS) | [actions/setup-java Releases](https://github.com/actions/setup-java/releases) |
| Gradle Caching | `gradle/actions/setup-gradle@v6` | [Gradle GitHub Actions Manual](https://docs.gradle.org/current/userguide/github-actions.html) |
| npm Cache | `actions/cache@v5` | [actions/cache](https://github.com/actions/cache) |
| Rust Toolchain | `dtolnay/rust-toolchain@stable` (`>= 1.90`) | [Announcing Tauri 2.12](https://v2.tauri.app/blog/tauri-2.12/) |
| Rust Cache | `Swatinem/rust-cache@v2` | [Tauri v2 GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) |
| Artifact Upload | `actions/upload-artifact@v7` (`archive: false`) | [actions/upload-artifact Releases](https://github.com/actions/upload-artifact/releases) |
| GitHub Releases | `softprops/action-gh-release@v3` | [softprops/action-gh-release Releases](https://github.com/softprops/action-gh-release/releases) |
| Android SDK/NDK | Pre-installed `$ANDROID_HOME/cmdline-tools/*/bin/sdkmanager` | Reuses runner NDK (r26/r27/r28), avoids broken `setup-android@v3` |
| Python Imaging | `apt-get install python3-pil` | Reliable on Ubuntu 24.04 PEP 668 without pip conflicts |

---

## 4. Speed & Binary Size Optimization Stack

1. **Multi-Layer CI Caching**:
   - Rust compiled dependencies cached via `Swatinem/rust-cache@v2`.
   - Gradle User Home & build cache managed via `gradle/actions/setup-gradle@v6` with automatic `on-success` cleanup.
   - npm package cache restored via `actions/cache@v5`.
   - Pre-installed Android NDK on `ubuntu-24.04` reused directly (saves `~1.2 GB` download per run).
   - Single-ABI Rust target (`aarch64-linux-android`) compiled by default instead of all 4 ABIs.
2. **Minimum APK Size Pipeline**:
   - Cargo release profile: `opt-level = "z"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.
   - Linker flags (`src-tauri/.cargo/config.toml`): `-Wl,--gc-sections` and `-Wl,--strip-all`.
   - Android Gradle (`scripts/optimize-android-gradle.py`): `isMinifyEnabled = true`, `isShrinkResources = true`, `android.enableR8.fullMode=true`.
   - APK alignment & signing: `zipalign -f -p 4` + `apksigner` (`v1 + v2 + v3`).

---

## 5. Optional Production Keystore Secrets

By default, the workflow uses `src-tauri/keystore/xmusic-release.jks` so app updates install cleanly over previous versions. For private signing keys, add two repository secrets in **Settings → Secrets and variables → Actions**:
- `KEYSTORE_BASE64`: Base64-encoded `.jks` file (`base64 -w 0 release.jks`).
- `KEYSTORE_PASSWORD`: Keystore & key password.
