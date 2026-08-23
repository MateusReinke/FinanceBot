"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { hashPassword } from "@/lib/password";
import { createUserWithDefaultCategories } from "@/lib/user-provisioning";
import {
  AdminCreateUserSchema,
  AdminUpdateUserSchema,
  AdminResetPasswordSchema,
} from "@/lib/validation/admin";
import type { FormState } from "@/lib/form-state";

function revalidateAdminPages() {
  revalidatePath("/admin");
}

export async function createUserByAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  await verifyAdminSession();

  const validatedFields = AdminCreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const { name, email, password, role } = validatedFields.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["Este e-mail já está cadastrado."] } };
  }

  const passwordHash = await hashPassword(password);
  await createUserWithDefaultCategories({ name, email, passwordHash, role });

  revalidateAdminPages();
  return { success: true };
}

export async function updateUserByAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId: adminId } = await verifyAdminSession();
  const targetId = formData.get("id");
  if (typeof targetId !== "string") return { message: "Usuário inválido." };

  const validatedFields = AdminUpdateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }
  const { name, email, role } = validatedFields.data;

  if (targetId === adminId && role !== "admin") {
    return { errors: { role: ["Você não pode remover seu próprio papel de administrador."] } };
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { message: "Usuário não encontrado." };

  if (email !== target.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) return { errors: { email: ["Este e-mail já está em uso."] } };
  }

  await prisma.user.update({ where: { id: targetId }, data: { name, email, role } });

  revalidateAdminPages();
  return { success: true };
}

export async function resetUserPasswordByAdmin(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  await verifyAdminSession();
  const targetId = formData.get("id");
  if (typeof targetId !== "string") return { message: "Usuário inválido." };

  const validatedFields = AdminResetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { message: "Usuário não encontrado." };

  const passwordHash = await hashPassword(validatedFields.data.password);
  await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });

  revalidateAdminPages();
  return { success: true };
}

export async function deleteUserByAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId: adminId } = await verifyAdminSession();
  const targetId = formData.get("id");
  if (typeof targetId !== "string") return { message: "Usuário inválido." };

  if (targetId === adminId) {
    return { message: "Você não pode excluir sua própria conta por aqui." };
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { message: "Usuário não encontrado." };

  try {
    await prisma.user.delete({ where: { id: targetId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        message:
          "Não é possível excluir: este usuário participou de despesas em eventos compartilhados e não pode ser removido.",
      };
    }
    throw error;
  }

  revalidateAdminPages();
  return { success: true };
}
