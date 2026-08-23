"use client";

import { useState } from "react";
import { ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ReceiptScanForm } from "./receipt-scan-form";

type Participant = { userId: string; user: { id: string; name: string; email: string } };

export function ReceiptScanButton({
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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ScanText className="h-4 w-4" /> Ler nota fiscal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ler nota fiscal"
        className="max-w-lg"
      >
        <ReceiptScanForm
          eventId={eventId}
          participants={participants}
          currentUserId={currentUserId}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
