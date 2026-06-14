/** @type {import('tailwindcss').Config} */
// 디자인 토큰: prototype.html :root 변수 이식 (PRD 부록 C — 시각 명세)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F4F0',
        surface: '#FFFFFF',
        ink: '#1A1916',
        sub: '#8C887C',
        faint: '#B6B2A6',
        line: '#E8E5DD',
        line2: '#F0EEE7',
        good: '#1F8A4C',
        'good-bg': '#E7F3EC',
        warn: '#D85A2C',
        'warn-bg': '#FBEBE2',
        // 카드사 브랜드 색상
        samsung: '#1A3FB0',
        hyundai: '#222226',
        shinhan: '#0A6CFF',
        lotte: '#D7263D',
        kb: '#FFB81C',
        woori: '#0067AC',
        hana: '#00857C',
        bc: '#E4002B',
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,25,22,.04), 0 6px 20px rgba(26,25,22,.06)',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
