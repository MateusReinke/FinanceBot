import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isOpenAiConfigured } from "@/lib/openai";
import { getNavBadges } from "@/lib/queries/nav-badges";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifySession();
  const [user, badges] = await Promise.all([getCurrentUser(), getNavBadges(userId)]);
  if (!user) redirect("/login");

  return (
    <AppShell
      name={user.name}
      email={user.email}
      role={user.role}
      aiEnabled={isOpenAiConfigured()}
      badges={{
        "/transactions": badges.overdueExpenses,
        "/receivables": badges.overdueReceivables,
      }}
    >
      {children}
    </AppShell>
  );
}
