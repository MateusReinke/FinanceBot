import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { CategoryManager } from "./category-manager";

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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Organize suas transações em categorias personalizadas.
        </p>
      </div>
      <CategoryManager expense={expense} income={income} />
    </div>
  );
}
