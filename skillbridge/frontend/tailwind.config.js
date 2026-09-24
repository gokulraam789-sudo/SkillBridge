/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101826',
        paper: '#F5F7FA',
        line: '#E2E7EF',
        muted: '#64748B',
        student: { DEFAULT: '#1F4FD8', soft: '#E8EEFD' },
        institute: { DEFAULT: '#0E7C66', soft: '#E1F2EE' },
        industry: { DEFAULT: '#B4530A', soft: '#FBEDE0' },
        admin: { DEFAULT: '#6D28D9', soft: '#EFE9FD' },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,38,0.04), 0 8px 24px -16px rgba(16,24,38,0.18)',
      },
    },
  },
  plugins: [],
}
