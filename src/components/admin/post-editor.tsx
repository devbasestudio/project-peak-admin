"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  ArrowLeft, Eye, Fullscreen, ImagePlus,
  LoaderCircle, Minimize2, Save,
} from "lucide-react";
import { toast } from "sonner";
import { createPost, initialPostState, type PostActionState, updatePost } from "@/app/website-actions";
import type { BlogPost } from "@/lib/blog";
import { MarkdownContent } from "@/components/admin/markdown-content";
import { normalizeRichTextContent, RichTextEditor } from "@/components/admin/rich-text-editor";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").replace(/^-|-$/g, "");
}

function generatedSlug(title: string, fallback: string) {
  const readable = slugify(title);
  if (readable) return readable;
  if (!title.trim()) return fallback;
  let hash = 2166136261;
  for (const character of title) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `post-${(hash >>> 0).toString(36)}`;
}

export function PostEditor({ post }: { post?: BlogPost }) {
  const action = useMemo(() => post ? updatePost.bind(null, post.id) : createPost, [post]);
  const [state, formAction, pending] = useActionState<PostActionState, FormData>(action, initialPostState);
  const fallbackSlug = post?.slug ?? "project-peak-journal";
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(() => normalizeRichTextContent(post?.content ?? ""));
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url ?? "");
  const [coverPath, setCoverPath] = useState(post?.cover_image_path ?? "");
  const [status, setStatus] = useState<"draft" | "published">(post?.status ?? "draft");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const slug = post?.slug ?? generatedSlug(title, fallbackSlug);

  async function upload(file: File) {
    setUploading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("intent", "blog");
      const response = await fetch("/api/admin/upload", { method: "POST", body: data });
      const result = await response.json() as { url?: string; path?: string; error?: string };
      if (!response.ok || !result.url || !result.path) throw new Error(result.error ?? "Upload failed");
      setCoverUrl(result.url);
      setCoverPath(result.path);
      toast.success("Cover image တင်ပြီးပါပြီ");
    } catch (error) {
      toast.error("Image တင်မရသေးပါ", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  if (preview) {
    return <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <button type="button" onClick={() => setPreview(false)} className="mb-8 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold"><ArrowLeft size={16} />Editor ပြန်မယ်</button>
        {coverUrl ? <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-black/5"><Image src={coverUrl} fill sizes="900px" className="object-cover" alt="" /></div> : null}
        <p className="mono mt-10 text-[10px] tracking-[.2em] text-peak-blue">PROJECT PEAK JOURNAL · PREVIEW</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{title || "Post title"}</h1>
        <p className="mt-5 text-lg leading-8 text-black/55">{excerpt}</p>
        <MarkdownContent content={content} className="mt-10 max-w-none space-y-5 border-t border-black/10 pt-10 text-[17px] leading-9 [&_a]:font-bold [&_a]:text-sky-700 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-400 [&_blockquote]:pl-5 [&_blockquote]:text-black/60 [&_h2]:pt-4 [&_h2]:text-3xl [&_h2]:font-bold [&_h3]:pt-3 [&_h3]:text-2xl [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-7 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-7" />
      </div>
    </div>;
  }

  const editor = <section className={`${fullscreen ? "fixed inset-0 z-[100] overflow-y-auto bg-[#f4f3ed] p-4 sm:p-8" : "mt-5"}`}>
    <div className={fullscreen ? "mx-auto max-w-6xl" : ""}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="admin-label !mb-0" htmlFor="content-editor">စာကိုယ်</label>
        <button type="button" onClick={() => setFullscreen((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold">
          {fullscreen ? <Minimize2 size={15} /> : <Fullscreen size={15} />}{fullscreen ? "ပြန်ချုံ့မယ်" : "Full screen ရေးမယ်"}
        </button>
      </div>
      <RichTextEditor value={content} onChange={setContent} fullscreen={fullscreen} />
      <input type="hidden" name="content" value={content} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-black/38"><span>Format code တွေမမြင်ရဘဲ စာရွေးပြီး ခလုတ်နှိပ်ရုံပါ။</span><span>{content.replace(/<[^>]*>/g, "").length.toLocaleString()} လုံး</span></div>
    </div>
  </section>;

  return <form action={formAction} className="grid gap-5 xl:grid-cols-[1fr_320px]">
    <main className="rounded-2xl border border-black/8 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-5">
        <div><p className="mono text-[9px] tracking-[.2em] text-peak-blue">JOURNAL EDITOR</p><h1 className="mt-2 text-2xl font-bold">{post ? "Post ပြင်မယ်" : "Post အသစ်ရေးမယ်"}</h1></div>
        <button type="button" onClick={() => setPreview(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-bold"><Eye size={16} />Preview</button>
      </div>
      <div className="mt-7"><label className="admin-label" htmlFor="title">ခေါင်းစဉ်</label><input className="admin-input text-lg font-bold" id="title" name="title" maxLength={180} required value={title} onChange={(event) => setTitle(event.target.value)} />{state.errors?.title ? <p className="mt-2 text-xs text-red-600">{state.errors.title[0]}</p> : null}</div>
      <div className="mt-5"><label className="admin-label" htmlFor="excerpt">အကျဉ်းချုပ်</label><textarea className="admin-input min-h-28 resize-y" id="excerpt" name="excerpt" maxLength={420} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} /><p className="mt-2 text-right text-[10px] text-black/35">{excerpt.length}/420</p></div>
      {editor}
      <input type="hidden" name="slug" value={slug} />
    </main>

    <aside className="space-y-5">
      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <p className="text-sm font-bold">Cover image</p>
        <label className="mt-4 flex aspect-[16/10] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-black/15 bg-[#f5f6f5]">{coverUrl ? <span className="relative block h-full w-full"><Image src={coverUrl} fill sizes="320px" className="object-cover" alt="Cover preview" /></span> : <span className="flex flex-col items-center gap-2 text-xs font-bold text-black/45">{uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}Image တင်မယ်</span>}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>
        <input type="hidden" name="coverImageUrl" value={coverUrl} /><input type="hidden" name="coverImagePath" value={coverPath} />
      </section>
      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <div><label className="admin-label" htmlFor="status">မြင်ရမယ့်နေရာ</label><select className="admin-input" id="status" name="status" value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")}><option value="draft">Draft — Admin ပဲမြင်မယ်</option><option value="published">Published — Website မှာပေါ်မယ်</option></select></div>
        <div className="mt-4"><label className="admin-label" htmlFor="language">စာရဲ့ဘာသာစကား</label><select className="admin-input" id="language" name="language" defaultValue={post?.language ?? "mm"}><option value="mm">မြန်မာ</option><option value="en">English</option></select></div>
        <label className="mt-5 flex items-center gap-3 rounded-xl bg-[#f5f6f5] p-4 text-sm font-semibold"><input type="checkbox" name="featured" defaultChecked={post?.featured} className="h-4 w-4 accent-[#08a9dc]" />Landing page မှာ ဦးစားပေးပြမယ်</label>
      </section>
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs leading-6 text-sky-900"><strong className="block">SEO နဲ့ URL ကို auto ထုတ်ပေးပါတယ်</strong>ခေါင်းစဉ်နဲ့ အကျဉ်းချုပ်ကိုသုံးပြီး Google title၊ description နဲ့ URL slug ကို အလိုအလျောက်သိမ်းပါမယ်။</div>
      {state.message ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.message}</p> : null}
      <button type="submit" disabled={pending || uploading} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#07131c] px-5 text-sm font-bold !text-white disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{pending ? "သိမ်းနေပါတယ်…" : status === "published" ? "Website မှာ Publish မယ်" : "Draft သိမ်းမယ်"}</button>
      <Link href="/website/posts" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-sm font-bold"><ArrowLeft size={16} />Posts ပြန်မယ်</Link>
    </aside>
  </form>;
}
