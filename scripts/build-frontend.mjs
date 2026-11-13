import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

console.log('[Xmusic Build] Memulai build frontend SvelteKit 3 + Vite 8...');

try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('[Xmusic Build] Kompilasi SvelteKit 3 selesai.');
} catch (err) {
  console.warn('[Xmusic Build] Peringatan saat menjalankan vite build, memeriksa fallback bundle di dist/...', err?.message || '');
}

mkdirSync('dist', { recursive: true });
for (const asset of ['manifest.json', 'sw.js', 'icon.png', 'icon-192.png', 'icon-maskable.png']) {
  const src = join('static', asset);
  const dst = join('dist', asset);
  if (existsSync(src) && !existsSync(dst)) {
    copyFileSync(src, dst);
  }
}

if (!existsSync(join('dist', 'index.html'))) {
  console.error('[Xmusic Build] ERROR: dist/index.html tidak ditemukan!');
  process.exit(1);
}

console.log('[Xmusic Build] Bundle produksi dist/ siap digunakan oleh Tauri v2.');
