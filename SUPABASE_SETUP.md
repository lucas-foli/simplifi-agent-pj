# Configuração do Supabase - SimplifiQA

## Passo 1: Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Clique em "New Project"
4. Preencha:
   - **Name**: SimplifiQA
   - **Database Password**: Crie uma senha forte (anote!)
   - **Region**: Escolha o mais próximo (South America - São Paulo)
5. Clique em "Create new project" e aguarde ~2 minutos

## Passo 2: Executar o Schema SQL

1. No painel do Supabase, clique em "SQL Editor" no menu lateral
2. Clique em "+ New query"
3. Copie TODO o conteúdo do arquivo `supabase-schema.sql`
4. Cole no editor SQL
5. Clique em "Run" (ou pressione Ctrl+Enter)
6. Aguarde a mensagem de sucesso ✅

## Passo 3: Obter as Credenciais

1. No painel do Supabase, clique em "Settings" (⚙️) no menu lateral
2. Clique em "API"
3. Na seção "Project API keys", copie:
   - **Project URL** (ex: https://xxxx.supabase.co)
   - **anon public** key (a chave longa que começa com `eyJ...`)

## Passo 4: Configurar Variáveis de Ambiente

1. Na raiz do projeto, crie o arquivo `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edite o arquivo `.env` e cole suas credenciais:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```

3. **IMPORTANTE**: Adicione `.env` ao `.gitignore` se ainda não estiver:
   ```bash
   echo ".env" >> .gitignore
   ```

## Passo 5: Reiniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

## Passo 6: Verificar Conexão

O app agora deve conectar ao Supabase automaticamente. Para verificar:

1. Abra o console do navegador (F12)
2. Não deve haver erros relacionados ao Supabase
3. Se houver erro "Missing Supabase environment variables", revise o Passo 4

## Próximos Passos

Após configurar o Supabase, vou:
1. ✅ Criar hooks React Query para operações CRUD
2. ✅ Implementar sistema de autenticação (login/registro)
3. ✅ Migrar o Dashboard para usar dados reais
4. ✅ Criar página de Transações
5. ✅ Implementar o Chat

## Troubleshooting

### Erro: "Missing Supabase environment variables"
- Verifique se o arquivo `.env` está na raiz do projeto
- Verifique se as variáveis começam com `VITE_`
- Reinicie o servidor (`npm run dev`)

### Erro: "Invalid API key"
- Certifique-se de copiar a chave **anon public**, não a **service_role**
- Verifique se não há espaços extras na chave

### Tabelas não criadas
- Execute o SQL novamente no SQL Editor
- Verifique se não há erros no console do SQL Editor

## Segurança

⚠️ **NUNCA commite o arquivo `.env` no git!**
- O `.env.example` é apenas um template
- Compartilhe credenciais apenas por canais seguros
