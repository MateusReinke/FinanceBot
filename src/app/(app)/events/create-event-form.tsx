"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/actions/events";
import { Input, Label, FieldError, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function CreateEventForm() {
  const [state, action] = useActionState(createEvent, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do evento</Label>
        <Input id="name" name="name" placeholder="Ex: Viagem para a praia" required autoFocus />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" name="description" rows={2} />
        <FieldError messages={state?.errors?.description} />
      </div>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Criar evento</SubmitButton>
    </form>
  );
}
