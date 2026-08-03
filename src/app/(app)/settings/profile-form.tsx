"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/settings";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={name} required />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={email} disabled />
      </div>
      {state?.message ? (
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      ) : null}
      <SubmitButton size="sm">Salvar</SubmitButton>
    </form>
  );
}
