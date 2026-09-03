import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const getAuditActorId = cache(async () => {
  const db = createAdminClient();
  const { data, error } = await db.rpc("central_admin_actor_id");
  if (error || !data) throw new Error("No Project Peak admin account is configured");
  return data as string;
});

export async function writeAudit(
  sessionId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  const db = createAdminClient();
  const { error } = await db.from("admin_audit_log").insert({
    actor_session_id: sessionId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata,
  });
  if (error) throw error;
}
