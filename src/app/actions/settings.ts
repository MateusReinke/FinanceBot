"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hashPassword, verifyPassword } from "@/lib/password";
import { deleteSession } from "@/lib/session";
import { UpdateProfileSchema, ChangePasswordSchema } from "@/lib/validation/settings";
import type { FormState } from "@/lib/form-state";

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = UpdateProfileSchema.safeParse({ name: formData.get("name") });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  await prisma.user.update({ where: { id: userId }, data: { name: validatedFields.data.name } });

  revalidatePath("/", "layout");
  return { success: true, message: "Perfil atualizado." };
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();

  const validatedFields = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // A Google-only account is *setting* a first password rather than changing
  // one, so there is no current password to prove. The session already
  // proves who they are, which is the same guarantee the check provides.
  if (user.passwordHash) {
    if (!validatedFields.data.currentPassword) {
      return { errors: { currentPassword: ["Informe sua senha atual."] } };
    }
    const isValid = await verifyPassword(validatedFields.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return { errors: { currentPassword: ["Senha atual incorreta."] } };
    }
  }

  const passwordHash = await hashPassword(validatedFields.data.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true, message: "Senha atualizada." };
}

export async function deleteAccountAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const { userId } = await verifySession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const confirmEmail = formData.get("confirmEmail");
  if (confirmEmail !== user.email) {
    return { errors: { confirmEmail: ["Digite seu e-mail exatamente para confirmar."] } };
  }

  await prisma.user.delete({ where: { id: userId } });
  await deleteSession();
  redirect("/login");
}
