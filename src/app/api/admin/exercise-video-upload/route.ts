import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, getAuditActorId, writeAudit } from "@/lib/admin-db";
import { isAllowedOrigin } from "@/lib/security";
import { requireAdminSession } from "@/lib/session";

export const runtime = "nodejs";

const BUCKET = "program-media";
const MAX_VIDEO_BYTES = 75 * 1024 * 1024;
const VIDEO_ROLES = new Set(["primary", "alternative"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

type UploadPayload = {
  exerciseId?: unknown;
  role?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  byteSize?: unknown;
  path?: unknown;
};

function cleanMimeType(value: unknown, fileName: unknown) {
  const mimeType = typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : "";
  if (VIDEO_TYPES.has(mimeType)) return mimeType;
  const extension = typeof fileName === "string" ? fileName.trim().toLowerCase().split(".").pop() : "";
  if ((mimeType === "" || mimeType === "application/octet-stream" || mimeType === "video/x-m4v") && extension === "mov") return "video/quicktime";
  if ((mimeType === "" || mimeType === "application/octet-stream" || mimeType === "video/x-m4v") && ["mp4", "m4v"].includes(extension ?? "")) return "video/mp4";
  if ((mimeType === "" || mimeType === "application/octet-stream") && extension === "webm") return "video/webm";
  return null;
}

function validIdentity(payload: UploadPayload) {
  return typeof payload.exerciseId === "string"
    && UUID_PATTERN.test(payload.exerciseId)
    && typeof payload.role === "string"
    && VIDEO_ROLES.has(payload.role);
}

function expectedPrefix(exerciseId: string, role: string) {
  return `shared-exercises/${exerciseId}/${role}/`;
}

async function jsonPayload(request: Request) {
  return request.json().catch(() => null) as Promise<UploadPayload | null>;
}

async function removeObject(path: string) {
  await createAdminClient().storage.from(BUCKET).remove([path]);
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  await requireAdminSession();
  const payload = await jsonPayload(request);
  if (!payload || !validIdentity(payload)) return NextResponse.json({ error: "Exercise သို့မဟုတ် Video အမျိုးအစား မမှန်ပါ။" }, { status: 400 });
  if (typeof payload.byteSize !== "number" || !Number.isFinite(payload.byteSize) || payload.byteSize <= 0 || payload.byteSize > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video file ကို 75MB အောက်ရွေးပေးပါ။" }, { status: 400 });
  }
  const mimeType = cleanMimeType(payload.mimeType, payload.fileName);
  if (!mimeType) return NextResponse.json({ error: "MP4, WebM သို့မဟုတ် MOV video ပဲတင်ပေးပါ။" }, { status: 415 });

  const db = createAdminClient();
  const { data: exercise } = await db.from("shared_exercises").select("id").eq("id", payload.exerciseId).maybeSingle();
  if (!exercise) return NextResponse.json({ error: "Exercise မတွေ့ပါ။" }, { status: 404 });

  const extension = VIDEO_TYPES.get(mimeType)!;
  const path = `${expectedPrefix(payload.exerciseId as string, payload.role as string)}${randomUUID()}.${extension}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Video upload စတင်မရသေးပါ။ ခဏနေ ပြန်စမ်းပါ။" }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl, path, mimeType });
}

export async function PATCH(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const session = await requireAdminSession();
  const payload = await jsonPayload(request);
  if (!payload || !validIdentity(payload) || typeof payload.path !== "string") {
    return NextResponse.json({ error: "Video upload အချက်အလက် မပြည့်စုံပါ။" }, { status: 400 });
  }
  const mimeType = cleanMimeType(payload.mimeType, payload.fileName);
  const prefix = expectedPrefix(payload.exerciseId as string, payload.role as string);
  if (!mimeType || !payload.path.startsWith(prefix) || payload.path.includes("..")) {
    return NextResponse.json({ error: "Video upload path မမှန်ပါ။" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: stored, error: storedError } = await db.storage.from(BUCKET).info(payload.path);
  if (storedError || !stored) return NextResponse.json({ error: "တင်ထားတဲ့ Video ကို မတွေ့ပါ။ ပြန်ရွေးပေးပါ။" }, { status: 404 });
  if (!stored.size || stored.size > MAX_VIDEO_BYTES) {
    await removeObject(payload.path);
    return NextResponse.json({ error: "Video file ကို 75MB အောက်ရွေးပေးပါ။" }, { status: 400 });
  }

  const actorId = await getAuditActorId();
  const { data: currentLink } = await db.from("shared_exercise_videos")
    .select("asset_id")
    .eq("exercise_id", payload.exerciseId)
    .eq("role", payload.role)
    .maybeSingle();
  const { data: asset, error: assetError } = await db.from("media_assets").insert({
    bucket_id: BUCKET,
    object_path: payload.path,
    kind: "video",
    mime_type: mimeType,
    byte_size: stored.size,
    uploaded_by: actorId,
  }).select("id").single();
  if (assetError || !asset) {
    await removeObject(payload.path);
    return NextResponse.json({ error: "Video အချက်အလက်ကို မသိမ်းနိုင်သေးပါ။" }, { status: 500 });
  }

  const { error: linkError } = await db.from("shared_exercise_videos").upsert({
    exercise_id: payload.exerciseId,
    role: payload.role,
    asset_id: asset.id,
  }, { onConflict: "exercise_id,role" });
  if (linkError) {
    await db.from("media_assets").delete().eq("id", asset.id);
    await removeObject(payload.path);
    return NextResponse.json({ error: "Video ကို Exercise နဲ့ မချိတ်နိုင်ပါ။" }, { status: 500 });
  }

  if (currentLink?.asset_id && currentLink.asset_id !== asset.id) {
    const { data: previousAsset } = await db.from("media_assets").select("object_path").eq("id", currentLink.asset_id).maybeSingle();
    await db.from("media_assets").delete().eq("id", currentLink.asset_id);
    if (previousAsset?.object_path) await removeObject(previousAsset.object_path);
  }

  try {
    await writeAudit(session.id, "exercise.video.upload", "storage_object", payload.path, {
      mimeType,
      bytes: stored.size,
      exerciseId: payload.exerciseId,
      role: payload.role,
    });
  } catch (error) {
    console.error("exercise.video.upload audit write failed", error);
  }
  return NextResponse.json({ ok: true, assetId: asset.id, url: `/api/admin/media/${asset.id}` });
}

export async function DELETE(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  await requireAdminSession();
  const payload = await jsonPayload(request);
  if (!payload || !validIdentity(payload) || typeof payload.path !== "string") {
    return NextResponse.json({ error: "Invalid upload cleanup" }, { status: 400 });
  }
  if (!payload.path.startsWith(expectedPrefix(payload.exerciseId as string, payload.role as string)) || payload.path.includes("..")) {
    return NextResponse.json({ error: "Invalid upload cleanup" }, { status: 400 });
  }
  await removeObject(payload.path);
  return NextResponse.json({ ok: true });
}
