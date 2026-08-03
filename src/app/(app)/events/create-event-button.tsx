"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CreateEventForm } from "./create-event-form";

export function CreateEventButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo evento
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo evento">
        <CreateEventForm />
      </Modal>
    </>
  );
}
