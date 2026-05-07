export const branding = {
	/**
	 * Nome mostrado em textos, títulos e meta tags.
	 * Altere aqui para personalizar o white label.
	 */
	brandName: 'EasyNumbers',

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
		primary: '#00F0A8',
		primaryForeground: '#000000',
		primaryLight: '#33f3b9',
		primaryDark: '#00c086',

		secondary: '#0F172A',
		secondaryForeground: '#f8fafc',

		success: '#00F0A8',
		warning: '#F59E0B',
		destructive: '#EF4444',

		muted: '#1E293B',
		mutedForeground: '#94A3B8',

		accent: '#00F0A8',
		accentForeground: '#000000',

		chart1: '#00F0A8',
		chart2: '#3B82F6',
		chart3: '#8B5CF6',
		chart4: '#F43F5E',
		chart5: '#F59E0B',

		shadowPrimary: '0 10px 30px -10px rgba(0, 240, 168, 0.3)',
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
	cssVars: {
		background: '222 47% 4%',
		foreground: '210 40% 98%',
		card: '222 47% 4%',
		'card-foreground': '210 40% 98%',
		popover: '222 47% 4%',
		'popover-foreground': '210 40% 98%',
		border: '217 32% 17%',
		input: '217 32% 17%',
		ring: '162 100% 47%',
	},
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
