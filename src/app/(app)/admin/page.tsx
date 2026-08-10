import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { UserTable } from "./user-table";
import { CreateUserButton } from "./create-user-button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Administração — FinanceBot" };

export default async function AdminPage() {
  const { userId } = await verifyAdminSession();

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Administração"
          description="Gerencie as contas de usuário do sistema. Isso não dá acesso aos dados financeiros de ninguém — só à identidade e credenciais de login."
        />
        <CreateUserButton />
      </div>

      <UserTable users={users} currentUserId={userId} />
    </div>
  );
}
