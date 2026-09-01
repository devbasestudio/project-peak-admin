"use client";

import { useMemo, useState, useTransition, type ComponentType } from "react";
import {
  Camera,
  Check,
  CheckSquare,
  ChevronRight,
  Clock3,
  Eye,
  Hash,
  ListChecks,
  Minus,
  Plus,
  Save,
  Send,
  Type,
  X,
} from "lucide-react";
import { saveCoachingTemplate } from "@/app/coaching-actions";
import styles from "./template-builder.module.css";

type FieldType = "number" | "time" | "select" | "checkbox" | "counter" | "text" | "photo";
type Field = { id: string; label: string; type: FieldType; icon: string; fixed?: boolean; options?: string[] };
type Section = { title: "Morning" | "Mid-day" | "Night"; icon: string; fields: Field[] };
type Client = { id: string; username: string; email: string; avatar_url?: string | null; registration?: { name?: string | null; payment_status?: string | null } | null };
type Template = { user_id: string; name: string; sections: unknown; updated_at: string };
type IconComponent = ComponentType<{ size?: number; strokeWidth?: number }>;

const fieldTypes: Array<{
  value: FieldType;
  label: string;
  hint: string;
  defaultLabel: string;
  iconName: string;
  Icon: IconComponent;
}> = [
  { value: "number", label: "နံပါတ်", hint: "Weight၊ water စတဲ့ တန်ဖိုး", defaultLabel: "အမှတ် / တန်ဖိုး", iconName: "ph-hash", Icon: Hash },
  { value: "time", label: "အချိန်", hint: "အိပ်ချိန်၊ စားချိန်", defaultLabel: "အချိန်", iconName: "ph-clock", Icon: Clock3 },
  { value: "select", label: "ရွေးချယ်မှု", hint: "ရွေးစရာအနည်းငယ်", defaultLabel: "အခြေအနေ", iconName: "ph-list-checks", Icon: ListChecks },
  { value: "checkbox", label: "ပြီး / မပြီး", hint: "Habit ပြီးစီးမှု", defaultLabel: "ပြီးပါပြီ", iconName: "ph-check-square", Icon: CheckSquare },
  { value: "counter", label: "အကြိမ်ရေ", hint: "Steps၊ cups စတဲ့ count", defaultLabel: "အကြိမ်ရေ", iconName: "ph-plus-circle", Icon: Plus },
  { value: "text", label: "မှတ်စု", hint: "Client ရေးဖြည့်ရန်", defaultLabel: "မှတ်စု", iconName: "ph-note-pencil", Icon: Type },
  { value: "photo", label: "ဓာတ်ပုံ", hint: "Meal၊ progress photo", defaultLabel: "ဓာတ်ပုံ", iconName: "ph-camera", Icon: Camera },
];

const sectionHelp: Record<Section["title"], { mm: string; description: string }> = {
  Morning: { mm: "မနက်ပိုင်း", description: "နိုးပြီးချိန်မှာ client မှတ်တမ်းတင်ရမယ့်အရာများ" },
  "Mid-day": { mm: "နေ့လယ်ပိုင်း", description: "Workout၊ meal နဲ့ နေ့စဉ် activity များ" },
  Night: { mm: "ညပိုင်း", description: "ဒီနေ့ရလဒ်နဲ့ ပြန်သုံးသပ်ချက်များ" },
};

const starter: Section[] = [
  { title: "Morning", icon: "ph-sun-horizon", fields: [{ id: "body_weight", label: "Morning weight", type: "number", icon: "ph-scales", fixed: true }, { id: "sleep", label: "Sleep quality", type: "select", icon: "ph-moon", options: ["Low", "OK", "Great"] }] },
  { title: "Mid-day", icon: "ph-sun", fields: [{ id: "workout", label: "Workout complete", type: "checkbox", icon: "ph-barbell" }, { id: "meal_photo", label: "Meal photo", type: "photo", icon: "ph-camera" }, { id: "steps", label: "Steps", type: "counter", icon: "ph-person-simple-walk" }] },
  { title: "Night", icon: "ph-moon-stars", fields: [{ id: "win", label: "Today’s win", type: "text", icon: "ph-trend-up" }, { id: "struggle", label: "Main struggle", type: "text", icon: "ph-warning-circle" }, { id: "water", label: "Water (litres)", type: "number", icon: "ph-drop" }] },
];

function normalize(value: unknown): Section[] {
  return Array.isArray(value) && value.length === 3
    ? JSON.parse(JSON.stringify(value))
    : JSON.parse(JSON.stringify(starter));
}

function snapshot(name: string, sections: Section[]) {
  return JSON.stringify({ name, sections });
}

function FieldPreview({ field }: { field: Field }) {
  if (field.type === "select") return <div className={styles.previewChoices}>{(field.options?.length ? field.options : ["ရွေးချယ်ရန်"]).slice(0, 3).map((option) => <span key={option}>{option}</span>)}</div>;
  if (field.type === "checkbox") return <span className={styles.previewCheckbox}><Check size={13} /> ပြီးပါပြီ</span>;
  if (field.type === "counter") return <span className={styles.previewCounter}>− <b>0</b> +</span>;
  if (field.type === "photo") return <span className={styles.previewUpload}><Camera size={14} /> ဓာတ်ပုံတင်မယ်</span>;
  if (field.type === "time") return <span className={styles.previewValue}>08:00</span>;
  if (field.type === "number") return <span className={styles.previewValue}>0</span>;
  return <span className={styles.previewText}>ဒီနေရာမှာ ရေးဖြည့်မယ်…</span>;
}

export function CoachingTemplateBuilder({ clients, templates }: { clients: Client[]; templates: Template[] }) {
  const firstClientId = clients[0]?.id || "";
  const firstTemplate = templates.find((item) => item.user_id === firstClientId);
  const initialName = firstTemplate?.name || "My 1:1 Coaching Day";
  const initialSections = normalize(firstTemplate?.sections);
  const [clientId, setClientId] = useState(firstClientId);
  const [name, setName] = useState(initialName);
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot(initialName, initialSections));
  const [message, setMessage] = useState("");
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [activated, setActivated] = useState(firstClientId !== "" && clients[0]?.registration?.payment_status === "ready");
  const [pending, startTransition] = useTransition();

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clients, clientId]);
  const fieldCount = useMemo(() => sections.reduce((total, section) => total + section.fields.length, 0), [sections]);
  const dirty = snapshot(name, sections) !== savedSnapshot;
  const canSave = Boolean(clientId && name.trim() && sections.every((section) => section.fields.every((field) => field.label.trim() && (field.type !== "select" || field.options?.length))));

  function selectClient(nextClientId: string) {
    const nextTemplate = templates.find((item) => item.user_id === nextClientId);
    const nextName = nextTemplate?.name || "My 1:1 Coaching Day";
    const nextSections = normalize(nextTemplate?.sections);
    setClientId(nextClientId);
    setName(nextName);
    setSections(nextSections);
    setSavedSnapshot(snapshot(nextName, nextSections));
    setActivated(clients.find((client) => client.id === nextClientId)?.registration?.payment_status === "ready");
    setAddingTo(null);
    setMessage("");
  }

  function update(sectionIndex: number, fieldIndex: number, patch: Partial<Field>) {
    setSections((all) => all.map((section, sectionPosition) => sectionPosition !== sectionIndex ? section : {
      ...section,
      fields: section.fields.map((field, fieldPosition) => fieldPosition !== fieldIndex ? field : { ...field, ...patch }),
    }));
    setMessage("");
  }

  function add(sectionIndex: number, type: FieldType) {
    const config = fieldTypes.find((item) => item.value === type) ?? fieldTypes[5];
    setSections((all) => all.map((section, sectionPosition) => sectionPosition !== sectionIndex ? section : {
      ...section,
      fields: [...section.fields, {
        id: `custom_${crypto.randomUUID().slice(0, 8)}`,
        label: config.defaultLabel,
        type,
        icon: config.iconName,
        options: type === "select" ? ["အားနည်း", "အဆင်ပြေ", "အကောင်းဆုံး"] : undefined,
      }],
    }));
    setAddingTo(null);
    setMessage("");
  }

  function remove(sectionIndex: number, fieldIndex: number) {
    setSections((all) => all.map((section, sectionPosition) => sectionPosition !== sectionIndex ? section : {
      ...section,
      fields: section.fields.filter((field, fieldPosition) => fieldPosition !== fieldIndex || field.fixed),
    }));
    setMessage("");
  }

  function save(markReady: boolean) {
    if (!canSave) {
      setMessage("Client၊ template name နဲ့ field name တွေကို အရင်ဖြည့်ပေးပါ။");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const result = await saveCoachingTemplate({ userId: clientId, name, sections, markReady });
      setMessage(result.message);
      if (result.ok) {
        setSavedSnapshot(snapshot(name, sections));
        if (markReady) setActivated(true);
      }
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p>CLIENT-SPECIFIC · NO CODE</p>
          <h1>Custom Template Builder</h1>
          <span>Client တစ်ယောက်ကိုရွေးပြီး သူနေ့စဉ်မှတ်တမ်းတင်ရမယ့်အရာတွေကို အဆင့်လိုက်တည်ဆောက်ပါ။ Technical knowledge မလိုပါဘူး။</span>
        </div>
        <div className={styles.saveState} data-dirty={dirty}>
          <span />
          {pending ? "သိမ်းနေပါတယ်…" : dirty ? "မသိမ်းရသေးတဲ့ ပြင်ဆင်မှုရှိပါတယ်" : "နောက်ဆုံးပြင်ဆင်မှု သိမ်းပြီးပါပြီ"}
        </div>
      </header>

      {clients.length === 0 ? (
        <div className={styles.empty}><strong>Template ဆောက်ဖို့ client မရှိသေးပါ</strong><span>Payment approve အရင်လုပ်ပေးပါ။</span></div>
      ) : (
        <>
          <ol className={styles.steps} aria-label="Template setup progress">
            <li data-done={Boolean(clientId)}><span>1</span><div><strong>Client ရွေးမယ်</strong><small>{selectedClient?.email || "Client ရွေးပါ"}</small></div><Check size={17} /></li>
            <li data-done={fieldCount > 0}><span>2</span><div><strong>နေ့စဉ်ပုံစံ ဆောက်မယ်</strong><small>{fieldCount} fields ထည့်ထားပါတယ်</small></div><Check size={17} /></li>
            <li data-done={activated && !dirty}><span>3</span><div><strong>Client ကို ဖွင့်ပေးမယ်</strong><small>{activated && !dirty ? "အသုံးပြုနိုင်ပါပြီ" : "Activate လုပ်ရန်ကျန်ပါတယ်"}</small></div><ChevronRight size={17} /></li>
          </ol>

          <section className={styles.setupCard}>
            <label>
              <span>ဘယ် Client အတွက်လဲ?</span>
              <select value={clientId} onChange={(event) => selectClient(event.target.value)}>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.username || client.registration?.name || client.email} · {client.email}</option>)}
              </select>
            </label>
            <label>
              <span>Template နာမည်</span>
              <input value={name} maxLength={180} onChange={(event) => { setName(event.target.value); setMessage(""); }} placeholder="ဥပမာ — Phyo ရဲ့ Daily Coaching Plan" />
            </label>
          </section>

          <div className={styles.workspace}>
            <div className={styles.sections}>
              {sections.map((section, sectionIndex) => {
                const help = sectionHelp[section.title];
                return (
                  <section className={styles.section} key={section.title}>
                    <div className={styles.sectionHead}>
                      <span>0{sectionIndex + 1}</span>
                      <div><small>{section.title}</small><strong>{help.mm}</strong><p>{help.description}</p></div>
                      <b>{section.fields.length} ခု</b>
                    </div>
                    <div className={styles.fields}>
                      {section.fields.map((field, fieldIndex) => {
                        const config = fieldTypes.find((item) => item.value === field.type) ?? fieldTypes[5];
                        const Icon = config.Icon;
                        return (
                          <article key={field.id}>
                            <span className={styles.typeIcon}><Icon size={18} /></span>
                            <label className={styles.fieldName}>
                              <span>Client မြင်မယ့် နာမည်</span>
                              <input aria-label={`${help.mm} field ${fieldIndex + 1} name`} value={field.label} maxLength={180} onChange={(event) => update(sectionIndex, fieldIndex, { label: event.target.value })} />
                            </label>
                            <label className={styles.fieldType}>
                              <span>ဖြည့်ရမယ့်ပုံစံ</span>
                              <select aria-label={`${field.label} field type`} value={field.type} disabled={field.fixed} onChange={(event) => {
                                const type = event.target.value as FieldType;
                                const next = fieldTypes.find((item) => item.value === type) ?? fieldTypes[5];
                                update(sectionIndex, fieldIndex, { type, icon: next.iconName, options: type === "select" ? ["အားနည်း", "အဆင်ပြေ", "အကောင်းဆုံး"] : undefined });
                              }}>
                                {fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                              </select>
                            </label>
                            <button type="button" disabled={field.fixed} onClick={() => remove(sectionIndex, fieldIndex)} aria-label={`${field.label} ကို ဖယ်မယ်`}><Minus size={18} /></button>
                            {field.type === "select" ? (
                              <label className={styles.options}>
                                <span>ရွေးချယ်စရာများ — comma နဲ့ခွဲရေးပါ</span>
                                <input aria-label={`${field.label} choices`} placeholder="အားနည်း, အဆင်ပြေ, အကောင်းဆုံး" value={(field.options || []).join(", ")} onChange={(event) => update(sectionIndex, fieldIndex, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                              </label>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>

                    {addingTo === sectionIndex ? (
                      <div className={styles.picker}>
                        <div className={styles.pickerHead}><div><strong>ဘာကိုမှတ်စေချင်လဲ?</strong><span>Client ဖြည့်ရမယ့်ပုံစံကို ရွေးပါ</span></div><button type="button" onClick={() => setAddingTo(null)} aria-label="Field picker ပိတ်မယ်"><X size={18} /></button></div>
                        <div className={styles.typeGrid}>
                          {fieldTypes.map(({ value, label, hint, Icon }) => <button type="button" key={value} onClick={() => add(sectionIndex, value)}><Icon size={19} /><span><strong>{label}</strong><small>{hint}</small></span></button>)}
                        </div>
                      </div>
                    ) : (
                      <button className={styles.add} type="button" onClick={() => setAddingTo(sectionIndex)}><Plus size={17} /> ဒီအချိန်အတွက် Field ထည့်မယ်</button>
                    )}
                  </section>
                );
              })}
            </div>

            <aside className={styles.preview} aria-label="Client dashboard preview">
              <div className={styles.previewHead}><span><Eye size={16} /> CLIENT PREVIEW</span><small>Client ဘက်မှာ ဒီလိုမြင်ရပါမယ်</small></div>
              <div className={styles.phone}>
                <div className={styles.phoneTop}><span>PROJECT PEAK</span><b>1:1</b></div>
                <div className={styles.clientName}><small>DAILY SYSTEM</small><strong>{name || "Template name"}</strong><span>{selectedClient?.username || selectedClient?.registration?.name || selectedClient?.email}</span></div>
                {sections.map((section) => <section key={section.title}><header><span>{sectionHelp[section.title].mm}</span><small>{section.title}</small></header>{section.fields.map((field) => <div className={styles.previewField} key={field.id}><span>{field.label || "Field name"}</span><FieldPreview field={field} /></div>)}</section>)}
              </div>
            </aside>
          </div>

          <div className={styles.actions}>
            <div><strong>{dirty ? "ပြင်ထားတာတွေ မသိမ်းရသေးပါ" : "Template အသင့်ဖြစ်ပါတယ်"}</strong><span>Draft က client ကို ready မပြောင်းပါ။ Activate လုပ်မှ client စသုံးနိုင်ပါမယ်။</span></div>
            <button disabled={pending || !canSave || !dirty} onClick={() => save(false)}><Save size={17} />{pending ? "သိမ်းနေပါတယ်…" : "Draft သိမ်းမယ်"}</button>
            <button disabled={pending || !canSave} data-primary onClick={() => save(true)}><Send size={17} />{pending ? "ဖွင့်ပေးနေပါတယ်…" : "Save + Client ကိုဖွင့်ပေးမယ်"}</button>
            {message ? <p role="status" data-success={!message.includes("အရင်") && !message.includes("မမှန်")}>{message}</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
