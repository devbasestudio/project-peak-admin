import "server-only";
import { getAuditActorId } from "@/lib/admin-db";
import { requireAdminSession } from "@/lib/session";

export async function requireAdmin(_locale?: unknown) {
  void _locale;
  const session = await requireAdminSession();
  const actorId = await getAuditActorId();
  return { session, user: { id: actorId } };
}
