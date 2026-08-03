"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ExpenseForm } from "./expense-form";

type Participant = { userId: string; user: { id: string; name: string; email: string } };

export function AddExpenseButton({
  eventId,
  participants,
  currentUserId,
}: {
  eventId: string;
  participants: Participant[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nova despesa
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova despesa" className="max-w-lg">
        <ExpenseForm
          eventId={eventId}
          participants={participants}
          currentUserId={currentUserId}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
