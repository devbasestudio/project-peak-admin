import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, getAuditActorId, writeAudit } from "@/lib/admin-db";
import { requireAdminSession } from "@/lib/session";
import { isAllowedOrigin } from "@/lib/security";
import { extensionFor, validatedUpload } from "@/lib/upload-validation";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const session = await requireAdminSession();
  const form = await request.formData();
  const file = form.get("file");
  const isBlog = form.get("intent") === "blog";
  const isSharedExerciseVideo = form.get("intent") === "shared-exercise-video";
  const sharedExerciseId = String(form.get("exerciseId") ?? "");
  const videoRole = String(form.get("role") ?? "");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sharedExerciseId);
  const maxBytes = isBlog ? 8 * 1024 * 1024 : 75 * 1024 * 1024;
  if (!(file instanceof File)) return NextResponse.json({ error: "တင်မယ့် file ရွေးပါ။" }, { status: 400 });
  if (isSharedExerciseVideo && (!isUuid || !["primary", "alternative"].includes(videoRole))) return NextResponse.json({ error: "Exercise သို့မဟုတ် Video အမျိုးအစား မမှန်ပါ။" }, { status: 400 });
  if (isSharedExerciseVideo && !file.type.startsWith("video/")) return NextResponse.json({ error: "MP4, WebM သို့မဟုတ် MOV video ပဲတင်ပေးပါ။" }, { status: 415 });
  const bytes = await validatedUpload(file, isBlog, maxBytes);
  if (!bytes) return NextResponse.json({ error: isBlog ? "JPG, PNG, WEBP ပုံကို 8MB အောက်တင်ပါ။" : "MP4, WebM, MOV, JPG, PNG, WEBP file ကို 75MB အောက်တင်ပါ။" }, { status: 415 });
  const actorId = await getAuditActorId();
  const extension = extensionFor(file.type);
  const objectPath = isBlog
    ? `blog/${randomUUID()}.${extension}`
    : isSharedExerciseVideo
      ? `shared-exercises/${sharedExerciseId}/${videoRole}/${randomUUID()}.${extension}`
      : `program-editor/${actorId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const db = createAdminClient();
  const bucket = isBlog ? "site-assets" : "program-media";
  const { error: uploadError } = await db.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const publicData = isBlog ? db.storage.from(bucket).getPublicUrl(objectPath).data : null;
  let assetId: string | undefined;
  if (!isBlog) {
    const { data: asset, error: assetError } = await db.from("media_assets").insert({ bucket_id: bucket, object_path: objectPath, kind: file.type.startsWith("video/") ? "video" : "image", mime_type: file.type, byte_size: file.size, uploaded_by: actorId }).select("id").single();
    if (assetError) { await db.storage.from(bucket).remove([objectPath]); return NextResponse.json({ error: assetError.message }, { status: 500 }); }
    assetId = asset.id;
    if (isSharedExerciseVideo) {
      const { data: exercise } = await db.from("shared_exercises").select("id").eq("id", sharedExerciseId).maybeSingle();
      if (!exercise) {
        await db.storage.from(bucket).remove([objectPath]);
        await db.from("media_assets").delete().eq("id", assetId);
        return NextResponse.json({ error: "Exercise မတွေ့ပါ။" }, { status: 404 });
      }
      const { error: linkError } = await db.from("shared_exercise_videos").upsert({
        exercise_id: sharedExerciseId,
        role: videoRole,
        asset_id: assetId,
      }, { onConflict: "exercise_id,role" });
      if (linkError) {
        await db.storage.from(bucket).remove([objectPath]);
        await db.from("media_assets").delete().eq("id", assetId);
        return NextResponse.json({ error: "Video ကို Exercise နဲ့ မချိတ်နိုင်ပါ။" }, { status: 500 });
      }
    }
  }
  await writeAudit(
    session.id,
    isBlog ? "blog.cover.upload" : isSharedExerciseVideo ? "exercise.video.upload" : "template.media.upload",
    "storage_object",
    objectPath,
    { mimeType: file.type, bytes: file.size, exerciseId: isSharedExerciseVideo ? sharedExerciseId : undefined, role: isSharedExerciseVideo ? videoRole : undefined },
  );
  return NextResponse.json({ url: isBlog ? publicData?.publicUrl : `/api/admin/media/${assetId}`, assetId, path: objectPath });
}
