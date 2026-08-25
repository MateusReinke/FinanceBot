import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";

// The guide sits outside the app shell on purpose: no sidebar, no badges,
// nothing to click away into. Someone who has just signed up has no idea
// what any of those nav items mean yet, and a first screen with fourteen
// exits is a first screen nobody reads.
export default async function GuideLayout({ children }: { children: React.ReactNode }) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
