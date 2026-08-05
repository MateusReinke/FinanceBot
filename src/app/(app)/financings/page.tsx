import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getFinancingsList } from "@/lib/queries/financing";
import { FinancingList } from "./financing-list";

export const metadata: Metadata = { title: "Financiamentos — FinanceBot" };

export default async function FinancingsPage() {
  const { userId } = await verifySession();

  const [financings, accounts, categories] = await Promise.all([
    getFinancingsList(userId),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId, type: "expense" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Financiamentos</h1>
        <p className="text-sm text-muted-foreground">
          Compras parceladas e financiamentos — a parcela de cada mês entra automaticamente nos
          seus gastos quando vence.
        </p>
      </div>
      <FinancingList financings={financings} accounts={accounts} categories={categories} />
    </div>
  );
}
