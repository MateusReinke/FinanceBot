"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { LoginSchema, SignupSchema } from "@/lib/validation/auth";
import type { FormState } from "@/lib/form-state";
import { createUserWithDefaultCategories } from "@/lib/user-provisioning";
import { isAdminEmail } from "@/lib/admin";

export async function signup(_state: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, phoneNumber, password } = validatedFields.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["Este e-mail já está cadastrado."] } };
  }

  // Checked before the insert so the user gets a field-level message rather
  // than a unique-constraint failure. The constraint is still the real
  // guarantee — two simultaneous signups would collide there.
  const phoneTaken = await prisma.user.findUnique({ where: { phoneNumber } });
  if (phoneTaken) {
    return { errors: { phoneNumber: ["Esse WhatsApp já está cadastrado em outra conta."] } };
  }

  const passwordHash = await hashPassword(password);
  const user = await createUserWithDefaultCategories({
    name,
    email,
    phoneNumber,
    passwordHash,
    role: isAdminEmail(email) ? "admin" : "user",
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { message: "E-mail ou senha incorretos." };
  }

  // Promote-only: if ADMIN_EMAIL now matches an existing account, grant
  // admin on next login. Never demote here — that would fight the admin
  // panel's own "promote a user" feature for anyone whose email isn't the
  // ADMIN_EMAIL value.
  if (isAdminEmail(email) && user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  }

  await createSession(user.id);

  const next = formData.get("next");
  const redirectTo =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";
  redirect(redirectTo);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
