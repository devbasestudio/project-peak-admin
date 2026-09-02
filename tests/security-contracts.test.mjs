import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("admin mutations use atomic database functions", async () => {
  const source = await read("src/app/admin-actions.ts");
  for (const rpc of [
    "save_template_draft",
    "publish_template_version_atomic",
    "reject_payment_order_atomic",
    "update_program_status_strict",
  ]) assert.match(source, new RegExp(`rpc\\(\\\"${rpc}\\\"`));
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
