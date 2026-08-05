"use client";

import { useActionState, useEffect } from "react";
import { resetUserPasswordByAdmin } from "@/app/actions/admin";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetPasswordForm({
  id,
  name,
  onSuccess,
}: {
  id: string;
  name: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(resetUserPasswordByAdmin, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground">
        Defina uma nova senha para <strong className="text-foreground">{name}</strong>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres" required autoFocus />
        <FieldError messages={state?.errors?.password} />
      </div>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Redefinir senha</SubmitButton>
    </form>
  );
}
