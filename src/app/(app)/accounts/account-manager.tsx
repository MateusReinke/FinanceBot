"use client";

import { useState } from "react";
import type { Account } from "@prisma/client";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Landmark, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AccountForm } from "./account-form";
import { InvoiceImportButton } from "./invoice-import-button";
import { PayInvoiceButton } from "./pay-invoice-button";
import { InvoicePlannerButton } from "./invoice-planner-button";
import { toggleArchiveAccount, deleteAccount } from "@/app/actions/accounts";
import { getAccountTypeMeta } from "@/lib/account-types";
import { startOfTodayUTC } from "@/lib/transaction-status";
import type { CardInvoicePlans, PlannedInvoice } from "@/lib/queries/card-invoices";
import { formatCurrency, formatMonthShort, cn } from "@/lib/utils";

function AccountCard({
  account,
  aiEnabled,
  sourceAccounts,
  plan,
}: {
  account: Account;
  aiEnabled: boolean;
  sourceAccounts: Account[];
  plan: PlannedInvoice[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const meta = getAccountTypeMeta(account.type);
  const Icon = meta.icon;
  const isSynced = Boolean(account.pluggyItemId);
  const isCard = account.type === "credit_card";

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

      {isCard ? <CreditCardDetails account={account} /> : null}

      {isCard ? <PlannedInvoices plan={plan} /> : null}

      {isCard && !isSynced ? (
        <div className="space-y-1.5">
          <PayInvoiceButton account={account} sourceAccounts={sourceAccounts} />
          <InvoicePlannerButton account={account} sourceAccounts={sourceAccounts} plan={plan} />
          {aiEnabled ? <InvoiceImportButton accountId={account.id} /> : null}
        </div>
      ) : null}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar conta">
        <AccountForm account={account} onSuccess={() => setEditOpen(false)} />
      </Modal>
    </div>
  );
}

// What the user has already filled in for this card, on the card itself —
// otherwise the planner would be the only place the numbers exist, and a
// forecast you have to open a modal to read is one nobody reads.
function PlannedInvoices({ plan }: { plan: PlannedInvoice[] }) {
  const today = startOfTodayUTC();
  const pending = plan.filter((invoice) => !invoice.paid);
  if (pending.length === 0) return null;

  const shown = pending.slice(0, 3);
  const rest = pending.length - shown.length;
  const total = pending.reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <div className="space-y-1 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Faturas previstas</p>
      {shown.map((invoice) => (
        <div key={invoice.id} className="flex items-center justify-between text-xs">
          <span className={cn("text-muted-foreground", invoice.date < today && "text-danger")}>
            {formatMonthShort(invoice.date.getUTCMonth() + 1, invoice.date.getUTCFullYear())}{" "}
            {invoice.date.getUTCFullYear()}
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(invoice.amount)}
          </span>
        </div>
      ))}
      {rest > 0 ? (
        <p className="text-xs text-muted-foreground">
          +{rest} {rest === 1 ? "mês" : "meses"} · {formatCurrency(total)} no total
        </p>
      ) : null}
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

function AccountGrid({
  accounts,
  aiEnabled,
  sourceAccounts,
  plans,
  muted,
}: {
  accounts: Account[];
  aiEnabled: boolean;
  sourceAccounts: Account[];
  plans: CardInvoicePlans;
  muted?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", muted && "opacity-70")}>
      {accounts.map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          aiEnabled={aiEnabled}
          sourceAccounts={sourceAccounts}
          plan={plans[a.id] ?? []}
        />
      ))}
    </div>
  );
}

export function AccountManager({
  accounts,
  aiEnabled,
  plans,
}: {
  accounts: Account[];
  aiEnabled: boolean;
  plans: CardInvoicePlans;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  const activeCards = active.filter((a) => a.type === "credit_card");
  const activeAccounts = active.filter((a) => a.type !== "credit_card");
  const sourceAccounts = activeAccounts.filter((a) => !a.pluggyItemId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não tem contas cadastradas. Crie uma conta manual ou conecte seu banco.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
      ) : (
        <>
          {activeCards.length > 0 ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CreditCard className="h-4 w-4" /> Cartões de crédito
              </h2>
              <AccountGrid accounts={activeCards} aiEnabled={aiEnabled} sourceAccounts={sourceAccounts} plans={plans} />
            </div>
          ) : null}

          {activeAccounts.length > 0 ? (
            <div className="space-y-3">
              {activeCards.length > 0 ? (
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Landmark className="h-4 w-4" /> Contas
                </h2>
              ) : null}
              <AccountGrid accounts={activeAccounts} aiEnabled={aiEnabled} sourceAccounts={sourceAccounts} plans={plans} />
            </div>
          ) : null}
        </>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Contas arquivadas ({archived.length})
          </summary>
          <div className="mt-3">
            <AccountGrid accounts={archived} aiEnabled={aiEnabled} sourceAccounts={sourceAccounts} plans={plans} muted />
          </div>
        </details>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova conta">
        <AccountForm onSuccess={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}
