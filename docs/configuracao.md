# Configuração e variáveis de ambiente

Cada integração é opcional e segue a mesma regra: **sem credencial
configurada, a feature não aparece na interface** — nada quebra, nada fica
visível e desligado. O app roda inteiro só com `DATABASE_URL` e
`SESSION_SECRET`.

`.env.example` é a referência completa, com comentários. As principais:

| Variável                                    | Obrigatória | Descrição                                                                                                                                                                      |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | sim         | String de conexão do Postgres (`postgresql://usuario:senha@host:5432/banco?schema=public`)                                                                                     |
| `SESSION_SECRET`                            | sim         | Chave usada para assinar o cookie de sessão (`openssl rand -base64 32`)                                                                                                        |
| `ADMIN_EMAIL`                               | não         | E-mail que, ao se cadastrar ou logar, vira administrador com acesso a `/admin`. Deixe em branco para desativar o painel admin                                                  |
| `COOKIE_SECURE`                             | não         | `false` libera o cookie de sessão em HTTP puro (acesso por IP, sem domínio nem proxy). Fora isso, deixe em branco: o app decide pelo `X-Forwarded-Proto`                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | não         | Ligam o **Entrar com Google** nas telas de login e cadastro e a importação de contatos. Sem elas, o botão não é renderizado                                                    |
| `GOOGLE_REDIRECT_URI`                       | não         | Só se a URI registrada no Google Cloud for diferente da que o app deduz do request (proto/host, respeitando `X-Forwarded-*`)                                                   |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | não         | Credenciais do Pluggy. Sem elas, o app funciona normalmente só com contas manuais — a seção de Open Finance fica oculta                                                        |
| `PLUGGY_USE_SANDBOX`                        | não         | `true` (padrão) inclui os conectores de teste do Pluggy no widget                                                                                                              |
| `PLUGGY_WEBHOOK_SECRET`                     | recomendada | Segredo do HMAC-SHA256 conferido contra o header `x-signature` do webhook. Sem ele nem `PLUGGY_WEBHOOK_TOKEN`, o endpoint de webhook recusa todas as chamadas                  |
| `N8N_WEBHOOK_URL`                           | não         | Para onde o app publica eventos de divisão de contas (criação, entrada de participante, nova despesa). Sem ela, os eventos ficam enfileirados e a opção de grupo não aparece   |
| `N8N_WEBHOOK_SECRET`                        | recomendada | Assina o corpo dos eventos publicados com HMAC-SHA256 no header `X-FinanceBot-Signature`                                                                                       |
| `PLUGGY_WEBHOOK_TOKEN`                      | alternativa | Token na query string, para quando só a URL do webhook é configurável. O app já anexa `?token=...` na URL registrada no Pluggy                                                 |
| `PLUGGY_WEBHOOK_URL`                        | não         | URL pública para receber eventos do Pluggy (sincronização automática). Sem isso, a sincronização é manual/no momento da conexão                                                |
| `OPENAI_API_KEY`                            | não         | Chave da OpenAI — liga o Assistente de IA (topbar) e a leitura de nota fiscal (Eventos). Sem ela, os dois ficam ocultos e o lançamento manual continua funcionando normalmente |
| `OPENAI_MODEL`                              | não         | Sobrescreve o modelo usado pelas duas features de IA acima (padrão: `gpt-4o`)                                                                                                  |

## Ativando o login com Google

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   crie um projeto e uma credencial do tipo **OAuth client ID → Web application**.
2. Em **Authorized redirect URIs**, registre
   `https://SEU-DOMINIO/api/auth/google/callback` (em dev,
   `http://localhost:3000/api/auth/google/callback`). A URI tem que bater byte
   a byte com a que o app envia.
3. Cole o client ID e o secret em `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Reinicie o servidor — o botão **Entrar com Google** aparece em `/login` e
   em `/register`.

O primeiro login com Google **cria a conta** (não existe um cadastro
separado), e uma conta criada assim não tem senha até você definir uma em
Configurações. Se o e-mail do Google já pertence a uma conta criada por
e-mail/senha, os dois são vinculados em vez de virar uma conta duplicada — e
um e-mail não verificado no Google nunca reivindica uma conta existente.

O fluxo usa PKCE e `state`, e o `id_token` do Google é verificado (assinatura,
emissor e audiência) antes de qualquer claim dele ser levado a sério.

⚠️ **Importação de contatos**: o escopo `contacts.readonly` é _restrito_ no
Google. Enquanto o app não passar pela verificação do Google (que inclui uma
avaliação de segurança CASA), só as contas listadas como "usuários de teste"
na tela de permissão conseguem autorizar a importação. O **login** com Google
funciona normalmente sem isso.

## Ativando a integração com Open Finance (Pluggy)

1. Crie uma conta gratuita em https://dashboard.pluggy.ai
2. Copie o `Client ID` e o `Client Secret` do seu app
3. Cole em `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` no `.env`
4. Reinicie o servidor — o botão **Conectar banco** aparece na página de Contas

Por padrão a integração roda em modo sandbox (`PLUGGY_USE_SANDBOX=true`), então
dá pra testar o fluxo completo de conexão com os bancos fictícios do Pluggy sem
precisar de credenciais bancárias reais. Para produção, troque para credenciais
de produção do Pluggy e ajuste `PLUGGY_USE_SANDBOX=false`.

## Ativando as features de IA (Assistente + leitura de nota fiscal)

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
