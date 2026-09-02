import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin-db";
import { requireAdminSession } from "@/lib/session";

const forwardedHeaders = ["accept-ranges", "content-length", "content-range", "content-type", "etag", "last-modified"];

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  await requireAdminSession();
  const { assetId } = await params;
  const db = createAdminClient();
  const { data: asset } = await db
    .from("media_assets")
    .select("bucket_id,object_path,mime_type")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.bucket_id !== "program-media") {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  const { data, error } = await db.storage.from(asset.bucket_id).createSignedUrl(asset.object_path, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not open media" }, { status: 500 });
  }

  try {
    const range = request.headers.get("range");
    const upstream = await fetch(data.signedUrl, {
      cache: "no-store",
      headers: range ? { Range: range } : undefined,
      signal: request.signal,
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Media file is unavailable" }, { status: upstream.status === 404 ? 404 : 502 });
    }

    const headers = new Headers();
    for (const name of forwardedHeaders) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("content-type") && asset.mime_type) headers.set("content-type", asset.mime_type);
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", "inline");
    headers.set("x-content-type-options", "nosniff");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "Media stream could not be opened" }, { status: 502 });
  }
}
