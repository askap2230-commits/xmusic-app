# Contributing Guidelines — nys Xmusic

Thank you for contributing to `nys Xmusic`. Follow these engineering standards to keep the codebase fast, lightweight, and maintainable.

## 1. Code Style & Language Conventions

- **English-Only Source Code**: Write all identifiers, filenames, CSS classes, comments, JSDoc, Rust doc comments, Python scripts, and commit messages in English.
- **Indonesian UI Copy**: Keep user-facing UI strings clear and natural in Indonesian.
- **Modular Boundaries**:
  - Views go in `src/lib/components/views/`.
  - Modals go in `src/lib/components/modals/`.
  - Shared state goes in `src/lib/stores/`.
  - Pure helpers go in `src/lib/utils/`.
  - Styles go in `src/app.css` (no scattered inline layout styles).

## 2. Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(audio): add crossfade toggle to equalizer view`
- `fix(lyrics): handle multi-timestamp LRC lines`
- `perf(ui): reduce grid re-renders during playback`
- `a11y(modal): add Escape key close handler`
- `ci(android): update Gradle cache cleanup policy`
- `docs(agents): clarify Svelte 5 runes rules`

## 3. Security & Secrets Policy

- Never commit `.env` files, personal API keys (`Spotify`, `RapidAPI`, `YouTube`), or private production keystores.
- All external API keys are configured locally by the user inside **Profil → Edit Profil & API Key** and stored only on the user's device.

## 4. Pre-Commit Verification Checklist

1. Run `npm run build` and confirm zero errors or broken imports.
2. Run `python3 -m py_compile scripts/sync-android-icons.py scripts/optimize-android-gradle.py`.
3. If modifying `src-tauri/`, run `cargo fmt --check`, `cargo check`, and `cargo clippy -- -D warnings`.
4. Verify WCAG 2.2 AA compliance (contrast, keyboard navigation, `aria-label`, no nested buttons).
5. Trigger `.github/workflows/ci-verify.yml` manually on GitHub Actions before cutting a release APK.
