import { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha — FinanceBot" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-semibold">Esqueceu sua senha?</h2>
        <p className="text-muted-foreground text-sm">
          Digite seu e-mail abaixo e enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
