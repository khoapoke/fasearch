/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF4D00',
          hover: '#E04300',
          light: '#FFF4ED',
          border: '#FFD8C2',
          dark: '#AA3000',
        },
        charcoal: {
          DEFAULT: '#111827',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        crimson: {
          DEFAULT: '#E11D48',
          light: '#FFE4E8',
        },
        ai: {
          glow: '#FFEDD5',
          text: '#C2410C',
          badge: '#FF6B00',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F9FAFB',
          card: '#FFFFFF',
          dim: '#F3F4F6',
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(17, 24, 39, 0.05)',
        'card': '0 10px 25px -5px rgba(17, 24, 39, 0.06), 0 8px 10px -6px rgba(17, 24, 39, 0.04)',
        'modal': '0 20px 35px -10px rgba(17, 24, 39, 0.15)',
        'glow': '0 0 20px -2px rgba(255, 77, 0, 0.25)',
      },
      borderRadius: {
        'base': '8px',
      }
    },
  },
  plugins: [],
}
