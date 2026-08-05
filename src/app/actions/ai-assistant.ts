"use server";

import type { Account, Category } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { isOpenAiConfigured, parseTransactionCommand } from "@/lib/openai";

export type ParseTransactionResult =
  | { error: string }
  | {
      type: "income" | "expense";
      amount: number;
      description: string;
      date: string;
      accountId: string | null;
      categoryId: string | null;
      accounts: Account[];
      categories: Category[];
    };

// Not FormState/useActionState-shaped, same reason as extractReceiptExpenses
// in src/app/actions/events.ts: the review step needs the parsed fields
// (and the account/category lists to populate its selects) back as data,
// not just a success/error flag. The actual transaction is created by the
// review form submitting straight to the existing upsertTransaction action
// — this function never writes anything itself.
export async function parseTransactionText(text: string): Promise<ParseTransactionResult> {
  const { userId } = await verifySession();

  if (!isOpenAiConfigured()) {
    return { error: "O assistente de IA não está configurado neste servidor." };
  }
  if (!text.trim()) {
    return { error: "Digite um comando, tipo \"gastei 50 reais no mercado\"." };
  }

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId, archived: false }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  let extracted;
  try {
    extracted = await parseTransactionCommand(
      text,
      accounts.map((a) => ({ name: a.name, type: a.type })),
      categories.map((c) => ({ name: c.name, type: c.type }))
    );
  } catch (error) {
    console.error("Falha ao interpretar comando do assistente", error);
    return { error: "Não consegui entender esse comando. Tente descrever de novo ou lance manualmente." };
  }

  const accountId = extracted.accountName
    ? (accounts.find((a) => a.name.toLowerCase() === extracted.accountName!.toLowerCase())?.id ?? null)
    : null;
  const categoryId = extracted.categoryName
    ? (categories.find(
        (c) => c.name.toLowerCase() === extracted.categoryName!.toLowerCase() && c.type === extracted.type
      )?.id ?? null)
    : null;

  return {
    type: extracted.type,
    amount: extracted.amount,
    description: extracted.description,
    date: extracted.date ?? new Date().toISOString().slice(0, 10),
    accountId,
    categoryId,
    accounts,
    categories,
  };
}
