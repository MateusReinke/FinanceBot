import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha — FinanceBot" };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token || typeof token !== "string" || token.length < 10) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-semibold">Redefinir senha</h2>
        <p className="text-muted-foreground text-sm">
          Digite sua nova senha abaixo. O link de redefinição expira em 1 hora.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
