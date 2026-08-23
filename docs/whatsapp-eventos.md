# Grupo de WhatsApp por evento


> **O app não fala com o WhatsApp.** A API oficial (Meta Cloud API) **não cria
> grupos nem adiciona membros** — só gateways não oficiais (Evolution API,
> Baileys, WPPConnect) fazem isso, e eles operam fora dos termos do WhatsApp,
> com risco real de bloqueio do número. Por isso o FinanceBot só **publica o
> que aconteceu**; quem cria o grupo e manda mensagem é o seu fluxo do n8n,
> com o gateway que você escolher. Trocar de gateway não mexe no app.

## Como funciona

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

## Fechando o ciclo

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

## Garantias de entrega

Cada evento é uma linha em `OutboundEvent`, gravada junto com a mudança que a
originou. A entrega tem retentativa com backoff (1min, 5min, 25min, ~2h, ~2h) e
desiste depois de 5 tentativas **sem apagar o registro**, para dar pra
diagnosticar. Uma linha é reivindicada atomicamente antes do envio, então o
despacho pós-ação e a varredura da sessão nunca notificam a mesma despesa duas
vezes. Ainda assim, **deduplique pelo `X-FinanceBot-Event-Id`** no n8n: se o
processo cair no meio de um envio, a linha volta pra fila e é reenviada.

Sem `N8N_WEBHOOK_URL` configurada, nada é enviado — os eventos ficam
enfileirados e saem quando você configurar.

## Privacidade

Os telefones dos participantes saem do app nesses eventos — é o que permite
montar o grupo. Só vão membros daquele evento, só nome e número, e só para o
n8n que você configurou.

