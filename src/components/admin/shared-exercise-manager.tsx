"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Film, FolderPlus, Pencil, Play, Plus, Save, Search, Upload } from "lucide-react";
import { saveExerciseCategory, saveSharedExercise } from "@/app/exercise-actions";
import styles from "./shared-exercise-manager.module.css";

type Category = { id: string; name: string; sort_order: number };
type Video = { id: string; role: "primary" | "alternative"; asset_id: string; preview_url: string };
type Exercise = {
  id: string; category_id: string; slug: string; name_mm: string; name_en: string;
  cue_en: string | null; equipment_en: string | null; muscle_group: string | null;
  default_sets: number; default_reps_min: number; default_reps_max: number;
  default_rest_seconds: number; sort_order: number; videos: Video[];
};
type ExerciseForm = {
  id?: string; categoryId: string; nameEn: string; nameMm: string; equipment: string;
  cue: string; muscleGroup: string; defaultSets: number; defaultRepsMin: number;
  defaultRepsMax: number; defaultRestSeconds: number; sortOrder: number;
};

const blankExercise = (categoryId = ""): ExerciseForm => ({
  categoryId, nameEn: "", nameMm: "", equipment: "", cue: "", muscleGroup: "",
  defaultSets: 3, defaultRepsMin: 8, defaultRepsMax: 12, defaultRestSeconds: 90, sortOrder: 0,
});

export function SharedExerciseManager({ categories, exercises }: { categories: Category[]; exercises: Exercise[] }) {
  const router = useRouter();
  const [categoryName, setCategoryName] = useState("");
  const [form, setForm] = useState<ExerciseForm>(() => blankExercise(categories[0]?.id));
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState("");
  const [preview, setPreview] = useState("");

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase();
    return exercises.filter((exercise) => (filter === "all" || exercise.category_id === filter)
      && (!needle || `${exercise.name_en} ${exercise.name_mm} ${exercise.muscle_group ?? ""}`.toLocaleLowerCase().includes(needle)));
  }, [deferredQuery, exercises, filter]);

  function startNew() {
    setForm(blankExercise(filter === "all" ? categories[0]?.id : filter));
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function edit(exercise: Exercise) {
    setForm({ id: exercise.id, categoryId: exercise.category_id, nameEn: exercise.name_en, nameMm: exercise.name_mm,
      equipment: exercise.equipment_en ?? "", cue: exercise.cue_en ?? "", muscleGroup: exercise.muscle_group ?? "",
      defaultSets: exercise.default_sets, defaultRepsMin: exercise.default_reps_min, defaultRepsMax: exercise.default_reps_max,
      defaultRestSeconds: exercise.default_rest_seconds, sortOrder: exercise.sort_order });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCategory() {
    startTransition(async () => {
      const result = await saveExerciseCategory({ name: categoryName, sortOrder: categories.length * 10 + 10 });
      setSuccess(result.ok); setMessage(result.message);
      if (result.ok) { setCategoryName(""); router.refresh(); }
    });
  }

  function saveExercise() {
    startTransition(async () => {
      const result = await saveSharedExercise(form);
      setSuccess(result.ok); setMessage(result.message);
      if (result.ok) { setForm((current) => ({ ...current, id: result.exerciseId })); router.refresh(); }
    });
  }

  async function uploadVideo(exerciseId: string, role: Video["role"], file?: File) {
    if (!file) return;
    const key = `${exerciseId}:${role}`;
    setUploading(key); setMessage("");
    try {
      const body = new FormData();
      body.set("intent", "shared-exercise-video"); body.set("exerciseId", exerciseId); body.set("role", role); body.set("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Video upload မအောင်မြင်ပါ");
      setSuccess(true); setMessage("Video တစ်ခါတည်းတင်ပြီး Home Workout နဲ့ 1:1 နှစ်ခုလုံးအတွက် ချိတ်ပြီးပါပြီ။");
      router.refresh();
    } catch (error) {
      setSuccess(false); setMessage(error instanceof Error ? error.message : "Video upload မအောင်မြင်ပါ");
    } finally { setUploading(""); }
  }

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><p>COMMON LIBRARY · ALL PROGRAMS</p><h1>Exercises</h1><span>Exercise နဲ့ Video ကို ဒီမှာတစ်ခါပဲထည့်ပါ။ Home Workout နဲ့ 1:1 Workout နှစ်ခုလုံးက ဒီ Library ကိုအတူသုံးပါတယ်။</span></div>
      <div className={styles.summary}><strong>{exercises.length}</strong><span>Exercises</span><strong>{categories.length}</strong><span>Categories</span></div>
    </header>
    {message ? <div className={styles.message} data-success={success}>{success ? <Check size={17}/> : null}{message}</div> : null}

    <section className={styles.createGrid}>
      <article className={styles.panel}>
        <header><span><FolderPlus size={18}/></span><div><p>STEP 1</p><h2>Category အသစ်ထည့်မယ်</h2></div></header>
        <div className={styles.panelBody}><label><span>Category နာမည်</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="ဥပမာ Mobility"/></label><button disabled={pending || !categoryName.trim()} onClick={saveCategory}><Plus size={16}/>Category ထည့်မယ်</button></div>
      </article>
      <article className={styles.panel}>
        <header><span><Film size={18}/></span><div><p>STEP 2</p><h2>{form.id ? "Exercise ပြင်မယ်" : "Exercise အသစ်ထည့်မယ်"}</h2></div><button className={styles.textButton} onClick={startNew}>အသစ်</button></header>
        <div className={styles.formGrid}>
          <label><span>Category *</span><select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label><span>English name *</span><input value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} placeholder="Dumbbell bench press"/></label>
          <label><span>မြန်မာနာမည်</span><input value={form.nameMm} onChange={(event) => setForm({ ...form, nameMm: event.target.value })} placeholder="မဖြည့်လည်းရပါတယ်"/></label>
          <label><span>Muscle group</span><input value={form.muscleGroup} onChange={(event) => setForm({ ...form, muscleGroup: event.target.value })} placeholder="Chest"/></label>
          <label><span>Equipment</span><input value={form.equipment} onChange={(event) => setForm({ ...form, equipment: event.target.value })} placeholder="Dumbbell"/></label>
          <label className={styles.wide}><span>တိုတိုလေး လမ်းညွှန်ချက်</span><input value={form.cue} onChange={(event) => setForm({ ...form, cue: event.target.value })} placeholder="Form cue (optional)"/></label>
          <div className={styles.numbers}>
            <label><span>Sets</span><input type="number" min="1" max="20" value={form.defaultSets} onChange={(event) => setForm({ ...form, defaultSets: Number(event.target.value) })}/></label>
            <label><span>Min reps</span><input type="number" min="0" max="999" value={form.defaultRepsMin} onChange={(event) => setForm({ ...form, defaultRepsMin: Number(event.target.value) })}/></label>
            <label><span>Max reps</span><input type="number" min="0" max="999" value={form.defaultRepsMax} onChange={(event) => setForm({ ...form, defaultRepsMax: Number(event.target.value) })}/></label>
            <label><span>Rest (sec)</span><input type="number" min="0" max="3600" value={form.defaultRestSeconds} onChange={(event) => setForm({ ...form, defaultRestSeconds: Number(event.target.value) })}/></label>
          </div>
          <button className={styles.primary} disabled={pending || !form.categoryId || !form.nameEn.trim()} onClick={saveExercise}><Save size={16}/>{pending ? "သိမ်းနေတယ်…" : "Exercise သိမ်းမယ်"}</button>
        </div>
      </article>
    </section>

    <section className={styles.library}>
      <header><div><p>ONE LIBRARY</p><h2>Exercise + optional video</h2></div><button onClick={startNew}><Plus size={16}/>Exercise အသစ်</button></header>
      <div className={styles.filters}><label><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Exercise ရှာမယ်"/></label><div><button data-active={filter === "all"} onClick={() => setFilter("all")}>အားလုံး</button>{categories.map((category) => <button data-active={filter === category.id} onClick={() => setFilter(category.id)} key={category.id}>{category.name}</button>)}</div></div>
      <div className={styles.exerciseGrid}>{visible.map((exercise) => <article className={styles.card} key={exercise.id}>
        <div className={styles.cardHead}><div><small>{categories.find((category) => category.id === exercise.category_id)?.name ?? "General"}</small><h3>{exercise.name_en}</h3><p>{exercise.name_mm}</p></div><button onClick={() => edit(exercise)} aria-label={`${exercise.name_en} ပြင်မယ်`}><Pencil size={16}/></button></div>
        <div className={styles.meta}><span>{exercise.default_sets} sets</span><span>{exercise.default_reps_min}–{exercise.default_reps_max} reps</span><span>{exercise.default_rest_seconds}s rest</span></div>
        <div className={styles.videoGrid}>{(["primary", "alternative"] as const).map((role) => { const video = exercise.videos.find((item) => item.role === role); const key = `${exercise.id}:${role}`; return <div className={styles.videoSlot} key={role}>
          <div className={styles.preview}>{video ? preview === key ? <video controls playsInline preload="metadata" src={video.preview_url}/> : <button onClick={() => setPreview(key)}><Play fill="currentColor" size={19}/><span>Video ကြည့်မယ်</span></button> : <Film size={24}/>}</div>
          <div><span><strong>{role === "primary" ? "အဓိက Video" : "အစားထိုး Video"}</strong><small>{video ? "တင်ပြီး" : "Optional"}</small></span><label><Upload size={15}/><span>{uploading === key ? "တင်နေတယ်…" : video ? "ပြောင်းမယ်" : "တင်မယ်"}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={Boolean(uploading)} onChange={(event) => void uploadVideo(exercise.id, role, event.target.files?.[0])}/></label></div>
        </div>; })}</div>
      </article>)}</div>
      {!visible.length ? <div className={styles.empty}>ဒီ Category ထဲမှာ Exercise မရှိသေးပါ။ “Exercise အသစ်” ကိုနှိပ်ပြီး စပါ။</div> : null}
    </section>
  </div>;
}
