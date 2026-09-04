import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin mutations use atomic database functions", async () => {
  const source = await read("src/app/admin-actions.ts");
  for (const rpc of [
    "save_template_program_structure",
    "publish_template_version_atomic",
    "reject_payment_order_atomic",
    "update_program_status_strict",
  ]) assert.match(source, new RegExp(`rpc\\(\\\"${rpc}\\\"`));
});

test("home workout program builder exposes the full 12-week hierarchy", async () => {
  const page = await read("src/app/(dashboard)/home-workout/templates/[templateId]/page.tsx");
  assert.match(page, /Program Builder/);
  assert.match(page, /Phase၊ Week၊ Session၊ Exercise/);
  assert.doesNotMatch(page, /view=content|TemplateBuilder|လမ်းညွှန် Screens|Screen Content/);
  const builder = await read("src/components/admin/program-structure-builder.tsx");
  assert.match(builder, /length: 48/);
  assert.match(builder, /length: 12/);
  for (const field of ["sets", "repsMin", "repsMax", "targetKg", "restSeconds"]) {
    assert.match(builder, new RegExp(field));
  }
  assert.doesNotMatch(builder, /Coach note \/ Effort/);
  const migration = await read("supabase/migrations/20260902133838_save_template_program_structure.sql");
  assert.match(migration, /jsonb_array_length\(p_days\) <> 48/);
  assert.match(migration, /clone_template_version/);
  assert.match(migration, /grant execute .* to service_role/);
  assert.match(migration, /revoke all .* authenticated/);
});

test("exercise videos load only after the admin asks to preview one", async () => {
  const manager = await read("src/components/admin/exercise-video-manager.tsx");
  assert.match(manager, /activePreview===key/);
  assert.match(manager, /Video ကြည့်မယ်/);
  assert.match(manager, /onCanPlay/);
  assert.match(manager, /onError/);
  assert.match(manager, /previewAttempt/);
  assert.doesNotMatch(manager, /<video controls playsInline preload="metadata" src=/);

  const mediaRoute = await read("src/app/api/admin/media/[assetId]/route.ts");
  assert.match(mediaRoute, /request\.headers\.get\("range"\)/);
  assert.match(mediaRoute, /headers: range \? \{ Range: range \}/);
  assert.match(mediaRoute, /new NextResponse\(upstream\.body/);
  assert.match(mediaRoute, /private, no-store/);
  assert.doesNotMatch(mediaRoute, /NextResponse\.redirect/);
});

test("1:1 client progress has a detailed drill-down and repeat-safe demo seed", async () => {
  const clientsPage = await read("src/app/(dashboard)/coaching/clients/page.tsx");
  assert.match(clientsPage, /coaching\/clients\/\$\{client\.id\}/);
  assert.match(clientsPage, /အသေးစိတ်/);

  const detailPage = await read("src/app/(dashboard)/coaching/clients/[clientId]/page.tsx");
  for (const label of ["DAY BY DAY", "SELECTED DAY", "TRACKER", "WORKOUT", "MEALS", "DAY NOTE", "WEIGHT TREND", "Weekly check-in အားလုံး"]) {
    assert.match(detailPage, new RegExp(label));
  }
  const data = await read("src/lib/data.ts");
  for (const table of ["coaching_daily_trackers", "coaching_weekly_checkins", "coaching_workouts", "coaching_custom_tracker_templates", "coaching_nutrition_logs"]) {
    assert.match(data, new RegExp(`from\\(\"${table}\"\\)`));
  }

  const seed = await read("supabase/demo/seed-coaching-progress-demo.sql");
  assert.match(seed, /phyodynamics@gmail\.com/);
  assert.match(seed, /on conflict \(user_id, date\) do nothing/);
  assert.match(seed, /on conflict \(user_id, week_number\) do nothing/);
  assert.doesNotMatch(seed, /delete\s+from/i);
});

test("1:1 admin exposes real workout, exercise video, meal, and feedback management", async () => {
  const shell = await read("src/components/dashboard/dashboard-shell.tsx");
  for (const route of ["/exercises", "/coaching/workouts", "/coaching/meals", "/coaching/feedback-forms"]) assert.match(shell, new RegExp(route));
  assert.doesNotMatch(shell, /href: "\/coaching\/exercises"/);
  const actions = await read("src/app/coaching-actions.ts");
  for (const action of ["saveCoachingWorkout", "saveCoachingMeal", "deleteCoachingMeal", "saveCoachingFeedbackTemplate"]) assert.match(actions, new RegExp(`export async function ${action}`));
  assert.doesNotMatch(actions, /saveCoachingExerciseLibraryItem/);
  for (const table of ["coaching_workouts", "coaching_workout_exercises", "coaching_nutrition_items", "coaching_feedback_form_templates"]) assert.match(actions, new RegExp(`from\\(\\\"${table}\\\"\\)`));
  assert.match(actions, /await requireAdmin\(\)/);
  const workout = await read("src/components/coaching/workout-manager.tsx");
  assert.match(workout, /type=\"number\"/);
  assert.match(workout, /<select value=\{exercise\.libraryExerciseId\}/);
  assert.match(workout, /<optgroup label=\{group\}/);
  assert.match(workout, /Workout သိမ်းမယ်/);
  const library = await read("src/components/admin/shared-exercise-manager.tsx");
  assert.match(library, /shared-exercise-video/);
  assert.match(library, /Category အသစ်ထည့်မယ်/);
  assert.match(library, /Home Workout နဲ့ 1:1 Workout နှစ်ခုလုံး/);
  assert.match(library, /primary", "alternative/);
  const upload = await read("src/app/api/admin/upload/route.ts");
  assert.match(upload, /shared-exercise-video/);
  assert.match(upload, /shared_exercise_videos/);
  assert.match(upload, /program-media/);
  assert.match(upload, /requireAdminSession/);
  assert.match(upload, /isAllowedOrigin/);
  const feedback = await read("src/components/coaching/feedback-form-manager.tsx");
  assert.match(feedback, /မေးခွန်းစာသား/);
  assert.match(feedback, /မေးခွန်းထည့်မယ်/);
  for (const type of ["short_text", "long_text", "number", "rating", "yes_no", "image"]) assert.match(feedback, new RegExp(type));
  assert.match(feedback, /setFields\(\(rows\) => rows\.filter/);
  assert.match(feedback, /function move/);
  const coachingItems = shell.match(/href: "\/coaching\//g) || [];
  assert.equal(coachingItems.length, 4);
});

test("home workout and 1:1 selectors share one categorized exercise source", async () => {
  const data = await read("src/lib/data.ts");
  assert.match(data, /from\("shared_exercises"\)/);
  assert.match(data, /from\("exercise_categories"\)/);
  const builder = await read("src/components/admin/program-structure-builder.tsx");
  const workout = await read("src/components/coaching/workout-manager.tsx");
  assert.match(builder, /<optgroup label=\{category\}/);
  assert.match(workout, /<optgroup label=\{group\}/);
  const templatePage = await read("src/app/(dashboard)/home-workout/templates/[templateId]/page.tsx");
  assert.match(templatePage, /href="\/exercises"/);
  assert.doesNotMatch(templatePage, /ExerciseVideoManager|view=videos/);
  const migration = await read("supabase/migrations/20260903033218_create_shared_exercise_library.sql");
  for (const table of ["exercise_categories", "shared_exercises", "shared_exercise_videos"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /Service role authorization required/);
  const decouple = await read("supabase/migrations/20260903050644_decouple_legacy_coaching_splits.sql");
  assert.match(decouple, /drop trigger if exists shared_exercise_sync_coaching_library/);
  assert.match(decouple, /set split_name = 'Full Body'/);
  const coachingLink = await read("supabase/migrations/20260903054231_link_coaching_workouts_to_shared_exercises.sql");
  assert.match(coachingLink, /add column if not exists shared_exercise_id uuid/);
});

test("server-action modules only export callable actions and erased types", async () => {
  const source = await read("src/app/website-actions.ts");
  assert.doesNotMatch(source, /export\s+const\s+initialPostState/);
  assert.match(source, /export\s+async\s+function\s+createPost/);
});

test("journal editor keeps the owner-facing fields and formatting controls", async () => {
  const source = await read("src/components/admin/post-editor.tsx");
  for (const field of ["title", "excerpt", "content", "coverImageUrl", "status", "language", "featured"]) {
    assert.match(source, new RegExp(`name=\\\"${field}\\\"`));
  }
  assert.match(source, /Full screen ရေးမယ်/);
  assert.match(source, /<RichTextEditor /);
  const richEditor = await read("src/components/admin/rich-text-editor.tsx");
  assert.match(richEditor, /calc\(100svh - 230px\)/);
  assert.match(richEditor, /clamp\(520px, 62vh, 760px\)/);
  assert.match(richEditor, /insertUnorderedList/);
  assert.match(richEditor, /insertOrderedList/);
  assert.match(richEditor, /aria-pressed/);
  assert.match(richEditor, /current === tag \? "p" : tag/);
  assert.doesNotMatch(richEditor, /`\*\*/);
});

test("home workout payment and customer lists are searchable", async () => {
  const search = await read("src/components/admin/admin-search.tsx");
  assert.match(search, /role="search"/);
  assert.match(search, /name="q"/);
  assert.match(search, /အားလုံးပြမယ်/);

  const payments = await read("src/app/(dashboard)/home-workout/payments/page.tsx");
  const customers = await read("src/app/(dashboard)/home-workout/customers/page.tsx");
  for (const source of [payments, customers]) {
    assert.match(source, /searchParams/);
    assert.match(source, /matchesSearch/);
    assert.match(source, /<AdminSearch/);
    assert.match(source, /ရှာမတွေ့ပါ/);
  }
  assert.match(payments, /reference_code/);
  assert.match(customers, /program\?\.status/);
  const data = await read("src/lib/data.ts");
  assert.match(data, /function latestByUser/);
  assert.match(data, /if \(!latest\.has\(row\.user_id\)\)/);
});
