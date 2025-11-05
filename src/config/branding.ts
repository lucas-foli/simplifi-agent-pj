export const branding = {
	/**
	 * Nome mostrado em textos, títulos e meta tags.
	 * Altere aqui para personalizar o white label.
	 */
	brandName: 'Easy Numbers',
	// brandName: "Simplifi Agent",

	/**
	 * Caminhos das logos. Troque os arquivos em /public/branding
	 * mantendo os mesmos nomes para propagar automaticamente.
	 */
	logo: {
		horizontal: '/branding/GOFly (1).png',
		horizontalInverted: '/branding/GOFly (1).png',
		mark: '/branding/GOFly (2).png',
	},
	// logo: {
	//   horizontal: "/branding/logo-horizontal.svg",
	//   horizontalInverted: "/branding/logo-horizontal-inverted.svg",
	//   mark: "/branding/logo-mark.svg",
	// },

	/**
	 * Paleta de cores da marca. Aceita HEX ou nomes CSS.
	 * Essas cores são convertidas para HSL em tempo de execução
	 * e aplicadas nas variáveis do design system.
	 */
	colors: {
		// preto 000000
		// vermelho df3e5f
		// verde 45b180
		// branco FFFFFF
		// laranja ec7523
		// azul escuro 394e6b
		// amarelo eec569

		primary: '#000000',
		primaryForeground: '#FFFFFF',
		primaryLight: '#3AB5F2',
		primaryDark: '#394e6b',

		secondary: '#eec569',
		secondaryForeground: '#1F2937',

		success: '#45b180',
		warning: '#F97316',
		destructive: '#df3e5f',

		muted: '#E2E8F0',
		mutedForeground: '#64748B',

		accent: '#45b180',
		accentForeground: '#FFFFFF',

		chart1: '#0EA5E9',
		chart2: '#22C55E',
		chart3: '#F97316',
		chart4: '#EF4444',
		chart5: '#7C3AED',

		shadowPrimary: 'rgba(14, 165, 233, 0.3)',
	},

	/**
	 * Favicon utilizado pelo Vite. Substitua o arquivo em /public
	 * se precisar customizar.
	 */
	favicon: '/favicon.ico',
};

export type BrandingConfig = typeof branding;
