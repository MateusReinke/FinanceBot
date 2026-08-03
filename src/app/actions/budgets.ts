"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { BudgetSchema } from "@/lib/validation/budgets";
import type { FormState } from "@/lib/form-state";

function revalidateBudgetPages() {
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function upsertBudget(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = BudgetSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    month: formData.get("month"),
    year: formData.get("year"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { categoryId, amount, month, year } = validatedFields.data;

  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) return { errors: { categoryId: ["Categoria inválida."] } };

  await prisma.budget.upsert({
    where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
    update: { amount },
    create: { userId, categoryId, month, year, amount },
  });

  revalidateBudgetPages();
  return { success: true };
}

export async function deleteBudget(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) return;

  await prisma.budget.delete({ where: { id } });
  revalidateBudgetPages();
}
