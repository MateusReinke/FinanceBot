"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { isOpenAiConfigured, extractInvoiceData } from "@/lib/openai";
import { extractPdfText } from "@/lib/pdf";
import { addMonthsUTC } from "@/lib/utils";
import { ConfirmInvoiceImportSchema } from "@/lib/validation/invoice-import";
import type { FormState } from "@/lib/form-state";

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

function revalidateInvoiceImportPages() {
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/financings");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

// Installment counters survive a description rewrite between invoices
// ("AMAZON BR 2/6" -> "AMAZON BR 3/6"), so comparison strips any trailing
// "x/y" before matching.
function normalizeDescription(desc: string) {
  return desc
    .toLowerCase()
    .replace(/\d{1,2}\s*\/\s*\d{1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monthDiff(a: Date, b: Date) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export type InvoiceImportItem = {
  description: string;
  amount: number;
  date: string;
  categoryId: string | null;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  matchedFinancingId: string | null;
  matchedFinancingDescription: string | null;
};

export type AnalyzeInvoiceResult =
  | { error: string }
  | {
      referenceMonth: number;
      referenceYear: number;
      totalAmount: number;
      items: InvoiceImportItem[];
    };

// Not FormState/useActionState-shaped, same reason as the AI transaction
// assistant and the Events receipt scanner: the review step needs the
// parsed fields back as data to seed an editable draft, not a success flag.
export async function analyzeInvoice(
  accountId: string,
  formData: FormData
): Promise<AnalyzeInvoiceResult> {
  const { userId } = await verifySession();

  if (!isOpenAiConfigured()) {
    return { error: "A leitura de fatura por IA não está configurada neste servidor." };
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return { error: "Conta não encontrada." };
  if (account.type !== "credit_card") {
    return { error: "Importação de fatura é só para contas do tipo cartão de crédito." };
  }
  if (account.pluggyItemId) {
    return {
      error: "Contas conectadas via Open Finance já têm a fatura sincronizada automaticamente.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione o PDF da fatura." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Formato não suportado. Envie um arquivo PDF." };
  }
  if (file.size > MAX_INVOICE_BYTES) {
    return {
      error: `Arquivo muito grande (máx. ${Math.floor(MAX_INVOICE_BYTES / 1024 / 1024)}MB).`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch (error) {
    console.error("Falha ao ler texto do PDF da fatura", error);
    return { error: "Não foi possível ler esse PDF. Verifique se o arquivo não está corrompido." };
  }

  if (text.trim().length < 50) {
    return {
      error:
        "Não encontrei texto nesse PDF — parece ser uma fatura escaneada como imagem, o que ainda não é suportado. Tente exportar o PDF direto do app ou site do banco.",
    };
  }

  const categories = await prisma.category.findMany({
    where: { userId, type: "expense" },
    orderBy: { name: "asc" },
  });

  let extracted;
  try {
    extracted = await extractInvoiceData(
      text,
      categories.map((c) => ({ name: c.name, type: c.type }))
    );
  } catch (error) {
    console.error("Falha ao interpretar fatura via OpenAI", error);
    return {
      error: "Não consegui interpretar essa fatura agora. Tente novamente ou lance manualmente.",
    };
  }

  if (extracted.items.length === 0) {
    return { error: "Não consegui identificar lançamentos nessa fatura." };
  }

  const now = new Date();
  const referenceMonth = extracted.referenceMonth ?? now.getUTCMonth() + 1;
  const referenceYear = extracted.referenceYear ?? now.getUTCFullYear();
  const totalAmount =
    extracted.totalAmount ??
    Math.round(extracted.items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

  const anchorDay = Math.min(account.dueDay ?? 1, 28);
  const referenceDate = new Date(Date.UTC(referenceYear, referenceMonth - 1, anchorDay));
  const fallbackDate = referenceDate.toISOString().slice(0, 10);

  // Matched against this account's existing financings so a purchase
  // already being tracked from a previous invoice (or manual entry) isn't
  // re-scheduled into a duplicate set of future installments.
  const existingFinancings = await prisma.financing.findMany({ where: { userId, accountId } });

  const items: InvoiceImportItem[] = extracted.items.map((item) => {
    const categoryId = item.categoryName
      ? (categories.find((c) => c.name.toLowerCase() === item.categoryName!.toLowerCase())?.id ??
        null)
      : null;

    let matchedFinancingId: string | null = null;
    let matchedFinancingDescription: string | null = null;

    if (item.installmentCurrent && item.installmentTotal) {
      const normalizedItemDesc = normalizeDescription(item.description);
      const match = existingFinancings.find((f) => {
        if (f.installmentCount !== item.installmentTotal) return false;
        if (monthDiff(f.firstDueDate, referenceDate) + 1 !== item.installmentCurrent) return false;
        if (Math.abs(f.installmentAmount - item.amount) > 0.05) return false;
        const normalizedFinancingDesc = normalizeDescription(f.description);
        return (
          normalizedFinancingDesc.includes(normalizedItemDesc) ||
          normalizedItemDesc.includes(normalizedFinancingDesc)
        );
      });
      if (match) {
        matchedFinancingId = match.id;
        matchedFinancingDescription = match.description;
      }
    }

    return {
      description: item.description,
      amount: item.amount,
      date: item.date ?? fallbackDate,
      categoryId,
      installmentCurrent: item.installmentCurrent,
      installmentTotal: item.installmentTotal,
      matchedFinancingId,
      matchedFinancingDescription,
    };
  });

  return { referenceMonth, referenceYear, totalAmount, items };
}

export async function confirmInvoiceImport(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const { userId } = await verifySession();

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string") return { message: "Conta inválida." };

  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return { message: "Conta não encontrada." };
  if (account.type !== "credit_card") {
    return { message: "Importação de fatura é só para contas do tipo cartão de crédito." };
  }
  if (account.pluggyItemId) {
    return {
      message: "Contas conectadas via Open Finance já têm a fatura sincronizada automaticamente.",
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    return { message: "Itens inválidos." };
  }

  const validated = ConfirmInvoiceImportSchema.safeParse({
    accountId,
    referenceMonth: formData.get("referenceMonth"),
    referenceYear: formData.get("referenceYear"),
    totalAmount: formData.get("totalAmount"),
    items: rawItems,
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const { referenceMonth, referenceYear, totalAmount, items } = validated.data;

  const categoryIds = [
    ...new Set(items.map((i) => i.categoryId).filter((id): id is string => Boolean(id))),
  ];
  const validCategoryIds = new Set(
    categoryIds.length
      ? (
          await prisma.category.findMany({
            where: { id: { in: categoryIds }, userId, type: "expense" },
            select: { id: true },
          })
        ).map((c) => c.id)
      : []
  );

  const anchorDay = Math.min(account.dueDay ?? 1, 28);
  const referenceDate = new Date(Date.UTC(referenceYear, referenceMonth - 1, anchorDay));

  const financingCreates = [];
  const transactionCreates = [];

  for (const item of items) {
    const categoryId =
      item.categoryId && validCategoryIds.has(item.categoryId) ? item.categoryId : undefined;
    const isInstallment =
      item.installmentCurrent != null &&
      item.installmentTotal != null &&
      item.installmentCurrent <= item.installmentTotal;

    if (isInstallment) {
      const installmentCurrent = item.installmentCurrent!;
      const installmentTotal = item.installmentTotal!;
      const firstDueDate = addMonthsUTC(referenceDate, -(installmentCurrent - 1));
      const schedule = Array.from({ length: installmentTotal }, (_, i) => ({
        installmentNumber: i + 1,
        date: addMonthsUTC(firstDueDate, i),
        balanceApplied: i + 1 <= installmentCurrent,
      }));

      financingCreates.push(
        prisma.financing.create({
          data: {
            userId,
            accountId,
            categoryId,
            description: item.description,
            installmentAmount: item.amount,
            installmentCount: installmentTotal,
            firstDueDate,
            installments: {
              create: schedule.map((s) => ({
                userId,
                accountId,
                categoryId,
                description: `Parcela ${s.installmentNumber}/${installmentTotal} — ${item.description}`,
                amount: item.amount,
                date: s.date,
                type: "expense",
                installmentNumber: s.installmentNumber,
                balanceApplied: s.balanceApplied,
              })),
            },
          },
        })
      );
    } else {
      transactionCreates.push(
        prisma.transaction.create({
          data: {
            userId,
            accountId,
            categoryId,
            description: item.description,
            amount: item.amount,
            date: item.date,
            type: "expense",
            balanceApplied: true,
          },
        })
      );
    }
  }

  // The account balance is set directly to the invoice's own total rather
  // than accumulated from each created row — that total already reflects
  // every charge on it (installment or not), so decrementing per-item on
  // top would double-count.
  await prisma.$transaction([
    ...financingCreates,
    ...transactionCreates,
    prisma.account.update({ where: { id: accountId }, data: { balance: -totalAmount } }),
  ]);

  revalidateInvoiceImportPages();
  return { success: true };
}
