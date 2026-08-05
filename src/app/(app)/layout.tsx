import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { isOpenAiConfigured } from "@/lib/openai";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell name={user.name} email={user.email} role={user.role} aiEnabled={isOpenAiConfigured()}>
      {children}
    </AppShell>
  );
}
