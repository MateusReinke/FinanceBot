import "server-only";
import { prisma } from "@/lib/prisma";
import { toFrequency } from "@/lib/recurrence";

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function summarize(
  installments: { amount: number; balanceApplied: boolean; date: Date }[],
  installmentCount: number
) {
  const today = startOfTodayUTC();
  const paidCount = installments.filter((i) => i.balanceApplied).length;
  const paidTotal = installments.filter((i) => i.balanceApplied).reduce((sum, i) => sum + i.amount, 0);
  const remainingCount = installments.filter((i) => !i.balanceApplied).length;
  const remainingTotal = installments
    .filter((i) => !i.balanceApplied)
    .reduce((sum, i) => sum + i.amount, 0);
  const totalAmount = paidTotal + remainingTotal;

  let status: "andamento" | "concluido" | "quitado";
  if (remainingCount === 0 && installments.length === installmentCount) {
    status = "concluido";
  } else if (remainingCount === 0) {
    status = "quitado";
  } else {
    status = "andamento";
  }

  // Only reachable for an autoSettle: false schedule — an automatic one is
  // applied the moment it comes due, so it can never sit here past its date.
  const pending = installments.filter((i) => !i.balanceApplied);
  const overdueCount = pending.filter((i) => i.date < today).length;
  const nextDueDate = pending.find((i) => i.date >= today)?.date ?? null;

  return {
    paidCount,
    paidTotal,
    remainingCount,
    remainingTotal,
    totalAmount,
    status,
    overdueCount,
    nextDueDate,
  };
}

export async function getFinancingsList(userId: string) {
  const financings = await prisma.financing.findMany({
    where: { userId },
    include: {
      account: true,
      category: true,
      installments: { select: { amount: true, balanceApplied: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return financings.map((f) => ({
    id: f.id,
    description: f.description,
    account: f.account,
    category: f.category,
    type: f.type,
    autoSettle: f.autoSettle,
    installmentAmount: f.installmentAmount,
    installmentCount: f.installmentCount,
    firstDueDate: f.firstDueDate,
    isRecurring: f.isRecurring,
    frequency: toFrequency(f.frequency),
    ...summarize(f.installments, f.installmentCount),
  }));
}

export async function getFinancingDetail(userId: string, id: string) {
  const financing = await prisma.financing.findFirst({
    where: { id, userId },
    include: {
      account: true,
      category: true,
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });
  if (!financing) return null;

  return {
    ...financing,
    // Narrowed from the schema's plain String to the Frequency union so
    // every consumer can index the label maps without re-checking.
    frequency: toFrequency(financing.frequency),
    ...summarize(financing.installments, financing.installmentCount),
  };
}

export type FinancingDetail = NonNullable<Awaited<ReturnType<typeof getFinancingDetail>>>;
