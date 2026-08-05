import { verifyAdminSession } from "@/lib/admin-dal";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyAdminSession();
  return children;
}
