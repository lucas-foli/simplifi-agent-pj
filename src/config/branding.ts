export const branding = {
	/**
	 * Nome mostrado em textos, títulos e meta tags.
	 * Altere aqui para personalizar o white label.
	 */
	brandName: 'FinSight',

	/**
	 * Caminhos das logos. Troque os arquivos em /public/branding
	 * mantendo os mesmos nomes para propagar automaticamente.
	 */
	logo: {
		horizontal: '/branding/logo-horizontal.svg',
		horizontalInverted: '/branding/logo-horizontal-inverted.svg',
		mark: '/branding/logo-mark.svg',
	},

	/**
	 * Paleta de cores da marca. Aceita HEX ou nomes CSS.
	 * Essas cores são convertidas para HSL em tempo de execução
	 * e aplicadas nas variáveis do design system.
	 */
	colors: {
		primary: '#0a64a9',
		primaryForeground: '#ffffff',
		primaryLight: '#0d80d9',
		primaryDark: '#074778',

		secondary: '#eaedf0',
		secondaryForeground: '#2b3d4f',

		success: '#2ecc70',
		warning: '#f39c12',
		destructive: '#e74d3c',

		muted: '#eaedf0',
		mutedForeground: '#7e8c9a',

		accent: '#2ecc70',
		accentForeground: '#ffffff',

		chart1: '#0a64a9',
		chart2: '#2ecc70',
		chart3: '#f39c12',
		chart4: '#e74d3c',
		chart5: '#995cd6',

		shadowPrimary: '0 10px 30px -10px hsl(206 89% 35% / 0.3)',
	},

	/**
	 * Favicon utilizado pelo Vite. Substitua o arquivo em /public
	 * se precisar customizar.
	 */
	favicon: '/favicon.ico',
	/**
	 * Imagens opcionais usadas em telas específicas.
	 */
	images: {
		hero: '',
		login: '',
		onboarding: '',
		dashboard: '',
	},
	/**
	 * CSS variables adicionais (sem o prefixo --).
	 * Ex.: { background: '210 16% 98%', foreground: '210 29% 24%' }
	 */
	cssVars: {},
	/**
	 * Paleta opcional para telas específicas (ex.: dashboard).
	 */
	dashboard: {
		primary: '',
		secondary: '',
		background: '',
		foreground: '',
	},
};

export type BrandingConfig = typeof branding;
