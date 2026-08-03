import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Criar conta — FinanceBot" };

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">Crie sua conta</h2>
        <p className="text-sm text-muted-foreground">
          Comece a organizar suas finanças gratuitamente.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
