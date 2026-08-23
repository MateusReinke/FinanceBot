"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

// Finishing the guide and skipping it write the same field: once the user
// has made that call, the app stops deciding for them. Re-reading the guide
// is a link in the user menu, not a state the app puts them back into.
export async function finishGuide() {
  const { userId } = await verifySession();

  await prisma.user.update({
    where: { id: userId },
    // updateMany-style guard is unnecessary here (the id comes from the
    // session, not the form), but the write is idempotent either way: a
    // second call just re-stamps the same field.
    data: { onboardedAt: new Date() },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Hides the "Primeiros passos" checklist on the painel for good. Separate
// from onboardedAt because they answer different questions: one is "have
// you seen the guide", the other is "do you still want the checklist".
export async function dismissGuideChecklist() {
  const { userId } = await verifySession();

  await prisma.user.update({
    where: { id: userId },
    data: { guideDismissedAt: new Date() },
  });

  revalidatePath("/dashboard");
}
