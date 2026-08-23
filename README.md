# FinanceBot

Controle financeiro pessoal: contas e cartões, lançamentos com previsto e
realizado, contas fixas e parceladas, orçamentos, divisão de contas entre
amigos, lançamento por WhatsApp e importação automática do banco via **Open
Finance**.

<p align="right"><sub>Next.js 16 · TypeScript · Tailwind v4 · Prisma · PostgreSQL</sub></p>

## Rodando localmente

```bash
npm install
cp .env.example .env

# gere um SESSION_SECRET e cole no .env
openssl rand -base64 32

# sobe um Postgres local com as credenciais que já estão no .env.example
docker compose up -d

npm run db:migrate   # aplica as migrations e gera o Prisma Client
npm run dev
```

Abra <http://localhost:3000> e crie uma conta. Categorias padrão são criadas
automaticamente, e a primeira entrada cai no guia de primeiros passos.

Se o e-mail do cadastro for igual ao `ADMIN_EMAIL` do `.env`, essa conta
também ganha o painel admin em `/admin`.

> Só `DATABASE_URL` e `SESSION_SECRET` são obrigatórios. Google, Open
> Finance, IA e WhatsApp são opcionais — sem credencial configurada, cada um
> simplesmente não aparece na interface.

## Documentação

|                                                          |                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| [Arquitetura](docs/arquitetura.md)                       | como o código é organizado e onde mexer para cada tipo de mudança |
| [Funcionalidades](docs/funcionalidades.md)               | o que o app faz, tela por tela                                    |
| [Configuração](docs/configuracao.md)                     | variáveis de ambiente e como ligar Google, Open Finance e IA      |
| [API pública](docs/api.md)                               | endpoints por token, usados pelo WhatsApp/n8n                     |
| [Grupo de WhatsApp por evento](docs/whatsapp-eventos.md) | como a divisão de contas conversa com um grupo                    |
| [Segurança](docs/seguranca.md)                           | isolamento de dados entre usuários                                |
| [Deploy](docs/deploy.md)                                 | Coolify, Docker Compose e resolução de problemas                  |
| [Como contribuir](CONTRIBUTING.md)                       | fluxo de trabalho, convenções e o que rodar antes de abrir um PR  |

## Scripts

```bash
npm run dev           # desenvolvimento (Turbopack)
npm run build         # build de produção
npm run start         # roda o build de produção

npm run check         # lint + typecheck + formato — o mesmo que a CI roda
npm run lint          # ESLint            (lint:fix corrige o que dá)
npm run typecheck     # TypeScript, sem emitir
npm run format        # Prettier          (format:check só verifica)

npm run db:migrate    # criar/aplicar migrations em desenvolvimento
npm run db:deploy     # aplicar migrations em produção
npm run db:studio     # explorar o banco visualmente
npm run db:generate   # regerar o Prisma Client
npm run db:reset      # apagar e recriar o banco local
```

## Stack

- [Next.js 16](https://nextjs.org) — App Router, Server Components, Server Actions, Turbopack
- TypeScript + Tailwind CSS v4, com os tokens de design em `src/app/globals.css`
- Tipografia Inter, auto-hospedada no build por `next/font` — nenhuma requisição sai do navegador
- [Prisma](https://www.prisma.io) + PostgreSQL
- Autenticação própria: cookie httpOnly assinado com [`jose`](https://github.com/panva/jose), senhas com `bcryptjs`, e login com Google via OAuth 2.0 + PKCE
- Gráficos com [Recharts](https://recharts.org)
- Open Finance via [Pluggy](https://pluggy.ai), agregador homologado no Open Finance Brasil
