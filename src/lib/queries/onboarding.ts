import "server-only";
import { prisma } from "@/lib/prisma";

// The four things that have to exist before the painel stops being a page
// of empty states. Deliberately all core app objects, none of them behind an
// integration: a step that can never be ticked because the server has no
// Google credentials configured is a checklist that never goes away.
//
// Order matters — it is the order the app makes sense in. You cannot record
// a lançamento without somewhere to record it against, and a budget means
// nothing until there is spending to compare it to.
export const GUIDE_STEPS = [
  {
    id: "account",
    title: "Cadastre suas contas e cartões",
    description:
      "Conta corrente, carteira, cartão de crédito — é o lugar de onde o dinheiro sai e para onde ele entra.",
    href: "/accounts",
    cta: "Criar conta",
  },
  {
    id: "transaction",
    title: "Registre seu primeiro lançamento",
    description:
      "Um gasto ou uma entrada. Marque como pago quando o dinheiro já saiu, ou deixe agendado se ainda vai sair.",
    href: "/transactions",
    cta: "Lançar",
  },
  {
    id: "financing",
    title: "Programe o que se repete todo mês",
    description:
      "Aluguel, assinaturas, parcelas. Cadastre uma vez e o app preenche os próximos meses sozinho.",
    href: "/financings",
    cta: "Cadastrar fixo",
  },
  {
    id: "budget",
    title: "Defina um orçamento",
    description: "Um teto por categoria — o painel avisa quando o mês estiver perto de estourar.",
    href: "/budgets",
    cta: "Definir teto",
  },
] as const;

export type GuideStepId = (typeof GUIDE_STEPS)[number]["id"];

export type GuideStep = (typeof GUIDE_STEPS)[number] & { done: boolean };

export type GuideProgress = {
  steps: GuideStep[];
  doneCount: number;
  /** True once every step is ticked — the checklist retires itself then. */
  complete: boolean;
};

// Four `count`s rather than four `findMany`s: nothing here needs the rows,
// only whether any exist, and `take: 1` on a count is not a thing. Postgres
// answers each of these from an index on userId.
export async function getGuideProgress(userId: string): Promise<GuideProgress> {
  const [accounts, transactions, financings, budgets] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.financing.count({ where: { userId, canceledAt: null } }),
    prisma.budget.count({ where: { userId } }),
  ]);

  const done: Record<GuideStepId, boolean> = {
    account: accounts > 0,
    transaction: transactions > 0,
    financing: financings > 0,
    budget: budgets > 0,
  };

  const steps = GUIDE_STEPS.map((step) => ({ ...step, done: done[step.id] }));

  return {
    steps,
    doneCount: steps.filter((s) => s.done).length,
    complete: steps.every((s) => s.done),
  };
}
