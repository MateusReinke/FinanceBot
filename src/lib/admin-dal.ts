import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

// The one gate for every admin route/action. Always re-reads role fresh
// from the DB — role is deliberately never carried in the session JWT
// (src/lib/session.ts), since a demoted admin's already-issued cookie could
// otherwise keep asserting admin for up to 30 days. cache()-scoped to one
// read per request, same discipline getCurrentUser() already uses.
//
// notFound(), not a redirect or 403: a non-admin hitting /admin should see
// exactly what they'd see for a route that doesn't exist, not a page that
// confirms an admin panel is there to attack.
//
// Every admin page.tsx and every action in src/app/actions/admin.ts calls
// this independently — a nested admin/layout.tsx alone is not enough,
// because Next renders layouts and pages in parallel with no happens-before
// guarantee between them (the same reason src/lib/dal.ts's verifySession
// itself is called from every page rather than trusted from a parent).
export const verifyAdminSession = cache(async () => {
  const { userId } = await verifySession();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "admin") notFound();

  return { userId };
});
