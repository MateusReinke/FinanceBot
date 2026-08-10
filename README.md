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

- Cadastro/login com sessão segura (cookie httpOnly + JWT). O **WhatsApp é
  obrigatório no cadastro** — é por ele que você lança gastos por mensagem e
  é adicionado ao grupo de uma divisão de contas
- Contas manuais (corrente, poupança, cartão de crédito, dinheiro, investimentos).
  Cartões de crédito têm campos próprios de limite, dia de fechamento e dia de
  vencimento, com barra de limite disponível calculada a partir do saldo atual
- Categorias de receita/despesa personalizáveis (cor + ícone)
- Lançamentos em formato de **extrato mensal**: a lista mostra um mês por vez
  (navegue com as setas), agrupada por dia com o total de cada dia e o resumo
  de entradas/saídas/saldo do período no topo. A busca por texto sai do mês e
  procura em todo o histórico. Filtros de conta, categoria, tipo e situação
  ficam recolhidos até você precisar deles
- Painel com saldo total, receitas x despesas, gráfico de tendência (6 meses),
  gastos por categoria e transações recentes
- Orçamentos mensais por categoria com barra de progresso
- **Assistente de IA** (ícone de estrelas no topo, ao lado do menu do usuário):
  descreva um lançamento em texto livre — "gastei 45 reais no mercado com o
  nubank" — e a IA identifica valor, tipo, conta e categoria a partir das suas
  contas/categorias reais, te mostra tudo num formulário pra revisar e editar,
  e só cria a transação quando você confirma. Precisa de `OPENAI_API_KEY`
  configurada; sem ela, o ícone simplesmente não aparece e o lançamento manual
  continua igual
- **Open Finance**: conecte um banco real (ou sandbox) via widget do Pluggy,
  importe contas e transações automaticamente, sincronize sob demanda ou via webhook
- **Eventos**: divida contas em grupo (viagem, churrasco, etc.) — convide pessoas
  por link, veja o saldo de cada participante e sugestões de quem deve pagar quem.
  Cada despesa é lançada em três etapas: **o que foi** (descrição, valor, data),
  **quem pagou** (uma pessoa ou várias, com quanto cada uma pôs) e **de quem é**
  (compartilhada ou pessoal). Uma despesa compartilhada é dividida só entre quem
  você marcar — dá para deixar alguém de fora — por partes iguais ou por valores
  diferentes. Uma despesa **pessoal** fica visível só para quem pagou, não entra
  na divisão e ninguém fica devendo por ela; ainda assim conta no total que a
  pessoa gastou no evento. Com `OPENAI_API_KEY`
  configurada, dá pra anexar uma foto da nota fiscal e a IA lista os itens da
  nota automaticamente (um item = uma despesa), pra você revisar e ajustar
  antes de confirmar — sem chave configurada, o lançamento manual continua
  funcionando normalmente, só o botão de leitura por IA fica oculto (mesma
  chave do Assistente de IA acima). Ao criar o evento dá para pedir um
  **grupo no WhatsApp**: quem entra no evento é adicionado ao grupo e cada
  despesa nova é avisada lá (veja
  [Grupo de WhatsApp por evento](#grupo-de-whatsapp-por-evento) abaixo)
- **Financiamentos**: lance um financiamento/parcelamento informando data da
  primeira parcela, quantidade e valor — o app monta o cronograma automaticamente,
  aplica cada parcela no saldo da conta só no mês em que ela vence (nunca o valor
  total de uma vez) e mostra total pago x restante na página de detalhe. Suporta
  quitação antecipada (cancela as parcelas futuras, mantém as já pagas como histórico)
- **Gastos fixos e receitas fixas (recorrentes)**: na mesma tela, cadastre aluguel,
  assinatura, diarista ou o salário, escolhendo com que frequência se repete — toda
  semana, a cada 15 dias (quinzenal), todo mês, a cada 3 ou 6 meses, ou uma vez por
  ano — e se tem quantidade de cobranças definida, data pra terminar, ou nenhuma das
  duas ("sem data pra acabar"). Cada cobrança vira um lançamento normal na data em
  que vence, então já conta no painel, nos orçamentos e no saldo da conta sozinha.
  Um lançamento sem data pra acabar é materializado numa **janela de 24 meses**
  que anda junto com o tempo — continua infinito na prática, sem encher a base
  com décadas de parcelas futuras
- **Débito automático x confirmar na mão**: cada lançamento fixo escolhe se cai no
  saldo sozinho no vencimento (débito automático, salário) ou se fica pendente
  esperando você confirmar — nesse caso aparece como **atrasada** quando passa do
  dia, e o saldo só muda quando você confirma, pelo valor que realmente pagou
- **Editar esta e as próximas**: mudar valor, categoria, frequência ou a data das
  próximas cobranças só altera o que ainda não foi pago; o histórico fica intacto
  (é assim que um reajuste de aluguel fica correto). Dá também para pular uma
  cobrança avulsa de um lançamento fixo
- **Próximos vencimentos no painel**: o que está atrasado, o que vence nos próximos
  30 dias, quanto há a pagar e a receber, e o **saldo previsto no fim do mês**
- **Previsto x realizado em qualquer lançamento**: todo lançamento (não só os
  fixos) pode ser criado como "já paguei" ou "ainda vou pagar". O que está
  agendado não entra no saldo nem no orçamento até ser confirmado, aparece como
  **atrasado** quando passa da data, e é mostrado ao lado do realizado no painel
  ("R$ 1.200 gastos + R$ 300 a pagar")
- **Lançar gasto pelo WhatsApp**: gere um token em Configurações, ligue no seu
  fluxo do n8n e mande "gastei 45 no mercado com o nubank" — o app interpreta,
  lança e devolve a confirmação pronta para o bot responder. Também responde
  perguntas ("qual meu saldo?", "o que vence essa semana?"). Veja
  [API pública](#api-pública-whatsapp-n8n-e-outras-automações) abaixo
- **Painel administrativo**: quem faz login com o e-mail definido em `ADMIN_EMAIL`
  ganha acesso a `/admin` para criar, editar, resetar senha e excluir outros
  usuários — sem nenhum acesso aos dados financeiros deles
- Configurações de perfil, troca de senha e exclusão de conta


## API pública (WhatsApp, n8n e outras automações)

Todo o fluxo do WhatsApp roda por uma API REST autenticada por token. A
inteligência fica no FinanceBot: o n8n só encaminha o texto da mensagem e
devolve a resposta ao usuário — não precisa de nó de IA no meio, nem de saber
ids de conta ou categoria.

### Autenticação

Gere um token em **Configurações → WhatsApp e automações**. Ele aparece uma
única vez (só o hash SHA-256 é guardado) e vale para **um usuário** — não
existe token de serviço capaz de lançar na conta de qualquer pessoa.

```
Authorization: Bearer fbot_...
```

Opcionalmente, vincule seu número de WhatsApp na mesma tela. Com o número
vinculado, a automação precisa enviar `from` e ele tem que bater — assim uma
mensagem de outra pessoa nunca cai na sua conta.

### `POST /api/v1/messages` — texto cru (é o que o n8n usa)

```jsonc
{
  "text": "gastei 45 no mercado com o nubank",
  "messageId": "wamid.XYZ",   // id do provedor: é o que evita lançamento duplicado
  "from": "+5511999999999"     // opcional; conferido contra o número vinculado
}
```

```jsonc
{
  "reply": "✅ Gasto lançado: R$ 45,00 — Mercado\nConta: Nubank\n...",
  "status": "created"   // created | answered | duplicate | failed
}
```

Mande `reply` de volta pro usuário no WhatsApp. Mensagens que parecem perguntas
("quanto gastei?", "qual meu saldo?", "o que vence?") são respondidas com um
resumo em vez de virarem lançamento — e sem custar chamada de IA.

### `POST /api/v1/transactions` — campos estruturados

Para quando a automação já sabe o que quer lançar. Conta e categoria vão por
**nome**, não por id; nome desconhecido devolve 400 com a lista de contas
válidas, nunca um palpite silencioso.

```jsonc
{ "description": "Almoço", "amount": 32.5, "type": "expense",
  "account": "Nubank", "category": "Alimentação", "paid": true }
```

### `GET /api/v1/transactions?limit=20` e `GET /api/v1/summary`

Últimos lançamentos e o resumo do mês (saldo, realizado, previsto, atrasados,
próximos vencimentos) — úteis para um fluxo agendado no n8n que manda um
resumo diário.

### Notas de operação

- **Idempotência**: sempre envie o `messageId` do provedor. Gateways de
  WhatsApp reentregam a mesma mensagem, e é o índice único `(userId,
  externalId)` que impede o gasto de ser lançado duas vezes.
- **Rate limit**: 30 requisições por minuto por usuário e por rota.
- **Interpretação de texto** exige `OPENAI_API_KEY`. Sem ela, `/api/v1/messages`
  responde perguntas normalmente, mas não cria lançamento a partir de texto
  livre — use `/api/v1/transactions` nesse caso.


## Grupo de WhatsApp por evento

> **O app não fala com o WhatsApp.** A API oficial (Meta Cloud API) **não cria
> grupos nem adiciona membros** — só gateways não oficiais (Evolution API,
> Baileys, WPPConnect) fazem isso, e eles operam fora dos termos do WhatsApp,
> com risco real de bloqueio do número. Por isso o FinanceBot só **publica o
> que aconteceu**; quem cria o grupo e manda mensagem é o seu fluxo do n8n,
> com o gateway que você escolher. Trocar de gateway não mexe no app.

### Como funciona

Ao criar um evento você marca "Criar um grupo no WhatsApp". A partir daí o app
publica eventos assinados em `N8N_WEBHOOK_URL`:

| Evento | Quando | O que o fluxo deve fazer |
|---|---|---|
| `event.created` | evento criado com a opção marcada | criar o grupo com `data.members[].phone` e devolver o id |
| `event.participant_joined` | alguém entra pelo convite | adicionar `data.joined.phone` ao grupo |
| `event.expense_created` | despesa **compartilhada** registrada | mandar a mensagem no grupo `data.event.whatsappGroupId` |

Despesas pessoais não são publicadas: só quem pagou as vê, então o grupo não é
avisado delas.

Corpo entregue:

```jsonc
{
  "id": "cms...",              // repita no header X-FinanceBot-Event-Id
  "type": "event.expense_created",
  "eventId": "cms...",
  "data": {
    "event": { "id": "...", "name": "Churrasco", "whatsappGroupId": "1203...@g.us", "whatsappGroupStatus": "created" },
    "members": [{ "userId": "...", "name": "Ana", "phone": "+5511999999999" }],
    "membersWithoutPhone": [{ "userId": "...", "name": "Carla" }],
    "expense": {
      "description": "Carne", "amount": 200,
      "paidBy": [{ "name": "Ana", "amount": 150 }, { "name": "Bruno", "amount": 50 }],
      "splits": [{ "userId": "...", "amount": 100 }]
    }
  },
  "sentAt": "2026-08-10T14:00:00.000Z"
}
```

Com `N8N_WEBHOOK_SECRET` configurado, o header `X-FinanceBot-Signature` traz o
HMAC-SHA256 do corpo — confira antes de agir.

### Fechando o ciclo

Depois de criar o grupo, o fluxo avisa o app de volta:

```
POST /api/v1/events/{eventId}/whatsapp-group
Authorization: Bearer fbot_...        # token de um participante do evento
{ "groupId": "1203630...@g.us" }
{ "status": "failed", "error": "número não permite ser adicionado" }   # se não deu
```

O evento passa a mostrar o status do grupo na tela. Um `failed` costuma ser
alguém cuja privacidade não permite ser adicionado a grupos — nesse caso mande
o convite do grupo manualmente.

### Garantias de entrega

Cada evento é uma linha em `OutboundEvent`, gravada junto com a mudança que a
originou. A entrega tem retentativa com backoff (1min, 5min, 25min, ~2h, ~2h) e
desiste depois de 5 tentativas **sem apagar o registro**, para dar pra
diagnosticar. Uma linha é reivindicada atomicamente antes do envio, então o
despacho pós-ação e a varredura da sessão nunca notificam a mesma despesa duas
vezes. Ainda assim, **deduplique pelo `X-FinanceBot-Event-Id`** no n8n: se o
processo cair no meio de um envio, a linha volta pra fila e é reenviada.

Sem `N8N_WEBHOOK_URL` configurada, nada é enviado — os eventos ficam
enfileirados e saem quando você configurar.

### Privacidade

Os telefones dos participantes saem do app nesses eventos — é o que permite
montar o grupo. Só vão membros daquele evento, só nome e número, e só para o
n8n que você configurou.

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
não sequencial e não adivinhável. A foto da nota fiscal segue a mesma regra —
fica guardada como bytes no Postgres (não em disco/storage externo) e só é
servida via `/api/events/[id]/receipts/[receiptId]` depois de passar pelo
mesmo `verifyEventAccess`, nunca por um caminho público direto.

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
| `PLUGGY_WEBHOOK_SECRET` | recomendada | Segredo do HMAC-SHA256 conferido contra o header `x-signature` do webhook. Sem ele nem `PLUGGY_WEBHOOK_TOKEN`, o endpoint de webhook recusa todas as chamadas |
| `N8N_WEBHOOK_URL` | não | Para onde o app publica eventos de divisão de contas (criação, entrada de participante, nova despesa). Sem ela, os eventos ficam enfileirados e a opção de grupo não aparece |
| `N8N_WEBHOOK_SECRET` | recomendada | Assina o corpo dos eventos publicados com HMAC-SHA256 no header `X-FinanceBot-Signature` |
| `PLUGGY_WEBHOOK_TOKEN` | alternativa | Token na query string, para quando só a URL do webhook é configurável. O app já anexa `?token=...` na URL registrada no Pluggy |
| `PLUGGY_WEBHOOK_URL` | não | URL pública para receber eventos do Pluggy (sincronização automática). Sem isso, a sincronização é manual/no momento da conexão |
| `OPENAI_API_KEY` | não | Chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos). Sem ela, os dois ficam ocultos e o lançamento manual continua funcionando normalmente |
| `OPENAI_MODEL` | não | Sobrescreve o modelo usado pelas duas features de IA acima (padrão: `gpt-4o`) |

### Ativando a integração com Open Finance (Pluggy)

1. Crie uma conta gratuita em https://dashboard.pluggy.ai
2. Copie o `Client ID` e o `Client Secret` do seu app
3. Cole em `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` no `.env`
4. Reinicie o servidor — o botão **Conectar banco** aparece na página de Contas

Por padrão a integração roda em modo sandbox (`PLUGGY_USE_SANDBOX=true`), então
dá pra testar o fluxo completo de conexão com os bancos fictícios do Pluggy sem
precisar de credenciais bancárias reais. Para produção, troque para credenciais
de produção do Pluggy e ajuste `PLUGGY_USE_SANDBOX=false`.

### Ativando as features de IA (Assistente + leitura de nota fiscal)

1. Crie uma chave em https://platform.openai.com/api-keys
2. Cole em `OPENAI_API_KEY` no `.env`
3. Reinicie o servidor — o ícone de estrelas (Assistente de IA) aparece no
   topo ao lado do menu do usuário, e o botão **Ler nota fiscal** aparece ao
   lado de "Nova despesa" dentro de um Evento

**Assistente de IA**: digite um comando em texto livre (ex: "gastei 45 reais
no mercado com o nubank") e confirme, edite ou cancele os campos que a IA
identificou antes de qualquer coisa ser salva. Ela escolhe a conta e a
categoria comparando com os nomes que você já cadastrou — se não reconhecer
nenhuma com certeza, deixa em branco pra você escolher na hora de confirmar.

**Leitura de nota fiscal** (Eventos): formatos aceitos JPEG, PNG ou WEBP, até
8MB. A IA lista cada item da nota como uma despesa separada (todas com o
mesmo "quem pagou" e divididas igualmente entre quem você marcar) — você
revisa, edita ou remove itens antes de confirmar, nada é salvo sem essa
confirmação. Fotos em HEIC (padrão de câmera do iPhone) não são aceitas
diretamente; troque o formato da câmera para "Mais compatível" (JPEG) nas
configurações do iPhone, ou exporte/tire print da foto antes de enviar.

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
| `COOKIE_SECURE` | não | deixe em branco (exige HTTPS, o correto). `false` só se ainda não configurou domínio/TLS — veja aviso abaixo |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não | credenciais de produção do Pluggy, se for usar Open Finance |
| `PLUGGY_USE_SANDBOX` | não | já vem `false` por padrão nesse arquivo |
| `PLUGGY_WEBHOOK_URL` | não | URL pública do serviço + `/api/openfinance/webhook` |
| `OPENAI_API_KEY` | não | chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos); sem ela, os dois ficam ocultos |
| `OPENAI_MODEL` | não | sobrescreve o modelo usado pelas duas features de IA (padrão: `gpt-4o`) |

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
   | `COOKIE_SECURE` | não | deixe em branco (exige HTTPS, o correto). `false` só se ainda não configurou domínio/TLS — veja aviso abaixo |
   | `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não | credenciais de produção do Pluggy |
   | `PLUGGY_USE_SANDBOX` | não | `false` em produção |
   | `PLUGGY_WEBHOOK_URL` | não | URL pública do serviço + `/api/openfinance/webhook` |
   | `OPENAI_API_KEY` | não | chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos) |
   | `OPENAI_MODEL` | não | sobrescreve o modelo usado pelas duas features de IA (padrão: `gpt-4o`) |

3. Confira o campo **"Ports Exposes"**: precisa ser `3000` (é o que o
   Dockerfile expõe e o que `server.js` escuta por padrão via `PORT`/
   `HOSTNAME`) — a menos que você também adicione uma variável `PORT` com
   outro valor, aí os dois precisam bater. A porta pública de acesso em si
   fica em **"Port Mappings"** (`<porta que você quiser>:3000`).

### "Consigo logar, mas todo clique volta pro /login"

O cookie de sessão exige conexão HTTPS por padrão (`secure: true`) — é o
navegador que se recusa a guardar um cookie `Secure` numa conexão HTTP pura,
não uma falha do app. Sintoma típico: login parece funcionar (a página que
já estava carregada continua na tela), mas qualquer clique que precise de
uma nova verificação no servidor te manda de volta pro `/login`.

Isso acontece se você está acessando via IP:porta direto, sem domínio nem
HTTPS configurado no Coolify ainda. Duas saídas:

- **Certo, para produção**: configure um domínio no recurso da aplicação
  (aba "Domains" → "Generate Domain" já dá HTTPS automático via Let's
  Encrypt, ou aponte seu próprio domínio). Uma vez com HTTPS na frente, o
  app detecta isso sozinho (via `X-Forwarded-Proto`) e volta a funcionar
  sem precisar mexer em variável nenhuma.
- **Atalho pra testar agora**: defina `COOKIE_SECURE=false` nas variáveis
  de ambiente e redeploy. Desbloqueia o acesso via HTTP puro, mas as
  credenciais de login trafegam sem criptografia — não deixe assim numa
  instância com dados reais.

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
    api/events/            # imagem da nota fiscal, atrás de verifyEventAccess
    actions/                # Server Actions (mutações)
  components/
    ui/                 # primitivos (botão, modal, input, stat card...)
    layout/              # sidebar, topbar, navegação, ai-assistant.tsx
    charts/               # gráficos (Recharts)
    openfinance/           # widget de conexão bancária e gestão de conexões
  lib/                    # Prisma client, sessão/auth, validação (zod), cliente Pluggy
    events-dal.ts           # verifyEventAccess — gate central de acesso a Eventos
    events.ts                # cálculo de divisão/saldos/quitação (puro, sem I/O)
    openai.ts                 # integrações de IA (assistente de lançamento + leitura de nota)
    admin-dal.ts             # verifyAdminSession — gate central de acesso a /admin
    admin.ts                  # isAdminEmail — decide quem vira admin
    financing.ts               # cronograma de parcelas + reconciliação de saldo
    user-provisioning.ts        # criação de usuário + categorias padrão (signup e admin)
prisma/
  schema.prisma           # modelos (User, Account, Category, Transaction, Budget,
                           # PluggyItem, Event, EventParticipant, EventInvite,
                           # EventExpense, EventExpenseSplit, EventReceipt, Financing)
```
