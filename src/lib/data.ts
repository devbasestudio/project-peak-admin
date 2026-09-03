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

  const [templateExerciseResult, sharedExerciseResult, categoryResult, dayResult] = await Promise.all([
    db.from("template_exercises")
      .select("id,slug,name_mm,name_en,cue_mm,cue_en,equipment_mm,equipment_en,position")
      .eq("template_version_id", version.id)
      .eq("is_assessment_only", false)
      .order("position"),
    db.from("shared_exercises")
      .select("id,category_id,slug,name_mm,name_en,cue_mm,cue_en,equipment_mm,equipment_en,default_sets,default_reps_min,default_reps_max,default_rest_seconds,sort_order")
      .order("sort_order")
      .order("name_en"),
    db.from("exercise_categories").select("id,name,sort_order").order("sort_order").order("name"),
    db.from("template_days")
      .select("id,day_number,day_type,phase,title_mm,title_en")
      .eq("template_version_id", version.id)
      .order("day_number"),
  ]);
  const firstError = [templateExerciseResult.error, sharedExerciseResult.error, categoryResult.error, dayResult.error].find(Boolean);
  if (firstError) throw firstError;

  const dayIds = (dayResult.data ?? []).map((day) => day.id);
  const itemResult = dayIds.length
    ? await db.from("template_day_items")
      .select("id,template_day_id,template_exercise_id,position,sets,reps_min,reps_max,target_kg,rest_seconds")
      .in("template_day_id", dayIds)
      .order("position")
    : { data: [], error: null };
  if (itemResult.error) throw itemResult.error;

  const categoryNameById = new Map((categoryResult.data ?? []).map((category) => [category.id, category.name]));
  const exercises = (sharedExerciseResult.data ?? []).map((exercise) => ({
    id: exercise.id,
    slug: exercise.slug,
    nameMm: exercise.name_mm,
    nameEn: exercise.name_en,
    cueMm: exercise.cue_mm ?? "",
    cueEn: exercise.cue_en ?? "",
    equipmentMm: exercise.equipment_mm ?? "",
    equipmentEn: exercise.equipment_en ?? "",
    position: exercise.sort_order,
    categoryName: categoryNameById.get(exercise.category_id) ?? "General",
    defaultSets: exercise.default_sets,
    defaultRepsMin: exercise.default_reps_min,
    defaultRepsMax: exercise.default_reps_max,
    defaultRestSeconds: exercise.default_rest_seconds,
  }));
  const exerciseSlugById = new Map((templateExerciseResult.data ?? []).map((exercise) => [exercise.id, exercise.slug]));

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

function privateCoachingPath(value: string | null | undefined) {
  if (!value || value.startsWith("http://") || value.startsWith("https://")) return null;
  const path = value.startsWith("private:") ? value.slice("private:".length) : value;
  return path && !path.startsWith("/") && !path.includes("..") ? path : null;
}

export async function getCoachingClientProgress(clientId: string) {
  const db = createAdminClient();
  const [profile, registration, program, template, trackers, checkins, bodyProfile, schedule, workouts, journals, nutritionLogs] = await Promise.all([
    db.from("coaching_profiles").select("id,username,email,avatar_url,onboarding_complete,created_at").eq("id", clientId).eq("role", "user").maybeSingle(),
    db.from("coaching_registrations").select("id,user_id,name,email,phone,age,height,weight,program_name,payment_status,intake_answers,photo_front,photo_back,photo_side,created_at,approved_at,ready_at").eq("user_id", clientId).maybeSingle(),
    db.from("coaching_programs").select("id,user_id,duration_weeks,target_calories,macros_p,macros_c,macros_f,program_type,start_date,created_at,updated_at").eq("user_id", clientId).maybeSingle(),
    db.from("coaching_custom_tracker_templates").select("id,user_id,name,sections,active,created_at,updated_at").eq("user_id", clientId).eq("active", true).maybeSingle(),
    db.from("coaching_daily_trackers").select("id,user_id,date,body_weight,steps,sleep_score,water_3l,omega_3,bed_phone_filter,meal_plan_adhered,toilet,phone_off_time,water_liters,wake_time,one_win,one_struggle,tracker_values,created_at").eq("user_id", clientId).order("date", { ascending: false }).limit(180),
    db.from("coaching_weekly_checkins").select("id,user_id,week_number,avg_weight,progress_photo_url,energy_workout,energy_workout_notes,energy_daily,energy_daily_notes,motivation,motivation_notes,struggle_notes,improvement_notes,upcoming_disruptions,changes_wanted,admin_feedback,created_at").eq("user_id", clientId).order("week_number", { ascending: false }).limit(52),
    db.from("coaching_user_profiles").select("id,user_id,height_cm,starting_weight,age,body_fat_percent,desired_body_text,created_at,updated_at").eq("user_id", clientId).maybeSingle(),
    db.from("coaching_weekly_schedule").select("id,user_id,day_of_week,split_name,is_rest").eq("user_id", clientId).order("day_of_week"),
    db.from("coaching_workouts").select("id,user_id,date,split_name,completed,user_notes,user_feelings,created_at").eq("user_id", clientId).order("date", { ascending: false }).limit(180),
    db.from("coaching_journaling").select("id,user_id,date,diet_status,satisfied_with,difficult_with,created_at").eq("user_id", clientId).order("date", { ascending: false }).limit(60),
    db.from("coaching_nutrition_logs").select("id,user_id,date,nutrition_item_id,completed,created_at,coaching_nutrition_items(id,meal_type,food_name,food_name_mm,portion,calories,protein_g,carbs_g,fat_g)").eq("user_id", clientId).order("date", { ascending: false }).limit(1000),
  ]);
  const firstError = [profile.error, registration.error, program.error, template.error, trackers.error, checkins.error, bodyProfile.error, schedule.error, workouts.error, journals.error, nutritionLogs.error].find(Boolean);
  if (firstError) throw firstError;
  if (!profile.data) return null;

  const workoutIds = (workouts.data ?? []).map((workout) => workout.id);
  const { data: exercises, error: exerciseError } = workoutIds.length
    ? await db.from("coaching_workout_exercises").select("id,workout_id,exercise_name,target_sets,target_reps,actual_weight,actual_reps").in("workout_id", workoutIds)
    : { data: [], error: null };
  if (exerciseError) throw exerciseError;

  const rawPhotos = [
    registration.data?.photo_front,
    registration.data?.photo_back,
    registration.data?.photo_side,
    ...(checkins.data ?? []).map((checkin) => checkin.progress_photo_url),
  ];
  const privatePaths = [...new Set(rawPhotos.map(privateCoachingPath).filter((path): path is string => Boolean(path)))];
  const signedByPath = new Map<string, string>();
  if (privatePaths.length) {
    const { data: signedRows } = await db.storage.from("coaching-user-photos").createSignedUrls(privatePaths, 900);
    for (const signed of signedRows ?? []) if (signed.path && signed.signedUrl) signedByPath.set(signed.path, signed.signedUrl);
  }
  const photoUrl = (value: string | null | undefined) => {
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    const path = privateCoachingPath(value);
    return path ? signedByPath.get(path) ?? null : null;
  };

  const exercisesByWorkout = new Map<number, typeof exercises>();
  for (const exercise of exercises ?? []) {
    const group = exercisesByWorkout.get(exercise.workout_id) ?? [];
    group.push(exercise);
    exercisesByWorkout.set(exercise.workout_id, group);
  }

  return {
    generatedAt: new Date().toISOString(),
    profile: profile.data,
    registration: registration.data ? {
      ...registration.data,
      photos: {
        front: photoUrl(registration.data.photo_front),
        back: photoUrl(registration.data.photo_back),
        side: photoUrl(registration.data.photo_side),
      },
    } : null,
    program: program.data,
    template: template.data,
    bodyProfile: bodyProfile.data,
    schedule: schedule.data ?? [],
    trackers: trackers.data ?? [],
    checkins: (checkins.data ?? []).map((checkin) => ({ ...checkin, progressPhotoUrl: photoUrl(checkin.progress_photo_url) })),
    workouts: (workouts.data ?? []).map((workout) => ({ ...workout, exercises: exercisesByWorkout.get(workout.id) ?? [] })),
    journals: journals.data ?? [],
    nutritionLogs: nutritionLogs.data ?? [],
  };
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

async function getEditableCoachingClients() {
  const db = createAdminClient();
  const [profiles, registrations, programs] = await Promise.all([
    db.from("coaching_profiles").select("id,username,email,avatar_url").eq("role", "user").order("username"),
    db.from("coaching_registrations").select("user_id,name,payment_status").in("payment_status", ["approved", "ready"]),
    db.from("coaching_programs").select("user_id,program_type,start_date,duration_weeks"),
  ]);
  const firstError = [profiles.error, registrations.error, programs.error].find(Boolean);
  if (firstError) throw firstError;
  const registrationByUser = new Map((registrations.data ?? []).filter((row) => row.user_id).map((row) => [row.user_id, row]));
  const programByUser = new Map((programs.data ?? []).map((row) => [row.user_id, row]));
  return (profiles.data ?? []).filter((profile) => registrationByUser.has(profile.id)).map((profile) => ({
    ...profile,
    registration: registrationByUser.get(profile.id) ?? null,
    program: programByUser.get(profile.id) ?? null,
  }));
}

export async function getCoachingWorkoutManagerData() {
  const db = createAdminClient();
  const [clients, workouts, library, categories] = await Promise.all([
    getEditableCoachingClients(),
    db.from("coaching_workouts")
      .select("id,user_id,date,split_name,completed,user_notes,user_feelings,created_at")
      .order("date", { ascending: false })
      .limit(1000),
    db.from("shared_exercises")
      .select("id,category_id,slug,name_mm,name_en,muscle_group,default_sets,default_reps_min,default_reps_max,default_rest_seconds,sort_order")
      .order("sort_order")
      .order("name_en"),
    db.from("exercise_categories").select("id,name,sort_order").order("sort_order"),
  ]);
  const firstError = [workouts.error, library.error, categories.error].find(Boolean);
  if (firstError) throw firstError;
  const workoutIds = (workouts.data ?? []).map((row) => row.id);
  const exercises = workoutIds.length
    ? await db.from("coaching_workout_exercises")
      .select("id,workout_id,exercise_name,target_sets,target_reps,actual_weight,actual_reps")
      .in("workout_id", workoutIds)
      .order("id")
    : { data: [], error: null };
  if (exercises.error) throw exercises.error;
  const exerciseByWorkout = new Map<number, typeof exercises.data>();
  for (const exercise of exercises.data ?? []) {
    const rows = exerciseByWorkout.get(exercise.workout_id) ?? [];
    rows.push(exercise);
    exerciseByWorkout.set(exercise.workout_id, rows);
  }
  return {
    clients,
    workouts: (workouts.data ?? []).map((workout) => ({ ...workout, exercises: exerciseByWorkout.get(workout.id) ?? [] })),
    library: (library.data ?? []).map((exercise) => ({
      ...exercise,
      category_name: (categories.data ?? []).find((category) => category.id === exercise.category_id)?.name ?? "General",
    })),
  };
}

export async function getSharedExerciseLibraryData() {
  const db = createAdminClient();
  const [categories, exercises, videos] = await Promise.all([
    db.from("exercise_categories").select("id,name,sort_order").order("sort_order").order("name"),
    db.from("shared_exercises").select("id,category_id,slug,name_mm,name_en,cue_mm,cue_en,equipment_mm,equipment_en,muscle_group,default_sets,default_reps_min,default_reps_max,default_rest_seconds,unilateral,sort_order").order("sort_order").order("name_en"),
    db.from("shared_exercise_videos").select("id,exercise_id,role,asset_id").order("role"),
  ]);
  const firstError = [categories.error, exercises.error, videos.error].find(Boolean);
  if (firstError) throw firstError;
  return {
    categories: categories.data ?? [],
    exercises: (exercises.data ?? []).map((exercise) => ({
      ...exercise,
      videos: (videos.data ?? []).filter((video) => video.exercise_id === exercise.id).map((video) => ({
        ...video,
        preview_url: `/api/admin/media/${video.asset_id}`,
      })),
    })),
  };
}

export async function getCoachingMealManagerData() {
  const db = createAdminClient();
  const [items, programs] = await Promise.all([
    db.from("coaching_nutrition_items")
      .select("id,program_type,meal_type,food_name,food_name_mm,portion,calories,protein_g,carbs_g,fat_g,benefits_text,sort_order")
      .order("sort_order")
      .order("id"),
    db.from("coaching_programs").select("program_type"),
  ]);
  const firstError = [items.error, programs.error].find(Boolean);
  if (firstError) throw firstError;
  const programTypes = [...new Set(["personal_coaching", ...(programs.data ?? []).map((row) => row.program_type).filter(Boolean)])];
  return { items: items.data ?? [], programTypes };
}

export async function getCoachingFeedbackManagerData() {
  const db = createAdminClient();
  const { data, error } = await db.from("coaching_feedback_form_templates")
    .select("id,name,cadence,fields,active,updated_at")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
