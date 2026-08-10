import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { reconcileDueInstallments, maintainRecurringSchedules } from "@/lib/financing";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  try {
    await reconcileDueInstallments(session.userId);
    // Keeps open-ended entries topped up to the rolling horizon (and trims
    // anything beyond it). Same rationale as the reconciliation above for
    // living here: there is no cron in this app, and verifySession is the
    // one call every page and action already awaits.
    await maintainRecurringSchedules(session.userId);
  } catch (error) {
    // Never let a reconciliation hiccup block login, navigation, or an
    // unrelated action — worst case the balance is one request more stale
    // and gets retried on the very next call.
    console.error("Falha ao manter os lançamentos recorrentes", error);
  }
  return { userId: session.userId };
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return user;
});
