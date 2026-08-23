"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction } from "@/app/actions/settings";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

function DeleteAccountForm({ email }: { email: string }) {
  const [state, action] = useActionState(deleteAccountAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Essa ação é permanente e apaga todas as suas contas, transações, categorias e orçamentos.
        Digite <strong className="text-foreground">{email}</strong> para confirmar.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="confirmEmail">Confirme seu e-mail</Label>
        <Input id="confirmEmail" name="confirmEmail" placeholder={email} required autoFocus />
        <FieldError messages={state?.errors?.confirmEmail} />
      </div>
      <SubmitButton variant="danger" className="w-full">
        Excluir minha conta permanentemente
      </SubmitButton>
    </form>
  );
}

export function DangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-danger/30 bg-danger-bg/40 rounded-xl border p-5">
      <h3 className="text-danger text-sm font-semibold">Zona de risco</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Excluir sua conta remove permanentemente todos os seus dados financeiros.
      </p>
      <Button variant="danger" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        Excluir conta
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Excluir conta">
        <DeleteAccountForm email={email} />
      </Modal>
    </div>
  );
}
