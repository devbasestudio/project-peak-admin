import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin mutations use atomic database functions", async () => {
  const source = await read("src/app/admin-actions.ts");
  for (const rpc of [
    "save_template_draft",
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
  assert.match(page, /လမ်းညွှန် Screens/);
  assert.match(page, /Baseline စမ်းသပ်ချိန်/);
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
