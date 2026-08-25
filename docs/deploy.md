# Deploy

Duas formas de fazer o deploy. A diferença prática entre elas é só uma: se o
Coolify preenche os campos de variável de ambiente sozinho, ou se você
preenche tudo na mão.

## Opção A (recomendada): Docker Compose

Ao importar o projeto, escolha **Build Pack: Docker Compose** (não
"Dockerfile") e aponte **Docker Compose Location** para
`/docker-compose.prod.yml`. Esse arquivo sobe `app` + `postgres` juntos, e
por referenciar as variáveis como `${POSTGRES_PASSWORD}` no lugar de
valores fixos, o Coolify lê o arquivo e já monta os campos pra você
preencher na aba "Environment Variables". Se esquecer alguma obrigatória, o
container sobe e encerra na hora com uma mensagem clara nos logs (via
`docker-entrypoint.sh`), em vez de ficar tentando servir requisições sem
banco configurado.

| Variável                                    | Obrigatória | Valor                                                                                                                   |
| ------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`                         | sim         | senha do Postgres (gerada uma vez, usada internamente)                                                                  |
| `SESSION_SECRET`                            | sim         | `openssl rand -base64 32`                                                                                               |
| `POSTGRES_USER` / `POSTGRES_DB`             | não         | default `financebot` para os dois                                                                                       |
| `APP_PORT`                                  | não         | porta pública de acesso — default `3000`, mude aqui pelo painel se quiser outra                                         |
| `ADMIN_EMAIL`                               | não         | e-mail que vira admin ao se cadastrar/logar                                                                             |
| `COOKIE_SECURE`                             | não         | deixe em branco (exige HTTPS, o correto). `false` só se ainda não configurou domínio/TLS — veja aviso abaixo            |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não         | credenciais de produção do Pluggy, se for usar Open Finance                                                             |
| `PLUGGY_USE_SANDBOX`                        | não         | já vem `false` por padrão nesse arquivo                                                                                 |
| `PLUGGY_WEBHOOK_URL`                        | não         | URL pública do serviço + `/api/openfinance/webhook`                                                                     |
| `OPENAI_API_KEY`                            | não         | chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos); sem ela, os dois ficam ocultos |
| `OPENAI_MODEL`                              | não         | sobrescreve o modelo usado pelas duas features de IA (padrão: `gpt-4o`)                                                 |

Não precisa criar um recurso Postgres separado nem copiar connection string
nenhuma — o `docker-compose.prod.yml` já monta o `DATABASE_URL` internamente
a partir de `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, apontando pro
próprio serviço `postgres` da mesma stack. Os dados do banco persistem num
volume Docker nomeado que o Coolify gerencia.

## Opção B: Dockerfile puro + Postgres separado

Se preferir gerenciar o banco como um recurso independente do Coolify (útil
se outros serviços também vão usá-lo), escolha **Build Pack: Dockerfile**
em vez de Docker Compose. Nesse modo o Coolify **não lê** `.env.example` nem
nenhum arquivo do repositório pra sugerir variáveis — a aba "Environment
Variables" começa vazia e cada uma abaixo precisa ser adicionada na mão:

1. Crie um recurso **Postgres** separado (Databases → PostgreSQL) e copie a
   connection string interna que o Coolify gera para esse recurso.
2. Crie o recurso da aplicação apontando para este repositório/branch, tipo
   Dockerfile, e preencha manualmente:

   | Variável                                    | Obrigatória | Valor                                                                                                        |
   | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
   | `DATABASE_URL`                              | sim         | connection string do Postgres do passo 1                                                                     |
   | `SESSION_SECRET`                            | sim         | `openssl rand -base64 32`                                                                                    |
   | `ADMIN_EMAIL`                               | não         | e-mail que vira admin ao se cadastrar/logar                                                                  |
   | `COOKIE_SECURE`                             | não         | deixe em branco (exige HTTPS, o correto). `false` só se ainda não configurou domínio/TLS — veja aviso abaixo |
   | `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não         | credenciais de produção do Pluggy                                                                            |
   | `PLUGGY_USE_SANDBOX`                        | não         | `false` em produção                                                                                          |
   | `PLUGGY_WEBHOOK_URL`                        | não         | URL pública do serviço + `/api/openfinance/webhook`                                                          |
   | `OPENAI_API_KEY`                            | não         | chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos)                      |
   | `OPENAI_MODEL`                              | não         | sobrescreve o modelo usado pelas duas features de IA (padrão: `gpt-4o`)                                      |

3. Confira o campo **"Ports Exposes"**: precisa ser `3000` (é o que o
   Dockerfile expõe e o que `server.js` escuta por padrão via `PORT`/
   `HOSTNAME`) — a menos que você também adicione uma variável `PORT` com
   outro valor, aí os dois precisam bater. A porta pública de acesso em si
   fica em **"Port Mappings"** (`<porta que você quiser>:3000`).

## "Consigo logar, mas todo clique volta pro /login"

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

## Migrations do banco (as duas opções)

Não é um passo manual em nenhuma das duas: `docker-entrypoint.sh` roda
`prisma migrate deploy` automaticamente toda vez que o container inicia,
antes de subir o servidor. É idempotente (só aplica o que ainda não foi
aplicado) e seguro mesmo com múltiplas réplicas subindo ao mesmo tempo. Se a
migration falhar, o container não sobe o servidor — ele encerra em vez de
servir requisições contra um schema desatualizado (é normal ver "Exited" no
Coolify se `DATABASE_URL`/`POSTGRES_PASSWORD` ainda não foram preenchidos),
e os logs do deploy mostram o erro exato.

## Healthcheck (as duas opções)

`GET /api/health` faz um `SELECT 1` real no Postgres e responde `200`/`503`.
O `Dockerfile` já declara um `HEALTHCHECK` nele; o Coolify usa isso para saber
se o deploy foi bem-sucedido antes de rotear tráfego para o novo container.

## Local com Docker (sem Coolify)

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
