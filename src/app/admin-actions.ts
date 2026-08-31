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
    const { data: requestedVersion, error: requestedError } = await supabase
      .from("template_versions")
      .select("id,template_id,status,version_no")
      .eq("id", payload.versionId)
      .eq("template_id", payload.templateId)
      .single();
    if (requestedError) throw requestedError;

    let versionId = requestedVersion.id as string;
    if (requestedVersion.status !== "draft") {
      const { data: latest } = await supabase
        .from("template_versions")
        .select("version_no")
        .eq("template_id", payload.templateId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: draft, error: draftError } = await supabase
        .from("template_versions")
        .insert({
          template_id: payload.templateId,
          version_no: (latest?.version_no ?? 0) + 1,
          status: "draft",
          name_mm: payload.nameMm,
          name_en: payload.nameEn,
          created_by: viewer.user.id,
        })
        .select("id")
        .single();
      if (draftError) throw draftError;
      versionId = draft.id;
    } else {
      const { error: versionError } = await supabase
        .from("template_versions")
        .update({ name_mm: payload.nameMm, name_en: payload.nameEn })
        .eq("id", versionId)
        .eq("status", "draft");
      if (versionError) throw versionError;
    }

    const { error: templateError } = await supabase
      .from("program_templates")
      .update({
        slug: payload.slug,
        name_mm: payload.nameMm,
        name_en: payload.nameEn,
        description_mm: payload.descriptionMm,
        description_en: payload.descriptionEn,
      })
      .eq("id", payload.templateId);
    if (templateError) throw templateError;

    const { error: deleteError } = await supabase
      .from("template_documents")
      .delete()
      .eq("template_version_id", versionId);
    if (deleteError) throw deleteError;

    const documentRows = payload.documents.map((document, index) => ({
      template_version_id: versionId,
      screen_key: document.screenKey,
      day_number: document.dayNumber,
      title_mm: document.titleMm,
      title_en: document.titleEn,
      position: index + 1,
    }));
    const { data: insertedDocuments, error: documentError } = await supabase
      .from("template_documents")
      .insert(documentRows)
      .select("id,position");
    if (documentError) throw documentError;

    const idByPosition = new Map((insertedDocuments ?? []).map((document) => [Number(document.position), document.id as string]));
    const blockRows = payload.documents.flatMap((document, documentIndex) => {
      const documentId = idByPosition.get(documentIndex + 1);
      if (!documentId) return [];
      return document.blocks.map((block, blockIndex) => ({
        document_id: documentId,
        parent_id: null,
        position: blockIndex + 1,
        block_type: block.blockType,
        title_mm: block.titleMm || null,
        title_en: block.titleEn || null,
        content_mm: block.contentMm,
        content_en: block.contentEn,
        config: block.config,
        visible: block.visible,
      }));
    });
    if (blockRows.length) {
      const { error: blocksError } = await supabase.from("template_blocks").insert(blockRows);
      if (blocksError) throw blocksError;
    }

    revalidatePath(adminPath(payload.locale, "/templates"));
    revalidatePath(adminPath(payload.locale, `/templates/${payload.templateId}`));
    await writeAudit(viewer.session.id, "template.draft.save", "program_template", payload.templateId, { versionId });
    return { ok: true, message: "Draft saved", templateId: payload.templateId, versionId };
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
    const { error: archiveError } = await supabase
      .from("template_versions")
      .update({ status: "archived" })
      .eq("template_id", parsed.data.templateId)
      .eq("status", "published")
      .neq("id", parsed.data.versionId);
    if (archiveError) throw archiveError;

    const { error: publishError } = await supabase
      .from("template_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", parsed.data.versionId)
      .eq("template_id", parsed.data.templateId)
      .eq("status", "draft");
    if (publishError) throw publishError;

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
      const { error } = await supabase
        .from("payment_orders")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          reviewed_by: viewer.user.id,
          review_note: parsed.data.reviewNote || null,
        })
        .eq("id", parsed.data.orderId)
        .in("status", ["awaiting_payment", "submitted"]);
      if (error) throw error;
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
    const { error } = await supabase.from("programs").update({ status: parsed.data.status }).eq("id", parsed.data.programId);
    if (error) throw error;
    revalidatePath(adminPath(parsed.data.locale, "/customers"));
    await writeAudit(viewer.session.id, "program.status.update", "program", parsed.data.programId, { status: parsed.data.status });
    return { ok: true, message: `Program ${parsed.data.status}` };
  } catch (error) {
    return { ok: false, message: cleanError(error) };
  }
}
