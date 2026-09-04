"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveCoachingFeedbackTemplate } from "@/app/coaching-actions";
import styles from "./content-managers.module.css";

type FieldType = "short_text" | "long_text" | "number" | "rating" | "yes_no" | "image";
type Field = { key: string; label: string; type: FieldType; required: boolean };
type Template = { id: number; name: string; cadence: string; fields: unknown; active: boolean };

const defaults: Field[] = [
  { key: "avg_weight", label: "ဒီအပတ် ပျမ်းမျှကိုယ်အလေးချိန်", type: "number", required: true },
  { key: "progress_photo", label: "Progress photo", type: "image", required: false },
  { key: "energy_workout", label: "Workout လုပ်ချိန် Energy", type: "rating", required: true },
  { key: "energy_daily", label: "တစ်နေ့တာ Energy", type: "rating", required: true },
  { key: "motivation", label: "Motivation level", type: "rating", required: true },
  { key: "struggle_notes", label: "ဒီအပတ် အဓိကအခက်အခဲ", type: "long_text", required: false },
  { key: "improvement_notes", label: "ဒီအပတ် တိုးတက်မှု / အနိုင်ရမှု", type: "long_text", required: false },
  { key: "upcoming_disruptions", label: "လာမယ့်အပတ် ထိခိုက်နိုင်မယ့်ကိစ္စ", type: "long_text", required: false },
  { key: "changes_wanted", label: "Food / Exercise ပြောင်းချင်တာ", type: "long_text", required: false },
];

const fieldTypes: Array<{ value: FieldType; label: string }> = [
  { value: "short_text", label: "စာတို" },
  { value: "long_text", label: "စာရှည်" },
  { value: "number", label: "နံပါတ်" },
  { value: "rating", label: "1–10 Rating" },
  { value: "yes_no", label: "Yes / No" },
  { value: "image", label: "ဓာတ်ပုံ" },
];

function normalize(value: unknown): Field[] {
  if (!Array.isArray(value) || value.length === 0) return defaults;
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const legacyType = row.type === "text" ? "long_text" : row.type;
    const type = fieldTypes.some((option) => option.value === legacyType) ? legacyType as FieldType : "short_text";
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : `မေးခွန်း ${index + 1}`;
    const key = typeof row.key === "string" && row.key.trim() ? row.key : `custom_${index + 1}`;
    return [{ key, label, type, required: row.required === true }];
  });
}

function newField(): Field {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 12)
    : `${Date.now()}`;
  return { key: `custom_${suffix}`, label: "", type: "short_text", required: false };
}

export function FeedbackFormManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const first = templates.find((template) => template.cadence === "weekly") ?? templates[0];
  const [id, setId] = useState<number | undefined>(first?.id);
  const [name, setName] = useState(first?.name || "Weekly Coaching Check-in");
  const [cadence, setCadence] = useState<"weekly" | "end">(first?.cadence === "end" ? "end" : "weekly");
  const [active, setActive] = useState(first?.active ?? true);
  const [fields, setFields] = useState<Field[]>(normalize(first?.fields));
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(value: string) {
    const template = templates.find((item) => String(item.id) === value);
    if (!template) return;
    setId(template.id);
    setName(template.name);
    setCadence(template.cadence === "end" ? "end" : "weekly");
    setActive(template.active);
    setFields(normalize(template.fields));
    setMessage("");
  }

  function update(index: number, next: Partial<Field>) {
    setFields((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...next } : row));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((rows) => {
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveCoachingFeedbackTemplate({ id, name, cadence, active, fields });
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok && result.templateId) {
        setId(result.templateId);
        router.refresh();
      }
    });
  }

  const invalid = !name.trim() || fields.length === 0 || fields.some((field) => !field.label.trim());

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div><p>1:1 COACHING · CHECK-IN BUILDER</p><h1>မေးခွန်း Form ကို လွယ်လွယ်ဆောက်မယ်</h1><span>မေးခွန်းထည့်၊ အမျိုးအစားရွေး၊ အစီအစဉ်ပြောင်းပြီး သိမ်းလိုက်ရုံပါပဲ။ Client ရဲ့ Progress စာမျက်နှာမှာ တန်းပေါ်ပါမယ်။</span></div>
        {message ? <div className={styles.status} data-ok={ok}>{message}</div> : null}
      </header>

      <section className={styles.formSetupBar}>
        {templates.length > 0 && <label className={styles.field}><span>ပြင်မယ့် Form</span><select value={id} onChange={(event) => choose(event.target.value)}>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label>}
        <label className={styles.field}><span>Form နာမည်</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className={styles.field}><span>ဖြည့်ရမယ့်အချိန်</span><select value={cadence} onChange={(event) => setCadence(event.target.value as "weekly" | "end")}><option value="weekly">အပတ်စဉ်</option><option value="end">Program အဆုံး</option></select></label>
        <label className={styles.toggle}><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>အသုံးပြုမယ်</span></label>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.kicker}>CLIENT WILL SEE</p><h2>မေးခွန်း {fields.length} ခု</h2></div><button type="button" className={styles.secondary} onClick={() => setFields((rows) => [...rows, newField()])}><Plus size={17} />မေးခွန်းထည့်မယ်</button></div>
        <div className={styles.formBuilderBody}>
          {fields.map((field, index) => (
            <article className={styles.builderQuestion} key={field.key}>
              <div className={styles.builderNumber}>{String(index + 1).padStart(2, "0")}</div>
              <label className={styles.field}><span>မေးခွန်းစာသား</span><input value={field.label} placeholder="Client ကို မေးချင်တဲ့စာရေးပါ" onChange={(event) => update(index, { label: event.target.value })} /></label>
              <label className={styles.field}><span>အဖြေအမျိုးအစား</span><select value={field.type} onChange={(event) => update(index, { type: event.target.value as FieldType })}>{fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <label className={styles.requiredToggle}><input type="checkbox" checked={field.required} onChange={(event) => update(index, { required: event.target.checked })} /><span>မဖြစ်မနေ ဖြေရမယ်</span></label>
              <div className={styles.builderActions}>
                <button type="button" aria-label="အပေါ်ရွှေ့မယ်" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} /></button>
                <button type="button" aria-label="အောက်ရွှေ့မယ်" disabled={index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} /></button>
                <button type="button" aria-label="မေးခွန်းဖျက်မယ်" className={styles.removeQuestion} disabled={fields.length === 1} onClick={() => setFields((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
          <div className={styles.builderFooter}><p>မေးခွန်းတွေကို အပေါ်/အောက်ရွှေ့လို့ရပါတယ်။ သိမ်းပြီးရင် client app မှာ အစီအစဉ်အတိုင်း ပေါ်ပါမယ်။</p><button type="button" className={styles.button} disabled={pending || invalid} onClick={save}><Save size={17} />{pending ? "သိမ်းနေတယ်…" : "Form သိမ်းမယ်"}</button></div>
        </div>
      </section>
    </div>
  );
}
