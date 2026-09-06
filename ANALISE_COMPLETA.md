# Análise do Projeto FinanceBot

## 📋 Resumo executivo

Esta é uma nova varredura completa do FinanceBot, feita do zero e validada em código real (não só lida) — cada achado abaixo foi confirmado lendo o arquivo, e a maioria foi reproduzida rodando o app de verdade (build de produção, banco Postgres local, formulários reais no navegador) antes de ser corrigida. A análise anterior deste documento ficou desatualizada: parte do que ela apontava já tinha sido corrigido por commits posteriores, e um commit mais recente (`Implement password reset functionality...`, de outra IA) introduziu regressões sérias que não tinham sido percebidas. Este documento substitui o anterior.

**O achado mais importante: o app estava com o build quebrado.** Um erro de sintaxe em `src/app/actions/auth.ts` impedia `tsc`/`next build` de compilar, e o schema do Prisma tinha um relacionamento inválido que impedia até `prisma generate` de rodar. Uma sessão paralela chegou a esse mesmo diagnóstico enquanto esta análise estava em andamento (mesmo commit-problema, investigado de forma independente) e já tinha corrigido o build e adicionado a entrega do link de reset por webhook antes deste trabalho ser enviado; o texto abaixo reflete o resultado já reconciliado das duas sessões, mais o que esta sessão corrigiu por cima disso.

---

## 1. Bugs críticos corrigidos nesta revisão

### 1.1 Build quebrado — string com aspas não escapadas

`src/app/actions/auth.ts` tinha uma mensagem de erro com aspas duplas dentro de uma string de aspas duplas sem escapar (`"Use o botão "Entrar com Google" — ..."`), o que é um erro de sintaxe JavaScript. **O TypeScript não compilava, `next build` falhava e o app não subia.** Corrigido trocando a string para aspas simples por fora.

### 1.2 Schema do Prisma inválido — `prisma generate` falhava

O mesmo commit adicionou o model `PasswordReset` com uma relação (`user User @relation(...)`) sem o campo inverso em `User`, o que o Prisma rejeita (`prisma validate`/`prisma generate` falhavam com `P1012`). Sem um client gerado, **nenhuma parte do app rodava**, não só o reset de senha. Corrigido adicionando `passwordResets PasswordReset[]` em `User`.

### 1.3 Migration nunca criada para a tabela nova

O model `PasswordReset` foi adicionado ao `schema.prisma`, mas nenhuma migration foi gerada — a tabela nunca existiria em um banco real, então a primeira tentativa de usar "esqueci minha senha" quebraria em produção com um erro de SQL. Criada e aplicada contra um Postgres real (`prisma migrate deploy` + `prisma migrate status` → sem drift).

### 1.4 `.gitignore` bloqueando `prisma/migrations/` — o bug mais perigoso a longo prazo

O mesmo commit **reescreveu o `.gitignore` inteiro** (trocando por um template genérico, com um ` ``` ` de markdown colado por engano na primeira e na última linha) e, no meio da troca, adicionou a regra `prisma/migrations/`. Isso faz o Git ignorar silenciosamente **qualquer migration nova** — a pasta criada para o `PasswordReset` não aparecia nem como "untracked" até essa regra ser removida. Sem esta correção, toda mudança de schema futura seria aplicada localmente, funcionaria no `npm run db:migrate` de quem a criou, e **desapareceria silenciosamente do repositório** — o próximo deploy quebraria com um schema desatualizado, sem nenhum erro óbvio apontando pra causa. Corrigido removendo os ` ``` ` soltos e a regra `prisma/migrations/` (o mesmo `.gitignore` também passou a ignorar `next-env.d.ts` e `*.tsbuildinfo`, arquivos gerados a cada `next dev`/`build` que só viravam ruído de "untracked").

### 1.5 Telefone local não virava um WhatsApp válido

`phoneField`/`optionalPhoneField` (`src/lib/phone.ts`) validavam o formato mas só prefixavam um `+` na frente dos dígitos, sem completar o DDI. O próprio formulário de cadastro pede exatamente `(11) 99999-9999` (11 dígitos, sem DDI) — e era exatamente esse formato que virava `+11999999999` (DDI +1, não +55). Isso quebrava a comparação de telefone (`samePhone`) usada para autenticar mensagens de WhatsApp recebidas: **qualquer pessoa que preenchesse o telefone exatamente como o formulário pede nunca conseguiria usar o lançamento por WhatsApp**, porque o número guardado não batia com o número real do WhatsApp dela. Havia inclusive uma função já pronta para isso (`toE164FromLocal`, usada só na importação de contatos do Google) — o campo do formulário de cadastro simplesmente não a chamava. Corrigido unificando os dois campos para usar `toE164FromLocal`.

**Confirmado rodando de verdade**: cadastrei um usuário de teste digitando `(11) 99999-9999` — antes da correção isso teria virado `+11999999999`; depois da correção, o banco mostra `+5511999999999`, o formato correto.

### 1.6 Arredondamento de centavos faltando na aplicação de parcelas

`reconcileDueInstallments` (`src/lib/financing.ts`) soma o efeito de todas as parcelas vencidas de uma conta em ponto flutuante e aplica a soma direto no saldo, sem passar pelo mesmo arredondamento de centavos que o resto do app usa (ex.: `toCents` em `transactions.ts`). Três parcelas de R$10,10 + R$20,20 + R$5,05 somam `35.349999999999994` em JS — e essa sujeira ficava **permanentemente gravada** no saldo da conta, porque essa função roda a cada requisição (via `verifySession`) e nunca reprocessa o passado. Corrigido arredondando a soma antes de aplicar.

### 1.7 Vencimento de gastos fixos "andando" para trás a cada virada de mês curto

`maintainRecurringSchedules` calculava cada nova ocorrência somando um intervalo à ocorrência anterior (`addIntervalUTC(candidate, frequency, 1)`), em vez de calcular a partir da data-âncora original. Um aluguel com vencimento dia 31 e frequência mensal: janeiro → fevereiro vira dia 28 (não existe 31 em fevereiro, isso é esperado); mas o próximo passo, fevereiro → março, ao somar "mais um mês" **a partir do dia 28** (não do dia 31 original), gera 28 de março — e a partir daí a assinatura fica presa no dia 28 para sempre, nunca mais voltando pro dia 31 nos meses que têm. Corrigido calculando cada ocorrência a partir da data-âncora fixa (`firstDueDate`) mais o número de passos, do mesmo jeito que `buildInstallmentSchedule` (parcelamentos) já fazia corretamente.

### 1.8 Valores sem limite máximo em quatro formulários

`MAX_AMOUNT` (R$ 10 milhões) já existe e é aplicado em quase todo campo monetário do app, mas faltava em quatro lugares: a API pública `/api/v1/transactions` (um token vazado ou um fluxo de n8n com bug podia gravar um valor absurdo direto no saldo), `PayInstallmentSchema.paidAmount` e `UpdateFinancingSchema.installmentAmount` (confirmar o pagamento de uma parcela ou editar "esta e as próximas" não tinham teto), e a importação de fatura por IA (`ConfirmInvoiceImportSchema`/`InvoiceItemSchema`). Corrigido aplicando o mesmo `.max(MAX_AMOUNT)` nos quatro.

### 1.9 Token de redefinição de senha guardado em texto puro

O fluxo de "esqueci minha senha" guardava o token de reset **sem hash** no banco (diferente do `ApiToken`, que já segue a regra "só o hash SHA-256 fica no banco, um dump não gera token válido"). Corrigido para seguir a mesma regra: o campo agora se chama `tokenHash` e guarda `sha256(token)`, nunca o token em si — uma migration própria (`.../password_reset_token_hash`) renomeia a coluna por cima da migration que já criava a tabela. A troca de senha em si também foi movida para uma transação (`$transaction`): antes, se a atualização da senha falhasse depois do token já ter sido apagado, o link de reset virava um beco sem saída sem nenhuma mensagem clara disso.

**Confirmado rodando de verdade**: pedi um reset, troquei a senha pelo link, a senha antiga parou de funcionar, a nova funcionou, e usar o mesmo link de novo foi corretamente rejeitado ("Token de redefinição inválido ou expirado").

### 1.10 Entrega do link de redefinição — webhook dedicado

Não existe nenhum provedor de e-mail configurado neste app — sem isso, o link de reset só era escrito no console do servidor, o que não chega a lugar nenhum em produção. A correção adicionada (reconciliada nesta revisão): um webhook próprio, `N8N_PASSWORD_RESET_WEBHOOK_URL` (+ `N8N_PASSWORD_RESET_WEBHOOK_SECRET` opcional para assinar o corpo em HMAC-SHA256), **deliberadamente separado** do `N8N_WEBHOOK_URL` que alimenta o fluxo dos grupos de WhatsApp de evento — um link de redefinição de senha nunca deve poder ser roteado pelo mesmo fluxo que posta em um grupo compartilhado. O fluxo de n8n que você conectar nessa URL é responsável por entregar o link de forma privada (ex.: DM de WhatsApp para o número da pessoa). Sem essa URL configurada, o link continua só no log do servidor — e, depois da correção desta revisão, só fora de produção.

### 1.11 Cor fora do sistema de tokens

Os dois formulários novos (esqueci a senha / redefinir senha) usavam `text-green-600` (uma cor fixa do Tailwind) em vez de `text-success` (o token de design do app, que muda entre tema claro e escuro). Corrigido para usar o token, conforme a regra documentada em `docs/arquitetura.md` ("nomeados por papel, nunca por matiz").

---

## 2. O webhook do grupo de WhatsApp — já existe, não precisa de uma variável nova

O pedido de "uma variável para o webhook do fluxo que gera o grupo com os participantes, e que avisa quando um novo participante entra" **já está implementado**, e não é um recorte pequeno: é `N8N_WEBHOOK_URL` (+ opcionalmente `N8N_WEBHOOK_SECRET` para assinar o corpo), documentado em `.env.example` e em `docs/whatsapp-eventos.md`. Note que isso é uma variável **diferente** da nova `N8N_PASSWORD_RESET_WEBHOOK_URL` da seção 1.10 — propositalmente, para o link de senha de uma pessoa nunca poder vazar no fluxo de grupo de outra. O fluxo do grupo de evento, ponta a ponta:

1. Ao criar um evento marcando "Criar um grupo no WhatsApp", o app publica `event.created` com o telefone de cada participante (`src/app/actions/events.ts` → `publish()` → `buildEventPayload`).
2. **Cada vez que alguém novo entra no evento pelo link de convite**, o app publica `event.participant_joined` com o telefone de quem entrou (`joinEventByCode`, só na entrada genuinamente nova — reabrir o link não avisa de novo).
3. Cada despesa **compartilhada** nova publica `event.expense_created`.
4. O fluxo de n8n (que você monta) recebe esses eventos, cria/mantém o grupo real no WhatsApp e adiciona o número — é o n8n que fala com o WhatsApp, nunca o app diretamente, porque a API oficial da Meta não cria grupos.
5. O n8n avisa de volta via `POST /api/v1/events/{id}/whatsapp-group`, e o status aparece na tela do evento.

Ou seja: **basta preencher `N8N_WEBHOOK_URL` com a URL do seu fluxo do n8n** (em Coolify, como variável de ambiente do serviço) que o recurso descrito já funciona — não há nada faltando no app para isso.

---

## 3. Painel de Insights — novo

O pedido de melhorar os insights/dashboard "de forma mais fácil de entender" virou um card novo, **Insights do mês**, logo abaixo dos cartões de Entradas/Saídas/Sobrou. Ele lê os mesmos números que o resto do painel já calcula (nenhuma consulta nova ao banco) e devolve frases diretas em vez de exigir que a pessoa faça a conta de cabeça:

- **Taxa de poupança**: "Você guardou 33% da sua renda neste mês — acima dos 20% recomendados" (ou o equivalente quando está gastando mais do que ganha).
- **Maior categoria de gasto**: "Alimentação é sua maior despesa: R$ 1.200,00 (60% do total gasto)".
- **Ritmo do mês** (só no mês corrente): compara o que já foi gasto até hoje com a média dos últimos 3 meses completos, ajustada pelo dia do mês — "Já gastou R$ 2.000,00 até o dia 5 — 500% acima do ritmo dos últimos meses". Só aparece quando a diferença é grande o bastante pra valer a pena (±20%) e quando há histórico completo dos 3 meses anteriores, pra não alarmar um usuário novo por comparação com quase nada.

Lógica pura em `src/lib/insights.ts` (sem I/O, testável isoladamente, no mesmo padrão dos outros arquivos de regra de negócio do app), componente de exibição em `src/components/dashboard/insights.tsx`. Testado de ponta a ponta num navegador de verdade, com dados reais em 4 meses diferentes — inclusive confirmando que o card não mostra o insight de ritmo ao olhar um mês passado, só no mês atual.

---

## 4. Pontos fortes que continuam de pé

A arquitetura segue sólida e a maior parte da análise anterior sobre isso continua válida:

- **Isolamento por `userId`** em toda leitura/escrita — confirmado de novo nesta revisão em `financing.ts`, `card-invoices.ts`, `recurrence.ts`, `receivables.ts`, `budgets.ts`, `admin-dal.ts`, `accounts.ts`, `transactions.ts`: nenhuma query sem filtro por dono encontrada.
- **`verifySession`/`verifyEventAccess`/`verifyAdminSession`** no topo de toda Server Action revisada.
- **`balanceApplied` como estado universal** (realizado x previsto) e "atrasado" como estado derivado, nunca guardado.
- **Fila de eventos de saída (`OutboundEvent`) com claim atômico e retentativa com backoff** — a race entre o despacho pós-ação e a varredura da sessão foi revisada e está corretamente protegida contra notificar a mesma despesa duas vezes.
- **Dedupe de mensagens recebidas** (`InboundMessage`, chave única `(userId, externalId)`) é seguro contra reentrega do provedor.

## 5. Gaps que ficam registrados (não corrigidos nesta revisão)

- Redefinir a senha não invalida outras sessões já abertas em outros aparelhos.
- O webhook de reset de senha (seção 1.10) é fire-and-forget: se o n8n estiver fora do ar no momento do pedido, a pessoa não recebe o link e não há retentativa (diferente da fila com backoff que `N8N_WEBHOOK_URL` usa). Para o volume de um reset de senha isso tende a ser aceitável, mas vale saber que não tem a mesma garantia de entrega.
- `revalidatePath` continua chamado várias vezes por mutação em vez de tags mais granulares (Next 15+) — não é um bug, só uma otimização possível.

---

## 💡 Conclusão

O maior risco não estava na lógica de negócio "de sempre" (que segue madura e bem isolada) — estava num commit recente e mal revisado que deixou o projeto **sem buildar** e com um `.gitignore` que descartaria silenciosamente qualquer migration futura. Corrigido e verificado rodando o app de ponta a ponta (build de produção limpo, Postgres real, cadastro/login/redefinição de senha e o painel novo testados num navegador de verdade), com a entrega do link de reset agora passando por um webhook dedicado em vez de só aparecer no log do servidor. O pedido do webhook de grupo de WhatsApp já está coberto por `N8N_WEBHOOK_URL`; o painel agora tem uma leitura em português simples do que os números do mês significam.
