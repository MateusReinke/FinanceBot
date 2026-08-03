import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — FinanceBot" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">Bem-vindo de volta</h2>
        <p className="text-sm text-muted-foreground">
          Entre para continuar controlando suas finanças.
        </p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
