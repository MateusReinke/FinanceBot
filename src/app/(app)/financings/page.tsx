import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { getFinancingsList } from "@/lib/queries/financing";
import { FinancingList } from "./financing-list";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title="Fixos e parcelados"
        description="Gastos fixos, receitas fixas e compras parceladas — cada cobrança entra sozinha nos seus lançamentos na data em que vence."
      />
      <FinancingList financings={financings} accounts={accounts} categories={categories} />
    </div>
  );
}
