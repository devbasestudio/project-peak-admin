"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, writeAudit } from "@/lib/admin-db";

const sectionSchema = z.array(z.object({
  title: z.enum(["Morning", "Mid-day", "Night"]), icon: z.string().max(80),
  fields: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().trim().min(1).max(180), type: z.enum(["number", "time", "select", "checkbox", "counter", "text", "photo"]), icon: z.string().max(80), fixed: z.boolean().optional(), options: z.array(z.string().trim().min(1).max(100)).max(20).optional() })).max(50),
})).length(3);

export async function reviewCoachingPayment(formData: FormData) {
  const parsed = z.object({ registrationId: z.coerce.number().int().positive(), decision: z.enum(["approve", "reject"]) }).safeParse({ registrationId: formData.get("registrationId"), decision: formData.get("decision") });
  if (!parsed.success) throw new Error("Payment action မမှန်ပါ");
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { data: registration, error } = await db.from("coaching_registrations").select("*").eq("id", parsed.data.registrationId).single();
  if (error) throw error;
  if (!registration.user_id) throw new Error("Google user account မရှိသေးပါ");

  const now = new Date().toISOString();
  if (parsed.data.decision === "reject") {
    const { error: rejectError } = await db.from("coaching_registrations").update({ payment_status: "rejected", status: "rejected", updated_at: now }).eq("id", registration.id);
    if (rejectError) throw rejectError;
  } else {
    const intake = registration.intake_answers && typeof registration.intake_answers === "object" && !Array.isArray(registration.intake_answers)
      ? registration.intake_answers as Record<string, unknown>
      : {};
    if (intake.payment_confirmed !== true) throw new Error("Client က payment ပြီးကြောင်း အတည်မပြုရသေးပါ");
    if (!registration.photo_front || !registration.photo_back || !registration.photo_side) throw new Error("Body photos သုံးပုံ မပြည့်သေးပါ");
    const { error: profileError } = await db.from("coaching_profiles").update({ role: "user", updated_at: now }).eq("id", registration.user_id);
    if (profileError) throw profileError;
    const { error: programError } = await db.from("coaching_programs").upsert({ user_id: registration.user_id, duration_weeks: 12, program_type: "personal_coaching", start_date: now.slice(0, 10), updated_at: now }, { onConflict: "user_id" });
    if (programError) throw programError;
    const { error: approveError } = await db.from("coaching_registrations").update({ payment_status: "approved", status: "approved", approved_at: now, updated_at: now }).eq("id", registration.id);
    if (approveError) throw approveError;
  }
  await writeAudit(viewer.session.id, `coaching.payment.${parsed.data.decision}`, "coaching_registration", String(registration.id));
  revalidatePath("/coaching/payments"); revalidatePath("/coaching/clients"); revalidatePath("/coaching/overview");
}

export async function saveCoachingTemplate(input: unknown) {
  const parsed = z.object({ userId: z.string().uuid(), name: z.string().trim().min(1).max(180), sections: sectionSchema, markReady: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Template data မမှန်ပါ" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await db.from("coaching_custom_tracker_templates").upsert({ user_id: parsed.data.userId, name: parsed.data.name, sections: parsed.data.sections, active: true, updated_at: now }, { onConflict: "user_id" });
  if (error) {
    console.error("Coaching template save failed", error.code);
    return { ok: false, message: "Template save မအောင်မြင်ပါ။ ပြန်စမ်းကြည့်ပါ။" };
  }
  if (parsed.data.markReady) {
    const { data: registration, error: registrationError } = await db.from("coaching_registrations").select("id,payment_status").eq("user_id", parsed.data.userId).maybeSingle();
    if (registrationError) {
      console.error("Coaching registration lookup failed", registrationError.code);
      return { ok: false, message: "Client access စစ်မရပါ။ ပြန်စမ်းကြည့်ပါ။" };
    }
    if (!registration || !["approved", "ready"].includes(registration.payment_status)) return { ok: false, message: "Payment approve အရင်လုပ်ပေးပါ" };
    const { error: profileError } = await db.from("coaching_profiles").update({ onboarding_complete: true, updated_at: now }).eq("id", parsed.data.userId);
    if (profileError) {
      console.error("Coaching profile activation failed", profileError.code);
      return { ok: false, message: "Client dashboard ဖွင့်မရပါ။ ပြန်စမ်းကြည့်ပါ။" };
    }
    const { error: readyError } = await db.from("coaching_registrations").update({ payment_status: "ready", status: "ready", ready_at: now, updated_at: now }).eq("id", registration.id);
    if (readyError) {
      console.error("Coaching registration activation failed", readyError.code);
      return { ok: false, message: "Client access ready မလုပ်နိုင်ပါ။ ပြန်စမ်းကြည့်ပါ။" };
    }
  }
  await writeAudit(viewer.session.id, parsed.data.markReady ? "coaching.template.ready" : "coaching.template.save", "coaching_profile", parsed.data.userId);
  revalidatePath("/coaching/templates"); revalidatePath("/coaching/clients"); revalidatePath("/coaching/overview");
  return { ok: true, message: parsed.data.markReady ? "Template save ပြီး client စသုံးနိုင်ပါပြီ" : "အပြောင်းအလဲ သိမ်းပြီးပါပြီ" };
}

const workoutExerciseSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  libraryExerciseId: z.string().uuid(),
  exerciseName: z.string().trim().min(1).max(180),
  targetSets: z.coerce.number().int().min(1).max(20),
  targetReps: z.string().trim().min(1).max(40),
  restSeconds: z.coerce.number().int().min(0).max(3600),
});

export async function saveCoachingWorkout(input: unknown) {
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    userId: z.string().uuid(),
    date: z.iso.date(),
    splitName: z.string().trim().min(1).max(120),
    exercises: z.array(workoutExerciseSchema).min(1).max(30),
  }).superRefine((value, context) => {
    const names = value.exercises.map((exercise) => exercise.exerciseName.toLocaleLowerCase());
    if (new Set(names).size !== names.length) context.addIssue({ code: "custom", path: ["exercises"], message: "Exercise တစ်ခုကို ထပ်မထည့်ပါနဲ့" });
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Client၊ ရက်စွဲနဲ့ exercise အချက်အလက် ပြည့်စုံအောင်ဖြည့်ပေးပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const requestedExerciseIds = [...new Set(parsed.data.exercises.map((exercise) => exercise.libraryExerciseId))];
  const { data: libraryRows, error: libraryError } = await db.from("shared_exercises")
    .select("id,name_en")
    .in("id", requestedExerciseIds);
  if (libraryError || (libraryRows ?? []).length !== requestedExerciseIds.length) return { ok: false, message: "Common Library ထဲက Exercise ကို ပြန်ရွေးပေးပါ။" };
  const libraryNameById = new Map((libraryRows ?? []).map((exercise) => [exercise.id, exercise.name_en]));
  let workoutId = parsed.data.id;
  if (workoutId) {
    const { data, error } = await db.from("coaching_workouts")
      .update({ user_id: parsed.data.userId, date: parsed.data.date, split_name: parsed.data.splitName })
      .eq("id", workoutId).select("id").single();
    if (error || !data) return { ok: false, message: "Workout session ကို update မလုပ်နိုင်ပါ။" };
  } else {
    const { data, error } = await db.from("coaching_workouts")
      .insert({ user_id: parsed.data.userId, date: parsed.data.date, split_name: parsed.data.splitName, completed: false })
      .select("id").single();
    if (error || !data) return { ok: false, message: "Workout session အသစ် မသိမ်းနိုင်ပါ။" };
    workoutId = data.id;
  }
  const existing = await db.from("coaching_workout_exercises").select("id").eq("workout_id", workoutId);
  if (existing.error) return { ok: false, message: "လက်ရှိ exercise တွေကို ဖတ်မရပါ။" };
  const keptIds: number[] = [];
  for (const exercise of parsed.data.exercises) {
    if (exercise.id) {
      const { error } = await db.from("coaching_workout_exercises").update({
        shared_exercise_id: exercise.libraryExerciseId,
        exercise_name: libraryNameById.get(exercise.libraryExerciseId),
        target_sets: exercise.targetSets,
        target_reps: exercise.targetReps,
        rest_seconds: exercise.restSeconds,
      }).eq("id", exercise.id).eq("workout_id", workoutId);
      if (error) return { ok: false, message: `${exercise.exerciseName} ကို update မလုပ်နိုင်ပါ။` };
      keptIds.push(exercise.id);
    } else {
      const { data, error } = await db.from("coaching_workout_exercises").insert({
        workout_id: workoutId,
        shared_exercise_id: exercise.libraryExerciseId,
        exercise_name: libraryNameById.get(exercise.libraryExerciseId),
        target_sets: exercise.targetSets,
        target_reps: exercise.targetReps,
        rest_seconds: exercise.restSeconds,
      }).select("id").single();
      if (error || !data) return { ok: false, message: `${exercise.exerciseName} ကို မသိမ်းနိုင်ပါ။` };
      keptIds.push(data.id);
    }
  }
  const removed = (existing.data ?? []).map((row) => row.id).filter((id) => !keptIds.includes(id));
  if (removed.length) {
    const { error } = await db.from("coaching_workout_exercises").delete().in("id", removed).eq("workout_id", workoutId);
    if (error) return { ok: false, message: "ဖယ်ထားတဲ့ exercise ကို update မလုပ်နိုင်ပါ။" };
  }
  await writeAudit(viewer.session.id, "coaching.workout.save", "coaching_workout", String(workoutId), { userId: parsed.data.userId, date: parsed.data.date });
  revalidatePath("/coaching/workouts");
  revalidatePath(`/coaching/clients/${parsed.data.userId}`);
  return { ok: true, message: "Workout plan သိမ်းပြီးပါပြီ။ Client app မှာ ဒီရက်အတွက်ပြပါမယ်။", workoutId };
}

export async function duplicateCoachingWorkout(input: unknown) {
  const parsed = z.object({ workoutId: z.coerce.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ပွားမယ့် Session ကို ပြန်ရွေးပေးပါ။" };

  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.rpc("clone_coaching_workout_to_next_week", {
    p_source_workout_id: parsed.data.workoutId,
  });
  if (error) {
    if (error.code === "55000") return { ok: false, message: "Client ဆော့ပြီးသွားတဲ့ Session ကိုပဲ နောက်အပတ်ပွားနိုင်ပါတယ်။" };
    if (error.code === "23505") return { ok: false, message: "နောက်အပတ် ဒီရက်မှာ Session ရှိပြီးသားပါ။" };
    console.error("Coaching workout clone failed", error.code);
    return { ok: false, message: "Session ကို နောက်အပတ် မပွားနိုင်သေးပါ။" };
  }

  const cloned = Array.isArray(data) ? data[0] : null;
  if (!cloned?.workout_id || !cloned?.workout_date) return { ok: false, message: "ပွားထားတဲ့ Session ကို ပြန်ဖတ်မရသေးပါ။" };
  const { data: clonedExercises, error: clonedExercisesError } = await db.from("coaching_workout_exercises")
    .select("id,shared_exercise_id,exercise_name,target_sets,target_reps,rest_seconds")
    .eq("workout_id", cloned.workout_id)
    .order("id");
  if (clonedExercisesError) {
    console.error("Cloned coaching exercises lookup failed", clonedExercisesError.code);
    return { ok: false, message: "Session ပွားပြီးပေမယ့် Exercise တွေကို ပြန်ဖတ်မရသေးပါ။ Page ကို refresh လုပ်ပေးပါ။" };
  }
  await writeAudit(viewer.session.id, "coaching.workout.clone_next_week", "coaching_workout", String(cloned.workout_id), {
    sourceWorkoutId: parsed.data.workoutId,
    targetDate: cloned.workout_date,
  });
  revalidatePath("/coaching/workouts");
  return {
    ok: true,
    message: `${cloned.workout_date} ရက်အတွက် Session ပွားပြီးပါပြီ။`,
    workoutId: cloned.workout_id as number,
    date: cloned.workout_date as string,
    exercises: clonedExercises ?? [],
  };
}

export async function saveCoachingMeal(input: unknown) {
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    userId: z.string().uuid(),
    programType: z.literal("personal_coaching"),
    mealType: z.enum(["breakfast", "lunch", "snack", "dinner", "evening"]),
    planDate: z.iso.date(),
    foodName: z.string().trim().min(1).max(180),
    foodNameMm: z.string().trim().max(180).default(""),
    portion: z.string().trim().max(180).default(""),
    calories: z.coerce.number().int().min(0).max(10000),
    protein: z.coerce.number().min(0).max(1000),
    carbs: z.coerce.number().min(0).max(1000),
    fat: z.coerce.number().min(0).max(1000),
    benefits: z.string().trim().max(1000).default(""),
    sortOrder: z.coerce.number().int().min(0).max(999),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Meal အချက်အလက်ကို ပြည့်စုံအောင်ဖြည့်ပေးပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const row = {
    user_id: parsed.data.userId,
    program_type: parsed.data.programType, meal_type: parsed.data.mealType,
    plan_date: parsed.data.planDate,
    food_name: parsed.data.foodName, food_name_mm: parsed.data.foodNameMm || null,
    portion: parsed.data.portion || null, calories: parsed.data.calories,
    protein_g: parsed.data.protein, carbs_g: parsed.data.carbs, fat_g: parsed.data.fat,
    benefits_text: parsed.data.benefits || null, sort_order: parsed.data.sortOrder,
  };
  const result = parsed.data.id
    ? await db.from("coaching_nutrition_items").update(row).eq("id", parsed.data.id).eq("user_id", parsed.data.userId).select("id").single()
    : await db.from("coaching_nutrition_items").insert(row).select("id").single();
  if (result.error || !result.data) return { ok: false, message: "Meal ကို သိမ်းမရပါ။ ပြန်စမ်းပေးပါ။" };
  await writeAudit(viewer.session.id, "coaching.meal.save", "coaching_nutrition_item", String(result.data.id));
  revalidatePath("/coaching/meals");
  return { ok: true, message: "Meal plan သိမ်းပြီးပါပြီ။ Client app မှာပြန်ပေါ်ပါမယ်။", mealId: result.data.id };
}

export async function duplicateCoachingMealDay(input: unknown) {
  const parsed = z.object({
    userId: z.string().uuid(),
    sourceDate: z.iso.date(),
    targetDate: z.iso.date(),
  }).refine((value) => value.sourceDate !== value.targetDate, { message: "Source and target date must differ" }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ပွားမယ့်ရက်နဲ့ ထည့်မယ့်ရက်ကို မှန်အောင်ရွေးပေးပါ။" };

  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { data: source, error: sourceError } = await db.from("coaching_nutrition_items")
    .select("program_type,meal_type,plan_date,food_name,food_name_mm,portion,calories,protein_g,carbs_g,fat_g,benefits_text,sort_order")
    .eq("user_id", parsed.data.userId)
    .eq("program_type", "personal_coaching")
    .or(`plan_date.eq.${parsed.data.sourceDate},plan_date.is.null`)
    .order("sort_order")
    .order("id");
  if (sourceError) return { ok: false, message: "လက်ရှိရက် Meal Plan ကို ဖတ်မရပါ။" };
  if (!source?.length) return { ok: false, message: "ဒီရက်မှာ ပွားစရာ Meal မရှိသေးပါ။ အရင်ဆုံး Meal တစ်ခုသိမ်းပေးပါ။" };
  const activeSource = (["breakfast", "lunch", "snack", "dinner", "evening"] as const).flatMap((mealType) => {
    const dated = source.filter((item) => item.meal_type === mealType && item.plan_date === parsed.data.sourceDate);
    return dated.length ? dated : source.filter((item) => item.meal_type === mealType && !item.plan_date);
  });

  const { count, error: targetError } = await db.from("coaching_nutrition_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", parsed.data.userId)
    .eq("program_type", "personal_coaching")
    .eq("plan_date", parsed.data.targetDate);
  if (targetError) return { ok: false, message: "ထည့်မယ့်ရက်ကို စစ်မရပါ။" };
  if ((count ?? 0) > 0) return { ok: false, message: "ထည့်မယ့်ရက်မှာ Meal Plan ရှိပြီးသားပါ။ မပျက်စေရန် ပွားခြင်းကို ရပ်ထားပါတယ်။" };

  const rows = activeSource.map((item) => ({ ...item, user_id: parsed.data.userId, plan_date: parsed.data.targetDate }));
  const { error } = await db.from("coaching_nutrition_items").insert(rows);
  if (error) return { ok: false, message: "Meal Plan ကို ရက်အသစ်ဆီ မပွားနိုင်သေးပါ။" };

  await writeAudit(viewer.session.id, "coaching.meal_day.duplicate", "coaching_profile", parsed.data.userId, {
    sourceDate: parsed.data.sourceDate,
    targetDate: parsed.data.targetDate,
    itemCount: rows.length,
  });
  revalidatePath("/coaching/meals");
  return { ok: true, message: `${parsed.data.targetDate} ရက်အတွက် Meal ${rows.length} ခု ပွားပြီးပါပြီ။` };
}

export async function deleteCoachingMeal(input: unknown) {
  const parsed = z.object({ id: z.coerce.number().int().positive(), userId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ဖျက်မယ့် meal မမှန်ပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("coaching_nutrition_items").delete().eq("id", parsed.data.id).eq("user_id", parsed.data.userId);
  if (error) return { ok: false, message: "Meal ကို ဖျက်မရပါ။ အသုံးပြုပြီးသား log ရှိနိုင်ပါတယ်။" };
  await writeAudit(viewer.session.id, "coaching.meal.delete", "coaching_nutrition_item", String(parsed.data.id));
  revalidatePath("/coaching/meals");
  return { ok: true, message: "Meal ကို ဖယ်ပြီးပါပြီ။" };
}

const feedbackFieldSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(1).max(240),
  type: z.enum(["short_text", "long_text", "number", "rating", "yes_no", "image"]),
  required: z.boolean().default(false),
});

export async function saveCoachingFeedbackTemplate(input: unknown) {
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(160),
    cadence: z.enum(["weekly", "end"]),
    active: z.boolean(),
    fields: z.array(feedbackFieldSchema).min(1).max(20).refine(
      (fields) => new Set(fields.map((field) => field.key)).size === fields.length,
      "Duplicate field keys are not allowed",
    ),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Form name နဲ့ မေးခွန်းစာသားတွေ ပြည့်စုံအောင်ဖြည့်ပေးပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const row = { name: parsed.data.name, cadence: parsed.data.cadence, active: parsed.data.active, fields: parsed.data.fields, updated_at: new Date().toISOString() };
  const result = parsed.data.id
    ? await db.from("coaching_feedback_form_templates").update(row).eq("id", parsed.data.id).select("id").single()
    : await db.from("coaching_feedback_form_templates").insert(row).select("id").single();
  if (result.error || !result.data) return { ok: false, message: "Feedback form ကို သိမ်းမရပါ။" };
  await writeAudit(viewer.session.id, "coaching.feedback_template.save", "coaching_feedback_form_template", String(result.data.id));
  revalidatePath("/coaching/feedback-forms");
  return { ok: true, message: "Feedback form သိမ်းပြီးပါပြီ။", templateId: result.data.id };
}
