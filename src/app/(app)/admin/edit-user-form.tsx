"use client";

import { useActionState, useEffect } from "react";
import { updateUserByAdmin } from "@/app/actions/admin";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function EditUserForm({
  id,
  name,
  email,
  role,
  isSelf,
  onSuccess,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(updateUserByAdmin, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={name} required autoFocus />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={email} required />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        {isSelf ? (
          <>
            {/* A disabled <select> wouldn't submit its value at all, which
                would also block editing your own name/email — so keep the
                real value flowing through a hidden input instead. */}
            <Select id="role" defaultValue={role} disabled>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </Select>
            <input type="hidden" name="role" value={role} />
            <p className="text-xs text-muted-foreground">Você não pode alterar seu próprio papel.</p>
          </>
        ) : (
          <Select id="role" name="role" defaultValue={role}>
            <option value="user">Usuário</option>
            <option value="admin">Administrador</option>
          </Select>
        )}
        <FieldError messages={state?.errors?.role} />
      </div>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Salvar alterações</SubmitButton>
    </form>
  );
}
