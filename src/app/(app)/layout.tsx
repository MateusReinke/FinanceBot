import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isOpenAiConfigured } from "@/lib/openai";
import { getNavBadges } from "@/lib/queries/nav-badges";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifySession();
  const [user, badges] = await Promise.all([getCurrentUser(), getNavBadges(userId)]);
  if (!user) redirect("/login");
  // First visit ever: the guide, not the painel. A brand-new account's
  // painel is nine empty states in a trench coat, and no amount of copy on
  // it explains what the app expects you to do first. /bem-vindo lives
  // outside this route group, so there is no loop.
  if (!user.onboardedAt) redirect("/bem-vindo");

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
