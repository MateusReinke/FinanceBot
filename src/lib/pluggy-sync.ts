import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COLORS } from "@/lib/color-palette";
import { toDateInputValue } from "@/lib/utils";
import { mapPluggyCategory } from "@/lib/pluggy-categories";
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

// Banks routinely post a transaction days after its value date, and Pluggy
// itself amends rows (pending -> posted) after we first see them. Asking
// only for "everything since the last sync" therefore loses transactions
// permanently. Every sync re-reads a trailing window instead; the upsert
// below makes re-reading free.
const LOOKBACK_DAYS = 30;

// A sync that started but never finished (process restart, timeout) must not
// block the item forever.
const STALE_SYNC_MS = 10 * 60 * 1000;

/**
 * Pulls the latest item status, accounts and transactions for one Open Finance
 * connection from Pluggy and reconciles them into our local tables. Safe to
 * call repeatedly and safe to call concurrently: accounts are upserted by
 * pluggyAccountId, transactions by (userId, pluggyTransactionId), and a
 * second concurrent sync of the same item bails out instead of racing.
 */
export async function syncPluggyItem(pluggyItemDbId: string) {
  const pluggyItem = await prisma.pluggyItem.findUnique({ where: { id: pluggyItemDbId } });
  if (!pluggyItem) return;

  // Claim the item. The updateMany's where clause is the lock: only one
  // caller can flip syncStartedAt from "free" to "taken", so a webhook
  // landing while the user hits "sincronizar" no longer double-syncs.
  const staleBefore = new Date(Date.now() - STALE_SYNC_MS);
  const claimed = await prisma.pluggyItem.updateMany({
    where: {
      id: pluggyItem.id,
      OR: [{ syncStartedAt: null }, { syncStartedAt: { lt: staleBefore } }],
    },
    data: { syncStartedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    await runSync(pluggyItem);
  } catch (error) {
    await prisma.pluggyItem.update({
      where: { id: pluggyItem.id },
      data: {
        syncStartedAt: null,
        lastSyncError: error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido",
      },
    });
    throw error;
  }
}

async function runSync(pluggyItem: { id: string; userId: string; pluggyItemId: string; connectorName: string; connectorImageUrl: string | null; lastSyncedAt: Date | null }) {
  const [remoteItem, remoteAccounts] = await Promise.all([
    getPluggyItem(pluggyItem.pluggyItemId),
    listPluggyAccounts(pluggyItem.pluggyItemId),
  ]);

  const fromDate = pluggyItem.lastSyncedAt
    ? new Date(pluggyItem.lastSyncedAt.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    : undefined;
  const from = fromDate ? toDateInputValue(fromDate) : undefined;

  // Resolved once per sync rather than per transaction: an imported row
  // with no category is a row the user has to file by hand later.
  const categories = await prisma.category.findMany({
    where: { userId: pluggyItem.userId },
    select: { id: true, name: true, type: true },
  });
  const categoryByNameAndType = new Map(categories.map((c) => [`${c.name}|${c.type}`, c.id]));

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
      const type = t.amount < 0 ? "expense" : "income";
      const mappedName = mapPluggyCategory(t.category);
      const data = {
        userId: pluggyItem.userId,
        accountId: localAccount.id,
        description: t.description || "Transação",
        amount: Math.abs(t.amount),
        date: new Date(t.date),
        type,
        merchantName: t.merchant?.name ?? null,
        pluggyCategory: t.category ?? null,
        // Money already moved at the bank by definition, so an imported row
        // is always realizado — it is never previsto.
        balanceApplied: true,
        source: "openfinance",
      };
      const categoryId = mappedName ? (categoryByNameAndType.get(`${mappedName}|${type}`) ?? null) : null;
      // SQLite's createMany has no skipDuplicates support, and Pluggy can
      // amend a transaction (e.g. pending -> posted) after we first see it,
      // so an upsert per row is both necessary and the more correct choice.
      await prisma.transaction.upsert({
        where: { userId_pluggyTransactionId: { userId: pluggyItem.userId, pluggyTransactionId: t.id } },
        // categoryId is only set on insert: once a row exists the user may
        // have filed it themselves, and a re-sync must never overwrite that.
        update: data,
        create: { ...data, categoryId, pluggyTransactionId: t.id },
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
      lastSyncError: null,
      syncStartedAt: null,
    },
  });

  revalidateOpenFinancePages();
}
