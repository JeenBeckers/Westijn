import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        harvest: {
          bg: '#d8d3c9',
          surface: '#FFFBF5',
          dark: '#092B13',
          green: '#2F6B3A',
          brown: '#B8865F',
          muted: '#5b5750',
          error: '#9C2A12',
        },
      },
      fontFamily: {
        sans: ['Libre Franklin', 'sans-serif'],
        serif: ['Source Serif 4', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
