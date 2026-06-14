import { defineConfig } from 'vitest/config';
import path from 'node:path';

// 테스트 전용 설정 — vite 플러그인과 분리(이중 vite 타입 충돌 방지).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
