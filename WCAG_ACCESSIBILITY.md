# WCAG 2.2 AA Accessibility Standard — nys Xmusic v3.0

`nys Xmusic` enforces **WCAG 2.2 Level AA** (with AAA targets for core reading contrast and touch target sizing) across Desktop and Android WebView.

---

## 1. Verified Color Contrast Matrix

| Role | Foreground | Background | Approximate Ratio | WCAG Status |
| :--- | :--- | :--- | :--- | :--- |
| Primary text on canvas | `#f1f5f9` | `#0a0b0f` | `17.8 : 1` | AAA Pass |
| Primary text on card | `#f1f5f9` | `#181c28` | `14.6 : 1` | AAA Pass |
| Secondary / muted text | `#9ca3b8` | `#12151f` | `6.8 : 1` | AA+ Pass |
| Accent text / focus ring | `#7dd3fc` | `#12151f` | `10.9 : 1` | AAA Pass |
| Primary CTA button | `#0a0b0f` | `#f1f5f9` | `17.8 : 1` | AAA Pass |
| Spotify CTA button | `#04140a` | `#1db954` | `8.1 : 1` | AAA Pass |

---

## 2. Structural & Interactive Requirements

1. **Zoom & Reflow (WCAG 1.4.4 / 1.4.10)**:
   - `src/app.html` uses `width=device-width, initial-scale=1, viewport-fit=cover` with pinch-to-zoom explicitly enabled (`user-scalable=no` and `maximum-scale=1` are prohibited).
2. **Landmarks & Skip Navigation (WCAG 2.4.1)**:
   - Includes `.skip-link` (`Lewati ke konten utama`) targeting `<main id="main-content" tabindex="-1">`.
   - Distinct semantic regions: `<aside aria-label>`, `<header>`, `<main>`, `<nav aria-label>`, `<footer aria-label>`.
3. **Keyboard & Focus Visibility (WCAG 2.1.1 / 2.4.7 / 2.4.11)**:
   - Global `:focus-visible` rule renders a high-contrast `2px solid #7dd3fc` ring with `2px` offset.
   - `Escape` closes the topmost open modal or drawer.
   - Seek bars support `ArrowLeft` (`-5s`) and `ArrowRight` (`+5s`) keyboard scrubbing with `aria-valuetext`.
4. **No Nested Interactive Controls (WCAG 4.1.2)**:
   - Track cards separate the cover trigger `<button>` from top-right action buttons and the bottom play `<button>` — zero `<button>` elements nested inside clickable containers.
5. **Dialogs & Live Regions (WCAG 4.1.3)**:
   - All 7 modals use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
   - Toast messages render inside a persistent `role="status" aria-live="polite" aria-atomic="true"` region.
6. **Touch Target Sizing (WCAG 2.5.8)**:
   - Primary buttons, nav items, inputs, and player controls maintain `>= 44x44px` interactive bounds on mobile viewports.
7. **Reduced Motion (WCAG 2.3.3)**:
   - `@media (prefers-reduced-motion: reduce)` disables CSS transitions/animations, smooth scroll, and the Canvas FFT visualizer loop.
