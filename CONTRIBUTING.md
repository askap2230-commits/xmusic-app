# Contributing Guidelines — nys Xmusic

All contributions to **nys Xmusic** are licensed under **GNU AGPL-3.0-or-later** (`Copyright 2026 Azka Putra`).

## 1. Development Workflow (pnpm)

```bash
pnpm install
pnpm dev
```

## 2. Mandatory License Headers (Google `addlicense`)

Every source file must carry the AGPL-3.0-or-later header from `.license-header.txt`:

```bash
# Local automated header application & verification
pnpm license:apply
pnpm license:check

# Official Google addlicense CLI verification (also enforced in CI)
addlicense -check -f .license-header.txt \
  -ignore "node_modules/**" -ignore "dist/**" -ignore ".svelte-kit/**" \
  -ignore "src-tauri/target/**" -ignore "src-tauri/gen/**" \
  src-tauri/src scripts vite.config.ts static/sw.js
```

## 3. UI & Engineering Standards

- **Konsta UI iOS Theme Only**: Use official `konsta/svelte` components with Tailwind CSS v4. Never introduce conflicting CSS resets or switch off `theme="ios"`.
- **Single-Source Version**: Bump version in `package.json` only (`src-tauri/tauri.conf.json` resolves `"version": "../package.json"` automatically).
- **English Code / Indonesian UI**: Keep all code syntax, comments, and scripts in English; keep user-facing UI labels in natural Indonesian.
- **No Secrets**: Never commit API keys or private signing keystores.

## 4. Pre-Commit Checklist

1. `pnpm license:check` passes with exit code `0`.
2. `pnpm build` generates `dist/index.html` cleanly.
3. `python3 -m py_compile scripts/*.py` passes cleanly.
4. `cargo fmt --check && cargo check && cargo clippy -- -D warnings` passes in `src-tauri/`.
5. Trigger `.github/workflows/ci-verify.yml` manually on GitHub Actions before cutting a release APK.
