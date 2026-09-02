"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Film, LoaderCircle, Play, RotateCcw, Upload } from "lucide-react";
import { saveExerciseVideoVariant } from "@/app/admin-actions";
import styles from "./exercise-video-manager.module.css";

type Library = {
  versionId: string;
  versionStatus: string;
  versionNo: number;
  exercises: Array<{
    id: string;
    slug: string;
    nameMm: string;
    nameEn: string;
    position: number;
    videos: Array<{ id: string; assetId: string; position: number; role: "primary" | "alternative"; titleMm: string; titleEn: string; previewUrl: string }>;
  }>;
};

export function ExerciseVideoManager({ templateId, library }: { templateId: string; library: Library }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [activePreview, setActivePreview] = useState("");
  const [readyPreview, setReadyPreview] = useState("");
  const [failedPreview, setFailedPreview] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [, startTransition] = useTransition();

  function openPreview(key: string) {
    setReadyPreview("");
    setFailedPreview("");
    setActivePreview(key);
    setPreviewAttempt((attempt) => attempt + 1);
  }

  async function upload(exerciseSlug: string, role: "primary" | "alternative", file?: File) {
    if (!file) return;
    const key = `${exerciseSlug}:${role}`;
    setBusy(key);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const uploaded = await response.json() as { assetId?: string; error?: string };
      if (!response.ok || !uploaded.assetId) throw new Error(uploaded.error || "Video upload မပြီးပါ");
      const result = await saveExerciseVideoVariant({ templateId, versionId: library.versionId, exerciseSlug, role, assetId: uploaded.assetId, locale: "mm" });
      if (!result.ok) throw new Error(result.message);
      setMessage(result.message);
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Video မသိမ်းနိုင်ပါ");
    } finally {
      setBusy("");
    }
  }

  return <section className={styles.section}>
    <header className={styles.header}><div><p>EXERCISE VIDEOS · VERSION {library.versionNo}</p><h1>အဓိကနည်း + အစားထိုးနည်း</h1><span>Exercise တစ်ခုစီမှာ Video နှစ်ခုထားနိုင်ပါတယ်။ Customer က လက်နဲ့ swipe လုပ်ပြီး အဆင်ပြေတဲ့နည်းကို ရွေးနိုင်ပါတယ်။</span></div><b data-status={library.versionStatus}>{library.versionStatus === "draft" ? "ပြင်နေဆဲ Draft" : "Published · ပြင်ရင် Draft အသစ်လုပ်မယ်"}</b></header>
    {message ? <div className={styles.message}><Check size={15}/>{message}</div> : null}
    <div className={styles.grid}>{library.exercises.map((exercise) => <article className={styles.card} key={exercise.id}>
      <div className={styles.exerciseTitle}><span>{String(exercise.position).padStart(2,"0")}</span><div><strong>{exercise.nameEn}</strong><small>{exercise.nameMm}</small></div></div>
      <div className={styles.slots}>{(["primary","alternative"] as const).map((role) => {const video=exercise.videos.find((item)=>item.role===role);const key=`${exercise.slug}:${role}`;const isActive=activePreview===key;return <div className={styles.slot} key={role}>
        <div className={styles.preview}>{video ? isActive ? <>
          <video
            key={`${key}:${previewAttempt}`}
            autoPlay
            controls
            playsInline
            preload="metadata"
            src={video.previewUrl}
            onCanPlay={() => setReadyPreview(key)}
            onError={() => setFailedPreview(key)}
          />
          {readyPreview !== key && failedPreview !== key ? <div className={styles.previewStatus}><LoaderCircle className={styles.spin} size={22}/><span>Video ဖွင့်နေပါတယ်…</span></div> : null}
          {failedPreview === key ? <div className={styles.previewError}><AlertTriangle size={22}/><strong>Video မဖွင့်နိုင်ပါ</strong><button type="button" onClick={() => openPreview(key)}><RotateCcw size={14}/>ပြန်စမ်းမယ်</button></div> : null}
        </> : <button className={styles.previewButton} type="button" onClick={() => openPreview(key)} aria-label={`${exercise.nameEn} ${role === "primary" ? "primary" : "alternative"} video ကြည့်မယ်`}><span><Play fill="currentColor" size={20}/></span><strong>Video ကြည့်မယ်</strong><small>နှိပ်မှ Video load လုပ်ပါမယ်</small></button> : <div className={styles.emptyPreview}><Film size={22}/><span>Video မရှိသေးပါ</span></div>}</div>
        <div className={styles.slotFoot}><span><strong>{role === "primary" ? "အဓိကနည်း" : "အစားထိုးနည်း"}</strong><small>{video ? "Video ထည့်ပြီး" : "Video မရှိသေး"}</small></span><label>{busy===key?<LoaderCircle className={styles.spin} size={15}/>:<Upload size={15}/>}<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={Boolean(busy)} onChange={(event)=>void upload(exercise.slug,role,event.target.files?.[0])}/></label></div>
      </div>})}</div>
    </article>)}</div>
  </section>;
}
