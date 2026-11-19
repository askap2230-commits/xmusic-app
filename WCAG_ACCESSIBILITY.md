# WCAG 2.2 AA & WebQual 4.0 Compliance — nys Xmusic v5.0

`nys Xmusic` combines **Konsta UI v5.5 iOS Theme** with strict **WCAG 2.2 Level AA** accessibility and **WebQual 4.0** software quality standards.

---

## 1. WCAG 2.2 AA Compliance Matrix

| Criterion | Implementation in nys Xmusic v5.0 | Status |
| :--- | :--- | :--- |
| **1.4.3 Contrast (Minimum)** | Dual-mode verified: Light Mode (`#09090b` / `#52525b` on `#ffffff` / `#f2f2f7`, `#ffffff` on `#248a3d` green) and Dark Mode (`#ffffff` / `#d4d4d8` on `#000000` / `#1c1c1e`, `#000000` on `#30d158` green) — all >= 4.5:1 AA / 7:1+ AAA. | Pass (AAA) |
| **1.4.4 Resize Text** | `src/app.html` viewport enables pinch-to-zoom (`user-scalable=no` and `maximum-scale=1` prohibited). | Pass |
| **2.1.1 Keyboard & 2.4.7 Focus** | Global `:focus-visible` `2px solid #64d2ff` ring; `Escape` closes active Konsta `Popup` / `Panel`; native `<button>` and Konsta `<Range>` keyboard controls. | Pass |
| **2.3.3 Animation from Interactions** | `@media (prefers-reduced-motion: reduce)` disables transitions, smooth lyric scroll, and FFT Canvas animation. | Pass |
| **2.4.1 Bypass Blocks** | `.skip-link` (`Lewati ke konten utama`) jumps directly to `<main id="main-content">`. | Pass |
| **2.5.8 Target Size (Minimum)** | iOS `Tabbar`, `Navbar` icon links, mini-player buttons, and modal controls maintain `>= 44x44px` touch areas. | Pass (AAA) |
| **4.1.2 Name, Role, Value** | Zero nested interactive buttons; explicit `aria-label`, `aria-pressed`, `role="tablist"`, `role="region"`. | Pass |
| **4.1.3 Status Messages** | Konsta `<Toast>` wrapped in `role="status" aria-live="polite" aria-atomic="true"`; loading indicators use `<Preloader />` with `role="status"`. | Pass |

---

## 2. WebQual 4.0 Quality Dimensions

1. **Usability (Kemudahan Penggunaan)**:
   - Familiar native iOS Human Interface Guidelines via Konsta UI (`Navbar` + 5-tab `Tabbar` + floating mini-player + `Panel` drawer + `Popup` sheets).
   - Responsive Tailwind CSS v4 grid (`2` columns on mobile phones up to `5` columns on desktop) with zero horizontal overflow.
2. **Information Quality (Kualitas Informasi)**:
   - Real-time playback elapsed/remaining timestamps, active EQ preset badge, active Sleep Timer countdown in `Navbar`, Spotify API vs oEmbed mode badge, and single-source Tauri runtime version (`v5.0.0`).
3. **Service Interaction Quality (Kualitas Interaksi Layanan)**:
   - Instant visual feedback (`Toast`, `Preloader`, active states), automatic CORS audio fallback for third-party streams, offline IndexedDB persistence with leak-free `ObjectURL` cleanup, and zero hardcoded API keys.
