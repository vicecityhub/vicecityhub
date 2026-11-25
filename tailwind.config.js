/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./index.html',
		'./news.html',
		'./market.html',
		'./realestate.html',
		'./document.html',
		'./src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				border: 'rgba(255, 255, 255, 0.08)',
				background: '#050508',
				foreground: '#e4e4f0',
				neonPink: '#FF00FF',
				neonCyan: '#00FFFF',
				neonYellow: '#FFE135',
				neonOrange: '#FF6B35',
				cardBg: '#12121a',
				darkBg: '#0a0a0f',
				muted: '#636382',
			},
			fontFamily: {
				orbitron: ['Orbitron', 'sans-serif'],
				rajdhani: ['Rajdhani', 'sans-serif'],
			},
			borderRadius: {
				lg: '0.5rem',
				md: 'calc(0.5rem - 2px)',
				sm: 'calc(0.5rem - 4px)',
			},
			// Iridescent poster of the walkthrough banner on the home page (WalkthroughBanner, classes .vch-holo / .vch-sheen in index.css).
			// The color film is two cycles wide, so a shift of half its width loops without a seam; the sheen is a light streak that
			// sweeps across the picture and then rests off it. Both only move `transform` (no repaint) and stop under reduced motion.
			keyframes: {
				'vch-holo': {
					from: { transform: 'translateX(0)' },
					to: { transform: 'translateX(-50%)' },
				},
				'vch-sheen': {
					'0%': { transform: 'translateX(-150%) skewX(-18deg)' },
					'45%, 100%': { transform: 'translateX(450%) skewX(-18deg)' },
				},
			},
			animation: {
				'vch-holo': 'vch-holo 9s linear infinite',
				'vch-sheen': 'vch-sheen 5.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}
