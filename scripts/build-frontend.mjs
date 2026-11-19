import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

console.log('[Xmusic Build] Starting SvelteKit 3 + Vite 8 production build...');

execSync('npx vite build', { stdio: 'inherit' });

mkdirSync('dist', { recursive: true });

const staticAssets = ['manifest.json', 'sw.js', 'icon.png', 'icon-192.png', 'icon-maskable.png'];
for (const asset of staticAssets) {
  const src = join('static', asset);
  const dst = join('dist', asset);
  if (existsSync(src) && !existsSync(dst)) {
    copyFileSync(src, dst);
  }
}

if (!existsSync(join('dist', 'index.html'))) {
  console.error('[Xmusic Build] ERROR: dist/index.html was not generated.');
  process.exit(1);
}

console.log('[Xmusic Build] Production bundle in dist/ is ready for Tauri v2.');
