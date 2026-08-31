import { requireAdminSession, touchSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  await touchSession(session);
  return <DashboardShell sessionStarted={session.created_at}>{children}</DashboardShell>;
}
