# Arquitetura

Um mapa de onde as coisas ficam e por quê. Se você vai mexer no código, leia
isto antes — a maioria das perguntas ("onde valido isso?", "por que essa
query está aqui?") já está respondida aqui.

## Em uma frase

Next.js App Router com Server Components lendo direto do Postgres via Prisma,
mutações por Server Actions, e sessão própria em cookie httpOnly. Não existe
camada de API entre o front e o banco para as telas do app — a API REST em
`/api/v1` existe só para as automações (WhatsApp/n8n).

## O caminho de uma requisição

```
navegador
   │
   ├─ src/proxy.ts ................ middleware: rota protegida sem sessão → /login
   │
   ├─ src/app/(app)/*/page.tsx .... Server Component
   │     ├─ verifySession() ....... src/lib/dal.ts — userId ou redirect
   │     └─ getAlgumaCoisa() ...... src/lib/queries/* — leitura, sempre por userId
   │
   └─ <form action={acao}> ........ Server Action em src/app/actions/*
         ├─ verifySession() ....... de novo: uma action é um endpoint POST público
         ├─ Schema.safeParse() .... src/lib/validation/* (zod)
         ├─ prisma... ............. escrita, sempre com userId no where
         └─ revalidatePath() ...... invalida as telas afetadas
```

Duas regras que valem para o app inteiro:

1. **Toda leitura e escrita é filtrada por `userId`.** Nunca por id sozinho —
   `findFirst({ where: { id, userId } })`, nunca `findUnique({ where: { id } })`
   para dados de usuário. É o que impede um id adivinhado de devolver a conta de
   outra pessoa.
2. **Toda Server Action começa por `verifySession()`.** Ela é alcançável por um
   POST direto, não só pelo botão que a chama.

## Estrutura de pastas

```
src/
  app/
    (auth)/          login e cadastro (layout próprio, sem shell do app)
    (guide)/         /bem-vindo — guia de primeiros passos, sem shell
    (app)/           área autenticada: painel, lançamentos, a receber, contas,
                     fixos e parcelados, orçamentos, categorias, dividir contas,
                     configurações, admin
    actions/         Server Actions — uma por domínio (transactions, accounts, ...)
    api/v1/          API pública por token (WhatsApp/n8n)
    api/auth/google/ OAuth do Google (início + callback)
    api/openfinance/ fluxo Pluggy: connect-token, items, sync, webhook
    api/health/      healthcheck do Docker/Coolify
    globals.css      tokens de design — cores, sombras, raio, .surface
  components/
    ui/              primitivos: Button, Input, Modal, Card, StatCard, Alert...
    layout/          shell, sidebar, topbar, menu do usuário, assistente de IA
    charts/          Recharts + tooltip/tabela compartilhados
    dashboard/       blocos do painel (saldo, alertas, primeiros passos)
  lib/
    dal.ts           verifySession / getCurrentUser — o portão de toda tela
    session.ts       assina e lê o cookie de sessão (jose)
    prisma.ts        singleton do PrismaClient
    queries/         leituras — uma função por pergunta que uma tela faz
    validation/      schemas zod, um arquivo por domínio
    *.ts             regras de negócio puras (ver abaixo)
prisma/
  schema.prisma      modelos, com comentários explicando cada decisão
  migrations/        SQL versionado — nunca editado depois de aplicado
```

## As regras de negócio que vale conhecer

Estas são funções puras (sem I/O), o que as torna o lugar certo para entender
o comportamento do app sem seguir queries:

| Arquivo                     | O que decide                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `lib/transaction-status.ts` | se um lançamento é realizado, previsto ou atrasado              |
| `lib/due-dates.ts`          | quão urgente é um vencimento ("vence hoje", "venceu há 3 dias") |
| `lib/recurrence.ts`         | o espaçamento entre parcelas (semanal, mensal, anual...)        |
| `lib/financing.ts`          | o cronograma de parcelas e a reconciliação de saldo             |
| `lib/card-invoices.ts`      | meses e vencimentos das faturas de um cartão                    |
| `lib/events.ts`             | divisão de despesas, saldos e quitação entre participantes      |
| `lib/charge.ts`             | a mensagem de cobrança e o link de WhatsApp                     |
| `lib/phone.ts`              | normalização de telefone para E.164                             |

E os portões de acesso, que centralizam autorização em um lugar só:

| Arquivo             | Protege                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `lib/dal.ts`        | toda tela autenticada (`verifySession`)                                   |
| `lib/events-dal.ts` | acesso a um evento de divisão de contas (`verifyEventAccess`)             |
| `lib/admin-dal.ts`  | `/admin` (`verifyAdminSession` — o papel é relido do banco, nunca do JWT) |
| `lib/api-auth.ts`   | a API pública por token                                                   |

## Design

Todo o visual sai de tokens em `src/app/globals.css`, nomeados por **papel**
(`--danger`, `--muted-foreground`, `--border`) e nunca por matiz. O tema
escuro redefine os mesmos nomes, e é por isso que um componente escreve
`text-danger` uma vez e fica legível nos dois temas.

- Um painel é `.surface` — não `rounded-xl border bg-card shadow-card`
  espalhado por catorze arquivos.
- Verde e vermelho significam dinheiro entrando e saindo. Nunca são usados
  como decoração, para que um vermelho signifique sempre a mesma coisa.
- As cores dos gráficos são validadas para daltonismo e contraste; os
  comentários em `globals.css` registram os números. Se você trocar uma,
  revalide.

## Convenções

- **Português na interface, inglês no código.** Labels, textos de ajuda e
  mensagens de erro são em português; identificadores, tipos e nomes de
  arquivo são em inglês. As rotas seguem o código (`/transactions` é rotulada
  "Lançamentos" no menu) — `/bem-vindo` é a exceção, por ser uma URL que o
  usuário lê.
- **Validação com zod**, sempre no servidor, em `lib/validation/`. O
  `required` do HTML é conveniência, não garantia.
- **Migrations nunca são editadas depois de aplicadas.** Mudou o schema? Gere
  outra (`npm run db:migrate`).
- **Comentários explicam o porquê, não o quê.** O código já diz o que faz; o
  que se perde é a razão de ter sido feito assim — e este repositório
  documenta isso no lugar onde a decisão vive.

## Onde mexer para...

| Tarefa                               | Comece por                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| adicionar um campo a um lançamento   | `prisma/schema.prisma` → migration → `lib/validation/transactions.ts` → `app/actions/transactions.ts` → o formulário |
| mudar o que o painel mostra          | `lib/queries/dashboard.ts` e `app/(app)/dashboard/page.tsx`                                                          |
| adicionar uma tela ao menu           | `components/layout/nav-config.ts` (e a pasta da rota)                                                                |
| mudar cores, sombras ou raio         | `src/app/globals.css` — não os componentes                                                                           |
| mudar o guia de primeiros passos     | `app/(guide)/bem-vindo/welcome-guide.tsx` (as telas) e `lib/queries/onboarding.ts` (a checklist do painel)           |
| adicionar um endpoint para automação | `app/api/v1/` + `lib/api-auth.ts`                                                                                    |
