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
