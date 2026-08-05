"use client";

import { useActionState, useEffect, useState } from "react";
import type { Account } from "@prisma/client";
import { upsertAccount } from "@/app/actions/accounts";
import { Input, Label, FieldError, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { ACCOUNT_COLORS } from "@/lib/color-palette";
import { cn } from "@/lib/utils";

export function AccountForm({
  account,
  onSuccess,
}: {
  account?: Account;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(upsertAccount, undefined);
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[10]);
  const [type, setType] = useState(account?.type ?? ACCOUNT_TYPES[0].value);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <input type="hidden" name="color" value={color} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          defaultValue={account?.name}
          placeholder="Ex: Nubank"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type">Tipo</Label>
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.type} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="balance">{account ? "Saldo atual" : "Saldo inicial"}</Label>
        <Input
          id="balance"
          name="balance"
          type="number"
          step="0.01"
          defaultValue={account?.balance ?? 0}
          required
        />
        <FieldError messages={state?.errors?.balance} />
      </div>

      {type === "credit_card" ? (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="creditLimit">Limite (R$)</Label>
            <Input
              id="creditLimit"
              name="creditLimit"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 5000"
              defaultValue={account?.creditLimit ?? ""}
            />
            <FieldError messages={state?.errors?.creditLimit} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="closingDay">Dia do fechamento</Label>
              <Input
                id="closingDay"
                name="closingDay"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 10"
                defaultValue={account?.closingDay ?? ""}
              />
              <FieldError messages={state?.errors?.closingDay} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDay">Dia do vencimento</Label>
              <Input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 17"
                defaultValue={account?.dueDay ?? ""}
              />
              <FieldError messages={state?.errors?.dueDay} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full border-2 cursor-pointer",
                color === c ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      {state?.message ? (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">{account ? "Salvar alterações" : "Criar conta"}</SubmitButton>
    </form>
  );
}
