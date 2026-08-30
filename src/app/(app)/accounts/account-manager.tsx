"use client";

import { useState } from "react";
import Link from "next/link";
import type { Account } from "@prisma/client";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Landmark,
  CreditCard,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AccountForm } from "./account-form";
import { InvoiceImportButton } from "./invoice-import-button";
import { PayInvoiceButton } from "./pay-invoice-button";
import { InvoicePlannerButton } from "./invoice-planner-button";
import { toggleArchiveAccount, deleteAccount } from "@/app/actions/accounts";
import { getAccountTypeMeta } from "@/lib/account-types";
import { cardLimitUsage } from "@/lib/card-invoices";
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
    <div className="surface hover:border-border-strong flex flex-col overflow-hidden transition-colors duration-200">
      {/* A sliver of the account's own colour — the same one the balance
          chips and category dots use — so a grid of a dozen tiles is still
          sortable by eye before anyone reads a single label. */}
      <div className="h-1 shrink-0" style={{ backgroundColor: account.color }} aria-hidden />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${account.color}20`, color: account.color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-foreground text-sm font-semibold">{account.name}</p>
              <p className="text-muted-foreground text-xs">{meta.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href={`/transactions?accountId=${account.id}`}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors"
              aria-label={`Ver lançamentos de ${account.name}`}
              title="Ver lançamentos"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            {!isSynced ? (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
                  aria-label="Editar conta"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <form action={toggleArchiveAccount}>
                  <input type="hidden" name="id" value={account.id} />
                  <button
                    type="submit"
                    className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
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
                    if (
                      !confirm(
                        `Excluir "${account.name}"? Todas as transações desta conta também serão excluídas.`
                      )
                    )
                      e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={account.id} />
                  <button
                    type="submit"
                    className="text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer rounded-md p-1.5"
                    aria-label="Excluir conta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>

        {isSynced ? (
          <span className="bg-success-bg text-success w-fit rounded-full px-2 py-0.5 text-xs font-medium">
            Open Finance
          </span>
        ) : null}

        <p
          className={cn(
            "text-xl font-semibold",
            account.balance > 0
              ? "text-foreground"
              : account.balance < 0
                ? "text-danger"
                : "text-muted-foreground"
          )}
        >
          <AnimatedNumber value={account.balance} />
        </p>

        {isCard ? <CreditCardDetails account={account} plan={plan} /> : null}

        {isCard ? <PlannedInvoices plan={plan} /> : null}

        {isCard && !isSynced ? (
          <div className="mt-auto space-y-1.5 pt-1">
            <PayInvoiceButton account={account} sourceAccounts={sourceAccounts} />
            <InvoicePlannerButton account={account} sourceAccounts={sourceAccounts} plan={plan} />
            {aiEnabled ? <InvoiceImportButton accountId={account.id} /> : null}
          </div>
        ) : null}
      </div>

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
    <div className="border-border space-y-1 border-t pt-3">
      <p className="text-muted-foreground text-xs font-medium">Faturas previstas</p>
      {shown.map((invoice) => (
        <div key={invoice.id} className="flex items-center justify-between text-xs">
          <span className={cn("text-muted-foreground", invoice.date < today && "text-danger")}>
            {formatMonthShort(invoice.date.getUTCMonth() + 1, invoice.date.getUTCFullYear())}{" "}
            {invoice.date.getUTCFullYear()}
          </span>
          <span className="text-foreground font-medium tabular-nums">
            {formatCurrency(invoice.amount)}
          </span>
        </div>
      ))}
      {rest > 0 ? (
        <p className="text-muted-foreground text-xs">
          +{rest} {rest === 1 ? "mês" : "meses"} · {formatCurrency(total)} no total
        </p>
      ) : null}
    </div>
  );
}

function CreditCardDetails({ account, plan }: { account: Account; plan: PlannedInvoice[] }) {
  const { creditLimit, closingDay, dueDay, balance } = account;
  if (!creditLimit && !closingDay && !dueDay) return null;

  const { available, percent, nearestPending } = cardLimitUsage(balance, creditLimit, plan);

  return (
    <div className="border-border space-y-2.5 border-t pt-3">
      {creditLimit ? (
        <div className="space-y-1.5">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                percent >= 90 ? "bg-danger" : percent >= 70 ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {formatCurrency(available ?? 0)} disponível de {formatCurrency(creditLimit)}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">{percent}%</p>
          </div>
          {/* Makes the deduction legible instead of just applying it — a
              limit that moved with no line explaining why would read as a
              second bug on top of the one this fixes. */}
          {nearestPending ? (
            <p className="text-muted-foreground text-xs">
              Já considera a fatura de{" "}
              {formatMonthShort(
                nearestPending.date.getUTCMonth() + 1,
                nearestPending.date.getUTCFullYear()
              )}{" "}
              ({formatCurrency(nearestPending.amount)})
            </p>
          ) : null}
        </div>
      ) : null}
      {closingDay || dueDay ? (
        <div className="flex flex-wrap gap-1.5">
          {closingDay ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              Fecha dia {closingDay}
            </span>
          ) : null}
          {dueDay ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              Vence dia {dueDay}
            </span>
          ) : null}
        </div>
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
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3", muted && "opacity-70")}
    >
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
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <Landmark className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">
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
              <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                <CreditCard className="h-4 w-4" /> Cartões de crédito
                <span className="text-muted-foreground font-normal">({activeCards.length})</span>
              </h2>
              <AccountGrid
                accounts={activeCards}
                aiEnabled={aiEnabled}
                sourceAccounts={sourceAccounts}
                plans={plans}
              />
            </div>
          ) : null}

          {activeAccounts.length > 0 ? (
            <div className="space-y-3">
              {activeCards.length > 0 ? (
                <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                  <Landmark className="h-4 w-4" /> Contas
                  <span className="text-muted-foreground font-normal">
                    ({activeAccounts.length})
                  </span>
                </h2>
              ) : null}
              <AccountGrid
                accounts={activeAccounts}
                aiEnabled={aiEnabled}
                sourceAccounts={sourceAccounts}
                plans={plans}
              />
            </div>
          ) : null}
        </>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium transition-colors">
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" />
            Contas arquivadas ({archived.length})
          </summary>
          <div className="mt-3">
            <AccountGrid
              accounts={archived}
              aiEnabled={aiEnabled}
              sourceAccounts={sourceAccounts}
              plans={plans}
              muted
            />
          </div>
        </details>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova conta">
        <AccountForm onSuccess={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}
