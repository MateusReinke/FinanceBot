import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha | FinanceBot",
  description: "Redefina sua senha do FinanceBot",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Esqueceu sua senha?</h1>
        <p className="text-muted-foreground text-sm">
          Digite seu e-mail abaixo e enviaremos um link para redefinir sua senha.
        </p>
      </div>
      <ForgotPasswordForm />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Já tem uma conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
