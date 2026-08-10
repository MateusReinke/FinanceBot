import "server-only";
import { prisma } from "@/lib/prisma";
import { toFrequency } from "@/lib/recurrence";

function summarize(installments: { amount: number; balanceApplied: boolean }[], installmentCount: number) {
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

  return { paidCount, paidTotal, remainingCount, remainingTotal, totalAmount, status };
}

export async function getFinancingsList(userId: string) {
  const financings = await prisma.financing.findMany({
    where: { userId },
    include: {
      account: true,
      category: true,
      installments: { select: { amount: true, balanceApplied: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return financings.map((f) => ({
    id: f.id,
    description: f.description,
    account: f.account,
    category: f.category,
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
