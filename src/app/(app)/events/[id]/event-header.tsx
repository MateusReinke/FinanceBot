"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, LogOut, Trash2 } from "lucide-react";
import { leaveEvent, deleteEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EditEventForm } from "./edit-event-form";

export function EventHeader({
  eventId,
  name,
  description,
  canDelete,
}: {
  eventId: string;
  name: string;
  description: string | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  async function handleLeave() {
    if (!confirm("Sair deste evento? Você perde acesso aos gastos dele.")) return;
    const formData = new FormData();
    formData.set("eventId", eventId);
    await leaveEvent(formData);
    router.push("/events");
  }

  async function handleDelete() {
    if (!confirm(`Excluir o evento "${name}" para todos os participantes? Essa ação não pode ser desfeita.`))
      return;
    const formData = new FormData();
    formData.set("eventId", eventId);
    await deleteEvent(formData);
    router.push("/events");
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={handleLeave}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
        {canDelete ? (
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        ) : null}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar evento">
        <EditEventForm
          eventId={eventId}
          name={name}
          description={description}
          onSuccess={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}
