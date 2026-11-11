import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import { withUt } from "uploadthing/tw";

export default withUt({
    darkMode: ["class"],
    content: ["./src/**/*.tsx"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ["var(--font-geist-sans)", ...fontFamily.sans]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			'Dark-Navy': '#0F222D',
  			'Midnight-Blue': '#2D4554',
				'Blue-Dark': "#2B6282",
  			'Regent-Gray': '#8196A3',
  			'Titan-White': '#FCFDFD',
  			'Grass-Green': '#29BC5B',
  			'Sunglow': '#F5CB69',
  			'Sweet-Red': '#F16350',
  			'primary-50': '#FCFDFD',
  			'primary-100': '#EAEFF2',
  			'primary-200': '#DFE7EC',
  			'primary-300': '#BDCED8',
  			'primary-400': '#2B6282',
  			'primary-500': '#265673',
  			'primary-600': '#224D66',
  			'primary-700': '#204860',
  			'primary-800': '#193A4D',
  			'primary-900': '#132B3A',
  			'primary-1000': '#0F222D',
  			'secondary-50': '#F7FDFD',
  			'secondary-100': '#E6F8F8',
  			'secondary-200': '#D9F4F4',
  			'secondary-300': '#B0E9E9',
  			'secondary-400': '#00B7B7',
  			'secondary-500': '#00A5A5',
  			'secondary-600': '#009292',
  			'secondary-700': '#008989',
  			'secondary-800': '#006E6E',
  			'secondary-900': '#005252',
  			'secondary-1000': '#004040',
				'neutral-50': "#FFFFFF",
				'neutral-100': "#FAFAFA",
				'neutral-200': "#E9EDF1",
				'neutral-300': "#C7CCCF",
				'neutral-400': '#C4CACE',
				'neutral-500': "#9DA4A8",
				'neutral-600': "#768085",
				'neutral-700': "#636A6D",
				'neutral-800': "#474E50",
				'neutral-900': '#262B2D',
				'neutral-1000': '#141718',
				// Status (DESIGN.md): hanya untuk keadaan (sukses, menunggu, bahaya), bukan dekorasi.
				tomato: '#F16350',
				'danger-light': '#FEEFEE',
				'danger-dark': '#B54A3C',
				saffron: '#F5CB69',
				'warning-light': '#FEFAF0',
				'warning-dark': '#B8984F',
				'dark-pastel-green': '#29BC5B',
				'success-light': '#EAF8EF',
				'success-dark': '#1F8D44',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}) satisfies Config;
