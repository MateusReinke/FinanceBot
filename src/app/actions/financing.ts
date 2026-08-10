"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import {
  FinancingSchema,
  UpdateFinancingSchema,
  PayInstallmentSchema,
} from "@/lib/validation/financing";
import { buildInstallmentSchedule, installmentDescription } from "@/lib/financing";
import { addIntervalUTC } from "@/lib/recurrence";
import { signedAmount } from "@/lib/utils";
import type { FormState } from "@/lib/form-state";

function revalidateFinancingPages() {
  revalidatePath("/financings");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

// An empty <input type="date"> posts "", which z.coerce.date turns into an
// Invalid Date instead of leaving the field absent. Optional dates go
// through here so "não mexi nesse campo" stays undefined.
function optionalField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function createFinancing(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = FinancingSchema.safeParse({
    description: formData.get("description"),
    type: optionalField(formData.get("type")),
    accountId: formData.get("accountId"),
    categoryId: formData.get("categoryId"),
    firstDueDate: formData.get("firstDueDate"),
    installmentCount: formData.get("installmentCount"),
    frequency: optionalField(formData.get("frequency")),
    installmentAmount: formData.get("installmentAmount"),
    isRecurring: formData.get("isRecurring"),
    autoSettle: formData.get("autoSettle"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const data = validatedFields.data;

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) return { errors: { accountId: ["Conta inválida."] } };
  if (account.pluggyItemId) {
    return {
      errors: { accountId: ["Contas conectadas via Open Finance têm o saldo controlado pela sincronização e não podem receber um lançamento fixo manual."] },
    };
  }

  if (data.categoryId) {
    // The category has to be of the same kind as the schedule — a receita
    // fixa can't be filed under a despesa category, or the dashboard
    // breakdown and budgets would both read wrong.
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId, type: data.type },
    });
    if (!category) return { errors: { categoryId: ["Categoria inválida."] } };
  }

  const schedule = buildInstallmentSchedule(
    data.firstDueDate,
    data.installmentCount,
    data.installmentAmount,
    data.frequency,
    data.autoSettle
  );
  const alreadyAppliedDelta = schedule
    .filter((s) => s.balanceApplied)
    .reduce((sum, s) => sum + signedAmount(s.amount, data.type), 0);

  const [financing] = await prisma.$transaction([
    prisma.financing.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        type: data.type,
        installmentAmount: data.installmentAmount,
        installmentCount: data.installmentCount,
        firstDueDate: data.firstDueDate,
        frequency: data.frequency,
        isRecurring: data.isRecurring,
        autoSettle: data.autoSettle,
        installments: {
          create: schedule.map((s) => ({
            userId,
            accountId: data.accountId,
            categoryId: data.categoryId,
            description: installmentDescription(
              data.description,
              data.isRecurring,
              s.installmentNumber,
              data.installmentCount
            ),
            amount: s.amount,
            date: s.date,
            type: data.type,
            installmentNumber: s.installmentNumber,
            balanceApplied: s.balanceApplied,
          })),
        },
      },
    }),
    ...(alreadyAppliedDelta !== 0
      ? [
          prisma.account.update({
            where: { id: data.accountId },
            data: { balance: { increment: alreadyAppliedDelta } },
          }),
        ]
      : []),
  ]);

  revalidateFinancingPages();
  redirect(`/financings/${financing.id}`);
}

// "Esta e as próximas": rewrites every occurrence that hasn't been paid
// yet — amount, description, category, and (when a new next date or
// frequency is given) the whole remaining schedule, re-spaced from that
// date. Occurrences already paid are deliberately left untouched, which is
// what makes this safe: no past balance is ever rewritten, so there is
// nothing to recompute. This is how a rent increase is recorded — the old
// months keep the old value, as they should.
export async function updateFinancing(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return { message: "Lançamento inválido." };

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return { message: "Lançamento não encontrado." };

  const validatedFields = UpdateFinancingSchema.safeParse({
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    installmentAmount: formData.get("installmentAmount"),
    frequency: optionalField(formData.get("frequency")),
    nextDate: optionalField(formData.get("nextDate")),
    autoSettle: formData.get("autoSettle"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const data = validatedFields.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId, type: financing.type },
    });
    if (!category) return { errors: { categoryId: ["Categoria inválida."] } };
  }

  const pending = await prisma.transaction.findMany({
    where: { financingId: id, balanceApplied: false },
    orderBy: { installmentNumber: "asc" },
    select: { id: true, installmentNumber: true, date: true },
  });

  // Dates are only rewritten when the user actually asked for it — a new
  // next date, or a new frequency. Re-spacing on an amount-only edit would
  // quietly move dates that the original schedule had clamped (a monthly
  // plan anchored on Jan 31 lands on Feb 28, and re-spacing from there
  // would drag every later month to the 28th).
  const rescheduleFrom =
    data.nextDate ?? (data.frequency !== financing.frequency ? pending[0]?.date : undefined);

  await prisma.$transaction([
    prisma.financing.update({
      where: { id },
      data: {
        description: data.description,
        categoryId: data.categoryId ?? null,
        installmentAmount: data.installmentAmount,
        frequency: data.frequency,
        autoSettle: data.autoSettle,
      },
    }),
    ...pending.map((p, i) =>
      prisma.transaction.update({
        where: { id: p.id },
        data: {
          description: installmentDescription(
            data.description,
            financing.isRecurring,
            p.installmentNumber ?? i + 1,
            financing.installmentCount
          ),
          categoryId: data.categoryId ?? null,
          amount: data.installmentAmount,
          ...(rescheduleFrom ? { date: addIntervalUTC(rescheduleFrom, data.frequency, i) } : {}),
        },
      })
    ),
  ]);

  revalidateFinancingPages();
  return { success: true };
}

// Confirms that a pending occurrence really happened, for whatever amount
// was actually paid/received. Used both to settle a bill the user pays by
// hand (autoSettle: false) and to close an installment early for a
// discounted payoff — the gap between financing.installmentAmount and what
// was paid is the "economia" shown in the UI, no separate field needed.
export async function payInstallmentNow(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const financingId = formData.get("financingId");
  if (typeof financingId !== "string") return { message: "Lançamento inválido." };

  const financing = await prisma.financing.findFirst({ where: { id: financingId, userId } });
  if (!financing) return { message: "Lançamento não encontrado." };

  const validatedFields = PayInstallmentSchema.safeParse({
    transactionId: formData.get("transactionId"),
    paidAmount: formData.get("paidAmount"),
    paidDate: optionalField(formData.get("paidDate")),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const { transactionId, paidAmount, paidDate } = validatedFields.data;

  // The balanceApplied: false in the filter is what makes this idempotent
  // under a double submit — the second one finds nothing and stops.
  const installment = await prisma.transaction.findFirst({
    where: { id: transactionId, financingId, balanceApplied: false },
  });
  if (!installment) return { message: "Parcela não encontrada ou já paga." };

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { amount: paidAmount, balanceApplied: true, ...(paidDate ? { date: paidDate } : {}) },
    }),
    prisma.account.update({
      where: { id: installment.accountId },
      data: { balance: { increment: signedAmount(paidAmount, installment.type) } },
    }),
  ]);

  revalidateFinancingPages();
  return { success: true };
}

// Skips a single upcoming occurrence — the month you didn't call the
// diarista, the subscription you paused. Deleting is safe with no balance
// reversal: a pending occurrence never touched Account.balance. Only
// offered for recurring entries, where occurrences aren't numbered against
// a promised total.
export async function skipInstallment(formData: FormData) {
  const { userId } = await verifySession();
  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string") return;

  const installment = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, balanceApplied: false, financing: { isRecurring: true } },
  });
  if (!installment) return;

  await prisma.transaction.delete({ where: { id: installment.id } });

  revalidateFinancingPages();
}

// Removes only the occurrences that haven't happened yet, keeping past ones
// as history. Safe with no balance reversal, for the same reason as above.
export async function settleFinancingEarly(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return;

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { financingId: id, balanceApplied: false } }),
    // Marks the entry as ended so the rolling extender doesn't regenerate
    // the occurrences we just removed on the very next request.
    prisma.financing.update({ where: { id }, data: { canceledAt: new Date() } }),
  ]);

  revalidateFinancingPages();
}

export async function deleteFinancing(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const financing = await prisma.financing.findFirst({ where: { id, userId } });
  if (!financing) return;

  // Grouped by type rather than a flat sum: an installment's sign comes
  // from its own type, and paying one early never changes that, so this
  // reverses exactly what was applied — for a receita fixa too.
  const applied = await prisma.transaction.groupBy({
    by: ["type"],
    where: { financingId: id, balanceApplied: true },
    _sum: { amount: true },
  });
  const toReverse = applied.reduce((sum, g) => sum + signedAmount(g._sum.amount ?? 0, g.type), 0);

  await prisma.$transaction([
    ...(toReverse !== 0
      ? [
          prisma.account.update({
            where: { id: financing.accountId },
            data: { balance: { increment: -toReverse } },
          }),
        ]
      : []),
    // Cascades (onDelete: Cascade on Transaction.financing) to remove every
    // linked installment, applied and unapplied alike.
    prisma.financing.delete({ where: { id } }),
  ]);

  revalidateFinancingPages();
  redirect("/financings");
}
