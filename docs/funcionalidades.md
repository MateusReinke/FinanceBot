# Funcionalidades

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
  30 dias, quanto há a pagar e a receber, e o **saldo previsto no fim do mês**.
  Cada linha traz o botão de confirmar ali mesmo — não precisa ir a outra tela
  para dizer que pagou
- **Alertas visuais de vencimento**: o painel abre com um aviso do que está
  atrasado (e de quanto), e cada lançamento pendente mostra a contagem em
  palavras — "Vence hoje", "Vence em 2 dias", "Venceu há 5 dias", "Recebe
  amanhã" — com uma faixa colorida na lateral da linha. O menu lateral mostra
  um contador de atrasados em **Lançamentos** e em **A receber**, então o aviso
  aparece de qualquer tela do app
- **Marcar como pago / recebido em um clique**: todo lançamento pendente tem o
  botão **Paguei** (despesa) ou **Recebi** (receita) visível na lista, no painel
  e na tela A receber. O botão só confirma o que já estava agendado: mexe no
  saldo uma vez e é idempotente. Clicou errado? A seta de **desmarcar** desfaz,
  devolvendo o lançamento para pendente e estornando o saldo
- **A receber (controle de cobranças)**: uma tela dedicada a quem te deve,
  agrupada **por pessoa**, com o total de cada um, a data de cada valor, o que
  já passou do prazo e quanto. O botão **Cobrar no WhatsApp** abre a conversa
  com a mensagem já escrita (valores, descrições e datas), e registra que a
  cobrança foi enviada — a lista passa a mostrar "cobrado em 12/08", pra você
  não cobrar a mesma pessoa duas vezes no mesmo dia. Para usar, lance a receita
  como "ainda vou receber" e preencha **de quem** (e o WhatsApp, se tiver): o
  número é lembrado e preenchido sozinho na próxima vez que a mesma pessoa
  aparecer. Nada disso é um cadastro paralelo — é o mesmo lançamento previsto
  que já conta no saldo previsto do mês
- **Entrar com Google + importar contatos**: com `GOOGLE_CLIENT_ID` e
  `GOOGLE_CLIENT_SECRET` configurados, a tela de login ganha **Entrar com
  Google** (a primeira entrada já cria a conta) e Configurações ganha um
  painel para **importar seus contatos do Google**. Os contatos alimentam o
  campo **de quem** dos lançamentos: você escolhe a pessoa em vez de digitar,
  e o WhatsApp dela vai junto — que é o número que o botão **Cobrar** usa.
  Só nome e telefone são guardados (nunca e-mail, endereço ou foto), a
  importação só acontece quando você clica, e desconectar o Google apaga
  todos os contatos importados. Uma conta criada pelo Google não tem senha:
  dá para definir uma em Configurações e passar a entrar dos dois jeitos.
  ⚠️ O escopo de contatos é **restrito** no Google — enquanto o app não
  passar pela verificação deles, só contas cadastradas como _usuários de
  teste_ conseguem autorizar a importação (o login em si funciona normal).
  Veja `.env.example` para o passo a passo no Google Cloud
- **Faturas futuras de cartão, mês a mês**: no cartão, **Faturas futuras** abre
  os próximos 12 meses e você **preenche o valor esperado de cada um** — mês com
  parcela grande fica com o valor dele, mês tranquilo fica com o dele. Uma seta
  em cada linha **repete aquele valor nos meses seguintes** quando a fatura é
  sempre parecida. Reabrir mostra o que já foi preenchido: mudar um valor
  atualiza aquele mês, apagar remove só aquela fatura, e o **dia do vencimento**
  editado ali vale para as faturas e para o cartão. Meses já pagos aparecem
  bloqueados — um plano não reescreve um pagamento que já aconteceu. Os valores
  entram como **previstos** em Próximos vencimentos e no saldo previsto, e só
  mexem no saldo quando você confirmar. A fatura é lançada na **conta que vai
  pagar**, nunca no cartão (uma fatura não é uma compra — lançá-la no cartão
  aumentaria a própria dívida que ela quita), e fica ligada ao cartão: quando
  você usa "Marcar fatura como paga", o app **quita a fatura programada** em vez
  de criar um pagamento duplicado. O **Resumo das faturas** tem um seletor de
  mês, então dá para ver quanto os cartões somam em qualquer mês do plano, não
  só na fatura atual
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
- **Gastos de 6 meses atrás a 6 meses à frente**: o painel abre com treze
  colunas — meio ano de gasto realizado, o mês atual, e meio ano do que já
  está agendado. A barra cheia é o que saiu da conta, a clara é o que ainda
  vai sair, e a metade da frente fica sobre uma faixa marcada **previsto**,
  então dá para ver de relance onde o histórico acaba e o plano começa. O mês
  mais pesado à frente vem rotulado; o resto está no tooltip e na tabela **Ver
  os números**, embaixo de todo gráfico
- **Faturas dos cartões por mês**: em Contas, o mesmo recorte de treze meses,
  empilhado por cartão e na cor de cada um — dá para ver qual cartão pesa em
  qual mês. Clicar numa coluna leva o detalhamento abaixo para aquele mês
- **Interface**: fundo aurora — três lavagens de cor difusas sobre uma grade
  discreta, fixas na viewport — com painéis de vidro (translúcidos e
  desfocados) por cima, em tema claro e escuro. Tudo sai de tokens em
  `globals.css` e de uma única classe `.surface`, então o visual é ajustado em
  um lugar só. A ambientação é puramente decorativa: se nada dela pintar, o
  app continua legível
- **Painel administrativo**: quem faz login com o e-mail definido em `ADMIN_EMAIL`
  ganha acesso a `/admin` para criar, editar, resetar senha e excluir outros
  usuários — sem nenhum acesso aos dados financeiros deles
- Configurações de perfil, troca de senha e exclusão de conta
