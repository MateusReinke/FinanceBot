# FinanceBot

Controle financeiro pessoal completo: contas, transações, categorias, orçamentos,
painel com gráficos e integração com **Open Finance** (via [Pluggy](https://pluggy.ai))
para importar automaticamente contas e transações do seu banco.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack)
- TypeScript + Tailwind CSS v4
- [Prisma](https://www.prisma.io) + PostgreSQL
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
- **Eventos**: divida contas em grupo (viagem, churrasco, etc.) — convide pessoas
  por link, registre despesas com divisão igual ou customizada, veja o saldo de
  cada participante e sugestões de quem deve pagar quem
- **Financiamentos**: lance um financiamento/parcelamento informando data da
  primeira parcela, quantidade e valor — o app monta o cronograma automaticamente,
  aplica cada parcela no saldo da conta só no mês em que ela vence (nunca o valor
  total de uma vez) e mostra total pago x restante na página de detalhe. Suporta
  quitação antecipada (cancela as parcelas futuras, mantém as já pagas como histórico)
- **Painel administrativo**: quem faz login com o e-mail definido em `ADMIN_EMAIL`
  ganha acesso a `/admin` para criar, editar, resetar senha e excluir outros
  usuários — sem nenhum acesso aos dados financeiros deles
- Configurações de perfil, troca de senha e exclusão de conta

## Segurança e isolamento de dados

Toda a conta de um usuário — contas bancárias, transações, categorias e
orçamentos — só é visível para o próprio usuário; toda leitura e escrita passa
por uma verificação de posse (`userId` da sessão) antes de tocar o banco. A
única exceção deliberada é o recurso de **Eventos**: quem participa de um
evento compartilhado vê as despesas e saldos daquele evento, e só daquele
evento — nunca as finanças pessoais de quem está nele. Esse controle de acesso
fica centralizado em `src/lib/events-dal.ts` (`verifyEventAccess`), usado por
toda rota e Server Action de evento, e responde com 404 tanto para "evento não
existe" quanto para "você não participa dele", para nunca revelar quais ids de
evento são válidos. O convite usa um token de 192 bits (`crypto.randomBytes`),
não sequencial e não adivinhável.

O painel administrativo (`/admin`) segue a mesma lógica de menor privilégio:
dá para gerenciar *identidade* de outros usuários (nome, e-mail, senha, papel,
exclusão de conta), nunca *dados financeiros* — nenhuma Server Action do admin
toca em `Account`, `Transaction`, `Category`, `Budget`, `Financing` ou `Event`
de terceiros. O acesso é gated por `verifyAdminSession()` em
`src/lib/admin-dal.ts`, chamado diretamente por toda página e Server Action de
admin (nunca só no layout — como layout e página renderizam em paralelo no App
Router, sem essa checagem duplicada uma rota poderia escapar da verificação).
O papel de admin só é concedido a quem loga com o e-mail exato de
`ADMIN_EMAIL`, sempre reconferido no banco a cada requisição — nunca confiado
a partir do JWT da sessão.

## Como rodar localmente

```bash
npm install
cp .env.example .env
# gere um valor para SESSION_SECRET, por exemplo:
openssl rand -base64 32

# sobe um Postgres local com as credenciais que já estão em .env.example
docker compose up -d

npx prisma migrate dev
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Crie uma conta pela tela de
cadastro — categorias padrão são criadas automaticamente para cada novo usuário.
Se o e-mail usado no cadastro (ou em um login posterior) for igual ao valor de
`ADMIN_EMAIL` no `.env`, essa conta também ganha acesso ao painel admin em `/admin`.

## Variáveis de ambiente

Veja `.env.example`. As principais são:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Postgres (`postgresql://usuario:senha@host:5432/banco?schema=public`) |
| `SESSION_SECRET` | sim | Chave usada para assinar o cookie de sessão (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` | não | E-mail que, ao se cadastrar ou logar, vira administrador com acesso a `/admin`. Deixe em branco para desativar o painel admin |
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

## Deploy no Coolify

Duas formas de fazer o deploy. A diferença prática entre elas é só uma: se o
Coolify preenche os campos de variável de ambiente sozinho, ou se você
preenche tudo na mão.

### Opção A (recomendada): Docker Compose

Ao importar o projeto, escolha **Build Pack: Docker Compose** (não
"Dockerfile") e aponte **Docker Compose Location** para
`/docker-compose.prod.yml`. Esse arquivo sobe `app` + `postgres` juntos, e
por referenciar as variáveis como `${POSTGRES_PASSWORD}` no lugar de
valores fixos, o Coolify lê o arquivo e já monta os campos pra você
preencher na aba "Environment Variables". Se esquecer alguma obrigatória, o
container sobe e encerra na hora com uma mensagem clara nos logs (via
`docker-entrypoint.sh`), em vez de ficar tentando servir requisições sem
banco configurado.

| Variável | Obrigatória | Valor |
|---|---|---|
| `POSTGRES_PASSWORD` | sim | senha do Postgres (gerada uma vez, usada internamente) |
| `SESSION_SECRET` | sim | `openssl rand -base64 32` |
| `POSTGRES_USER` / `POSTGRES_DB` | não | default `financebot` para os dois |
| `APP_PORT` | não | porta pública de acesso — default `3000`, mude aqui pelo painel se quiser outra |
| `ADMIN_EMAIL` | não | e-mail que vira admin ao se cadastrar/logar |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não | credenciais de produção do Pluggy, se for usar Open Finance |
| `PLUGGY_USE_SANDBOX` | não | já vem `false` por padrão nesse arquivo |
| `PLUGGY_WEBHOOK_URL` | não | URL pública do serviço + `/api/openfinance/webhook` |

Não precisa criar um recurso Postgres separado nem copiar connection string
nenhuma — o `docker-compose.prod.yml` já monta o `DATABASE_URL` internamente
a partir de `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, apontando pro
próprio serviço `postgres` da mesma stack. Os dados do banco persistem num
volume Docker nomeado que o Coolify gerencia.

### Opção B: Dockerfile puro + Postgres separado

Se preferir gerenciar o banco como um recurso independente do Coolify (útil
se outros serviços também vão usá-lo), escolha **Build Pack: Dockerfile**
em vez de Docker Compose. Nesse modo o Coolify **não lê** `.env.example` nem
nenhum arquivo do repositório pra sugerir variáveis — a aba "Environment
Variables" começa vazia e cada uma abaixo precisa ser adicionada na mão:

1. Crie um recurso **Postgres** separado (Databases → PostgreSQL) e copie a
   connection string interna que o Coolify gera para esse recurso.
2. Crie o recurso da aplicação apontando para este repositório/branch, tipo
   Dockerfile, e preencha manualmente:

   | Variável | Obrigatória | Valor |
   |---|---|---|
   | `DATABASE_URL` | sim | connection string do Postgres do passo 1 |
   | `SESSION_SECRET` | sim | `openssl rand -base64 32` |
   | `ADMIN_EMAIL` | não | e-mail que vira admin ao se cadastrar/logar |
   | `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não | credenciais de produção do Pluggy |
   | `PLUGGY_USE_SANDBOX` | não | `false` em produção |
   | `PLUGGY_WEBHOOK_URL` | não | URL pública do serviço + `/api/openfinance/webhook` |

3. Confira o campo **"Ports Exposes"**: precisa ser `3000` (é o que o
   Dockerfile expõe e o que `server.js` escuta por padrão via `PORT`/
   `HOSTNAME`) — a menos que você também adicione uma variável `PORT` com
   outro valor, aí os dois precisam bater. A porta pública de acesso em si
   fica em **"Port Mappings"** (`<porta que você quiser>:3000`).

### Migrations do banco (as duas opções)

Não é um passo manual em nenhuma das duas: `docker-entrypoint.sh` roda
`prisma migrate deploy` automaticamente toda vez que o container inicia,
antes de subir o servidor. É idempotente (só aplica o que ainda não foi
aplicado) e seguro mesmo com múltiplas réplicas subindo ao mesmo tempo. Se a
migration falhar, o container não sobe o servidor — ele encerra em vez de
servir requisições contra um schema desatualizado (é normal ver "Exited" no
Coolify se `DATABASE_URL`/`POSTGRES_PASSWORD` ainda não foram preenchidos),
e os logs do deploy mostram o erro exato.

### Healthcheck (as duas opções)

`GET /api/health` faz um `SELECT 1` real no Postgres e responde `200`/`503`.
O `Dockerfile` já declara um `HEALTHCHECK` nele; o Coolify usa isso para saber
se o deploy foi bem-sucedido antes de rotear tráfego para o novo container.

### Local com Docker (sem Coolify)

```bash
docker compose up -d          # só o Postgres, para desenvolvimento
docker build -t financebot .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://financebot:financebot_dev_pw@host.docker.internal:5432/financebot?schema=public" \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  financebot
```

Ou, pra reproduzir a Opção A completa localmente:

```bash
POSTGRES_PASSWORD="$(openssl rand -hex 16)" SESSION_SECRET="$(openssl rand -base64 32)" \
  docker compose -f docker-compose.prod.yml up -d --build
```

## Estrutura

```
src/
  app/
    (auth)/           # login e cadastro
    (app)/             # área autenticada (painel, transações, contas, financiamentos,
                        # orçamentos, categorias, eventos, admin, configurações)
    api/openfinance/    # rotas do fluxo Pluggy (connect-token, items, sync, webhook)
    api/health/          # healthcheck (usado pelo Docker/Coolify)
    actions/              # Server Actions (mutações)
  components/
    ui/                 # primitivos (botão, modal, input, stat card...)
    layout/              # sidebar, topbar, navegação
    charts/               # gráficos (Recharts)
    openfinance/           # widget de conexão bancária e gestão de conexões
  lib/                    # Prisma client, sessão/auth, validação (zod), cliente Pluggy
    events-dal.ts           # verifyEventAccess — gate central de acesso a Eventos
    events.ts                # cálculo de divisão/saldos/quitação (puro, sem I/O)
    admin-dal.ts             # verifyAdminSession — gate central de acesso a /admin
    admin.ts                  # isAdminEmail — decide quem vira admin
    financing.ts               # cronograma de parcelas + reconciliação de saldo
    user-provisioning.ts        # criação de usuário + categorias padrão (signup e admin)
prisma/
  schema.prisma           # modelos (User, Account, Category, Transaction, Budget,
                           # PluggyItem, Event, EventParticipant, EventInvite,
                           # EventExpense, EventExpenseSplit, Financing)
```
