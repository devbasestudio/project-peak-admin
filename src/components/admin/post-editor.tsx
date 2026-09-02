"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { ArrowLeft, Eye, ImagePlus, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createPost, initialPostState, type PostActionState, updatePost } from "@/app/website-actions";
import type { BlogPost } from "@/lib/blog";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").replace(/^-|-$/g, "");
}

export function PostEditor({ post }: { post?: BlogPost }) {
  const action = useMemo(() => post ? updatePost.bind(null, post.id) : createPost, [post]);
  const [state, formAction, pending] = useActionState<PostActionState, FormData>(action, initialPostState);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url ?? "");
  const [coverPath, setCoverPath] = useState(post?.cover_image_path ?? "");
  const [status, setStatus] = useState<"draft" | "published">(post?.status ?? "draft");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const data = new FormData(); data.set("file", file); data.set("intent", "blog");
      const response = await fetch("/api/admin/upload", { method: "POST", body: data });
      const result = await response.json() as { url?: string; path?: string; error?: string };
      if (!response.ok || !result.url || !result.path) throw new Error(result.error ?? "Upload failed");
      setCoverUrl(result.url); setCoverPath(result.path); toast.success("Cover image တင်ပြီးပါပြီ");
    } catch (error) { toast.error("Image တင်မရသေးပါ", { description: error instanceof Error ? error.message : undefined }); }
    finally { setUploading(false); }
  }

  if (preview) return <div className="min-h-screen bg-paper"><div className="mx-auto max-w-4xl px-4 py-8 sm:px-8"><button type="button" onClick={() => setPreview(false)} className="mb-8 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-bold"><ArrowLeft size={16} />Editor ပြန်မယ်</button>{coverUrl ? <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-black/5"><Image src={coverUrl} fill sizes="900px" className="object-cover" alt="" /></div> : null}<p className="mono mt-10 text-[10px] tracking-[.2em] text-peak-blue">PROJECT PEAK JOURNAL · PREVIEW</p><h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{title || "Post title"}</h1><p className="mt-5 text-lg leading-8 text-black/55">{excerpt}</p><div className="mt-10 space-y-6 border-t border-black/10 pt-10 text-[17px] leading-9">{content.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></div></div>;

  return <form action={formAction} className="grid gap-5 xl:grid-cols-[1fr_320px]">
    <ol className="col-span-full grid overflow-hidden rounded-2xl border border-black/8 bg-white p-0 sm:grid-cols-3" aria-label="Blog post ရေးရန် အဆင့်များ">
      <li className="flex min-h-20 items-center gap-3 border-b border-black/8 p-4 sm:border-r sm:border-b-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-black text-sky-700">1</span><span><strong className="block text-sm">စာရေးမယ်</strong><small className="mt-1 block text-[11px] text-black/45">ခေါင်းစဉ်၊ အကျဉ်းချုပ်၊ စာကိုယ်</small></span></li>
      <li className="flex min-h-20 items-center gap-3 border-b border-black/8 p-4 sm:border-r sm:border-b-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-black text-sky-700">2</span><span><strong className="block text-sm">Preview ကြည့်မယ်</strong><small className="mt-1 block text-[11px] text-black/45">Website မှာဘယ်လိုပေါ်မလဲ စစ်မယ်</small></span></li>
      <li className="flex min-h-20 items-center gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-black text-sky-700">3</span><span><strong className="block text-sm">သိမ်းမယ် / Publish မယ်</strong><small className="mt-1 block text-[11px] text-black/45">Draft သို့မဟုတ် public website</small></span></li>
    </ol>
    <main className="rounded-2xl border border-black/8 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-5"><div><p className="mono text-[9px] tracking-[.2em] text-peak-blue">EDITOR</p><h1 className="mt-2 text-2xl font-bold">{post ? "Post ပြင်မယ်" : "Post အသစ်ရေးမယ်"}</h1></div><button type="button" onClick={() => setPreview(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-bold"><Eye size={16} />Preview</button></div>
      <div className="mt-7"><label className="admin-label" htmlFor="title">ခေါင်းစဉ်</label><input className="admin-input text-lg font-bold" id="title" name="title" maxLength={180} required value={title} onChange={(event) => { setTitle(event.target.value); if (!post) setSlug(slugify(event.target.value)); }} />{state.errors?.title ? <p className="mt-2 text-xs text-red-600">{state.errors.title[0]}</p> : null}</div>
      <div className="mt-5"><label className="admin-label" htmlFor="slug">URL Slug</label><div className="flex items-center rounded-xl border border-black/10 bg-[#f5f6f5] pl-4"><span className="mono text-xs text-black/35">/journal/</span><input className="min-h-12 min-w-0 flex-1 bg-transparent px-1 outline-none" id="slug" name="slug" required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} /></div>{state.errors?.slug ? <p className="mt-2 text-xs text-red-600">{state.errors.slug[0]}</p> : null}</div>
      <div className="mt-5"><label className="admin-label" htmlFor="excerpt">အကျဉ်းချုပ်</label><textarea className="admin-input min-h-28 resize-y" id="excerpt" name="excerpt" maxLength={420} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} /><p className="mt-2 text-right text-[10px] text-black/35">{excerpt.length}/420</p></div>
      <div className="mt-5"><label className="admin-label" htmlFor="content">စာကိုယ်</label><textarea className="admin-input min-h-[480px] resize-y text-[16px] leading-8" id="content" name="content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="စာပိုဒ်တစ်ပိုဒ်ပြီးတိုင်း Enter နှစ်ချက်နှိပ်ပါ…" /><p className="mt-2 text-xs text-black/38">စာပိုဒ်တွေကို blank line နဲ့ခွဲရေးနိုင်ပါတယ်။</p></div>
    </main>
    <aside className="space-y-5">
      <section className="rounded-2xl border border-black/8 bg-white p-5"><p className="text-sm font-bold">ဘယ်လိုသိမ်းမလဲ?</p><div className="mt-5"><label className="admin-label" htmlFor="status">မြင်ရမယ့်နေရာ</label><select className="admin-input" id="status" name="status" value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")}><option value="draft">Draft — Admin ပဲမြင်မယ်</option><option value="published">Published — Website မှာပေါ်မယ်</option></select></div><div className="mt-4"><label className="admin-label" htmlFor="language">စာရဲ့ဘာသာစကား</label><select className="admin-input" id="language" name="language" defaultValue={post?.language ?? "mm"}><option value="mm">မြန်မာ</option><option value="en">English</option></select></div><label className="mt-5 flex items-center gap-3 rounded-xl bg-[#f5f6f5] p-4 text-sm font-semibold"><input type="checkbox" name="featured" defaultChecked={post?.featured} className="h-4 w-4 accent-[#08a9dc]" />Landing page မှာ ဦးစားပေးပြမယ်</label></section>
      <section className="rounded-2xl border border-black/8 bg-white p-5"><p className="text-sm font-bold">Cover Image</p><label className="mt-4 flex aspect-[16/10] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-black/15 bg-[#f5f6f5]">{coverUrl ? <span className="relative block h-full w-full"><Image src={coverUrl} fill sizes="320px" className="object-cover" alt="Cover preview" /></span> : <span className="flex flex-col items-center gap-2 text-xs font-bold text-black/45">{uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}Image တင်မယ်</span>}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label><input type="hidden" name="coverImageUrl" value={coverUrl} /><input type="hidden" name="coverImagePath" value={coverPath} /></section>
      <details className="rounded-2xl border border-black/8 bg-white p-5"><summary className="cursor-pointer text-sm font-bold">SEO Setting</summary><div className="mt-5"><label className="admin-label" htmlFor="seoTitle">SEO Title</label><input className="admin-input" id="seoTitle" name="seoTitle" maxLength={180} defaultValue={post?.seo_title ?? ""} /></div><div className="mt-4"><label className="admin-label" htmlFor="seoDescription">SEO Description</label><textarea className="admin-input min-h-24" id="seoDescription" name="seoDescription" maxLength={320} defaultValue={post?.seo_description ?? ""} /></div></details>
      {state.message ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.message}</p> : null}
      <button type="submit" disabled={pending || uploading} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{pending ? "သိမ်းနေပါတယ်…" : status === "published" ? "Website မှာ Publish မယ်" : "Draft သိမ်းမယ်"}</button>
      <Link href="/website/posts" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-sm font-bold"><ArrowLeft size={16} />Posts ပြန်မယ်</Link>
    </aside>
  </form>;
}
