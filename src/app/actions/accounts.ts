"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { AccountSchema, PayInvoiceSchema } from "@/lib/validation/accounts";
import type { FormState } from "@/lib/form-state";

function revalidateAccountPages() {
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

// FormData.get() returns null for an absent field and "" for an emptied
// text input — neither should reach z.coerce.number(), which would turn
// them into 0 or NaN instead of "not provided."
function emptyToUndefined(value: FormDataEntryValue | null) {
  return value === null || value === "" ? undefined : value;
}

export async function upsertAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = AccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    balance: formData.get("balance"),
    color: formData.get("color"),
    creditLimit: emptyToUndefined(formData.get("creditLimit")),
    closingDay: emptyToUndefined(formData.get("closingDay")),
    dueDay: emptyToUndefined(formData.get("dueDay")),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const { creditLimit, closingDay, dueDay, ...rest } = validatedFields.data;
  // Never persist card-only fields for a non-card account, regardless of
  // what the form happened to send — the UI hides them, but the server
  // is what actually enforces it.
  const data =
    rest.type === "credit_card"
      ? { ...rest, creditLimit: creditLimit ?? null, closingDay: closingDay ?? null, dueDay: dueDay ?? null }
      : { ...rest, creditLimit: null, closingDay: null, dueDay: null };

  if (typeof id === "string" && id.length > 0) {
    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) return { message: "Conta não encontrada." };
    if (existing.pluggyItemId) {
      return { message: "Contas conectadas via Open Finance são somente leitura." };
    }
    await prisma.account.update({ where: { id }, data });
  } else {
    await prisma.account.create({ data: { ...data, userId } });
  }

  revalidateAccountPages();
  return { success: true };
}

// Settles a credit card's invoice. The card side is a direct balance
// adjustment with no Transaction record — same as manually editing the
// balance field — rather than a "type: income" row, which would otherwise
// wrongly inflate the dashboard's income total (it aggregates every
// income-type transaction; paying down a debt isn't income). The optional
// source account, if given, gets a real expense Transaction instead: money
// genuinely left that account, which does belong in its history/budgets.
export async function payCardInvoice(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return { message: "Conta inválida." };

  const account = await prisma.account.findFirst({ where: { id: accountId, userId, type: "credit_card" } });
  if (!account) return { message: "Cartão não encontrado." };
  if (account.pluggyItemId) {
    return { message: "Contas conectadas via Open Finance já sincronizam automaticamente." };
  }

  const validated = PayInvoiceSchema.safeParse({
    amount: formData.get("amount"),
    sourceAccountId: formData.get("sourceAccountId"),
  });
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };
  const { amount, sourceAccountId } = validated.data;

  let sourceAccount = null;
  if (sourceAccountId) {
    sourceAccount = await prisma.account.findFirst({
      where: { id: sourceAccountId, userId, type: { not: "credit_card" } },
    });
    if (!sourceAccount) return { errors: { sourceAccountId: ["Conta de origem inválida."] } };
    if (sourceAccount.pluggyItemId) {
      return { errors: { sourceAccountId: ["Contas conectadas via Open Finance são somente leitura."] } };
    }
  }

  await prisma.$transaction([
    prisma.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } }),
    ...(sourceAccount
      ? [
          prisma.account.update({
            where: { id: sourceAccount.id },
            data: { balance: { decrement: amount } },
          }),
          prisma.transaction.create({
            data: {
              userId,
              accountId: sourceAccount.id,
              description: `Pagamento da fatura — ${account.name}`,
              amount,
              date: new Date(),
              type: "expense",
              balanceApplied: true,
            },
          }),
        ]
      : []),
  ]);

  revalidateAccountPages();
  revalidatePath("/budgets");
  return { success: true };
}

export async function toggleArchiveAccount(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) return;

  await prisma.account.update({
    where: { id },
    data: { archived: !existing.archived },
  });
  revalidateAccountPages();
}

export async function deleteAccount(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing || existing.pluggyItemId) return;

  await prisma.account.delete({ where: { id } });
  revalidateAccountPages();
}
