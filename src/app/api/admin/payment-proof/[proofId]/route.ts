import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/session";
import { createAdminClient } from "@/lib/admin-db";

export async function GET(_request: Request, { params }: { params: Promise<{ proofId: string }> }) {
  await requireAdminSession();
  const { proofId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(proofId)) return NextResponse.json({ error: "Invalid proof" }, { status: 400 });
  const db = createAdminClient();
  const { data: proof, error } = await db.from("payment_proofs").select("storage_path").eq("id", proofId).maybeSingle();
  if (error || !proof) return NextResponse.json({ error: "Proof unavailable" }, { status: 404 });
  const { data, error: signError } = await db.storage.from("payment-proofs").createSignedUrl(proof.storage_path, 300);
  if (signError || !data) return NextResponse.json({ error: "Proof unavailable" }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
