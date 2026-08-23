import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { getGuideProgress } from "@/lib/queries/onboarding";
import { isGoogleConfigured } from "@/lib/google";
import { isOpenAiConfigured } from "@/lib/openai";
import { isPluggyConfigured } from "@/lib/pluggy";
import { WelcomeGuide } from "./welcome-guide";

export const metadata: Metadata = { title: "Primeiros passos — FinanceBot" };

export default async function WelcomePage() {
  const { userId } = await verifySession();
  const [user, progress] = await Promise.all([getCurrentUser(), getGuideProgress(userId)]);
  if (!user) redirect("/login");

  return (
    <WelcomeGuide
      firstName={user.name.split(" ")[0]}
      // A returning visitor (the "rever o guia" link in the user menu) gets
      // a way back to the painel; a brand-new one does not, because the only
      // way out is forward and that is the point.
      revisiting={user.onboardedAt !== null}
      hasAccount={progress.steps.some((s) => s.id === "account" && s.done)}
      // What the server actually has credentials for. Promising WhatsApp and
      // Open Finance to someone whose instance has neither configured is how
      // a welcome guide loses the reader's trust on day one.
      integrations={{
        whatsapp: isOpenAiConfigured(),
        openFinance: isPluggyConfigured(),
        google: isGoogleConfigured(),
      }}
    />
  );
}
