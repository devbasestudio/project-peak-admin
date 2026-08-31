import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin-db";
import { requestIp, sha256 } from "@/lib/security";
import { SESSION_COOKIE } from "@/lib/constants";

export { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";

export type AdminSession = {
  id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
};

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function getCurrentSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = createAdminClient();
  const { data, error } = await db.from("admin_device_sessions")
    .select("id,created_at,expires_at,last_seen_at")
    .eq("session_token_hash", sha256(token))
    .eq("active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  return data as AdminSession;
}

export async function requireAdminSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function touchSession(session: AdminSession) {
  if (Date.now() - new Date(session.last_seen_at).getTime() < 5 * 60_000) return;
  const headerStore = await headers();
  await createAdminClient().from("admin_device_sessions").update({
    last_seen_at: new Date().toISOString(),
    last_ip_hash: sha256(requestIp(headerStore)),
  }).eq("id", session.id).eq("active", true);
}
