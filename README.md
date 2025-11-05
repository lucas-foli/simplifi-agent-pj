# simplifi-agent-pj

Assistente financeiro conversacional focado em empresas (Pessoa Jurídica).  
O aplicativo centraliza o fluxo de caixa, cadastra custos fixos, registra transações via chat/WhatsApp e apresenta dashboards específicos para CNPJ.

---

## Principais recursos

- Onboarding 100% empresarial (responsável + dados da empresa + custos fixos).
- Dashboard de fluxo de caixa, custos e comparativos para cada empresa.
- Cadastros de transações, custos fixos e categorias por companhia.
- Integração com Supabase (Auth, PostgREST, edge functions, RPCs).
- Interface construída com Shadcn UI, Tailwind CSS e React Query.

---

## Requisitos

- Node.js 18+ (recomendado usar [nvm](https://github.com/nvm-sh/nvm))
- Supabase CLI (opcional, caso rode o backend localmente)
- Variáveis de ambiente (`.env`) com as chaves do projeto compartilhado

---

## Como rodar localmente

```bash
# 1. Clonar o repositório
git clone git@github.com:lucas-foli/simplifi-agent-pj.git
cd simplifi-agent-pj

# 2. Instalar dependências
npm install

# 3. Rodar o app
npm run dev
```

O projeto usa Vite; por padrão a aplicação sobe em `http://localhost:5173`.

---

## Estrutura de pastas

- `src/pages` – onboarding PJ, dashboards empresariais, fluxo de transações/custos.
- `src/hooks` – hooks específicos para empresas (`useCompanyFinancialData`, `useAuth`).
- `supabase/` – migrações, funções e configurações compartilhadas PF/PJ (não remover).
- `public/` – assets e ícones.

### White label / branding

Para personalizar o visual com a marca do cliente, basta substituir os arquivos em `public/branding/` mantendo os mesmos nomes:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Auth + PostgREST + Edge Functions)

## White label / Branding

- Ajuste o nome, caminhos de logo e paleta em `src/config/branding.ts`.
- Substitua os arquivos em `public/branding/` (`logo-horizontal.svg`, `logo-horizontal-inverted.svg`, `logo-mark.svg`).
- Paleta suportada: `primary`, `primaryLight`, `primaryDark`, `primaryForeground`, `secondary`, `secondaryForeground`, `accent`, `accentForeground`, `success`, `warning`, `destructive`, `muted`, `mutedForeground`, `chart1…chart5`, `shadowPrimary` (HEX ou CSS names).
- As cores alimentam automaticamente CTAs, botões, destaques e gráficos; plano de fundo e textos-base permanecem neutros.
- Se quiser mudar o favicon, substitua `public/favicon.ico`.
- `logo-horizontal.svg` – versão principal para fundos claros (menus, login etc.).
- `logo-horizontal-inverted.svg` – versão para fundos escuros.
- `logo-mark.svg` – ícone compacto usado em cabeçalhos e atalhos.

Também é possível trocar o favicon substituindo `public/favicon.ico`. Não é necessário alterar código: os componentes consomem essas imagens via `src/config/branding.ts`.

No mesmo arquivo você pode ajustar `brandName` e a paleta `colors` (`primary`, `secondary`, `tertiary`) usando HEX ou nomes CSS, caso precise personalizar componentes adicionais.

---

## Stack principal

- React + TypeScript + Vite
- @tanstack/react-query
- shadcn/ui + Tailwind CSS
- Supabase (Auth, Postgres, Storage, Edge Functions)

---

## Próximos passos sugeridos

- Conectar o app à instância Supabase compartilhada (já referenciada no `.env`).
- Revisar rotas protegidas em `src/App.tsx` caso adicione novos módulos PJ.
- Criar testes de integração/end-to-end para flows críticos (onboarding e lançamento de transações).

---

## Links úteis

- Projeto no Lovable: https://lovable.dev/projects/aaf55e6e-8ebe-423d-8e6a-e3132f3a7974
- Documentação Supabase: https://supabase.com/docs
- Documentação shadcn/ui: https://ui.shadcn.com/docs
