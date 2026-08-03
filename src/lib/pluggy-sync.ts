import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COLORS } from "@/lib/color-palette";
import { toDateInputValue } from "@/lib/utils";
import {
  getPluggyItem,
  listPluggyAccounts,
  listPluggyTransactions,
  type PluggyAccount,
} from "@/lib/pluggy";

function mapPluggyAccountType(account: PluggyAccount): string {
  const type = (account.type ?? "").toLowerCase();
  const subtype = (account.subtype ?? "").toLowerCase();
  if (subtype.includes("saving")) return "savings";
  if (type.includes("credit") || subtype.includes("credit")) return "credit_card";
  if (type.includes("invest")) return "investment";
  return "checking";
}

function revalidateOpenFinancePages() {
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/settings");
}

/**
 * Pulls the latest item status, accounts and transactions for one Open Finance
 * connection from Pluggy and reconciles them into our local tables. Safe to
 * call repeatedly — accounts are upserted by pluggyAccountId and transactions
 * are inserted with skipDuplicates keyed on pluggyTransactionId.
 */
export async function syncPluggyItem(pluggyItemDbId: string) {
  const pluggyItem = await prisma.pluggyItem.findUnique({ where: { id: pluggyItemDbId } });
  if (!pluggyItem) return;

  const [remoteItem, remoteAccounts] = await Promise.all([
    getPluggyItem(pluggyItem.pluggyItemId),
    listPluggyAccounts(pluggyItem.pluggyItemId),
  ]);

  const from = pluggyItem.lastSyncedAt ? toDateInputValue(pluggyItem.lastSyncedAt) : undefined;

  for (const [index, remoteAccount] of remoteAccounts.entries()) {
    const localAccount = await prisma.account.upsert({
      where: { pluggyAccountId: remoteAccount.id },
      update: {
        name: remoteAccount.name,
        balance: remoteAccount.balance ?? 0,
      },
      create: {
        userId: pluggyItem.userId,
        pluggyItemId: pluggyItem.id,
        pluggyAccountId: remoteAccount.id,
        name: remoteAccount.name,
        type: mapPluggyAccountType(remoteAccount),
        balance: remoteAccount.balance ?? 0,
        color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
      },
    });

    const transactions = await listPluggyTransactions(remoteAccount.id, { from });
    for (const t of transactions) {
      const data = {
        userId: pluggyItem.userId,
        accountId: localAccount.id,
        description: t.description || "Transação",
        amount: Math.abs(t.amount),
        date: new Date(t.date),
        type: t.amount < 0 ? "expense" : "income",
        merchantName: t.merchant?.name ?? null,
        pluggyCategory: t.category ?? null,
      };
      // SQLite's createMany has no skipDuplicates support, and Pluggy can
      // amend a transaction (e.g. pending -> posted) after we first see it,
      // so an upsert per row is both necessary and the more correct choice.
      await prisma.transaction.upsert({
        where: { pluggyTransactionId: t.id },
        update: data,
        create: { ...data, pluggyTransactionId: t.id },
      });
    }
  }

  await prisma.pluggyItem.update({
    where: { id: pluggyItem.id },
    data: {
      status: remoteItem.status,
      executionStatus: remoteItem.executionStatus ?? null,
      connectorName: remoteItem.connector?.name ?? pluggyItem.connectorName,
      connectorImageUrl: remoteItem.connector?.imageUrl ?? pluggyItem.connectorImageUrl,
      lastSyncedAt: new Date(),
    },
  });

  revalidateOpenFinancePages();
}
