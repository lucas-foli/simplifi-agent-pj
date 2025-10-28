# 🚀 Planejamento de Sprints - SimplifiQA

## 📊 Status Geral do Projeto

**Versão Atual:** 0.1.0 (MVP)  
**Última Atualização:** 28/10/2024  
**Stack:** React + TypeScript + Supabase + Tailwind CSS

---

## ✅ Sprint 0 - Setup e Infraestrutura (CONCLUÍDA)

**Período:** Semana 1-2  
**Status:** ✅ 100% Concluída

### Funcionalidades Implementadas
- [x] Setup inicial do projeto com Vite + React + TypeScript
- [x] Configuração do Supabase (Auth + Database)
- [x] Sistema de autenticação completo (Login/Signup/Logout)
- [x] Estrutura de tabelas no banco de dados
- [x] Row Level Security (RLS) configurado
- [x] Sistema de tipos TypeScript gerados do Supabase
- [x] Tailwind CSS + shadcn/ui configurados
- [x] Roteamento com React Router
- [x] ProtectedRoute para rotas autenticadas

### Arquivos Criados
- `src/lib/supabase.ts`
- `src/hooks/useAuth.ts`
- `src/components/ProtectedRoute.tsx`
- `supabase/migrations/*.sql`

---

## ✅ Sprint 1 - Onboarding e Gestão Básica (CONCLUÍDA)

**Período:** Semana 3-4  
**Status:** ✅ 100% Concluída

### Funcionalidades Implementadas
- [x] Onboarding completo em 4 steps
  - [x] Step 1: Tipo de conta (PF/PJ)
  - [x] Step 2: Dados pessoais/empresa
  - [x] Step 3: Receita mensal
  - [x] Step 4: Custos fixos (com importação CSV)
- [x] Dashboard principal com resumo financeiro
- [x] Página de transações com CRUD completo
- [x] Página de custos fixos com CRUD completo
- [x] Sistema de categorias padrão (10 categorias automáticas)
- [x] Importação multi-formato (CSV, Excel, OFX, JSON, Imagens, PDF)
- [x] Revisão e edição de transações antes de salvar
- [x] Criptografia LGPD para dados sensíveis (CNPJ)

### Funcionalidades de Importação
- [x] CSV Parser robusto (separadores , e ;)
- [x] Excel Parser (.xlsx, .xls)
- [x] OFX Parser (extratos bancários)
- [x] JSON Parser
- [x] Imagens via OpenAI Vision API
- [x] PDF via PDF.js no Edge Function

### Correções e Melhorias
- [x] Fix: Conversão user_type (pf/pj → pessoa_fisica/pessoa_juridica)
- [x] Fix: Schema cache errors (name → full_name)
- [x] Fix: Coluna date vs transaction_date
- [x] Triggers automáticos para criação de perfil e categorias
- [x] Migrations organizadas e aplicadas em produção

### Arquivos Principais
- `src/pages/Onboarding.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Transactions.tsx`
- `src/pages/FixedCosts.tsx`
- `src/components/FileUpload.tsx`
- `src/components/TransactionReview.tsx`
- `src/components/FixedCostReview.tsx`
- `supabase/functions/process-financial-upload/`

---

## 🔄 Sprint 2 - Relatórios e Análises (EM ANDAMENTO)

**Período:** Semana 5-6  
**Status:** 🟡 30% Concluída

### Funcionalidades Planejadas
- [ ] Relatórios em PDF exportáveis
  - [ ] Relatório mensal de receitas e despesas
  - [ ] Relatório por categoria
  - [ ] Relatório anual consolidado
- [ ] Gráficos interativos com Recharts
  - [ ] Gráfico de pizza por categoria
  - [ ] Gráfico de linhas (evolução temporal)
  - [ ] Gráfico de barras (comparativo mensal)
- [ ] Dashboard com métricas avançadas
  - [ ] Taxa de crescimento mensal
  - [ ] Média de gastos por categoria
  - [ ] Projeção de receitas/despesas
- [ ] Filtros avançados
  - [ ] Por período (dia, semana, mês, ano)
  - [ ] Por categoria
  - [ ] Por tipo de pagamento
  - [ ] Por valor (min/max)

### Arquivos a Criar
- `src/lib/pdf-generator.ts`
- `src/components/Charts/`
- `src/pages/Reports.tsx`
- `src/hooks/useReports.ts`

### Dependências
- `recharts` - Gráficos
- `jspdf` ou `@react-pdf/renderer` - Geração de PDF
- `date-fns` - Manipulação de datas

---

## 📅 Sprint 3 - Previsões e Metas Financeiras (PLANEJADA)

**Período:** Semana 7-8  
**Status:** ⏳ Não Iniciada

### Funcionalidades Planejadas
- [ ] Sistema de metas financeiras
  - [ ] Criar meta de economia mensal
  - [ ] Criar meta por categoria
  - [ ] Visualizar progresso das metas
  - [ ] Notificações quando atingir meta
- [ ] Previsão de gastos futuros
  - [ ] Algoritmo de previsão baseado em histórico
  - [ ] Alertas de gastos acima do padrão
  - [ ] Sugestões de economia
- [ ] Planejamento de orçamento
  - [ ] Definir orçamento por categoria
  - [ ] Comparar real vs. planejado
  - [ ] Ajustes automáticos de orçamento

### IA/ML Considerações
- Usar média móvel para previsões simples
- Considerar sazonalidade (finais de mês, datas especiais)
- Machine Learning opcional para versão futura

### Arquivos a Criar
- `src/pages/Goals.tsx`
- `src/pages/Forecast.tsx`
- `src/lib/prediction-engine.ts`
- `src/hooks/useGoals.ts`
- `src/hooks/useForecast.ts`

---

## 🤖 Sprint 4 - Integração WhatsApp e Open Finance (PLANEJADA)

**Período:** Semana 9-11  
**Status:** ⏳ Não Iniciada

### Funcionalidades Planejadas
- [ ] Bot do WhatsApp (via n8n ou Twilio)
  - [ ] Envio de relatórios diários/semanais
  - [ ] Alertas de gastos altos
  - [ ] Adicionar transações por mensagem
  - [ ] Consultar saldo e extratos
  - [ ] Comandos interativos
- [ ] Integração Open Finance Brasil
  - [ ] Conectar contas bancárias
  - [ ] Importação automática de extratos
  - [ ] Sincronização em tempo real
  - [ ] Múltiplas contas suportadas
- [ ] Alertas inteligentes
  - [ ] Gasto acima da média em categoria
  - [ ] Aproximação do limite do orçamento
  - [ ] Vencimento de contas fixas
  - [ ] Oportunidades de economia

### Integrações Necessárias
- **WhatsApp:**
  - n8n para orquestração de workflows
  - WhatsApp Business API ou Twilio
  - Webhook para receber mensagens
- **Open Finance:**
  - API Pluggy ou Belvo (agregadores)
  - Autenticação OAuth2 com bancos
  - Jobs agendados para sincronização

### Arquivos a Criar
- `supabase/functions/whatsapp-webhook/`
- `src/pages/Integrations.tsx`
- `src/lib/whatsapp-bot.ts`
- `src/lib/open-finance.ts`
- `src/hooks/useOpenFinance.ts`

### Considerações de Segurança
- Criptografia end-to-end para dados bancários
- Token de API seguro no Vault
- Rate limiting nos webhooks
- Validação de origem das requisições

---

## 🎨 Sprint 5 - Melhorias de UX/UI e Performance (PLANEJADA)

**Período:** Semana 12-13  
**Status:** ⏳ Não Iniciada

### Performance
- [ ] **Otimizar requests ao /profiles**
  - [ ] Migrar useAuth para AuthContext
  - [ ] Reduzir de 10+ para 1 request
  - [ ] Compartilhar estado globalmente
- [ ] Code splitting com React.lazy()
  - [ ] Lazy load de páginas
  - [ ] Lazy load de modais pesados
  - [ ] Reduzir bundle inicial
- [ ] Otimizar React Query
  - [ ] Configurar staleTime adequado
  - [ ] Implementar prefetching
  - [ ] Cache inteligente
- [ ] Memoização de componentes
  - [ ] React.memo nos componentes pesados
  - [ ] useMemo e useCallback estratégicos

### UX/UI
- [ ] Página de perfil do usuário
  - [ ] Editar dados pessoais
  - [ ] Alterar senha
  - [ ] Preferências de notificações
  - [ ] Tema claro/escuro
- [ ] Onboarding melhorado
  - [ ] Tutorial interativo
  - [ ] Tooltips contextuais
  - [ ] Skip steps opcionais
- [ ] Feedback visual
  - [ ] Loading states melhores
  - [ ] Skeleton loaders
  - [ ] Transições suaves
  - [ ] Confirmações visuais
- [ ] Responsividade mobile
  - [ ] Bottom navigation
  - [ ] Gestos touch
  - [ ] Layout adaptativo

### Acessibilidade
- [ ] Suporte a leitores de tela
- [ ] Navegação por teclado
- [ ] Contraste adequado (WCAG AA)
- [ ] Focus indicators visíveis

### Arquivos a Criar/Modificar
- `src/contexts/AuthContext.tsx`
- `src/pages/Profile.tsx`
- `src/components/Tutorial.tsx`
- `src/hooks/useTheme.ts`

---

## 🔐 Sprint 6 - Segurança e Compliance LGPD (PLANEJADA)

**Período:** Semana 14-15  
**Status:** ⏳ Não Iniciada

### Funcionalidades de Segurança
- [ ] Autenticação Multi-Fator (MFA)
  - [ ] TOTP (Google Authenticator)
  - [ ] SMS (Twilio)
  - [ ] E-mail de confirmação
- [ ] Gestão de sessões
  - [ ] Timeout de inatividade
  - [ ] Logout automático
  - [ ] Dispositivos ativos
- [ ] Auditoria de acesso
  - [ ] Log de todas as operações
  - [ ] Dashboard de auditoria
  - [ ] Exportação de logs

### Compliance LGPD
- [ ] Portal de privacidade
  - [ ] Baixar dados pessoais
  - [ ] Deletar conta (direito ao esquecimento)
  - [ ] Exportar histórico
  - [ ] Revogar consentimentos
- [ ] Políticas e termos
  - [ ] Política de privacidade
  - [ ] Termos de uso
  - [ ] Gestão de cookies
  - [ ] Consentimentos granulares
- [ ] Data retention
  - [ ] Políticas de retenção configuráveis
  - [ ] Limpeza automática de dados antigos
  - [ ] Backup e recovery

### Arquivos a Criar
- `src/pages/Privacy.tsx`
- `src/pages/DataManagement.tsx`
- `src/lib/audit-logger.ts`
- `supabase/functions/data-export/`
- `supabase/functions/account-deletion/`

---

## 🌐 Sprint 7 - Deploy e DevOps (PLANEJADA)

**Período:** Semana 16  
**Status:** ⏳ Não Iniciada

### Infraestrutura
- [ ] CI/CD Pipeline
  - [ ] GitHub Actions
  - [ ] Testes automatizados
  - [ ] Deploy automático
  - [ ] Rollback automático em caso de falha
- [ ] Ambientes
  - [ ] Development
  - [ ] Staging
  - [ ] Production
- [ ] Monitoramento
  - [ ] Sentry para errors
  - [ ] Analytics (Posthog ou Plausible)
  - [ ] Uptime monitoring
  - [ ] Performance monitoring

### Testes
- [ ] Testes unitários (Vitest)
  - [ ] Componentes críticos
  - [ ] Hooks customizados
  - [ ] Utils e helpers
- [ ] Testes de integração
  - [ ] Fluxos principais
  - [ ] API endpoints
- [ ] Testes E2E (Playwright)
  - [ ] Onboarding completo
  - [ ] CRUD de transações
  - [ ] Importação de arquivos

### Documentação
- [ ] README completo
- [ ] Documentação de API
- [ ] Guia de contribuição
- [ ] Changelog automatizado

### Arquivos a Criar
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/`

---

## 📱 Sprint 8 - PWA e Mobile (FUTURA)

**Período:** A definir  
**Status:** ⏳ Backlog

### Funcionalidades
- [ ] Progressive Web App
  - [ ] Service Worker
  - [ ] Cache offline
  - [ ] Instalação na home screen
- [ ] Notificações Push
  - [ ] Web Push API
  - [ ] Notificações personalizadas
- [ ] App Mobile Nativo (opcional)
  - [ ] React Native ou Capacitor
  - [ ] Biometria (Face ID / Touch ID)
  - [ ] Push notifications nativas

---

## 🎯 Métricas de Sucesso

### Performance
- ✅ Time to Interactive < 2s (atual: ~2-3s)
- 🎯 First Contentful Paint < 1s (atual: ~1s)
- 🔴 Requests ao /profiles: 1 (atual: 10-15)
- ✅ Bundle size < 1.5MB (atual: 1.09MB)

### UX
- 🎯 Taxa de conclusão do onboarding > 80%
- 🎯 Taxa de retenção (30 dias) > 60%
- 🎯 NPS Score > 50

### Técnico
- ✅ Cobertura de testes > 0% (atual: 0%)
- 🎯 Cobertura de testes > 80%
- ✅ Zero vulnerabilidades críticas
- ✅ Tempo de deploy < 10min

---

## 📝 Notas e Decisões Técnicas

### Arquitetura
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** React Query + Context API
- **Forms:** React Hook Form + Zod

### Padrões de Código
- ESLint + Prettier configurados
- Conventional Commits
- Feature branches + Pull Requests
- Code review obrigatório

### Banco de Dados
- PostgreSQL 15
- Row Level Security ativado
- Criptografia para dados sensíveis (pgcrypto)
- Migrations versionadas

### Decisões Importantes
1. **Criptografia:** Dados sensíveis (CNPJ) criptografados com AES-256
2. **user_type:** Enum database (pessoa_fisica, pessoa_juridica)
3. **Categorias:** Criadas automaticamente via trigger
4. **Importação:** Edge Functions para processamento server-side
5. **date vs transaction_date:** Unificado para `date` (data da transação real)

---

## 🐛 Bugs Conhecidos e Dívidas Técnicas

### Alta Prioridade
- [ ] **Múltiplas requests ao /profiles** → Resolver na Sprint 5

### Média Prioridade
- [ ] Bundle size grande (1MB) → Code splitting na Sprint 5
- [ ] Falta de testes automatizados → Sprint 7
- [ ] Sem tratamento de erros offline → Sprint 8

### Baixa Prioridade
- [ ] Warnings no console (minor)
- [ ] Otimização de imagens
- [ ] Acessibilidade completa

---

## 🎓 Aprendizados e Melhorias Contínuas

### O que funcionou bem
- ✅ Uso de React Query para gerenciamento de estado
- ✅ shadcn/ui para componentes consistentes
- ✅ Migrations versionadas do Supabase
- ✅ Edge Functions para processamento pesado

### O que pode melhorar
- 🔄 Organização de componentes (feature folders)
- 🔄 Testes desde o início
- 🔄 Documentação inline (JSDoc)
- 🔄 Monitoramento de performance desde o início

---

**Última Atualização:** 28/10/2024  
**Próxima Revisão:** Ao final de cada sprint
