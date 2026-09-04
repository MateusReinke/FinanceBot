"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="voce@email.com"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.email} />
      </div>
      {state?.message ? (
        <p className={`text-sm ${state.success ? "text-green-600" : "text-danger"}`} role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Enviar link de redefinição</SubmitButton>
      <div className="text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          ← Voltar para o login
        </Link>
      </div>
    </form>
  );
}
