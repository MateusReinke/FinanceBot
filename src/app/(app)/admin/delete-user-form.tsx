"use client";

import { useActionState, useEffect } from "react";
import { deleteUserByAdmin } from "@/app/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteUserForm({
  id,
  name,
  onSuccess,
}: {
  id: string;
  name: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(deleteUserByAdmin, undefined);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground">
        Excluir <strong className="text-foreground">{name}</strong> remove permanentemente as
        contas, transações, categorias e financiamentos desse usuário. Essa ação não pode ser
        desfeita.
      </p>
      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton variant="danger" className="w-full">
        Excluir usuário
      </SubmitButton>
    </form>
  );
}
