"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { InvoiceImportForm } from "./invoice-import-form";

export function InvoiceImportButton({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <FileText className="h-3.5 w-3.5" /> Importar fatura (PDF)
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Importar fatura (PDF)"
        className="max-w-lg"
      >
        <InvoiceImportForm accountId={accountId} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
