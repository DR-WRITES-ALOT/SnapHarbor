import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep background colors (if video fails to load or during transitions)
        base: '#0A0A0E', 
        
        // Translucent glass surfaces
        glass: {
          light: 'rgba(255, 255, 255, 0.08)',
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          dark: 'rgba(0, 0, 0, 0.4)',
        },
        
        // Text & Accents
        content: {
          primary: '#F8F9FA',
          secondary: '#A1A1AA',
          accent: '#3B82F6', // For progress bars, active states
        }
      },
      backdropBlur: {
        'glass-sm': '8px',
        'glass': '16px',
        'glass-md': '24px',
        'glass-lg': '40px',
      },
      boxShadow: {
        // Subtle outer shadow and inner highlights to simulate glass thickness
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
      },
      borderRadius: {
        'glass': '24px', // Smooth rounded corners
        'glass-sm': '16px',
      }
    },
  },
  plugins: [],
} satisfies Config;
