import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin-db";
import { requireAdminSession } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  await requireAdminSession();
  const { assetId } = await params;
  const db = createAdminClient();
  const { data: asset } = await db
    .from("media_assets")
    .select("bucket_id,object_path")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.bucket_id !== "program-media") {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  const { data, error } = await db.storage.from(asset.bucket_id).createSignedUrl(asset.object_path, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not open media" }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
