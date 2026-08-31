import "server-only";
import { createAdminClient } from "@/lib/admin-db";

export async function createClient() { return createAdminClient(); }
