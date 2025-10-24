# Desabilitar Confirmação de Email (Desenvolvimento)

Para facilitar o desenvolvimento, desabilite a confirmação de email no Supabase:

## Passo 1: Acessar Configurações de Email

1. Acesse o painel do Supabase
2. Vá em **Authentication** → **Providers** → **Email**

## Passo 2: Desabilitar Confirmação

1. Procure por **"Confirm email"**
2. **Desmarque** a opção "Enable email confirmations"
3. Clique em **Save**

## Passo 3: Configurar URL de Redirecionamento (opcional)

Se precisar de confirmação de email em produção:

1. Em **URL Configuration**:
   - **Site URL**: `http://localhost:8081` (desenvolvimento)
   - **Redirect URLs**: Adicione:
     - `http://localhost:8081/**`
     - Seu domínio de produção

## Alternativa: Usar Email de Teste

Se não quiser desabilitar confirmação:

1. Use o recurso de **"Auto Confirm"** para emails de teste
2. Em **Authentication** → **Email Templates**
3. Ou use um serviço de email de teste como Mailtrap

## Verificar se Funcionou

Após desabilitar:
1. Tente criar uma nova conta
2. Você deve ser redirecionado diretamente para o dashboard
3. Não deve precisar confirmar email
