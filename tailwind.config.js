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
		},
	},
	plugins: [require('tailwindcss-animate')],
}
