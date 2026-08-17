"use client";

import { useState } from "react";
import type { Account, Category } from "@prisma/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TransactionForm } from "./transaction-form";

export function AddTransactionButton({
  accounts,
  categories,
  counterparties = [],
}: {
  accounts: Account[];
  categories: Category[];
  counterparties?: { name: string; phone: string | null }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo lançamento">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          counterparties={counterparties}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
