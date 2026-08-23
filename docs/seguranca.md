# Segurança e isolamento de dados


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

