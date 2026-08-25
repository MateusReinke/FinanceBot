"use client";

import { useActionState, useState } from "react";
import { Copy, Check, Trash2, Plus } from "lucide-react";
import { createApiToken, revokeApiToken, updatePhoneNumber } from "@/app/actions/api-tokens";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/utils";

export type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function WhatsAppPanel({
  tokens,
  phoneNumber,
  baseUrl,
}: {
  tokens: TokenRow[];
  phoneNumber: string | null;
  baseUrl: string;
}) {
  return (
    <div className="space-y-6">
      <PhoneForm phoneNumber={phoneNumber} />
      <TokenList tokens={tokens} />
      <Instructions baseUrl={baseUrl} />
    </div>
  );
}

function PhoneForm({ phoneNumber }: { phoneNumber: string | null }) {
  const [state, action] = useActionState(updatePhoneNumber, undefined);

  return (
    <form action={action} className="space-y-1.5">
      <Label htmlFor="phoneNumber">Seu número de WhatsApp</Label>
      <div className="flex gap-2">
        <Input
          id="phoneNumber"
          name="phoneNumber"
          defaultValue={phoneNumber ?? ""}
          placeholder="+5511999999999"
          className="flex-1"
        />
        <SubmitButton>Salvar</SubmitButton>
      </div>
      <p className="text-muted-foreground text-xs">
        Opcional, mas recomendado: quando preenchido, a automação precisa mandar o número junto e
        ele tem que bater com este — assim uma mensagem de outra pessoa nunca cai na sua conta.
      </p>
      <FieldError messages={state?.errors?.phoneNumber} />
      {state?.success ? <p className="text-success text-xs">Número salvo.</p> : null}
    </form>
  );
}

function TokenList({ tokens }: { tokens: TokenRow[] }) {
  const [state, action] = useActionState(createApiToken, undefined);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  // Derived rather than synced in an effect: once a token comes back the
  // form has done its job, so the freshly-issued token takes its place.
  const formOpen = creating && !state?.token;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-foreground text-sm font-semibold">Tokens de acesso</h4>
        {!formOpen ? (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo token
          </Button>
        ) : null}
      </div>

      {formOpen ? (
        <form action={action} className="flex gap-2">
          <Input name="name" placeholder="Ex: n8n WhatsApp" required autoFocus className="flex-1" />
          <SubmitButton>Gerar</SubmitButton>
          <Button variant="outline" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </form>
      ) : null}
      <FieldError messages={state?.errors?.name} />
      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      {state?.token ? (
        <div className="border-primary bg-primary/5 space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-xs font-medium">
            Copie agora — esse token não aparece de novo.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs">
              {state.token}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(state.token!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum token ainda. Crie um para conectar o n8n.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm">{t.name}</p>
                <p className="text-muted-foreground text-xs">
                  <code>{t.prefix}…</code> · criado em {formatDate(t.createdAt)} ·{" "}
                  {t.lastUsedAt ? `usado em ${formatDate(t.lastUsedAt)}` : "nunca usado"}
                </p>
              </div>
              <form
                action={revokeApiToken}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `Revogar "${t.name}"? Quem estiver usando esse token para de funcionar na hora.`
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <Button type="submit" variant="outline" size="sm" title="Revogar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Instructions({ baseUrl }: { baseUrl: string }) {
  const snippet = `POST ${baseUrl}/api/v1/messages
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "text": "{{ $json.body }}",
  "messageId": "{{ $json.id }}",
  "from": "{{ $json.from }}"
}`;

  return (
    <details className="border-border bg-muted/40 rounded-lg border p-3">
      <summary className="text-foreground cursor-pointer text-sm font-medium">
        Como ligar no n8n
      </summary>
      <div className="text-muted-foreground mt-3 space-y-3 text-sm">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            No n8n, comece com o gatilho do seu provedor de WhatsApp (Evolution API, Twilio, Meta
            Cloud API…).
          </li>
          <li>
            Ligue esse gatilho direto num nó <strong>HTTP Request</strong> com a chamada abaixo. Não
            precisa de nó de IA no meio: o FinanceBot interpreta o texto.
          </li>
          <li>
            Mande o campo <code>reply</code> da resposta de volta pro usuário no WhatsApp.
          </li>
        </ol>
        <pre className="bg-card text-foreground overflow-x-auto rounded p-3 text-xs">{snippet}</pre>
        <p>
          Passar o <code>messageId</code> do provedor é o que evita lançamento duplicado quando ele
          reenvia a mesma mensagem.
        </p>
      </div>
    </details>
  );
}
