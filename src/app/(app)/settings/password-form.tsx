"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/actions/settings";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function PasswordForm({ hasPassword = true }: { hasPassword?: boolean }) {
  const [state, action] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {/* Hidden for an account that signs in with Google and has no
          password yet — there is nothing to confirm, and the session already
          proves who is asking. */}
      {hasPassword ? (
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required />
          <FieldError messages={state?.errors?.currentPassword} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sua conta entra com o Google. Defina uma senha para poder entrar também por e-mail.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{hasPassword ? "Nova senha" : "Senha"}</Label>
        <Input id="newPassword" name="newPassword" type="password" required />
        <FieldError messages={state?.errors?.newPassword} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">
          {hasPassword ? "Confirmar nova senha" : "Confirmar senha"}
        </Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
        <FieldError messages={state?.errors?.confirmPassword} />
      </div>
      {state?.message ? (
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      ) : null}
      <SubmitButton size="sm">{hasPassword ? "Atualizar senha" : "Definir senha"}</SubmitButton>
    </form>
  );
}
