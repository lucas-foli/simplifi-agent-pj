# Guia de Setup de Slug (Tenant)

## Visao Geral

O SimplifiQA utiliza um sistema multi-tenant baseado em **slugs**. Cada tenant (cliente/organizacao) possui um slug unico (ex: `acme`, `default`) que determina:

- Qual branding (cores, logos, imagens) e exibido
- Qual conjunto de dados o usuario acessa (isolamento via RLS)
- Como a URL de acesso e construida

Os slugs sao armazenados na tabela `public.tenants` no Supabase.

---

## 1. Criando um Slug via Admin UI

A forma mais simples e usar o painel administrativo:

1. Acesse `/admin` na aplicacao
2. Preencha os campos obrigatorios:
   - **Slug**: identificador unico, apenas letras minusculas, numeros e hifens (ex: `acme-corp`)
   - **Nome**: nome de exibicao do tenant (ex: `Acme Corporation`)
   - **Ativo**: marque para que o tenant fique acessivel
3. (Opcional) Configure o branding:
   - Cores (primaria, secundaria, accent, cores de graficos)
   - Logos (horizontal, invertido, mark)
   - Imagens (hero, login, onboarding, dashboard)
   - Variaveis CSS customizadas
   - Assets sao armazenados no Supabase Storage em `branding/{slug}/`

### Acesso ao Admin

O painel e restrito aos emails listados em `src/config/admin.ts`:

```typescript
export const ADMIN_EMAILS = [
  "lucas.defoliveira@gmail.com",
  "diego.fjddf@gmail.com",
];
```

Para adicionar novos admins, atualize tanto esse arquivo quanto a migration de politica RLS em `supabase/migrations/20260126123000_tenant_admin_policy.sql`.

---

## 2. Criando um Slug via Supabase SQL

Para criar diretamente no banco:

```sql
INSERT INTO public.tenants (slug, name, is_active)
VALUES ('acme', 'Acme Corporation', true);
```

Com branding customizado:

```sql
INSERT INTO public.tenants (slug, name, is_active, branding)
VALUES (
  'acme',
  'Acme Corporation',
  true,
  '{
    "brandName": "Acme Corp",
    "colors": {
      "primary": "#FF6B00",
      "secondary": "#1A1A2E"
    }
  }'::jsonb
);
```

O branding e mesclado com os valores padrao definidos em `src/config/branding.ts` — voce so precisa especificar os campos que deseja sobrescrever.

---

## 3. Variaveis de Ambiente

Configure no `.env` (veja `.env.example`):

| Variavel | Descricao | Exemplo |
|----------|-----------|---------|
| `VITE_DEFAULT_TENANT_SLUG` | Slug padrao quando nenhum e detectado na URL | `default` |
| `VITE_TENANT_URL_MODE` | Modo de resolucao: `query`, `subdomain`, ou vazio (auto-detect) | _(vazio)_ |
| `VITE_ADMIN_HOSTS` | Host(s) do painel admin (separados por virgula) | `app.example.com` |

---

## 4. Como a Resolucao de Slug Funciona

O slug e resolvido automaticamente pela funcao `resolveTenantSlug()` em `src/lib/tenant.ts`.

### Modo Query (desenvolvimento local / Vercel)

Usado automaticamente em `localhost`, IPs e dominios `.vercel.app`.

```
http://localhost:5173/?tenant=acme
http://app.vercel.app/?tenant=acme
```

### Modo Subdomain (producao)

Usado em dominios customizados com 3+ partes no hostname.

```
https://acme.example.com
https://cliente.simplifiqa.com.br
```

### Auto-deteccao

Se `VITE_TENANT_URL_MODE` estiver vazio, o modo e detectado automaticamente:
- **localhost / IP / `.vercel.app`** → modo `query`
- **Demais dominios** → modo `subdomain`

### Fallback

Se nenhum slug for encontrado na URL, o valor de `VITE_DEFAULT_TENANT_SLUG` e utilizado.

---

## 5. Vinculacao de Usuarios

Quando um usuario se cadastra em uma URL com slug:

1. O slug e capturado no momento do signup (`useAuth.ts`)
2. E enviado como metadado na criacao do usuario: `{ tenant_slug: "acme" }`
3. O trigger `handle_new_user()` no banco resolve o `tenant_id` a partir do slug
4. O perfil do usuario e criado com o `tenant_id` vinculado
5. O `tenant_id` e **imutavel** — nao pode ser alterado depois

Isso garante isolamento completo: cada usuario so acessa dados do seu tenant.

---

## Arquivos de Referencia

| Arquivo | Funcao |
|---------|--------|
| `src/lib/tenant.ts` | Resolucao de slug e carregamento de branding |
| `src/pages/Admin.tsx` | Painel admin para CRUD de tenants |
| `src/config/admin.ts` | Lista de emails com acesso admin |
| `src/config/branding.ts` | Branding padrao (template) |
| `supabase/migrations/20260126120000_create_tenants.sql` | Schema da tabela tenants |
| `supabase/migrations/20260127090000_add_tenant_isolation.sql` | Isolamento e RLS |
| `supabase/migrations/20260126123000_tenant_admin_policy.sql` | Politica de acesso admin |
