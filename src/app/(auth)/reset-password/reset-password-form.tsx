"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/app/actions/auth";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  const router = useRouter();
  // Only the (stable, useCallback-memoized) function itself, never the
  // whole toast object — that object's identity changes every time a toast
  // is shown or expires, which turned this effect into an infinite loop:
  // it fires, shows a toast, the identity changes, it fires again.
  const { success: notifySuccess } = useToast();

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.message || "Senha redefinida com sucesso!");
      const timeout = setTimeout(() => {
        router.push("/login");
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [state?.success, state?.message, router, notifySuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repita sua senha"
          required
        />
        <FieldError messages={state?.errors?.confirmPassword} />
      </div>
      {state?.message && !state?.success ? (
        <p className="bg-danger-bg text-danger rounded-lg px-3 py-2 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.success ? (
        <p className="bg-success-bg text-success rounded-lg px-3 py-2 text-sm" role="status">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Redefinir senha</SubmitButton>
    </form>
  );
}
