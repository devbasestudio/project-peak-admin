import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, getAuditActorId, writeAudit } from "@/lib/admin-db";
import { requireAdminSession } from "@/lib/session";

const allowed = new Set(["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await requireAdminSession();
  const form = await request.formData();
  const file = form.get("file");
  const isBlog = form.get("intent") === "blog";
  const maxBytes = isBlog ? 8 * 1024 * 1024 : 75 * 1024 * 1024;
  if (!(file instanceof File)) return NextResponse.json({ error: "တင်မယ့် file ရွေးပါ။" }, { status: 400 });
  if (!allowed.has(file.type) || (isBlog && file.type.startsWith("video/"))) return NextResponse.json({ error: isBlog ? "JPG, PNG, WEBP ပဲ တင်နိုင်ပါတယ်။" : "MP4, WebM, MOV, JPG, PNG, WEBP ပဲ တင်နိုင်ပါတယ်။" }, { status: 415 });
  if (file.size <= 0 || file.size > maxBytes) return NextResponse.json({ error: `File ကို ${isBlog ? "8" : "75"}MB အောက်ထားပါ။` }, { status: 413 });
  const actorId = await getAuditActorId();
  const extension = (file.name.split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "jpg")).replace(/[^a-z0-9]/gi, "").toLowerCase();
  const objectPath = isBlog ? `blog/${randomUUID()}.${extension}` : `program-editor/${actorId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const db = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await db.storage.from("site-assets").upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data: publicData } = db.storage.from("site-assets").getPublicUrl(objectPath);
  let assetId: string | undefined;
  if (!isBlog) {
    const { data: asset, error: assetError } = await db.from("media_assets").insert({ bucket_id: "site-assets", object_path: objectPath, kind: file.type.startsWith("video/") ? "video" : "image", mime_type: file.type, byte_size: file.size, uploaded_by: actorId }).select("id").single();
    if (assetError) { await db.storage.from("site-assets").remove([objectPath]); return NextResponse.json({ error: assetError.message }, { status: 500 }); }
    assetId = asset.id;
  }
  await writeAudit(session.id, isBlog ? "blog.cover.upload" : "template.media.upload", "storage_object", objectPath, { mimeType: file.type, bytes: file.size });
  return NextResponse.json({ url: publicData.publicUrl, assetId, path: objectPath });
}
