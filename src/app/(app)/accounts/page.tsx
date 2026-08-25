import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isPluggyConfigured, pluggyUseSandbox } from "@/lib/pluggy";
import { isOpenAiConfigured } from "@/lib/openai";
import { getCardInvoiceData } from "@/lib/queries/card-invoices";
import { AccountManager } from "./account-manager";
import { CardInvoiceSummary } from "./card-invoice-summary";
import { OpenFinanceSection } from "@/components/openfinance/open-finance-section";
import { PageHeader } from "@/components/ui/page-header";

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contas"
        description="Gerencie suas contas manuais ou conecte seu banco via Open Finance."
      />

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
