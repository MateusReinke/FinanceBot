"use client";

import { useState } from "react";
import type { Account } from "@prisma/client";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AccountForm } from "./account-form";
import { InvoiceImportButton } from "./invoice-import-button";
import { toggleArchiveAccount, deleteAccount } from "@/app/actions/accounts";
import { getAccountTypeMeta } from "@/lib/account-types";
import { formatCurrency, cn } from "@/lib/utils";

function AccountCard({ account, aiEnabled }: { account: Account; aiEnabled: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const meta = getAccountTypeMeta(account.type);
  const Icon = meta.icon;
  const isSynced = Boolean(account.pluggyItemId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${account.color}20`, color: account.color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{account.name}</p>
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>
        </div>
        {!isSynced ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
              aria-label="Editar conta"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <form action={toggleArchiveAccount}>
              <input type="hidden" name="id" value={account.id} />
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
                aria-label={account.archived ? "Reativar conta" : "Arquivar conta"}
              >
                {account.archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
            <form
              action={deleteAccount}
              onSubmit={(e) => {
                if (!confirm(`Excluir "${account.name}"? Todas as transações desta conta também serão excluídas.`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={account.id} />
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer"
                aria-label="Excluir conta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
            Open Finance
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-xl font-semibold",
          account.balance > 0 ? "text-foreground" : account.balance < 0 ? "text-danger" : "text-muted-foreground"
        )}
      >
        {formatCurrency(account.balance)}
      </p>

      {account.type === "credit_card" ? <CreditCardDetails account={account} /> : null}

      {account.type === "credit_card" && !isSynced && aiEnabled ? (
        <InvoiceImportButton accountId={account.id} />
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar conta">
        <AccountForm account={account} onSuccess={() => setEditOpen(false)} />
      </Modal>
    </div>
  );
}

function CreditCardDetails({ account }: { account: Account }) {
  const { creditLimit, closingDay, dueDay, balance } = account;
  if (!creditLimit && !closingDay && !dueDay) return null;

  const used = Math.max(0, -balance);
  const pct = creditLimit ? Math.min(100, Math.round((used / creditLimit) * 100)) : 0;
  const available = creditLimit ? Math.max(0, creditLimit - used) : null;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      {creditLimit ? (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(available ?? 0)} disponível de {formatCurrency(creditLimit)}
          </p>
        </div>
      ) : null}
      {closingDay || dueDay ? (
        <p className="text-xs text-muted-foreground">
          {closingDay ? `Fecha dia ${closingDay}` : null}
          {closingDay && dueDay ? " · " : null}
          {dueDay ? `Vence dia ${dueDay}` : null}
        </p>
      ) : null}
    </div>
  );
}

export function AccountManager({ accounts, aiEnabled }: { accounts: Account[]; aiEnabled: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {active.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => (
            <AccountCard key={a.id} account={a} aiEnabled={aiEnabled} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não tem contas cadastradas. Crie uma conta manual ou conecte seu banco.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Contas arquivadas ({archived.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => (
              <AccountCard key={a.id} account={a} aiEnabled={aiEnabled} />
            ))}
          </div>
        </details>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova conta">
        <AccountForm onSuccess={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}
