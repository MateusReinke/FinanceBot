"use client";

import { useActionState, useEffect } from "react";
import { createUserByAdmin } from "@/app/actions/admin";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action] = useActionState(createUserByAdmin, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Nome completo" required autoFocus />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" placeholder="voce@email.com" required />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha inicial</Label>
        <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres" required />
        <FieldError messages={state?.errors?.password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <Select id="role" name="role" defaultValue="user">
          <option value="user">Usuário</option>
          <option value="admin">Administrador</option>
        </Select>
        <FieldError messages={state?.errors?.role} />
      </div>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Criar usuário</SubmitButton>
    </form>
  );
}
