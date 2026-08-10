import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getFinancingsList } from "@/lib/queries/financing";
import { FinancingList } from "./financing-list";

export const metadata: Metadata = { title: "Lançamentos fixos — FinanceBot" };

export default async function FinancingsPage() {
  const { userId } = await verifySession();

  const [financings, accounts, categories] = await Promise.all([
    getFinancingsList(userId),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    // Both kinds: the form filters to income or expense categories as the
    // user flips between "dinheiro que entra" and "que sai".
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Lançamentos fixos</h1>
        <p className="text-sm text-muted-foreground">
          Gastos fixos, receitas fixas e compras parceladas — cada cobrança entra sozinha nos seus
          lançamentos na data em que vence.
        </p>
      </div>
      <FinancingList financings={financings} accounts={accounts} categories={categories} />
    </div>
  );
}
