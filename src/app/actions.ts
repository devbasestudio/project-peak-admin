"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/admin-db";
import { SESSION_COOKIE } from "@/lib/session";
import { sha256 } from "@/lib/security";

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await createAdminClient().from("admin_device_sessions").update({
      active: false,
      revoked_at: new Date().toISOString(),
    }).eq("session_token_hash", sha256(token)).eq("active", true);
  }
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
