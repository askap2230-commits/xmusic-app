// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

/**
 * Unified SvelteKit 3 + Strict TypeScript + Tailwind CSS v4 + Konsta UI + Vite 8 configuration.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
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
    reportCompressedSize: false,
    chunkSizeWarningLimit: 650
  }
});
