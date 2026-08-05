"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CreateUserForm } from "./create-user-form";

export function CreateUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo usuário
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário">
        <CreateUserForm onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
