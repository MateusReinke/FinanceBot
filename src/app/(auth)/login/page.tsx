import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { GoogleButton, AuthDivider, GoogleError } from "@/components/auth/google-button";
import { isGoogleConfigured } from "@/lib/google";

export const metadata: Metadata = { title: "Entrar — FinanceBot" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Same pattern as Pluggy and the AI features: unconfigured means the
  // button is simply not there, rather than there and broken.
  const googleEnabled = isGoogleConfigured();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">Bem-vindo de volta</h2>
        <p className="text-sm text-muted-foreground">
          Entre para continuar controlando suas finanças.
        </p>
      </div>

      <GoogleError code={error} />

      {googleEnabled ? (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      ) : null}

      <LoginForm next={next} />
    </div>
  );
}
