"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin-db";

const postSchema = z.object({
  title: z.string().trim().min(2, "ခေါင်းစဉ်ထည့်ပါ").max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug ကို english lowercase နဲ့ရေးပါ"),
  language: z.enum(["mm", "en"]),
  excerpt: z.string().trim().max(420),
  content: z.string().trim(),
  coverImageUrl: z.string().trim().url().or(z.literal("")),
  coverImagePath: z.string().trim(),
  seoTitle: z.string().trim().max(180),
  seoDescription: z.string().trim().max(320),
  status: z.enum(["draft", "published"]),
  featured: z.boolean(),
});

export type PostActionState = { ok: boolean; message?: string; errors?: Record<string, string[]> };
export const initialPostState: PostActionState = { ok: false };

function parsePost(formData: FormData) {
  const title = String(formData.get("title") ?? "");
  const excerpt = String(formData.get("excerpt") ?? "");
  return postSchema.safeParse({
    title, slug: formData.get("slug"), language: formData.get("language"),
    excerpt, content: formData.get("content"), coverImageUrl: formData.get("coverImageUrl"),
    coverImagePath: formData.get("coverImagePath"), seoTitle: title.slice(0, 180), seoDescription: excerpt.slice(0, 320),
    status: formData.get("status"), featured: formData.get("featured") === "on",
  });
}

export async function createPost(_state: PostActionState, formData: FormData): Promise<PostActionState> {
  const viewer = await requireAdmin();
  const parsed = parsePost(formData);
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "လိုအပ်တဲ့အချက်အလက်တွေ ပြန်စစ်ပါ" };
  const value = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase.from("blog_posts").insert({
    author_id: viewer.user.id, slug: value.slug, language: value.language, title: value.title, excerpt: value.excerpt,
    content: value.content, cover_image_url: value.coverImageUrl || null, cover_image_path: value.coverImagePath || null,
    seo_title: value.seoTitle || null, seo_description: value.seoDescription || null, status: value.status,
    featured: value.featured, published_at: value.status === "published" ? new Date().toISOString() : null,
  }).select("id").single();
  if (error) return { ok: false, message: error.code === "23505" ? "ဒီ slug ကို သုံးထားပြီးပါပြီ" : error.message };
  await writeAudit(viewer.session.id, "blog.post.create", "blog_post", created.id, { status: value.status, slug: value.slug });
  revalidatePath("/website/posts");
  redirect("/website/posts?created=1");
}

export async function updatePost(id: string, _state: PostActionState, formData: FormData): Promise<PostActionState> {
  const viewer = await requireAdmin();
  const parsedId = z.string().uuid().safeParse(id);
  const parsed = parsePost(formData);
  if (!parsedId.success || !parsed.success) return { ok: false, errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors, message: "အချက်အလက်တွေ ပြန်စစ်ပါ" };
  const value = parsed.data;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
  const { error } = await supabase.from("blog_posts").update({
    author_id: viewer.user.id, slug: value.slug, language: value.language, title: value.title, excerpt: value.excerpt,
    content: value.content, cover_image_url: value.coverImageUrl || null, cover_image_path: value.coverImagePath || null,
    seo_title: value.seoTitle || null, seo_description: value.seoDescription || null, status: value.status,
    featured: value.featured, published_at: value.status === "published" ? existing?.published_at ?? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "ဒီ slug ကို သုံးထားပြီးပါပြီ" : error.message };
  await writeAudit(viewer.session.id, "blog.post.update", "blog_post", id, { status: value.status, slug: value.slug });
  revalidatePath("/website/posts"); revalidatePath(`/website/posts/${id}`);
  redirect("/website/posts?updated=1");
}

export async function deletePost(id: string) {
  const viewer = await requireAdmin();
  const parsedId = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { data: post } = await supabase.from("blog_posts").select("cover_image_path").eq("id", parsedId).maybeSingle();
  const { error } = await supabase.from("blog_posts").delete().eq("id", parsedId);
  if (error) throw error;
  if (post?.cover_image_path) await supabase.storage.from("site-assets").remove([post.cover_image_path]);
  await writeAudit(viewer.session.id, "blog.post.delete", "blog_post", parsedId);
  revalidatePath("/website/posts");
  redirect("/website/posts?deleted=1");
}
