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
import { notifyPasswordResetInBackground } from "@/lib/password-reset-webhook";

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

  // Always return success message to prevent email enumeration attacks
  // Even if user doesn't exist, we return the same message
  if (!user || !user.passwordHash) {
    return {
      success: true,
      message: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
    };
  }

  // Generate reset token
  const resetToken = await generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  // Store token in database (we'll add a PasswordReset table or use existing)
  // For now, store in a temporary table or add to user metadata
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: resetToken,
      expiresAt,
    },
  });

  // No e-mail provider is configured for this app — delivery is a dedicated
  // n8n webhook (N8N_PASSWORD_RESET_WEBHOOK_URL) instead, kept separate from
  // the WhatsApp group automation in src/lib/outbound.ts. Logged either way
  // so the link is still reachable locally when that webhook isn't set.
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
  console.log(`[PASSWORD RESET] Link para ${email}: ${resetLink}`);
  notifyPasswordResetInBackground({
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    resetLink,
    expiresAt,
  });

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

  // Find valid reset token
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetRecord) {
    return { message: "Token de redefinição inválido ou expirado." };
  }

  // Check if token is expired
  if (new Date() > resetRecord.expiresAt) {
    // Clean up expired token
    await prisma.passwordReset.delete({ where: { token } });
    return { message: "Token de redefinição expirado. Solicite um novo link." };
  }

  // Hash new password and update user
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: resetRecord.userId },
    data: { passwordHash },
  });

  // Delete used token
  await prisma.passwordReset.delete({ where: { token } });

  // Optionally: create session and redirect to dashboard
  // For security, we'll just redirect to login
  return {
    success: true,
    message: "Senha redefinida com sucesso! Faça login com sua nova senha.",
  };
}
