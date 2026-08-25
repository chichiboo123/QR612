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
    fs: {
      /*
       * 공유 링크는 `/?url=<encodeURIComponent(URL)>&theme=...` 형태다.
       * Vite 개발 서버는 `?url` 을 자산 임포트 접미사로 해석해
       * "outside of Vite serving allow list" 로 요청을 막는다.
       * (빌드 결과물/정적 호스팅에는 해당 없음 — 개발 서버에서만 필요한 설정)
       */
      strict: false,
    },
  },
});
