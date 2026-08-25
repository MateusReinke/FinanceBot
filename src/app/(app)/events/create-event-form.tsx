"use client";

import { useActionState, useState } from "react";
import { createEvent } from "@/app/actions/events";
import { Input, Label, FieldError, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";

export function CreateEventForm({ whatsappEnabled }: { whatsappEnabled: boolean }) {
  const [state, action] = useActionState(createEvent, undefined);
  // Opt-in, not automatic: creating a WhatsApp group adds real people to a
  // real group. That should be a choice, not a side effect of naming an
  // event. Same hidden-input pattern as elsewhere — an unchecked checkbox
  // posts nothing at all.
  const [createGroup, setCreateGroup] = useState(false);

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
      {whatsappEnabled ? (
        <div className="border-border bg-muted/40 flex items-start justify-between gap-3 rounded-lg border p-3">
          <input type="hidden" name="createWhatsappGroup" value={createGroup ? "true" : "false"} />
          <p className="text-sm">
            <span className="text-foreground">Criar um grupo no WhatsApp para este evento</span>
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Quem entrar no evento é adicionado ao grupo, e cada despesa nova é avisada lá. Só
              entra quem tiver WhatsApp cadastrado e permitir ser adicionado a grupos.
            </span>
          </p>
          <Switch
            checked={createGroup}
            onChange={setCreateGroup}
            label="Criar um grupo no WhatsApp para este evento"
            className="mt-0.5"
          />
        </div>
      ) : null}

      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Criar evento</SubmitButton>
    </form>
  );
}
