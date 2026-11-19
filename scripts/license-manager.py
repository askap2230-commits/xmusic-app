#!/usr/bin/env python3
# Copyright 2026 Azka Putra
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
License Header Helper (Compatible with Google addlicense -f .license-header.txt).

Applies or verifies AGPL-3.0-or-later headers authored by Azka Putra across all
project source files without breaking shebangs, DOCTYPE declarations, or Svelte tags.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKER = "SPDX-License-Identifier: AGPL-3.0-or-later"
COPYRIGHT = "Copyright 2026 Azka Putra"

SKIP_DIRS = {"node_modules", "dist", ".svelte-kit", "target", "gen", ".git"}

STYLE_MAP = {
    ".js": ("// ", ""),
    ".mjs": ("// ", ""),
    ".ts": ("// ", ""),
    ".rs": ("// ", ""),
    ".py": ("# ", ""),
    ".yml": ("# ", ""),
    ".yaml": ("# ", ""),
    ".toml": ("# ", ""),
    ".css": ("/* ", " */"),
    ".svelte": ("<!-- ", " -->"),
    ".html": ("<!-- ", " -->"),
}


def build_header(ext: str) -> str:
    prefix, suffix = STYLE_MAP[ext]
    if suffix:
        return f"{prefix}{COPYRIGHT} | {MARKER}{suffix}\n"
    return f"{prefix}{COPYRIGHT}\n{prefix}{MARKER}\n\n"


def iter_source_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix in STYLE_MAP:
            yield path


def has_header(text: str) -> bool:
    head = "\n".join(text.splitlines()[:6])
    return MARKER in head and COPYRIGHT in head


def apply_header(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if has_header(text):
        return False

    header = build_header(path.suffix)
    lines = text.splitlines(keepends=True)

    # Preserve shebang or <!DOCTYPE html> on line 1
    if lines and (lines[0].startswith("#!") or lines[0].lstrip().lower().startswith("<!doctype")):
        updated = lines[0] + header + "".join(lines[1:])
    else:
        updated = header + text

    path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    missing = []
    updated = 0

    for path in iter_source_files():
        if mode == "apply":
            if apply_header(path):
                updated += 1
                print(f"[License Apply] Added header: {path.relative_to(ROOT)}")
        else:
            if not has_header(path.read_text(encoding="utf-8")):
                missing.append(path.relative_to(ROOT))

    if mode == "apply":
        print(f"[License Apply] Done. Updated {updated} file(s).")
        return 0

    if missing:
        print("[License Check] Missing AGPL-3.0-or-later header in:")
        for rel in missing:
            print(f"  - {rel}")
        return 1

    print("[License Check] All source files have valid AGPL-3.0-or-later headers (Azka Putra).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
