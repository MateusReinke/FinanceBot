# API pública (WhatsApp, n8n e outras automações)

Todo o fluxo do WhatsApp roda por uma API REST autenticada por token. A
inteligência fica no FinanceBot: o n8n só encaminha o texto da mensagem e
devolve a resposta ao usuário — não precisa de nó de IA no meio, nem de saber
ids de conta ou categoria.

## Autenticação

Gere um token em **Configurações → WhatsApp e automações**. Ele aparece uma
única vez (só o hash SHA-256 é guardado) e vale para **um usuário** — não
existe token de serviço capaz de lançar na conta de qualquer pessoa.

```
Authorization: Bearer fbot_...
```

Opcionalmente, vincule seu número de WhatsApp na mesma tela. Com o número
vinculado, a automação precisa enviar `from` e ele tem que bater — assim uma
mensagem de outra pessoa nunca cai na sua conta.

## `POST /api/v1/messages` — texto cru (é o que o n8n usa)

```jsonc
{
  "text": "gastei 45 no mercado com o nubank",
  "messageId": "wamid.XYZ", // id do provedor: é o que evita lançamento duplicado
  "from": "+5511999999999", // opcional; conferido contra o número vinculado
}
```

```jsonc
{
  "reply": "✅ Gasto lançado: R$ 45,00 — Mercado\nConta: Nubank\n...",
  "status": "created", // created | answered | duplicate | failed
}
```

Mande `reply` de volta pro usuário no WhatsApp. Mensagens que parecem perguntas
("quanto gastei?", "qual meu saldo?", "o que vence?") são respondidas com um
resumo em vez de virarem lançamento — e sem custar chamada de IA.

## `POST /api/v1/transactions` — campos estruturados

Para quando a automação já sabe o que quer lançar. Conta e categoria vão por
**nome**, não por id; nome desconhecido devolve 400 com a lista de contas
válidas, nunca um palpite silencioso.

```jsonc
{
  "description": "Almoço",
  "amount": 32.5,
  "type": "expense",
  "account": "Nubank",
  "category": "Alimentação",
  "paid": true,
}
```

## `GET /api/v1/transactions?limit=20` e `GET /api/v1/summary`

Últimos lançamentos e o resumo do mês (saldo, realizado, previsto, atrasados,
próximos vencimentos) — úteis para um fluxo agendado no n8n que manda um
resumo diário.

## Notas de operação

- **Idempotência**: sempre envie o `messageId` do provedor. Gateways de
  WhatsApp reentregam a mesma mensagem, e é o índice único `(userId,
externalId)` que impede o gasto de ser lançado duas vezes.
- **Rate limit**: 30 requisições por minuto por usuário e por rota.
- **Interpretação de texto** exige `OPENAI_API_KEY`. Sem ela, `/api/v1/messages`
  responde perguntas normalmente, mas não cria lançamento a partir de texto
  livre — use `/api/v1/transactions` nesse caso.
