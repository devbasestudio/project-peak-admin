import "server-only";
import { createAdminClient } from "@/lib/admin-db";
import { type AdminProgramStructure } from "@/components/admin/types";
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
  const [templates, versions] = await Promise.all([
    db.from("program_templates").select("id,slug,name_mm,name_en,description_mm,description_en,created_at,updated_at").order("updated_at", { ascending: false }),
    db.from("template_versions").select("id,template_id,version_no,status,published_at,updated_at").order("version_no", { ascending: false }),
  ]);
  const firstError = [templates.error, versions.error].find(Boolean); if (firstError) throw firstError;
  return (templates.data ?? []).map((template) => ({
    ...template,
    latest: (versions.data ?? []).find((version) => version.template_id === template.id) ?? null,
  }));
}

export async function getAdminTemplateHeader(templateId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("program_templates").select("id,name_mm,name_en").eq("id", templateId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, nameMm: data.name_mm, nameEn: data.name_en } : null;
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

export async function getAdminTemplateProgram(templateId: string): Promise<AdminProgramStructure | null> {
  const db = createAdminClient();
  const { data: versions, error: versionError } = await db
    .from("template_versions")
    .select("id,status,version_no")
    .eq("template_id", templateId)
    .order("version_no", { ascending: false });
  if (versionError) throw versionError;
  const version = (versions ?? []).find((item) => item.status === "draft")
    ?? (versions ?? []).find((item) => item.status === "published")
    ?? versions?.[0];
  if (!version) return null;

  const [exerciseResult, dayResult] = await Promise.all([
    db.from("template_exercises")
      .select("id,slug,name_mm,name_en,cue_mm,cue_en,equipment_mm,equipment_en,position")
      .eq("template_version_id", version.id)
      .eq("is_assessment_only", false)
      .order("position"),
    db.from("template_days")
      .select("id,day_number,day_type,phase,title_mm,title_en")
      .eq("template_version_id", version.id)
      .order("day_number"),
  ]);
  if (exerciseResult.error || dayResult.error) throw exerciseResult.error || dayResult.error;

  const dayIds = (dayResult.data ?? []).map((day) => day.id);
  const itemResult = dayIds.length
    ? await db.from("template_day_items")
      .select("id,template_day_id,template_exercise_id,position,sets,reps_min,reps_max,target_kg,rest_seconds")
      .in("template_day_id", dayIds)
      .order("position")
    : { data: [], error: null };
  if (itemResult.error) throw itemResult.error;

  const exercises = (exerciseResult.data ?? []).map((exercise) => ({
    id: exercise.id,
    slug: exercise.slug,
    nameMm: exercise.name_mm,
    nameEn: exercise.name_en,
    cueMm: exercise.cue_mm ?? "",
    cueEn: exercise.cue_en ?? "",
    equipmentMm: exercise.equipment_mm ?? "",
    equipmentEn: exercise.equipment_en ?? "",
    position: exercise.position,
  }));
  const exerciseSlugById = new Map(exercises.map((exercise) => [exercise.id, exercise.slug]));

  return {
    templateId,
    versionId: version.id,
    versionStatus: version.status as AdminProgramStructure["versionStatus"],
    versionNo: version.version_no,
    exercises,
    days: (dayResult.data ?? []).map((day) => ({
      id: day.id,
      dayNumber: day.day_number,
      dayType: day.day_type as AdminProgramStructure["days"][number]["dayType"],
      phase: day.phase === 2 ? 2 : 1,
      titleMm: day.title_mm ?? "",
      titleEn: day.title_en ?? "",
      items: (itemResult.data ?? []).filter((item) => item.template_day_id === day.id).map((item) => ({
        id: item.id,
        exerciseSlug: exerciseSlugById.get(item.template_exercise_id) ?? "",
        sets: item.sets,
        repsMin: item.reps_min,
        repsMax: item.reps_max,
        targetKg: Number(item.target_kg),
        restSeconds: item.rest_seconds,
      })).filter((item) => item.exerciseSlug),
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
    .select("id,user_id,name,email,phone,age,height,weight,program_name,program_price,duration_months,payment_method,payment_status,photo_front,photo_back,photo_side,intake_answers,created_at,approved_at,ready_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const privatePaths = [...new Set(rows.flatMap((row) => (["front", "back", "side"] as const).map((slot) => {
    const value = row[`photo_${slot}`];
    if (!value || value.startsWith("http://") || value.startsWith("https://")) return null;
    const path = value.startsWith("private:") ? value.slice("private:".length) : value;
    return path && !path.startsWith("/") && !path.includes("..") ? path : null;
  })).filter((path): path is string => path !== null))];
  const signedByPath = new Map<string, string>();
  if (privatePaths.length) {
    const { data: signedRows } = await db.storage.from("coaching-user-photos").createSignedUrls(privatePaths, 900);
    for (const signed of signedRows ?? []) {
      if (signed.path && signed.signedUrl) signedByPath.set(signed.path, signed.signedUrl);
    }
  }
  return rows.map((row) => {
    const photoEntries = (["front", "back", "side"] as const).map((slot) => {
      const value = row[`photo_${slot}`];
      if (!value) return [slot, null] as const;
      if (value.startsWith("http://") || value.startsWith("https://")) return [slot, value] as const;
      const path = value.startsWith("private:") ? value.slice("private:".length) : value;
      if (!path || path.startsWith("/") || path.includes("..")) return [slot, null] as const;
      return [slot, signedByPath.get(path) ?? null] as const;
    });
    return { ...row, photo_urls: Object.fromEntries(photoEntries) as Record<"front" | "back" | "side", string | null> };
  });
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
