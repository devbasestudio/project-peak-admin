"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, writeAudit } from "@/lib/admin-db";

const uuid = z.string().uuid();

function slugify(value: string) {
  return value.toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function refreshExerciseSurfaces() {
  revalidatePath("/exercises");
  revalidatePath("/coaching/workouts");
  revalidatePath("/home-workout/templates");
}

export async function saveExerciseCategory(input: unknown) {
  const parsed = z.object({
    id: uuid.optional(),
    name: z.string().trim().min(1).max(80),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Category နာမည်ဖြည့်ပေးပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const row = { name: parsed.data.name, sort_order: parsed.data.sortOrder };
  const result = parsed.data.id
    ? await db.from("exercise_categories").update(row).eq("id", parsed.data.id).select("id").single()
    : await db.from("exercise_categories").insert(row).select("id").single();
  if (result.error || !result.data) return { ok: false, message: result.error?.code === "23505" ? "ဒီ Category ရှိပြီးသားပါ။" : "Category ကို သိမ်းမရပါ။" };
  await writeAudit(viewer.session.id, "exercise.category.save", "exercise_category", result.data.id);
  refreshExerciseSurfaces();
  return { ok: true, message: "Category သိမ်းပြီးပါပြီ။", categoryId: result.data.id };
}

export async function saveSharedExercise(input: unknown) {
  const parsed = z.object({
    id: uuid.optional(),
    categoryId: uuid,
    nameEn: z.string().trim().min(1).max(180),
    nameMm: z.string().trim().max(180).default(""),
    equipment: z.string().trim().max(180).default(""),
    cue: z.string().trim().max(1000).default(""),
    muscleGroup: z.string().trim().max(120).default(""),
    defaultSets: z.coerce.number().int().min(1).max(20),
    defaultRepsMin: z.coerce.number().int().min(0).max(999),
    defaultRepsMax: z.coerce.number().int().min(0).max(999),
    defaultRestSeconds: z.coerce.number().int().min(0).max(3600),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  }).superRefine((value, context) => {
    if (value.defaultRepsMax < value.defaultRepsMin) context.addIssue({ code: "custom", path: ["defaultRepsMax"], message: "Max reps must be at least min reps" });
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Exercise နာမည်၊ Category၊ Sets/Reps ကို ပြည့်စုံအောင်ဖြည့်ပါ။" };

  const viewer = await requireAdmin();
  const db = createAdminClient();
  let slug: string;
  if (parsed.data.id) {
    const existing = await db.from("shared_exercises").select("slug").eq("id", parsed.data.id).maybeSingle();
    if (existing.error || !existing.data) return { ok: false, message: "ပြင်မယ့် Exercise ကို ရှာမတွေ့ပါ။" };
    slug = existing.data.slug;
  } else {
    slug = slugify(parsed.data.nameEn);
    if (!slug) return { ok: false, message: "English exercise နာမည်ကို ပြည့်စုံအောင်ဖြည့်ပါ။" };
  }
  const row = {
    category_id: parsed.data.categoryId,
    slug,
    name_en: parsed.data.nameEn,
    name_mm: parsed.data.nameMm || parsed.data.nameEn,
    equipment_en: parsed.data.equipment || null,
    equipment_mm: parsed.data.equipment || null,
    cue_en: parsed.data.cue || null,
    cue_mm: parsed.data.cue || null,
    muscle_group: parsed.data.muscleGroup || null,
    default_sets: parsed.data.defaultSets,
    default_reps_min: parsed.data.defaultRepsMin,
    default_reps_max: parsed.data.defaultRepsMax,
    default_rest_seconds: parsed.data.defaultRestSeconds,
    sort_order: parsed.data.sortOrder,
  };
  const result = parsed.data.id
    ? await db.from("shared_exercises").update(row).eq("id", parsed.data.id).select("id").single()
    : await db.from("shared_exercises").insert(row).select("id").single();
  if (result.error || !result.data) return { ok: false, message: result.error?.code === "23505" ? "ဒီ Exercise ရှိပြီးသားပါ။" : "Exercise ကို သိမ်းမရပါ။" };
  await writeAudit(viewer.session.id, "exercise.shared.save", "shared_exercise", result.data.id);
  refreshExerciseSurfaces();
  return { ok: true, message: "Common Exercise Library ထဲသိမ်းပြီးပါပြီ။", exerciseId: result.data.id };
}
