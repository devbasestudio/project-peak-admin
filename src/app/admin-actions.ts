"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin-db";
import { adminBlockTypes, type AdminActionResult } from "@/components/admin/types";

const localeSchema = z.custom<Locale>((value) => typeof value === "string" && isLocale(value));
const uuidSchema = z.string().uuid();
const slugSchema = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");
const jsonObjectSchema = z.record(z.string(), z.unknown());

const blockContentSchema = z.object({
  text: z.string().max(20_000).optional(),
  label: z.string().max(500).optional(),
  caption: z.string().max(2_000).optional(),
  alt: z.string().max(500).optional(),
  items: z.array(z.string().max(1_000)).max(100).optional(),
  question: z.string().max(5_000).optional(),
  options: z.array(z.string().max(1_000)).max(20).optional(),
  correctOption: z.number().int().min(0).max(19).optional(),
}).passthrough();

const templatePayloadSchema = z.object({
  locale: localeSchema,
  templateId: uuidSchema,
  versionId: uuidSchema,
  slug: slugSchema,
  nameMm: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionMm: z.string().max(4_000),
  descriptionEn: z.string().max(4_000),
  documents: z.array(z.object({
    id: z.string().min(1),
    screenKey: z.string().trim().min(1).max(100).regex(/^[a-z0-9_]+$/),
    dayNumber: z.number().int().min(1).max(48).nullable(),
    titleMm: z.string().trim().min(1).max(300),
    titleEn: z.string().trim().min(1).max(300),
    blocks: z.array(z.object({
      id: z.string().min(1),
      blockType: z.enum(adminBlockTypes),
      titleMm: z.string().max(1_000),
      titleEn: z.string().max(1_000),
      contentMm: blockContentSchema,
      contentEn: blockContentSchema,
      config: jsonObjectSchema,
      visible: z.boolean(),
    })).max(250),
  })).min(1).max(80),
});

const programStructurePayloadSchema = z.object({
  locale: localeSchema,
  templateId: uuidSchema,
  versionId: uuidSchema,
  days: z.array(z.object({
    dayNumber: z.number().int().min(1).max(48),
    dayType: z.enum(["push", "pull", "challenge"]),
    phase: z.union([z.literal(1), z.literal(2)]),
    titleMm: z.string().max(300),
    titleEn: z.string().max(300),
    items: z.array(z.object({
      exerciseSlug: z.string().trim().min(1).max(120),
      sets: z.number().int().min(1).max(20),
      repsMin: z.number().int().min(0).max(999),
      repsMax: z.number().int().min(0).max(999),
      targetKg: z.number().min(0).max(9999),
      restSeconds: z.number().int().min(0).max(3600),
    }).refine((item) => item.repsMax >= item.repsMin, "Maximum reps must be greater than or equal to minimum reps")).max(20),
  })).length(48),
}).superRefine((payload, context) => {
  const dayNumbers = new Set(payload.days.map((day) => day.dayNumber));
  if (dayNumbers.size !== 48) context.addIssue({ code: "custom", path: ["days"], message: "Sessions 1 through 48 must all be present" });
  for (const day of payload.days) {
    const slugs = new Set(day.items.map((item) => item.exerciseSlug));
    if (slugs.size !== day.items.length) context.addIssue({ code: "custom", path: ["days", day.dayNumber - 1, "items"], message: `Session ${day.dayNumber} has the same exercise more than once` });
  }
});

function cleanError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid form data";
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Something went wrong";
}

function adminPath(_locale: Locale, suffix = "") {
  return `/home-workout${suffix}`;
}

export async function createProgramTemplate(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const parsed = z.object({
    locale: localeSchema,
    slug: slugSchema,
    nameMm: z.string().trim().min(1).max(200),
    nameEn: z.string().trim().min(1).max(200),
    descriptionMm: z.string().max(4_000),
    descriptionEn: z.string().max(4_000),
  }).safeParse({
    locale: formData.get("locale"),
    slug: formData.get("slug"),
    nameMm: formData.get("nameMm"),
    nameEn: formData.get("nameEn"),
    descriptionMm: formData.get("descriptionMm") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
  });
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };

  const { locale, ...values } = parsed.data;
  const viewer = await requireAdmin(locale);
  const supabase = await createClient();

  try {
    const { data: template, error: templateError } = await supabase
      .from("program_templates")
      .insert({
        slug: values.slug,
        name_mm: values.nameMm,
        name_en: values.nameEn,
        description_mm: values.descriptionMm,
        description_en: values.descriptionEn,
        created_by: viewer.user.id,
      })
      .select("id")
      .single();
    if (templateError) throw templateError;

    const { data: version, error: versionError } = await supabase
      .from("template_versions")
      .insert({
        template_id: template.id,
        version_no: 1,
        status: "draft",
        name_mm: values.nameMm,
        name_en: values.nameEn,
        created_by: viewer.user.id,
      })
      .select("id")
      .single();
    if (versionError) throw versionError;

    const { data: document, error: documentError } = await supabase
      .from("template_documents")
      .insert({
        template_version_id: version.id,
        screen_key: "baseline",
        day_number: null,
        title_mm: "Baseline Test",
        title_en: "Baseline Test",
        position: 1,
      })
      .select("id")
      .single();
    if (documentError) throw documentError;

    const { error: blockError } = await supabase.from("template_blocks").insert({
      document_id: document.id,
      parent_id: null,
      position: 1,
      block_type: "heading",
      title_mm: "အစကို မှတ်ထားမယ်",
      title_en: "Record your starting point",
      content_mm: { text: "ဒီနေ့ရဲ့အခြေအနေကို မှတ်ထားပြီး ၁၂ ပတ်အကြာ ပြန်ယှဉ်မယ်" },
      content_en: { text: "Save today’s baseline and compare it again after 12 weeks." },
      config: { level: 1 },
      visible: true,
    });
    if (blockError) throw blockError;

    await writeAudit(viewer.session.id, "template.create", "program_template", template.id, { slug: values.slug });

    revalidatePath(adminPath(locale, "/templates"));
    return { ok: true, message: "Template created", templateId: template.id, versionId: version.id };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function saveTemplateDraft(rawPayload: unknown): Promise<AdminActionResult> {
  const parsed = templatePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };

  const payload = parsed.data;
  const viewer = await requireAdmin(payload.locale);
  const supabase = await createClient();

  try {
    const { data: versionId, error: saveError } = await supabase.rpc("save_template_draft", {
      p_template_id: payload.templateId,
      p_version_id: payload.versionId,
      p_slug: payload.slug,
      p_name_mm: payload.nameMm,
      p_name_en: payload.nameEn,
      p_description_mm: payload.descriptionMm,
      p_description_en: payload.descriptionEn,
      p_documents: payload.documents,
    });
    if (saveError) throw saveError;
    if (typeof versionId !== "string") throw new Error("Template draft was not saved");

    revalidatePath(adminPath(payload.locale, "/templates"));
    revalidatePath(adminPath(payload.locale, `/templates/${payload.templateId}`));
    await writeAudit(viewer.session.id, "template.draft.save", "program_template", payload.templateId, { versionId });
    return { ok: true, message: "Draft saved", templateId: payload.templateId, versionId };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function saveTemplateProgramStructure(rawPayload: unknown): Promise<AdminActionResult> {
  const parsed = programStructurePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };

  const payload = parsed.data;
  const viewer = await requireAdmin(payload.locale);
  const supabase = await createClient();

  try {
    const { data: versionId, error } = await supabase.rpc("save_template_program_structure", {
      p_template_id: payload.templateId,
      p_version_id: payload.versionId,
      p_days: payload.days,
    });
    if (error) throw error;
    if (typeof versionId !== "string") throw new Error("Program structure was not saved");

    await writeAudit(viewer.session.id, "template.program.save", "program_template", payload.templateId, {
      versionId,
      sessions: payload.days.length,
      exercises: payload.days.reduce((total, day) => total + day.items.length, 0),
    });
    revalidatePath(adminPath(payload.locale, "/templates"));
    revalidatePath(adminPath(payload.locale, `/templates/${payload.templateId}`));
    return { ok: true, message: "Program အစီအစဉ် သိမ်းပြီးပါပြီ", templateId: payload.templateId, versionId };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function saveExerciseVideoVariant(rawPayload: unknown): Promise<AdminActionResult> {
  const parsed = z.object({
    templateId: uuidSchema,
    versionId: uuidSchema,
    exerciseSlug: z.string().min(1).max(120),
    role: z.enum(["primary", "alternative"]),
    assetId: uuidSchema,
    locale: localeSchema,
  }).safeParse(rawPayload);
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };
  const viewer = await requireAdmin(parsed.data.locale);
  const supabase = await createClient();

  try {
    const { data: requestedVersion, error: versionError } = await supabase
      .from("template_versions")
      .select("id,status,template_id")
      .eq("id", parsed.data.versionId)
      .eq("template_id", parsed.data.templateId)
      .single();
    if (versionError) throw versionError;
    let versionId = requestedVersion.id as string;
    if (requestedVersion.status !== "draft") {
      const { data: clonedId, error: cloneError } = await supabase.rpc("clone_template_version", { p_source_version_id: versionId });
      if (cloneError) throw cloneError;
      versionId = clonedId as string;
    }

    const { data: exercise, error: exerciseError } = await supabase
      .from("template_exercises")
      .select("id")
      .eq("template_version_id", versionId)
      .eq("slug", parsed.data.exerciseSlug)
      .single();
    if (exerciseError) throw exerciseError;
    const isAlternative = parsed.data.role === "alternative";
    const { error: saveError } = await supabase.from("template_exercise_videos").upsert({
      template_exercise_id: exercise.id,
      position: isAlternative ? 2 : 1,
      role: parsed.data.role,
      asset_id: parsed.data.assetId,
      title_mm: isAlternative ? "အစားထိုးနည်း" : "အဓိကနည်း",
      title_en: isAlternative ? "Alternative movement" : "Main movement",
      cue_mm: isAlternative ? "အဓိကနည်း အဆင်မပြေရင် ဒီနည်းကို ရွေးနိုင်ပါတယ်။" : "Form ကိုကြည့်ပြီး Set မစခင် လေ့လာပါ။",
      cue_en: isAlternative ? "Choose this when the main movement is not comfortable." : "Review the form before your first set.",
    }, { onConflict: "template_exercise_id,role" });
    if (saveError) throw saveError;

    await writeAudit(viewer.session.id, "template.exercise_video.save", "program_template", parsed.data.templateId, { versionId, exerciseSlug: parsed.data.exerciseSlug, role: parsed.data.role });
    revalidatePath(`/home-workout/templates/${parsed.data.templateId}`);
    return { ok: true, message: isAlternative ? "အစားထိုး Video သိမ်းပြီးပြီ" : "အဓိက Video သိမ်းပြီးပြီ", templateId: parsed.data.templateId, versionId };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function publishTemplateVersion(
  templateId: string,
  versionId: string,
  locale: Locale,
): Promise<AdminActionResult> {
  const parsed = z.object({ templateId: uuidSchema, versionId: uuidSchema, locale: localeSchema }).safeParse({ templateId, versionId, locale });
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };
  const viewer = await requireAdmin(parsed.data.locale);
  const supabase = await createClient();

  try {
    const { data: publishedId, error: publishError } = await supabase.rpc("publish_template_version_atomic", {
      p_template_id: parsed.data.templateId,
      p_version_id: parsed.data.versionId,
    });
    if (publishError) throw publishError;
    if (publishedId !== parsed.data.versionId) throw new Error("Template version was not published");

    revalidatePath(adminPath(parsed.data.locale, "/templates"));
    revalidatePath(adminPath(parsed.data.locale, `/templates/${parsed.data.templateId}`));
    await writeAudit(viewer.session.id, "template.publish", "program_template", parsed.data.templateId, { versionId: parsed.data.versionId });
    return { ok: true, message: "Version published" };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function reviewPaymentOrder(
  orderId: string,
  decision: "approve" | "reject",
  templateVersionId: string | null,
  reviewNote: string,
  locale: Locale,
): Promise<AdminActionResult> {
  const parsed = z.object({
    orderId: uuidSchema,
    decision: z.enum(["approve", "reject"]),
    templateVersionId: uuidSchema.nullable(),
    reviewNote: z.string().trim().max(2_000),
    locale: localeSchema,
  }).safeParse({ orderId, decision, templateVersionId, reviewNote, locale });
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };
  const viewer = await requireAdmin(parsed.data.locale);
  const supabase = await createClient();

  try {
    if (parsed.data.decision === "approve") {
      const rpcArgs: { p_order_id: string; p_template_version_id?: string } = { p_order_id: parsed.data.orderId };
      if (parsed.data.templateVersionId) rpcArgs.p_template_version_id = parsed.data.templateVersionId;
      const { error } = await supabase.rpc("approve_payment_order", rpcArgs);
      if (error) throw error;
    } else {
      const { data: rejectedId, error } = await supabase.rpc("reject_payment_order_atomic", {
        p_order_id: parsed.data.orderId,
        p_reviewer_id: viewer.user.id,
        p_note: parsed.data.reviewNote || null,
      });
      if (error) throw error;
      if (rejectedId !== parsed.data.orderId) throw new Error("Payment order was not rejected");
    }

    revalidatePath(adminPath(parsed.data.locale));
    revalidatePath(adminPath(parsed.data.locale, "/payments"));
    revalidatePath(adminPath(parsed.data.locale, "/customers"));
    await writeAudit(viewer.session.id, `payment.${parsed.data.decision}`, "payment_order", parsed.data.orderId, { templateVersionId: parsed.data.templateVersionId });
    return { ok: true, message: parsed.data.decision === "approve" ? "Payment approved and program assigned" : "Payment rejected" };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}

export async function updateProgramStatus(
  programId: string,
  status: "active" | "paused" | "completed",
  locale: Locale,
): Promise<AdminActionResult> {
  const parsed = z.object({ programId: uuidSchema, status: z.enum(["active", "paused", "completed"]), locale: localeSchema }).safeParse({ programId, status, locale });
  if (!parsed.success) return { ok: false, message: cleanError(parsed.error) };
  const viewer = await requireAdmin(parsed.data.locale);
  const supabase = await createClient();
  try {
    const { data: updatedId, error } = await supabase.rpc("update_program_status_strict", {
      p_program_id: parsed.data.programId,
      p_status: parsed.data.status,
    });
    if (error) throw error;
    if (updatedId !== parsed.data.programId) throw new Error("Program status was not updated");
    revalidatePath(adminPath(parsed.data.locale, "/customers"));
    await writeAudit(viewer.session.id, "program.status.update", "program", parsed.data.programId, { status: parsed.data.status });
    return { ok: true, message: `Program ${parsed.data.status}` };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}
