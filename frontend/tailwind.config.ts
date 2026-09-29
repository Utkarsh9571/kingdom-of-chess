import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          orange: '#FF6B00',
          'orange-hover': '#E66000',
          'orange-light': '#FFF2E5',
          navy: '#03283D',
          'navy-light': '#0A3B54',
          cream: '#FFF9EE',
          'cream-dark': '#F5EFE4',
          teal: '#2DB8A5',
          'teal-light': '#E8F8F5',
          green: '#70C95A',
          'green-light': '#EBF7E7',
          yellow: '#F5C84B',
          'yellow-light': '#FEF9E7',
          pink: '#F58FA5',
          'pink-light': '#FEF0F3',
          sky: '#8CC9E8',
          'sky-light': '#EEF7FC',
          border: '#E9E1D5',
          text: '#082B3D',
          'text-muted': '#64747A',
        },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(3, 40, 61, 0.06), 0 2px 6px -1px rgba(3, 40, 61, 0.04)',
        'soft-md': '0 8px 30px -4px rgba(3, 40, 61, 0.08), 0 4px 10px -2px rgba(3, 40, 61, 0.04)',
        'soft-lg': '0 16px 40px -6px rgba(3, 40, 61, 0.12), 0 6px 16px -3px rgba(3, 40, 61, 0.05)',
        orange: '0 8px 24px -4px rgba(255, 107, 0, 0.35)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
