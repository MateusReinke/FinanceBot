"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { CategorySchema } from "@/lib/validation/categories";
import type { FormState } from "@/lib/form-state";

function revalidateCategoryPages() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function upsertCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = CategorySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    color: formData.get("color"),
    icon: formData.get("icon"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const id = formData.get("id");
  const data = validatedFields.data;

  try {
    if (typeof id === "string" && id.length > 0) {
      const existing = await prisma.category.findFirst({ where: { id, userId } });
      if (!existing) return { message: "Categoria não encontrada." };
      await prisma.category.update({ where: { id }, data });
    } else {
      await prisma.category.create({ data: { ...data, userId } });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "Já existe uma categoria com esse nome e tipo." };
    }
    throw error;
  }

  revalidateCategoryPages();
  return { success: true };
}

export async function deleteCategory(formData: FormData) {
  const { userId } = await verifySession();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) return;

  await prisma.category.delete({ where: { id } });
  revalidateCategoryPages();
}
