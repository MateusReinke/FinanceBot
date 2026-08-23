"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, X } from "lucide-react";
import { generateInvite, revokeInvite } from "@/app/actions/events";
import { Button } from "@/components/ui/button";

type Invite = { id: string; code: string; expiresAt: Date | null };

export function InvitePanel({ eventId, invites }: { eventId: string; invites: Invite[] }) {
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopy(code: string, id: string) {
    const url = `${window.location.origin}/events/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2000);
    });
  }

  function handleGenerate() {
    const formData = new FormData();
    formData.set("eventId", eventId);
    startTransition(() => {
      generateInvite(formData);
    });
  }

  function handleRevoke(inviteId: string) {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("inviteId", inviteId);
    startTransition(() => {
      revokeInvite(formData);
    });
  }

  return (
    <div className="space-y-3">
      {invites.length === 0 ? (
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={pending}>
          <Link2 className="h-4 w-4" /> Gerar link de convite
        </Button>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="border-border bg-muted/50 flex items-center gap-2 rounded-lg border p-2"
            >
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
                /events/join/{invite.code.slice(0, 16)}...
              </span>
              <button
                onClick={() => handleCopy(invite.code, invite.id)}
                className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
                aria-label="Copiar link"
              >
                {copiedId === invite.id ? (
                  <Check className="text-success h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => handleRevoke(invite.id)}
                disabled={pending}
                className="text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer rounded-md p-1.5"
                aria-label="Revogar convite"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={pending}>
            <Link2 className="h-4 w-4" /> Gerar outro link
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Qualquer pessoa com o link pode entrar no evento. Válido por 7 dias.
      </p>
    </div>
  );
}
