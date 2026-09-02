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
  const isCoachingExercise = form.get("intent") === "coaching-exercise";
  const exerciseId = Number(form.get("exerciseId"));
  const maxBytes = isBlog ? 8 * 1024 * 1024 : 75 * 1024 * 1024;
  if (!(file instanceof File)) return NextResponse.json({ error: "တင်မယ့် file ရွေးပါ။" }, { status: 400 });
  if (isCoachingExercise && (!Number.isInteger(exerciseId) || exerciseId <= 0)) return NextResponse.json({ error: "Exercise မမှန်ပါ။" }, { status: 400 });
  if (isCoachingExercise && !file.type.startsWith("video/")) return NextResponse.json({ error: "MP4, WebM သို့မဟုတ် MOV video ပဲတင်ပေးပါ။" }, { status: 415 });
  const bytes = await validatedUpload(file, isBlog, maxBytes);
  if (!bytes) return NextResponse.json({ error: isBlog ? "JPG, PNG, WEBP ပုံကို 8MB အောက်တင်ပါ။" : "MP4, WebM, MOV, JPG, PNG, WEBP file ကို 75MB အောက်တင်ပါ။" }, { status: 415 });
  const actorId = await getAuditActorId();
  const extension = extensionFor(file.type);
  const objectPath = isBlog
    ? `blog/${randomUUID()}.${extension}`
    : isCoachingExercise
      ? `exercise-videos/${exerciseId}/${randomUUID()}.${extension}`
      : `program-editor/${actorId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const db = createAdminClient();
  const bucket = isBlog ? "site-assets" : isCoachingExercise ? "coaching-program-assets" : "program-media";
  const { error: uploadError } = await db.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const publicData = isBlog || isCoachingExercise ? db.storage.from(bucket).getPublicUrl(objectPath).data : null;
  let assetId: string | undefined;
  if (isCoachingExercise) {
    const { data: exercise, error: exerciseError } = await db.from("coaching_exercise_library")
      .update({ form_video_url: publicData?.publicUrl ?? null })
      .eq("id", exerciseId)
      .select("id")
      .single();
    if (exerciseError || !exercise) {
      await db.storage.from(bucket).remove([objectPath]);
      return NextResponse.json({ error: "Exercise video ကို database နဲ့ မချိတ်နိုင်ပါ။" }, { status: 500 });
    }
  } else if (!isBlog) {
    const { data: asset, error: assetError } = await db.from("media_assets").insert({ bucket_id: bucket, object_path: objectPath, kind: file.type.startsWith("video/") ? "video" : "image", mime_type: file.type, byte_size: file.size, uploaded_by: actorId }).select("id").single();
    if (assetError) { await db.storage.from(bucket).remove([objectPath]); return NextResponse.json({ error: assetError.message }, { status: 500 }); }
    assetId = asset.id;
  }
  await writeAudit(session.id, isBlog ? "blog.cover.upload" : isCoachingExercise ? "coaching.exercise_video.upload" : "template.media.upload", "storage_object", objectPath, { mimeType: file.type, bytes: file.size, exerciseId: isCoachingExercise ? exerciseId : undefined });
  return NextResponse.json({ url: isBlog || isCoachingExercise ? publicData?.publicUrl : `/api/admin/media/${assetId}`, assetId, path: objectPath });
}
