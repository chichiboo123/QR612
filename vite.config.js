import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 base — GitHub Pages / Cloudflare Pages 등 서브 경로 배포 대응
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
});
