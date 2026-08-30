import type { Metadata } from "next";
import { Landmark, CreditCard, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isPluggyConfigured, pluggyUseSandbox } from "@/lib/pluggy";
import { isOpenAiConfigured } from "@/lib/openai";
import { getCardInvoiceData } from "@/lib/queries/card-invoices";
import { cardLimitUsage } from "@/lib/card-invoices";
import { AccountManager } from "./account-manager";
import { CardInvoiceSummary } from "./card-invoice-summary";
import { OpenFinanceSection } from "@/components/openfinance/open-finance-section";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Contas — FinanceBot" };

export default async function AccountsPage() {
  const { userId } = await verifySession();
  const pluggyEnabled = isPluggyConfigured();

  const [accounts, user, pluggyItems, invoices] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    getCurrentUser(),
    pluggyEnabled
      ? prisma.pluggyItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    getCardInvoiceData(userId),
  ]);

  // The same three numbers every card tile below shows individually, rolled
  // up once for the top of the page — "how am I doing right now", answered
  // before the first tile. Cards and everything else are kept apart: a
  // checking account's balance and a card's available limit answer different
  // questions, and netting them would answer neither.
  const active = accounts.filter((a) => !a.archived);
  const cards = active.filter((a) => a.type === "credit_card");
  const cashAccounts = active.filter((a) => a.type !== "credit_card");
  const cashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0);

  const cardUsage = cards.map((c) => ({
    account: c,
    ...cardLimitUsage(c.balance, c.creditLimit, invoices.plans[c.id] ?? []),
  }));
  const limitedCards = cardUsage.filter((c) => c.account.creditLimit != null);
  const totalLimit = limitedCards.reduce((sum, c) => sum + (c.account.creditLimit ?? 0), 0);
  const totalAvailable = limitedCards.reduce((sum, c) => sum + (c.available ?? 0), 0);
  const totalOwed = cardUsage.reduce((sum, c) => sum + c.used, 0);
  const cardsOwing = cardUsage.filter((c) => c.used > 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contas"
        description="Gerencie suas contas manuais ou conecte seu banco via Open Finance."
      />

      {active.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cashAccounts.length > 0 ? (
            <StatCard
              label="Saldo em contas"
              value={formatCurrency(cashBalance)}
              numericValue={cashBalance}
              valueClassName={cashBalance < 0 ? "text-danger" : "text-foreground"}
              icon={Landmark}
              iconClassName="bg-primary-soft text-primary"
              hint={`${cashAccounts.length} ${cashAccounts.length === 1 ? "conta" : "contas"}`}
            />
          ) : null}
          {limitedCards.length > 0 ? (
            <StatCard
              label="Limite disponível"
              value={formatCurrency(totalAvailable)}
              numericValue={totalAvailable}
              icon={CreditCard}
              iconClassName="bg-accent-soft text-accent"
              hint={`de ${formatCurrency(totalLimit)} no limite total`}
            />
          ) : null}
          {cards.length > 0 ? (
            <StatCard
              label="Faturas em aberto"
              value={formatCurrency(totalOwed)}
              numericValue={totalOwed}
              valueClassName={totalOwed > 0 ? "text-danger" : "text-foreground"}
              icon={ReceiptText}
              iconClassName={
                totalOwed > 0 ? "bg-danger-bg text-danger" : "bg-muted text-muted-foreground"
              }
              hint={
                cardsOwing > 0
                  ? `${cardsOwing} ${cardsOwing === 1 ? "cartão" : "cartões"} com saldo devedor`
                  : "Nenhum cartão devendo"
              }
            />
          ) : null}
        </div>
      ) : null}

      {pluggyEnabled ? (
        <OpenFinanceSection
          pluggyItems={pluggyItems}
          clientUserId={user?.email}
          includeSandbox={pluggyUseSandbox()}
        />
      ) : null}

      <CardInvoiceSummary accounts={accounts} series={invoices.series} />

      <div className="space-y-3">
        {pluggyEnabled ? (
          <h2 className="text-foreground text-base font-semibold">Contas manuais</h2>
        ) : null}
        <AccountManager
          accounts={accounts}
          aiEnabled={isOpenAiConfigured()}
          plans={invoices.plans}
        />
      </div>
    </div>
  );
}
