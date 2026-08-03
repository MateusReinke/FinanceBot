"use client";

import { useActionState, useEffect } from "react";
import { updateEvent } from "@/app/actions/events";
import { Input, Label, FieldError, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function EditEventForm({
  eventId,
  name,
  description,
  onSuccess,
}: {
  eventId: string;
  name: string;
  description: string | null;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(updateEvent, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do evento</Label>
        <Input id="name" name="name" defaultValue={name} required autoFocus />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={description ?? ""} />
        <FieldError messages={state?.errors?.description} />
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
