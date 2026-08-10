import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { CategoryManager } from "./category-manager";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Categorias — FinanceBot" };

export default async function CategoriesPage() {
  const { userId } = await verifySession();

  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        description="Organize seus lançamentos em categorias personalizadas."
      />
      <CategoryManager expense={expense} income={income} />
    </div>
  );
}
