# FinanceBot

Controle financeiro pessoal completo: contas, transações, categorias, orçamentos,
painel com gráficos e integração com **Open Finance** (via [Pluggy](https://pluggy.ai))
para importar automaticamente contas e transações do seu banco.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack)
- TypeScript + Tailwind CSS v4
- [Prisma](https://www.prisma.io) + SQLite (troque para Postgres/MySQL em produção só mudando o `provider`)
- Autenticação própria: sessão em cookie httpOnly assinado com [`jose`](https://github.com/panva/jose), senhas com `bcryptjs`
- Gráficos com [Recharts](https://recharts.org)
- Open Finance via [Pluggy](https://pluggy.ai) (agregador homologado no Open Finance Brasil)

## Funcionalidades

- Cadastro/login com sessão segura (cookie httpOnly + JWT)
- Contas manuais (corrente, poupança, cartão de crédito, dinheiro, investimentos)
- Categorias de receita/despesa personalizáveis (cor + ícone)
- Transações com filtros (conta, categoria, tipo, período, busca) e paginação
- Painel com saldo total, receitas x despesas, gráfico de tendência (6 meses),
  gastos por categoria e transações recentes
- Orçamentos mensais por categoria com barra de progresso
- **Open Finance**: conecte um banco real (ou sandbox) via widget do Pluggy,
  importe contas e transações automaticamente, sincronize sob demanda ou via webhook
- Configurações de perfil, troca de senha e exclusão de conta

## Como rodar localmente

```bash
npm install
cp .env.example .env
# gere um valor para SESSION_SECRET, por exemplo:
openssl rand -base64 32

npx prisma migrate dev
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Crie uma conta pela tela de
cadastro — categorias padrão são criadas automaticamente para cada novo usuário.

## Variáveis de ambiente

Veja `.env.example`. As principais são:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Caminho do banco SQLite (`file:./dev.db` por padrão) |
| `SESSION_SECRET` | sim | Chave usada para assinar o cookie de sessão (`openssl rand -base64 32`) |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não | Credenciais do Pluggy. Sem elas, o app funciona normalmente só com contas manuais — a seção de Open Finance fica oculta |
| `PLUGGY_USE_SANDBOX` | não | `true` (padrão) inclui os conectores de teste do Pluggy no widget |
| `PLUGGY_WEBHOOK_URL` | não | URL pública para receber eventos do Pluggy (sincronização automática). Sem isso, a sincronização é manual/no momento da conexão |

### Ativando a integração com Open Finance (Pluggy)

1. Crie uma conta gratuita em https://dashboard.pluggy.ai
2. Copie o `Client ID` e o `Client Secret` do seu app
3. Cole em `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` no `.env`
4. Reinicie o servidor — o botão **Conectar banco** aparece na página de Contas

Por padrão a integração roda em modo sandbox (`PLUGGY_USE_SANDBOX=true`), então
dá pra testar o fluxo completo de conexão com os bancos fictícios do Pluggy sem
precisar de credenciais bancárias reais. Para produção, troque para credenciais
de produção do Pluggy e ajuste `PLUGGY_USE_SANDBOX=false`.

## Scripts

```bash
npm run dev      # ambiente de desenvolvimento (Turbopack)
npm run build    # build de produção
npm run start    # roda o build de produção
npm run lint     # ESLint
npx prisma studio     # explorar o banco de dados visualmente
npx prisma migrate dev # criar/aplicar migrations após mudar o schema
```

## Estrutura

```
src/
  app/
    (auth)/           # login e cadastro
    (app)/             # área autenticada (painel, transações, contas, orçamentos, categorias, configurações)
    api/openfinance/    # rotas do fluxo Pluggy (connect-token, items, sync, webhook)
    actions/            # Server Actions (mutações)
  components/
    ui/                 # primitivos (botão, modal, input, stat card...)
    layout/              # sidebar, topbar, navegação
    charts/               # gráficos (Recharts)
    openfinance/           # widget de conexão bancária e gestão de conexões
  lib/                    # Prisma client, sessão/auth, validação (zod), cliente Pluggy
prisma/
  schema.prisma           # modelos (User, Account, Category, Transaction, Budget, PluggyItem)
```
