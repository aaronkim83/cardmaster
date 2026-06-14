import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// 100% 로컬 PWA — 서버·동기화 없음 (PRD v6)
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Pretendard 폰트(~2MB)를 오프라인 프리캐시에 포함
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },

      manifest: {
        name: '실적가계부',
        short_name: '실적가계부',
        description: '가계부 · 카드실적 · 혜택 통합 관리 (로컬 전용)',
        theme_color: '#1A1916',
        background_color: '#F5F4F0',
        display: 'standalone',
        lang: 'ko',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
});
