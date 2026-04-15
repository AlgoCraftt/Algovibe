import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        muted: 'var(--muted)',
        border: 'var(--border-color)',
        'nb-gold': 'var(--nb-gold)',
        'nb-gold-dim': 'var(--nb-gold-dim)',
        'nb-navy': 'var(--nb-navy)',
        'nb-lilac': 'var(--nb-lilac)',
        'nb-teal': 'var(--nb-teal)',
        'nb-green': 'var(--nb-green)',
        'nb-amber': 'var(--nb-amber)',
        'nb-red': 'var(--nb-red)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-in-up': {
          from: {
            opacity: '0',
            transform: 'translateY(8px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
