# AGENTS.md — AI Agentic Coding & Vibe Coding Specification

This file is the **single source of truth** for AI coding assistants (Antigravity, Claude Code, Cursor, GitHub Copilot, Codex, etc.) operating on the `nys Xmusic` repository. Every rule below is mandatory and non-ambiguous.

---

## 1. Non-Negotiable Golden Rules

1. **Language Separation**:
   - **ALL source code** (filenames, folder names, variable/function/class names, CSS classes, comments, JSDoc, Rust doc comments, Python scripts, YAML step names, and console logs) **MUST be in clear, idiomatic English**.
   - **End-user visible UI text** (labels, buttons, toasts, placeholders, empty states) **MUST remain natural Indonesian** (unless an i18n layer is explicitly introduced).
2. **Zero Spaghetti / Monolith Prevention**:
   - NEVER dump new views, modals, or heavy state logic into `src/routes/+page.svelte`.
   - Keep `+page.svelte` strictly as a thin layout shell (`< 150` lines).
   - Place global reactive state in `src/lib/stores/library.svelte.js` or a dedicated `*.svelte.js` store.
   - Place pure functions in `src/lib/utils/` and API/network logic in `src/lib/api/services.js`.
   - Place UI sections in `src/lib/components/views/` and dialogs in `src/lib/components/modals/`.
3. **Zero Inline Styles & Zero AI-Slop Aesthetics**:
   - NEVER write `style="..."` for layout, spacing, typography, or colors in `.svelte` files (the ONLY permitted dynamic inline styles are runtime data values: album art `background-image`, gradient fallbacks, category custom properties `--cat-bg`/`--cat-accent`, and progress bar `width`).
   - NEVER re-introduce heavy `backdrop-filter: blur(20px+)` panels or animated full-screen neon blur blobs — they destroy Android WebView frame rates.
   - Use CSS custom properties defined in `:root` inside `src/app.css`.
4. **Zero Hardcoded Secrets**:
   - NEVER hardcode API keys (`rapidApiKey`, `spotifyClientSecret`, `ytApiKey`, keystore passwords in docs/code). All external API credentials must default to `''` and be entered by the user at runtime via `ProfileModal.svelte`.
5. **Manual-Only CI/CD**:
   - NEVER add `push:` or `pull_request:` triggers to `.github/workflows/build-apk.yml` unless the user explicitly asks to re-enable auto-builds. Keep workflows strictly `workflow_dispatch`.

---

## 2. Framework & Syntax Rules (Svelte 5 + SvelteKit 3 + Tauri v2.12)

### Svelte 5 Runes (Strict)
- Always use Svelte 5 Runes: `$state`, `$derived`, `$derived.by`, `$effect`, `$props`.
- NEVER use legacy Svelte 4 syntax (`export let`, `$:`, `on:click`, `<slot>`).
- Use native DOM event attributes (`onclick`, `oninput`, `onchange`, `onkeydown`, `onsubmit`).
- Always clean up timers, listeners, and `requestAnimationFrame` inside `$effect` return functions or `onDestroy`.

### Performance Guardrails (Mobile Android WebView)
- **Never** update reactive `$state` inside a 60fps `requestAnimationFrame` loop. Playback position syncing in `src/lib/audio/engine.svelte.js` is intentionally throttled to `150ms`.
- **Never** parse LRC lyrics for unflipped grid cards (`TrackCard.svelte` parses lazily only when `isFlipped === true`).
- Always check `prefers-reduced-motion: reduce` and `document.hidden` before running canvas animations.
- Always revoke `URL.createObjectURL` entries when tracks are deleted or unmounted (`src/lib/db/storage.js`).

### Tauri v2.12 Rust Rules
- Target Rust edition `2024` and MSRV `1.90` (`src-tauri/Cargo.toml`).
- Keep `[profile.release]` intact (`opt-level = "z"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`) to maintain `< 4 MB` `aarch64` APK size.
- Register every new `#[tauri::command]` inside `tauri::generate_handler![...]` in `src-tauri/src/lib.rs` and document its input/output types.
- Declare required permissions in `src-tauri/capabilities/default.json` following least-privilege principles.

---

## 3. Strict WCAG 2.2 AA Checklist (Mandatory Before Finishing Any UI Edit)

- [ ] `<meta name="viewport">` in `src/app.html` NEVER contains `user-scalable=no` or `maximum-scale=1`.
- [ ] Every icon-only `<button>` has an explicit `aria-label` and `type="button"` (unless inside a `<form>` as `type="submit"`).
- [ ] Every decorative `<svg>` uses `<Icon />` (`aria-hidden="true"`).
- [ ] NEVER nest `<button>` inside another interactive element (`<div role="button">` wrapping `<button>` is forbidden).
- [ ] Every modal uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and closes on `Escape`.
- [ ] Every slider (`<input type="range">` or `role="slider"`) has `aria-label` and valid `min`/`max`/`value`.
- [ ] Text contrast meets `>= 4.5:1` (normal text) and `>= 3:1` (large text / UI borders). Never put white text on `#1db954` Spotify green (use `var(--spotify-ink)` `#04140a`).
- [ ] Mobile interactive controls maintain `>= 44x44px` hit areas.

---

## 4. Verification Protocol for AI Agents

Before completing any task, verify:
1. `python3 -m py_compile scripts/sync-android-icons.py scripts/optimize-android-gradle.py` exits `0`.
2. `npm run build` produces `dist/index.html` with zero errors (when Node >= 22 is available).
3. `cargo check --manifest-path src-tauri/Cargo.toml` exits `0` (when Rust >= 1.90 is available).
4. `.github/workflows/*.yml` contains valid YAML, zero deprecated Node 20 actions, and manual `workflow_dispatch` triggers.
5. Update `CHANGELOG.md` if user-facing behavior or architecture changed.
