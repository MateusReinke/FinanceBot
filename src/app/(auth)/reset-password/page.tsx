import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha | FinanceBot",
  description: "Crie uma nova senha para sua conta",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token || typeof token !== "string" || token.length < 10) {
    notFound();
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Redefinir senha</h1>
        <p className="text-muted-foreground text-sm">
          Digite sua nova senha abaixo. O link de redefinição expira em 1 hora.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
