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
  const { error } = await db.rpc("admin_review_coaching_payment_atomic", {
    p_registration_id: parsed.data.registrationId, p_decision: parsed.data.decision,
  });
  if (error) throw new Error("Payment update မအောင်မြင်ပါ။ အချက်အလက်စစ်ပြီး ပြန်စမ်းပါ။");
  await writeAudit(viewer.session.id, `coaching.payment.${parsed.data.decision}`, "coaching_registration", String(parsed.data.registrationId)).catch(() => console.error("Payment audit write failed"));
  revalidatePath("/coaching/payments"); revalidatePath("/coaching/clients"); revalidatePath("/coaching/overview");
}

export async function saveCoachingTemplate(input: unknown) {
  const parsed = z.object({ userId: z.string().uuid(), name: z.string().trim().min(1).max(180), sections: sectionSchema, markReady: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Template data မမှန်ပါ" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.rpc("admin_save_coaching_template_atomic", {
    p_user_id: parsed.data.userId, p_name: parsed.data.name,
    p_sections: parsed.data.sections, p_mark_ready: parsed.data.markReady,
  });
  if (error) {
    console.error("Coaching template save failed", error.code);
    return { ok: false, message: error.code === "55000" ? "Payment approve အရင်လုပ်ပေးပါ" : "Template save မအောင်မြင်ပါ။ ပြန်စမ်းကြည့်ပါ။" };
  }
  await writeAudit(viewer.session.id, parsed.data.markReady ? "coaching.template.ready" : "coaching.template.save", "coaching_profile", parsed.data.userId).catch(() => console.error("Template audit write failed"));
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
    requestId: z.string().uuid().optional(),
    id: z.coerce.number().int().positive().optional(),
    userId: z.string().uuid(),
    date: z.iso.date(),
    targetDates: z.array(z.iso.date()).max(30).default([]),
    splitName: z.string().trim().min(1).max(120),
    exercises: z.array(workoutExerciseSchema).min(1).max(30),
  }).superRefine((value, context) => {
    const names = value.exercises.map((exercise) => exercise.exerciseName.toLocaleLowerCase());
    if (new Set(names).size !== names.length) context.addIssue({ code: "custom", path: ["exercises"], message: "Exercise တစ်ခုကို ထပ်မထည့်ပါနဲ့" });
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Client၊ ရက်စွဲနဲ့ exercise အချက်အလက် ပြည့်စုံအောင်ဖြည့်ပေးပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_save_coaching_workout_atomic", {
    p_input: { ...parsed.data, requestId: parsed.data.requestId ?? crypto.randomUUID() },
  });
  if (error) return { ok: false, message: error.code === "23505"
    ? "ရွေးထားတဲ့ရက်မှာ Workout ရှိပြီးသားပါ။ ဘာမှ overwrite မလုပ်ထားပါ။"
    : "Workout မသိမ်းနိုင်ပါ။ ပြီးသား Session သို့မဟုတ် မှတ်တမ်းရှိတဲ့ Exercise ကိုပြင်မထားပါ။ ပြန်စစ်ပေးပါ။" };
  const workoutId = Number(data.workoutId);
  await writeAudit(viewer.session.id, "coaching.workout.save", "coaching_workout", String(workoutId), { userId: parsed.data.userId, date: parsed.data.date })
    .catch(() => console.error("Workout audit write failed"));
  revalidatePath("/coaching/workouts");
  revalidatePath(`/coaching/clients/${parsed.data.userId}`);
  return { ok: true, message: `${data.count} ရက်အတွက် Workout သိမ်းပြီးပါပြီ။`, workoutId };
}

export async function assignCoachingWorkoutToDates(input: unknown) {
  const parsed = z.object({
    requestId: z.string().uuid().optional(),
    workoutId: z.coerce.number().int().positive(),
    targetDates: z.array(z.iso.date()).min(1).max(31),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ထည့်မယ့်ရက်တွေကို ပြန်ရွေးပေးပါ။" };

  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { data: source, error: sourceError } = await db.from("coaching_workouts")
    .select("id,user_id,date,split_name")
    .eq("id", parsed.data.workoutId)
    .single();
  if (sourceError || !source) return { ok: false, message: "Source Workout ကို ပြန်ဖတ်မရပါ။" };
  const targetDates = [...new Set(parsed.data.targetDates)].filter((date) => date !== source.date).sort();
  if (!targetDates.length) return { ok: false, message: "Source ရက်မဟုတ်တဲ့ တခြားရက်တစ်ရက်အနည်းဆုံးရွေးပါ။" };

  const { data: sourceExercises, error: exerciseError } = await db.from("coaching_workout_exercises")
    .select("shared_exercise_id,exercise_name,target_sets,target_reps,rest_seconds").eq("workout_id", source.id).order("id");
  if (exerciseError || !sourceExercises?.length || sourceExercises.some((e) => !e.shared_exercise_id)) {
    return { ok: false, message: "Source Workout ရဲ့ Exercise တွေကို Common Library နဲ့ ချိတ်ပေးပါ။" };
  }
  const { data, error } = await db.rpc("admin_save_coaching_workout_atomic", { p_input: {
    requestId: parsed.data.requestId ?? crypto.randomUUID(), userId: source.user_id,
    date: targetDates[0], targetDates: targetDates.slice(1), strictDates: true, splitName: source.split_name,
    exercises: sourceExercises.map((e) => ({ libraryExerciseId: e.shared_exercise_id, exerciseName: e.exercise_name,
      targetSets: e.target_sets, targetReps: e.target_reps, restSeconds: e.rest_seconds })),
  } });
  if (error) return { ok: false, message: error.code === "23505"
    ? "ရွေးထားတဲ့ရက်မှာ Workout ရှိပြီးသားပါ။ ဘာမှ overwrite မလုပ်ထားပါ။"
    : "Workout မထည့်နိုင်ပါ။ ရက်အားလုံးကို မပြောင်းထားပါ။ ပြန်စမ်းပါ။" };
  await writeAudit(viewer.session.id, "coaching.workout.multi_date_assign", "coaching_workout", String(source.id), { targetDates, count: data.count })
    .catch(() => console.error("Workout assignment audit write failed"));
  revalidatePath("/coaching/workouts");
  revalidatePath(`/coaching/clients/${source.user_id}`);
  return { ok: true, message: `${data.count} ရက်အတွက် ${source.split_name} Workout ထည့်ပြီးပါပြီ။` };
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
    requestId: z.string().uuid().optional(),
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
  const result = await db.rpc("admin_mutate_coaching_meals", { p_input: {
    ...parsed.data, operation: "save", requestId: parsed.data.requestId ?? crypto.randomUUID(),
  } });
  if (result.error || !result.data) return { ok: false, message: "Meal ကို သိမ်းမရပါ။ ပြန်စမ်းပေးပါ။" };
  await writeAudit(viewer.session.id, "coaching.meal.save", "coaching_nutrition_item", String(result.data.mealId)).catch(() => console.error("Meal audit write failed"));
  revalidatePath("/coaching/meals");
  return { ok: true, message: "Meal plan သိမ်းပြီးပါပြီ။ Client app မှာပြန်ပေါ်ပါမယ်။", mealId: Number(result.data.mealId) };
}

export async function duplicateCoachingMealDay(input: unknown) {
  const parsed = z.object({
    requestId: z.string().uuid().optional(),
    userId: z.string().uuid(),
    sourceDate: z.iso.date(),
    targetDate: z.iso.date().optional(),
    targetDates: z.array(z.iso.date()).max(31).optional(),
  }).superRefine((value, context) => {
    if (!value.targetDate && !value.targetDates?.length) context.addIssue({ code: "custom", path: ["targetDates"], message: "Target date လိုပါတယ်" });
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ထည့်မယ့်ရက်တွေကို မှန်အောင်ရွေးပေးပါ။" };

  const targetDates = [...new Set([...(parsed.data.targetDates ?? []), ...(parsed.data.targetDate ? [parsed.data.targetDate] : [])])]
    .filter((date) => date !== parsed.data.sourceDate)
    .sort();
  const initializeSourceDate = parsed.data.targetDate === parsed.data.sourceDate && !parsed.data.targetDates?.length;
  if (!targetDates.length && !initializeSourceDate) return { ok: false, message: "Source ရက်မဟုတ်တဲ့ တခြားရက်တစ်ရက်အနည်းဆုံးရွေးပါ။" };

  const viewer = await requireAdmin();
  const db = createAdminClient();
  const datesToCreate = initializeSourceDate ? [parsed.data.sourceDate] : targetDates;
  const { data, error } = await db.rpc("admin_mutate_coaching_meals", { p_input: {
    requestId: parsed.data.requestId ?? crypto.randomUUID(), operation: "copy",
    userId: parsed.data.userId, sourceDate: parsed.data.sourceDate, targetDates: datesToCreate,
  } });
  if (error) return { ok: false, message: error.code === "23505"
    ? "ရွေးထားတဲ့ရက်မှာ Meal Plan ရှိပြီးသားပါ။ ဘာမှ overwrite မလုပ်ထားပါ။"
    : "Meal Plan မထည့်နိုင်ပါ။ Source နဲ့ ရက်တွေကို ပြန်စစ်ပေးပါ။ ရက်အားလုံး မပြောင်းထားပါ။" };

  await writeAudit(viewer.session.id, "coaching.meal_day.duplicate", "coaching_profile", parsed.data.userId, {
    sourceDate: parsed.data.sourceDate,
    targetDates: datesToCreate,
    itemCount: data.itemCount,
  }).catch(() => console.error("Meal copy audit write failed"));
  revalidatePath("/coaching/meals");
  return { ok: true, message: `${datesToCreate.length} ရက်အတွက် Meal Plan တစ်ခါတည်းထည့်ပြီးပါပြီ။` };
}

export async function deleteCoachingMeal(input: unknown) {
  const parsed = z.object({ id: z.coerce.number().int().positive(), userId: z.string().uuid(), requestId: z.string().uuid().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "ဖျက်မယ့် meal မမှန်ပါ။" };
  const viewer = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.rpc("admin_mutate_coaching_meals", { p_input: { ...parsed.data, operation: "delete", requestId: parsed.data.requestId ?? crypto.randomUUID() } });
  if (error) return { ok: false, message: "Meal ကို ဖျက်မရပါ။ အသုံးပြုပြီးသား log ရှိနိုင်ပါတယ်။" };
  await writeAudit(viewer.session.id, "coaching.meal.delete", "coaching_nutrition_item", String(parsed.data.id)).catch(() => console.error("Meal delete audit write failed"));
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
