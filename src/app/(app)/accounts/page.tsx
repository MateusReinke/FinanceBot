import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isPluggyConfigured, pluggyUseSandbox } from "@/lib/pluggy";
import { AccountManager } from "./account-manager";
import { OpenFinanceSection } from "@/components/openfinance/open-finance-section";

export const metadata: Metadata = { title: "Contas — FinanceBot" };

export default async function AccountsPage() {
  const { userId } = await verifySession();
  const pluggyEnabled = isPluggyConfigured();

  const [accounts, user, pluggyItems] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    getCurrentUser(),
    pluggyEnabled
      ? prisma.pluggyItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Contas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas contas manuais ou conecte seu banco via Open Finance.
        </p>
      </div>

      {pluggyEnabled ? (
        <OpenFinanceSection
          pluggyItems={pluggyItems}
          clientUserId={user?.email}
          includeSandbox={pluggyUseSandbox()}
        />
      ) : null}

      <div className="space-y-3">
        {pluggyEnabled ? <h2 className="text-base font-semibold text-foreground">Contas manuais</h2> : null}
        <AccountManager accounts={accounts} />
      </div>
    </div>
  );
}
