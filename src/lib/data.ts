import "server-only";
import { createAdminClient } from "@/lib/admin-db";
import { adminBlockTypes, type AdminBlockType, type AdminTemplate, type LocalizedBlockContent } from "@/components/admin/types";

function content(value: unknown): LocalizedBlockContent { return value && typeof value === "object" && !Array.isArray(value) ? value as LocalizedBlockContent : {}; }
function config(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function blockType(value: string): AdminBlockType { return adminBlockTypes.includes(value as AdminBlockType) ? value as AdminBlockType : "rich_text"; }
function groupByUser<T extends { user_id: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.user_id);
    if (group) group.push(row);
    else groups.set(row.user_id, [row]);
  }
  return groups;
}

export async function getCentralOverview() {
  const db = createAdminClient();
  const [customers, activePrograms, pendingPayments, templates, posts, publishedPosts, recentOrders, recentAudit] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("programs").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("payment_orders").select("id", { count: "exact", head: true }).in("status", ["awaiting_payment", "submitted"]),
    db.from("program_templates").select("id", { count: "exact", head: true }),
    db.from("blog_posts").select("id", { count: "exact", head: true }),
    db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    db.from("payment_orders").select("id,user_id,reference_code,status,amount_minor,currency,created_at").order("created_at", { ascending: false }).limit(5),
    db.from("admin_audit_log").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const errors = [customers.error, activePrograms.error, pendingPayments.error, templates.error, posts.error, publishedPosts.error, recentOrders.error, recentAudit.error].filter(Boolean);
  if (errors[0]) throw errors[0];
  const userIds = [...new Set((recentOrders.data ?? []).map((order) => order.user_id))];
  const { data: profiles } = userIds.length ? await db.from("profiles").select("id,display_name").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return {
    stats: { customers: customers.count ?? 0, activePrograms: activePrograms.count ?? 0, pendingPayments: pendingPayments.count ?? 0, templates: templates.count ?? 0, posts: posts.count ?? 0, publishedPosts: publishedPosts.count ?? 0 },
    recentOrders: (recentOrders.data ?? []).map((order) => ({ ...order, customerName: names.get(order.user_id) || "အမည်မရှိသေး" })),
    recentAudit: recentAudit.data ?? [],
  };
}

export async function getAdminCustomers() {
  const db = createAdminClient();
  const [profiles, programs, orders] = await Promise.all([
    db.from("profiles").select("id,display_name,preferred_locale,created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("programs").select("id,user_id,status,name_mm,name_en,assigned_at").order("assigned_at", { ascending: false }).limit(1000),
    db.from("payment_orders").select("id,user_id,status,reference_code,created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const firstError = [profiles.error, programs.error, orders.error].find(Boolean); if (firstError) throw firstError;
  const programByUser = new Map((programs.data ?? []).map((program) => [program.user_id, program]));
  const orderByUser = new Map((orders.data ?? []).map((order) => [order.user_id, order]));
  return (profiles.data ?? []).map((profile) => ({
    ...profile,
    program: programByUser.get(profile.id) ?? null,
    order: orderByUser.get(profile.id) ?? null,
  }));
}

export async function getAdminPayments() {
  const db = createAdminClient();
  const [orders, profiles, versions, templates, proofs] = await Promise.all([
    db.from("payment_orders").select("id,user_id,reference_code,status,amount_minor,currency,customer_note,submitted_at,approved_at,created_at").order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("id,display_name").limit(1000),
    db.from("template_versions").select("id,template_id,version_no,name_en,status").eq("status", "published").order("version_no", { ascending: false }),
    db.from("program_templates").select("id,name_en"),
    db.from("payment_proofs").select("id,order_id,storage_path,mime_type,created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const firstError = [orders.error, profiles.error, versions.error, templates.error, proofs.error].find(Boolean); if (firstError) throw firstError;
  const signedEntries = await Promise.all((proofs.data ?? []).map(async (proof) => {
    const { data } = await db.storage.from("payment-proofs").createSignedUrl(proof.storage_path, 900);
    return [proof.order_id, data?.signedUrl ?? null] as const;
  }));
  const proofUrls = new Map(signedEntries);
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const templateNames = new Map((templates.data ?? []).map((template) => [template.id, template.name_en]));
  return {
    orders: (orders.data ?? []).map((order) => ({ ...order, customerName: names.get(order.user_id) || "အမည်မရှိသေး", proofUrl: proofUrls.get(order.id) ?? null })),
    versions: (versions.data ?? []).map((version) => ({ id: version.id, label: `${version.name_en || templateNames.get(version.template_id) || "Program"} · v${version.version_no}` })),
  };
}

export async function getAdminTemplates() {
  const db = createAdminClient();
  const [templates, versions, documents] = await Promise.all([
    db.from("program_templates").select("id,slug,name_mm,name_en,description_mm,description_en,created_at,updated_at").order("updated_at", { ascending: false }),
    db.from("template_versions").select("id,template_id,version_no,status,published_at,updated_at").order("version_no", { ascending: false }),
    db.from("template_documents").select("id,template_version_id"),
  ]);
  const firstError = [templates.error, versions.error, documents.error].find(Boolean); if (firstError) throw firstError;
  return (templates.data ?? []).map((template) => { const latest = (versions.data ?? []).find((version) => version.template_id === template.id) ?? null; return { ...template, latest, documentCount: latest ? (documents.data ?? []).filter((document) => document.template_version_id === latest.id).length : 0 }; });
}

export async function getAdminTemplate(templateId: string): Promise<AdminTemplate | null> {
  const db = createAdminClient();
  const [{ data: template, error: templateError }, { data: versions, error: versionsError }] = await Promise.all([
    db.from("program_templates").select("id,slug,name_mm,name_en,description_mm,description_en").eq("id", templateId).maybeSingle(),
    db.from("template_versions").select("id,template_id,version_no,status").eq("template_id", templateId).order("version_no", { ascending: false }),
  ]);
  if (templateError || versionsError) throw templateError || versionsError; if (!template) return null;
  const version = (versions ?? []).find((item) => item.status === "draft") ?? (versions ?? []).find((item) => item.status === "published") ?? versions?.[0]; if (!version) return null;
  const { data: documents, error: documentError } = await db.from("template_documents").select("id,screen_key,day_number,title_mm,title_en,position").eq("template_version_id", version.id).order("position"); if (documentError) throw documentError;
  const documentIds = (documents ?? []).map((document) => document.id);
  const blocksResult = documentIds.length ? await db.from("template_blocks").select("id,document_id,position,block_type,title_mm,title_en,content_mm,content_en,config,visible").in("document_id", documentIds).order("position") : { data: [], error: null };
  if (blocksResult.error) throw blocksResult.error;
  return { id: template.id, slug: template.slug, nameMm: template.name_mm, nameEn: template.name_en, descriptionMm: template.description_mm ?? "", descriptionEn: template.description_en ?? "", versionId: version.id, versionStatus: version.status as AdminTemplate["versionStatus"], versionNo: version.version_no, documents: (documents ?? []).map((document) => ({ id: document.id, screenKey: document.screen_key, dayNumber: document.day_number, titleMm: document.title_mm, titleEn: document.title_en, blocks: (blocksResult.data ?? []).filter((block) => block.document_id === document.id).map((block) => ({ id: block.id, blockType: blockType(block.block_type), titleMm: block.title_mm ?? "", titleEn: block.title_en ?? "", contentMm: content(block.content_mm), contentEn: content(block.content_en), config: config(block.config), visible: block.visible !== false })) })) };
}

export async function getAdminTemplateExercises(templateId: string) {
  const db = createAdminClient();
  const { data: versions, error: versionError } = await db.from("template_versions").select("id,status,version_no").eq("template_id", templateId).order("version_no", { ascending: false });
  if (versionError) throw versionError;
  const version = (versions ?? []).find((item) => item.status === "draft") ?? (versions ?? []).find((item) => item.status === "published") ?? versions?.[0];
  if (!version) return { versionId: "", versionStatus: "draft", versionNo: 0, exercises: [] };
  const { data: exercises, error: exerciseError } = await db.from("template_exercises").select("id,slug,name_mm,name_en,position").eq("template_version_id", version.id).eq("is_assessment_only", false).order("position");
  if (exerciseError) throw exerciseError;
  const ids = (exercises ?? []).map((exercise) => exercise.id);
  const { data: videos, error: videoError } = ids.length ? await db.from("template_exercise_videos").select("id,template_exercise_id,asset_id,position,role,title_mm,title_en").in("template_exercise_id", ids).order("position") : { data: [], error: null };
  if (videoError) throw videoError;
  return {
    versionId: version.id,
    versionStatus: version.status,
    versionNo: version.version_no,
    exercises: (exercises ?? []).map((exercise) => ({
      id: exercise.id,
      slug: exercise.slug,
      nameMm: exercise.name_mm,
      nameEn: exercise.name_en,
      position: exercise.position,
      videos: (videos ?? []).filter((video) => video.template_exercise_id === exercise.id).map((video) => ({
        id: video.id,
        assetId: video.asset_id,
        position: video.position,
        role: video.role as "primary" | "alternative",
        titleMm: video.title_mm,
        titleEn: video.title_en,
        previewUrl: `/api/admin/media/${video.asset_id}`,
      })),
    })),
  };
}

export async function getCoachingOverview() {
  const db = createAdminClient();
  const [registrations, clients, trackers, checkins] = await Promise.all([
    db.from("coaching_registrations").select("id,name,email,payment_status,user_id,created_at").order("created_at", { ascending: false }).limit(8),
    db.from("coaching_profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    db.from("coaching_custom_tracker_templates").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("coaching_weekly_checkins").select("id", { count: "exact", head: true }),
  ]);
  const firstError = [registrations.error, clients.error, trackers.error, checkins.error].find(Boolean);
  if (firstError) throw firstError;
  const rows = registrations.data ?? [];
  return {
    stats: {
      clients: clients.count ?? 0,
      pending: rows.filter((row) => row.payment_status === "pending").length,
      ready: rows.filter((row) => row.payment_status === "ready").length,
      templates: trackers.count ?? 0,
      checkins: checkins.count ?? 0,
    },
    recent: rows,
  };
}

export async function getCoachingPayments() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("coaching_registrations")
    .select("id,user_id,name,email,program_name,program_price,duration_months,payment_status,payment_screenshot,created_at,approved_at,ready_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return await Promise.all((data ?? []).map(async (row) => {
    if (!row.payment_screenshot) return { ...row, payment_url: null };
    const { data: signed } = await db.storage.from("coaching-registrations").createSignedUrl(row.payment_screenshot, 900);
    return { ...row, payment_url: signed?.signedUrl ?? null };
  }));
}

export async function getCoachingClients() {
  const db = createAdminClient();
  const [profiles, registrations, programs, templates, logs, checkins] = await Promise.all([
    db.from("coaching_profiles").select("id,username,email,avatar_url,onboarding_complete,created_at").eq("role", "user").order("created_at", { ascending: false }),
    db.from("coaching_registrations").select("id,user_id,name,email,program_name,payment_status,created_at").order("created_at", { ascending: false }),
    db.from("coaching_programs").select("id,user_id,duration_weeks,start_date,program_type"),
    db.from("coaching_custom_tracker_templates").select("id,user_id,name,updated_at").eq("active", true),
    db.from("coaching_daily_trackers").select("id,user_id,date,body_weight,created_at").order("date", { ascending: false }).limit(3000),
    db.from("coaching_weekly_checkins").select("id,user_id,week_number,avg_weight,admin_feedback,created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const firstError = [profiles.error, registrations.error, programs.error, templates.error, logs.error, checkins.error].find(Boolean);
  if (firstError) throw firstError;
  const registrationByUser = new Map((registrations.data ?? []).filter((row) => row.user_id).map((row) => [row.user_id, row]));
  const programByUser = new Map((programs.data ?? []).map((row) => [row.user_id, row]));
  const templateByUser = new Map((templates.data ?? []).map((row) => [row.user_id, row]));
  const logsByUser = groupByUser(logs.data ?? []);
  const checkinsByUser = groupByUser(checkins.data ?? []);
  return (profiles.data ?? []).map((profile) => ({
    ...profile,
    registration: registrationByUser.get(profile.id) ?? null,
    program: programByUser.get(profile.id) ?? null,
    template: templateByUser.get(profile.id) ?? null,
    logs: logsByUser.get(profile.id) ?? [],
    checkins: checkinsByUser.get(profile.id) ?? [],
  }));
}

export async function getCoachingTemplateData() {
  const db = createAdminClient();
  const [profiles, registrations, templates] = await Promise.all([
    db.from("coaching_profiles").select("id,username,email,avatar_url").eq("role", "user").order("username"),
    db.from("coaching_registrations").select("user_id,name,email,payment_status").in("payment_status", ["approved", "ready"]),
    db.from("coaching_custom_tracker_templates").select("user_id,name,sections,updated_at").eq("active", true),
  ]);
  const firstError = [profiles.error, registrations.error, templates.error].find(Boolean);
  if (firstError) throw firstError;
  const registrationsByUser = new Map((registrations.data ?? []).filter((row) => row.user_id).map((row) => [row.user_id, row]));
  const clients = (profiles.data ?? []).filter((profile) => registrationsByUser.has(profile.id)).map((profile) => ({ ...profile, registration: registrationsByUser.get(profile.id) }));
  return { clients, templates: templates.data ?? [] };
}
