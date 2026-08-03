"use client";

import { useState } from "react";
import type { Category } from "@prisma/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "./category-form";
import { deleteCategory } from "@/app/actions/categories";
import { CategoryIcon } from "@/components/ui/category-icon";

function CategorySection({
  title,
  type,
  categories,
}: {
  title: string;
  type: "income" | "expense";
  categories: Category[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setModalOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          return (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
              >
                <CategoryIcon icon={cat.icon} className="h-4 w-4" />
              </span>
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {cat.name}
              </span>
              <button
                onClick={() => openEdit(cat)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
                aria-label="Editar categoria"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <form
                action={deleteCategory}
                onSubmit={(e) => {
                  if (!confirm(`Excluir a categoria "${cat.name}"?`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={cat.id} />
                <button
                  type="submit"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer"
                  aria-label="Excluir categoria"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          );
        })}
        {categories.length === 0 ? (
          <p className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhuma categoria ainda.
          </p>
        ) : null}
      </div>
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar categoria" : `Nova categoria de ${title.toLowerCase()}`}
      >
        <CategoryForm type={type} category={editing} onSuccess={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

export function CategoryManager({
  expense,
  income,
}: {
  expense: Category[];
  income: Category[];
}) {
  return (
    <div className="space-y-8">
      <CategorySection title="Despesas" type="expense" categories={expense} />
      <CategorySection title="Receitas" type="income" categories={income} />
    </div>
  );
}
