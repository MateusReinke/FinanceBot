"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Contact2, RefreshCw, Unlink } from "lucide-react";
import { importGoogleContacts, disconnectGoogle } from "@/app/actions/contacts";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function GooglePanel({
  connected,
  email,
  hasContactsScope,
  contactCount,
  lastSyncAt,
}: {
  connected: boolean;
  email: string | null;
  hasContactsScope: boolean;
  contactCount: number;
  lastSyncAt: string | null;
}) {
  const [state, action] = useActionState(importGoogleContacts, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google</CardTitle>
        {connected && email ? (
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Google para entrar com um clique e importar seus contatos —
              assim, ao lançar algo que alguém te deve, você escolhe a pessoa em vez de digitar
              nome e telefone.
            </p>
            <Link
              href="/api/auth/google?scope=contacts"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Contact2 className="h-4 w-4" /> Conectar Google e contatos
            </Link>
          </>
        ) : (
          <>
            {!hasContactsScope ? (
              <div className="space-y-3 rounded-lg bg-warning-bg p-3">
                <p className="text-sm text-warning">
                  Sua conta está conectada, mas o acesso aos contatos não foi autorizado.
                </p>
                <Link
                  href="/api/auth/google?scope=contacts"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  <Contact2 className="h-4 w-4" /> Conectar contatos
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {contactCount === 0
                    ? "Nenhum contato importado ainda."
                    : `${contactCount} ${contactCount === 1 ? "contato importado" : "contatos importados"}.`}
                  {lastSyncAt
                    ? ` Última importação em ${dateFormatter.format(new Date(lastSyncAt))}.`
                    : ""}
                </p>
                <form action={action}>
                  <SubmitButton variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                    {contactCount === 0 ? "Importar contatos" : "Atualizar contatos"}
                  </SubmitButton>
                </form>
                {state?.message ? (
                  <p
                    className={state.success ? "text-sm text-success" : "text-sm text-danger"}
                    role={state.success ? "status" : "alert"}
                  >
                    {state.message}
                  </p>
                ) : null}
              </>
            )}

            <form
              action={disconnectGoogle}
              onSubmit={(e) => {
                if (
                  !confirm(
                    "Desconectar o Google? Os contatos importados serão apagados do FinanceBot."
                  )
                )
                  e.preventDefault();
              }}
              className="border-t border-border pt-4"
            >
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <Unlink className="h-4 w-4" /> Desconectar
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Apaga os contatos importados. Seus lançamentos não são afetados.
              </p>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
