import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        accent: 'var(--accent)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'surface-foreground': 'var(--surface-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        brand: 'var(--shadow-elevated)',
      },
    },
  },
  plugins: [],
};

export default config;
