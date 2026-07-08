/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        clinical: {
          25: '#f7fcfd',
          50: '#ecfeff',
          100: '#cff9fe',
          200: '#a5f0fc',
          300: '#67e2f9',
          400: '#22ccee',
          500: '#0891b2',
          600: '#0e7490',
          700: '#155e75',
          800: '#164e63',
          900: '#0f3a4d'
        },
        emerald: {
          25: '#f4fbf7'
        },
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        ink: '#0f172a'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        soft: '0 6px 18px rgba(15, 23, 42, 0.05)',
        panel: '0 12px 32px rgba(15, 23, 42, 0.08)',
        lift: '0 8px 22px rgba(8, 145, 178, 0.12)',
        insetline: 'inset 0 1px 0 rgba(255,255,255,0.75)'
      },
      backgroundImage: {
        'app-radial': 'radial-gradient(circle at top left, rgba(8,145,178,0.05), transparent 32%)',
        'card-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(247,252,253,0.94))'
      }
    }
  },
  plugins: []
};
