"use client";

import { useActionState, useEffect } from "react";
import { updateFinancingDescription } from "@/app/actions/financing";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function EditFinancingForm({
  id,
  description,
  onSuccess,
}: {
  id: string;
  description: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(updateFinancingDescription, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={description} required autoFocus />
        <FieldError messages={state?.errors?.description} />
      </div>
      <p className="text-xs text-muted-foreground">
        Só a descrição pode ser editada. Para mudar valor, quantidade de parcelas ou conta, exclua
        e crie um novo financiamento.
      </p>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Salvar alterações</SubmitButton>
    </form>
  );
}
