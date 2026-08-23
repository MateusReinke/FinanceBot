import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { GoogleButton, AuthDivider, GoogleError } from "@/components/auth/google-button";
import { isGoogleConfigured } from "@/lib/google";

export const metadata: Metadata = { title: "Criar conta — FinanceBot" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const googleEnabled = isGoogleConfigured();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-2xl font-semibold">Crie sua conta</h2>
        <p className="text-muted-foreground text-sm">
          Comece a organizar suas finanças gratuitamente.
        </p>
      </div>

      <GoogleError code={error} />

      {googleEnabled ? (
        <>
          {/* Same endpoint as login: with Google there is no separate
              "cadastrar", the first sign-in creates the account. */}
          <GoogleButton label="Criar conta com Google" />
          <AuthDivider />
        </>
      ) : null}

      <RegisterForm />
    </div>
  );
}
