import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { DangerZone } from "./danger-zone";
import { WhatsAppPanel } from "./whatsapp-panel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Configurações — FinanceBot" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [tokens, profile, headerList] = await Promise.all([
    prisma.apiToken.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { phoneNumber: true } }),
    headers(),
  ]);
  // Built from the request rather than an env var so the snippet shows the
  // URL this deployment is actually reachable at.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configurações" description={`Membro desde ${formatDate(user.createdAt)}`} />

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name} email={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp e automações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Lance gastos mandando uma mensagem — “gastei 45 no mercado com o nubank”. Gere um token,
            ligue no seu fluxo do n8n e pronto.
          </p>
          <WhatsAppPanel tokens={tokens} phoneNumber={profile?.phoneNumber ?? null} baseUrl={baseUrl} />
        </CardContent>
      </Card>

      <DangerZone email={user.email} />
    </div>
  );
}
