"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/actions/settings";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
        <FieldError messages={state?.errors?.currentPassword} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input id="newPassword" name="newPassword" type="password" required />
        <FieldError messages={state?.errors?.newPassword} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
        <FieldError messages={state?.errors?.confirmPassword} />
      </div>
      {state?.message ? (
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      ) : null}
      <SubmitButton size="sm">Atualizar senha</SubmitButton>
    </form>
  );
}
