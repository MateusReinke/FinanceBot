"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import {
  LoginSchema,
  SignupSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "@/lib/validation/auth";
import type { FormState } from "@/lib/form-state";
import { createUserWithDefaultCategories } from "@/lib/user-provisioning";
import { isAdminEmail } from "@/lib/admin";

// Token expiration: 1 hour
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

async function generateResetToken(): Promise<string> {
  return randomBytes(32).toString("hex");
}

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
  // An account created through "Entrar com Google" has no password at all.
  // Saying so is better than "senha incorreta", which would send someone off
  // to reset a password that never existed — and it leaks nothing an
  // attacker could not learn by pressing the Google button themselves.
  if (user && !user.passwordHash) {
    return {
      message:
        'Esta conta entra com o Google. Use o botão "Entrar com Google" — ou defina uma senha em Configurações depois de entrar.',
    };
  }
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
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

export async function requestPasswordReset(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const validatedFields = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email } = validatedFields.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message either way — a different one for "not registered" would let
  // an attacker enumerate which e-mails have accounts here.
  if (!user || !user.passwordHash) {
    return {
      success: true,
      message: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
    };
  }

  const resetToken = await generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: resetToken,
      expiresAt,
    },
  });

  // TODO: send this by e-mail (Resend, SendGrid, ...) instead of logging it —
  // there is no delivery channel wired up yet, so this link never reaches
  // the user outside of local development.
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
  console.log(`[PASSWORD RESET] Link para ${email}: ${resetLink}`);

  return {
    success: true,
    message: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
  };
}

export async function resetPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const validatedFields = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    token: formData.get("token"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { password, token } = validatedFields.data;

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetRecord) {
    return { message: "Token de redefinição inválido ou expirado." };
  }

  if (new Date() > resetRecord.expiresAt) {
    await prisma.passwordReset.delete({ where: { token } });
    return { message: "Token de redefinição expirado. Solicite um novo link." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: resetRecord.userId },
    data: { passwordHash },
  });

  await prisma.passwordReset.delete({ where: { token } });

  return {
    success: true,
    message: "Senha redefinida com sucesso! Faça login com sua nova senha.",
  };
}
