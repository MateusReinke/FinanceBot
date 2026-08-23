"use client";

import { useActionState, useEffect, useState } from "react";
import type { Category } from "@prisma/client";
import { upsertCategory } from "@/app/actions/categories";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ICON_OPTIONS } from "@/lib/icon-registry";
import { CategoryIcon } from "@/components/ui/category-icon";
import { CATEGORY_COLORS } from "@/lib/color-palette";
import { cn } from "@/lib/utils";

export function CategoryForm({
  type,
  category,
  onSuccess,
}: {
  type: "income" | "expense";
  category?: Category;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(upsertCategory, undefined);
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? ICON_OPTIONS[0]);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={icon} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          defaultValue={category?.name}
          placeholder="Ex: Streaming"
          required
          autoFocus
        />
        <FieldError messages={state?.errors?.name} />
      </div>

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 cursor-pointer rounded-full border-2",
                color === c ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Ícone</Label>
        <div className="border-border grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg border p-2">
          {ICON_OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setIcon(key)}
              className={cn(
                "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md",
                icon === key
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
              aria-label={key}
            >
              <CategoryIcon icon={key} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">
        {category ? "Salvar alterações" : "Criar categoria"}
      </SubmitButton>
    </form>
  );
}
