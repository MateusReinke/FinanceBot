import "server-only";
import { prisma } from "@/lib/prisma";
import { isOpenAiConfigured, parseTransactionCommand } from "@/lib/openai";
import { getBillsSummary } from "@/lib/queries/bills";
import {
  formatCurrency,
  formatDate,
  signedAmount,
  monthRangeUTC,
  getCurrentMonthYear,
} from "@/lib/utils";

// The whole WhatsApp flow lives here, so the HTTP route stays a thin shell
// and the same logic can be reused by any other channel later.
//
// The automation on the other side (n8n) is deliberately kept dumb: it
// forwards the raw message text and gets back a string to send as the
// reply. All interpretation, account/category resolution and writing
// happens here, where the user's real data is — which also means the
// automation never needs to know account ids, category ids, or anything
// else about the user's setup.

export type InboundResult = {
  reply: string;
  status: "created" | "duplicate" | "failed" | "answered";
  transactionId?: string;
};

// Questions are answered instead of being turned into a transaction. Kept
// as an explicit, cheap keyword check ahead of the model: "quanto gastei?"
// should never cost an API call, and should never accidentally book R$0.
const QUESTION_PATTERNS = [
  /\bquanto\b/i,
  /\bsaldo\b/i,
  /\bresumo\b/i,
  /\bextrato\b/i,
  /\bcontas? a pagar\b/i,
  /\bvence/i,
];

function looksLikeQuestion(text: string) {
  return QUESTION_PATTERNS.some((re) => re.test(text));
}

const HELP = [
  "Manda o gasto em uma frase e eu lanço. Exemplos:",
  "• gastei 45 no mercado com o nubank",
  "• paguei 120 de luz ontem",
  "• recebi 3000 de salário",
  "",
  "Ou pergunte: “quanto gastei esse mês?”, “qual meu saldo?”, “o que vence essa semana?”",
].join("\n");

async function answerQuestion(userId: string): Promise<InboundResult> {
  const { month, year } = getCurrentMonthYear();
  const range = monthRangeUTC(year, month);

  const [accounts, expenseAgg, incomeAgg, bills] = await Promise.all([
    prisma.account.findMany({ where: { userId, archived: false }, select: { balance: true } }),
    prisma.transaction.aggregate({
      where: { userId, type: "expense", date: range, balanceApplied: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: "income", date: range, balanceApplied: true },
      _sum: { amount: true },
    }),
    getBillsSummary(userId),
  ]);

  const balance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const spent = expenseAgg._sum.amount ?? 0;
  const received = incomeAgg._sum.amount ?? 0;

  const lines = [
    `Saldo hoje: ${formatCurrency(balance)}`,
    `Neste mês: ${formatCurrency(received)} entraram, ${formatCurrency(spent)} saíram`,
    `Previsto pro fim do mês: ${formatCurrency(bills.forecastBalance)}`,
  ];

  if (bills.overdue.length > 0) {
    lines.push(
      `⚠️ ${bills.overdue.length} conta(s) atrasada(s), ${formatCurrency(bills.overdueTotal)}`
    );
  }
  const next = bills.upcoming[0];
  if (next) {
    lines.push(
      `Próxima: ${next.description} — ${formatCurrency(next.amount)} em ${formatDate(next.date)}`
    );
  }

  return { reply: lines.join("\n"), status: "answered" };
}

async function createFromText(
  userId: string,
  text: string,
  channel: string
): Promise<InboundResult> {
  if (!isOpenAiConfigured()) {
    return {
      reply:
        "O interpretador de mensagens não está configurado neste servidor (falta OPENAI_API_KEY).",
      status: "failed",
    };
  }

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId, archived: false }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  if (accounts.length === 0) {
    return {
      reply: "Você ainda não tem nenhuma conta cadastrada no FinanceBot.",
      status: "failed",
    };
  }

  let extracted;
  try {
    extracted = await parseTransactionCommand(
      text,
      accounts.map((a) => ({ name: a.name, type: a.type })),
      categories.map((c) => ({ name: c.name, type: c.type }))
    );
  } catch {
    return { reply: `Não entendi essa. ${HELP}`, status: "failed" };
  }

  // Same resolution rules as the in-app assistant: an exact name match or
  // nothing. When the message doesn't say which account, the first one is
  // used and the reply says so out loud — silently guessing an account is
  // how a WhatsApp bot quietly corrupts someone's books.
  const namedAccount = extracted.accountName
    ? accounts.find((a) => a.name.toLowerCase() === extracted.accountName!.toLowerCase())
    : undefined;
  const account = namedAccount ?? accounts[0];
  const category = extracted.categoryName
    ? categories.find(
        (c) =>
          c.name.toLowerCase() === extracted.categoryName!.toLowerCase() &&
          c.type === extracted.type
      )
    : undefined;

  const date = extracted.date ? new Date(`${extracted.date}T00:00:00Z`) : new Date();

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: category?.id ?? null,
        description: extracted.description,
        amount: extracted.amount,
        date,
        type: extracted.type,
        source: channel,
      },
    }),
    prisma.account.update({
      where: { id: account.id },
      data: { balance: { increment: signedAmount(extracted.amount, extracted.type) } },
    }),
  ]);

  const verb = extracted.type === "income" ? "Recebimento" : "Gasto";
  const reply = [
    `✅ ${verb} lançado: ${formatCurrency(extracted.amount)} — ${extracted.description}`,
    `Conta: ${account.name}${namedAccount ? "" : " (padrão — diga o nome da conta pra mudar)"}`,
    category ? `Categoria: ${category.name}` : "Sem categoria",
    `Data: ${formatDate(date)}`,
  ].join("\n");

  return { reply, status: "created", transactionId: transaction.id };
}

// Entry point. `externalId` is the provider's message id and is what makes
// this safe to retry: WhatsApp gateways redeliver aggressively, and the
// unique (userId, externalId) index means a redelivered message returns the
// original reply instead of booking the expense twice.
export async function handleInboundMessage(opts: {
  userId: string;
  text: string;
  externalId: string;
  channel: string;
}): Promise<InboundResult> {
  const text = opts.text.trim();

  // Claim the message id BEFORE doing any work, and let the unique index on
  // (userId, externalId) be the referee. A check-then-write would leave a
  // window where two simultaneous redeliveries both look new and both book
  // the expense — exactly the failure this is here to prevent.
  let claimed;
  try {
    claimed = await prisma.inboundMessage.create({
      data: {
        userId: opts.userId,
        externalId: opts.externalId,
        channel: opts.channel,
        body: text.slice(0, 1000),
        status: "processing",
      },
    });
  } catch {
    const existing = await prisma.inboundMessage.findUnique({
      where: { userId_externalId: { userId: opts.userId, externalId: opts.externalId } },
    });
    return {
      reply: existing?.reply ?? "Essa mensagem já tinha sido processada.",
      status: "duplicate",
    };
  }

  let result: InboundResult;
  if (!text) {
    result = { reply: HELP, status: "failed" };
  } else if (looksLikeQuestion(text)) {
    result = await answerQuestion(opts.userId);
  } else {
    result = await createFromText(opts.userId, text, opts.channel);
  }

  // Fill in the outcome. Never allowed to break a request that already did
  // its work — worst case the row stays "processing" and a retry is told it
  // is a duplicate, which is the safe direction to fail in.
  await prisma.inboundMessage
    .update({
      where: { id: claimed.id },
      data: { resultId: result.transactionId ?? null, status: result.status, reply: result.reply },
    })
    .catch(() => {});

  return result;
}

export const INBOUND_HELP_TEXT = HELP;
