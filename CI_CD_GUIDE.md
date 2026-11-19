# CI/CD & Reproducible Build Guide (2026 Verified)

All GitHub Actions workflows in this repository are **manual-only** (`workflow_dispatch`). Pushing commits never triggers automatic builds or releases.

---

## 1. Workflows Overview

| Workflow | Purpose | Trigger |
| :--- | :--- | :--- |
| `.github/workflows/build-apk.yml` | Zero-APT pipeline: license check (`google/addlicense`), pnpm build, zero-dependency Python stdlib icon sync, reproducible APK compilation, signing (`v1+v2+v3`), dynamic naming, `.sha256`/`.sha512` checksums, direct upload & optional Release | Manual (`workflow_dispatch`) |
| `.github/workflows/ci-verify.yml` | Fast check: `google/addlicense` AGPL-3.0 check, pnpm frontend build, Python `py_compile` + `--stdlib-only` icon verification, resilient APT Linux deps, Rust `fmt`/`check`/`clippy` | Manual (`workflow_dispatch`) |

---

## 2. Dynamic APK Output Naming

Every production build automatically reads `"version"` from `package.json` and maps the selected target architecture to a clear, unambiguous filename:

- **`aarch64` (default, smallest ~3 MB)**:
  - `Xmusic-v6.16.0-android-arm64-v8a-release.apk`
  - `Xmusic-v6.16.0-android-arm64-v8a-release.apk.sha256` & `.sha512` (embedded with signing cert SHA-256, exact byte size, `SOURCE_DATE_EPOCH`, Git SHA, and toolchain versions directly in the GitHub Release body)
- **`universal` (all Android ABIs)**:
  - `Xmusic-v6.16.0-android-universal-release.apk`
  - `Xmusic-v6.16.0-android-universal-release.apk.sha256` & `.sha512`

---

## 3. Triggering a Build Manually

### Option A: GitHub Website (Browser)
1. Open your repository on GitHub and click the **Actions** tab.
2. Select **Build Reproducible Android APK (Manual)** in the left sidebar.
3. Click **Run workflow**.
4. Choose:
   - `target_arch`: `aarch64` (recommended for 64-bit phones) or `universal`.
   - `publish_release`: `true` to publish APK + `.sha256` + `.sha512` to GitHub Releases.
   - `release_tag`: Leave blank to auto-use `v<package.json version>` (e.g., `v6.16.0`).
5. Click **Run workflow**. Download the direct `.apk`, `.sha256`, and `.sha512` files from **Artifacts** or **Releases**.

### Option B: GitHub CLI (`gh`)
```bash
# Build arm64-v8a reproducible APK and publish release
gh workflow run build-apk.yml -f target_arch=aarch64 -f publish_release=true

# Build universal APK (artifact only)
gh workflow run build-apk.yml -f target_arch=universal -f publish_release=false

# Run fast quality & license check
gh workflow run ci-verify.yml
```

> **GitHub Web UI Upload Tip**: Browser **Upload files** skips `.github/` dot-folders. Edit `.github/workflows/build-apk.yml` and `.github/workflows/ci-verify.yml` directly in GitHub's web editor whenever updating CI files from a browser.

---

## 4. Zero-APT Android APK Pipeline & Resilient APT Policy

- **`build-apk.yml` MUST NOT call `apt-get` or `pip`**: Ubuntu 24.04 GitHub Actions mirrors (`mirror+file:/etc/apt/apt-mirrors.txt` and `security.ubuntu.com`) intermittently return HTTP `503 Service Unavailable` (exit code `100`). Because `scripts/sync-android-icons.py` includes a complete pure Python 3 standard library PNG codec and resizer (with optional Pillow fast-path), `build-apk.yml` executes **zero `apt-get` commands** and is 100% immune to Ubuntu mirror outages.
- **`ci-verify.yml` Resilient Linux APT**: Linux desktop Tauri verification (`cargo check --all-targets`) uses a 5-attempt retry loop with `-o Acquire::Retries=5`, 30s timeouts, `--fix-missing`, exponential backoff, and automatic failover from Azure's `apt-mirrors.txt` to `http://archive.ubuntu.com/ubuntu` on attempt 3.

---

## 5. Verified 2026 CI/CD Stack (100% Node 24 Native)

| Component | Version | Official Source (2026) |
| :--- | :--- | :--- |
| Checkout | `actions/checkout@v7` | [Tauri GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) |
| pnpm Setup | `pnpm/action-setup@v4` | Auto-reads `packageManager` (`pnpm@10.12.1`) |
| Node.js Setup | `actions/setup-node@v6` (`24` LTS) | [Tauri GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) |
| pnpm Store Cache | `actions/cache@v5` | [actions/cache](https://github.com/actions/cache) |
| License Check | `google/addlicense` (`-f .license-header.txt`) | [google/addlicense](https://github.com/google/addlicense) |
| Java Setup | `actions/setup-java@v6` (`Temurin 21`) | [actions/setup-java Releases](https://github.com/actions/setup-java/releases) |
| Gradle Cache | `gradle/actions/setup-gradle@v6` | [Gradle GitHub Actions Manual](https://docs.gradle.org/current/userguide/github-actions.html) |
| Rust Toolchain | `dtolnay/rust-toolchain@stable` (`>= 1.90`) | [Announcing Tauri 2.12](https://v2.tauri.app/blog/tauri-2.12/) |
| Rust Cache | `Swatinem/rust-cache@v2` | [Tauri GitHub Pipelines](https://v2.tauri.app/distribute/pipelines/github/) |
| Artifact Upload | `actions/upload-artifact@v7` (`archive: false`) | [actions/upload-artifact Releases](https://github.com/actions/upload-artifact/releases) |
| Release Publish | `softprops/action-gh-release@v3` | [softprops/action-gh-release Releases](https://github.com/softprops/action-gh-release/releases) |

---

## 6. Verifying Reproducibility Locally

```bash
sha256sum -c Xmusic-v6.16.0-android-arm64-v8a-release.apk.sha256
sha512sum -c Xmusic-v6.16.0-android-arm64-v8a-release.apk.sha512
apksigner verify -v --print-certs Xmusic-v6.16.0-android-arm64-v8a-release.apk
```
