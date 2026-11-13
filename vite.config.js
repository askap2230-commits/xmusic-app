import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

/**
 * Konfigurasi Terpadu SvelteKit 3 + Vite 8 (Rolldown) untuk Tauri v2
 * Catatan SvelteKit 3: svelte.config.js telah dihapus di SvelteKit 3.0+,
 * seluruh opsi adapter dan compiler kini dideklarasikan langsung di sveltekit() dalam vite.config.js.
 */
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: 'dist',
        assets: 'dist',
        fallback: 'index.html',
        precompress: false,
        strict: false
      }),
      compilerOptions: {
        runes: true
      }
    })
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 5174
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    target: 'es2022',
    minify: true,
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: false
  }
});
