"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  BellRing,
  BetweenHorizontalStart,
  CheckSquare,
  CircleHelp,
  Clock3,
  Copy,
  Dumbbell,
  Eye,
  EyeOff,
  GripVertical,
  Heading,
  Image as ImageIcon,
  LayoutPanelTop,
  Link as LinkIcon,
  LoaderCircle,
  MonitorSmartphone,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { publishTemplateVersion, saveTemplateDraft } from "@/app/admin-actions";
import type { Locale } from "@/lib/i18n";
import {
  adminBlockTypes,
  type AdminBlockType,
  type AdminTemplate,
  type AdminTemplateBlock,
  type AdminTemplateDocument,
  type LocalizedBlockContent,
} from "./types";
import styles from "./admin.module.css";

const blockMeta: Record<AdminBlockType, { label: string; icon: LucideIcon }> = {
  heading: { label: "Heading", icon: Heading },
  rich_text: { label: "Rich text", icon: AlignLeft },
  callout: { label: "Callout", icon: BellRing },
  divider: { label: "Divider", icon: BetweenHorizontalStart },
  spacer: { label: "Spacer", icon: LayoutPanelTop },
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: Video },
  timer: { label: "Timer", icon: Clock3 },
  checklist: { label: "Checklist", icon: CheckSquare },
  exercise: { label: "Exercise", icon: Dumbbell },
  quiz: { label: "Quiz", icon: CircleHelp },
  button: { label: "Button", icon: LinkIcon },
};

function newId() {
  return crypto.randomUUID();
}

function createBlock(blockType: AdminBlockType): AdminTemplateBlock {
  const common = {
    id: newId(),
    blockType,
    titleMm: "",
    titleEn: "",
    contentMm: {},
    contentEn: {},
    config: {},
    visible: true,
  } satisfies AdminTemplateBlock;

  if (blockType === "heading") return { ...common, titleMm: "ခေါင်းစဉ်အသစ်", titleEn: "New heading", contentMm: { text: "သင်ခန်းစာကို စလိုက်မယ်" }, contentEn: { text: "Let’s begin the lesson" }, config: { level: 2 } };
  if (blockType === "rich_text") return { ...common, contentMm: { text: "Myanmar content ကို ဒီမှာရေးပါ" }, contentEn: { text: "Write the English content here." } };
  if (blockType === "callout") return { ...common, titleMm: "သတိထားရန်", titleEn: "Coach note", contentMm: { text: "Form မှန်အောင် အရင်ဦးစားပေး" }, contentEn: { text: "Prioritize clean form first." } };
  if (blockType === "divider") return common;
  if (blockType === "spacer") return { ...common, config: { height: 24 } };
  if (blockType === "image") return { ...common, contentMm: { caption: "ပုံစာတန်း", alt: "Workout demonstration" }, contentEn: { caption: "Image caption", alt: "Workout demonstration" }, config: { url: "" } };
  if (blockType === "video") return { ...common, titleMm: "လေ့ကျင့်ခန်း Video", titleEn: "Exercise video", contentMm: { caption: "Video ကိုကြည့်ပြီး form ကိုလေ့လာ" }, contentEn: { caption: "Watch the movement before you begin." }, config: { url: "", poster: "" } };
  if (blockType === "timer") return { ...common, titleMm: "အနားယူချိန်", titleEn: "Rest timer", contentMm: { label: "စမယ်" }, contentEn: { label: "Start" }, config: { seconds: 90, mode: "countdown" } };
  if (blockType === "checklist") return { ...common, titleMm: "ဒီနေ့ Checklist", titleEn: "Today’s checklist", contentMm: { items: ["Protein", "Water", "Sleep"] }, contentEn: { items: ["Protein", "Water", "Sleep"] } };
  if (blockType === "exercise") return { ...common, titleMm: "Push up", titleEn: "Push up", contentMm: { text: "Form မပျက်ခင် ရပ်လိုက်" }, contentEn: { text: "Stop before your form breaks." }, config: { sets: 3, reps: "8–12", restSeconds: 90, targetKg: 0 } };
  if (blockType === "quiz") return { ...common, contentMm: { question: "မေးခွန်းကို ဒီမှာရေးပါ", options: ["ရွေးချယ်မှု ၁", "ရွေးချယ်မှု ၂"], correctOption: 0 }, contentEn: { question: "Write the question here", options: ["Option one", "Option two"], correctOption: 0 } };
  return { ...common, contentMm: { label: "ဆက်မယ်" }, contentEn: { label: "Continue" }, config: { href: "#" } };
}

function summary(block: AdminTemplateBlock) {
  return block.titleEn || block.contentEn.text || block.contentEn.question || block.contentEn.label || blockMeta[block.blockType].label;
}

type SortableBlockProps = {
  block: AdminTemplateBlock;
  selected: boolean;
  locale: Locale;
  onSelect: () => void;
  onChange: (block: AdminTemplateBlock) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function SortableBlock({ block, selected, locale, onSelect, onChange, onDuplicate, onDelete }: SortableBlockProps) {
  const [editingLocale, setEditingLocale] = useState<Locale>(locale);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Icon = blockMeta[block.blockType].icon;
  const activeContent = editingLocale === "mm" ? block.contentMm : block.contentEn;
  const activeTitle = editingLocale === "mm" ? block.titleMm : block.titleEn;

  const updateContent = (next: Partial<LocalizedBlockContent>) => {
    onChange(editingLocale === "mm"
      ? { ...block, contentMm: { ...block.contentMm, ...next } }
      : { ...block, contentEn: { ...block.contentEn, ...next } });
  };
  const updateTitle = (value: string) => onChange(editingLocale === "mm" ? { ...block, titleMm: value } : { ...block, titleEn: value });
  const updateConfig = (key: string, value: unknown) => onChange({ ...block, config: { ...block.config, [key]: value } });

  async function uploadMedia(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const result = await response.json() as { url?: string; assetId?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Upload failed");
      onChange({ ...block, config: { ...block.config, url: result.url, mediaAssetId: result.assetId } });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <article
      className={styles.block}
      data-dragging={isDragging}
      data-selected={selected}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.blockHead} onClick={onSelect}>
        <button aria-label="Drag block" className={styles.dragHandle} type="button" {...attributes} {...listeners}><GripVertical size={16} /></button>
        <span className={styles.blockType}><Icon size={14} />{blockMeta[block.blockType].label}</span>
        <span className={styles.blockSummary}>{summary(block)}</span>
        <div className={styles.blockActions}>
          <button aria-label={block.visible ? "Hide block" : "Show block"} onClick={(event) => { event.stopPropagation(); onChange({ ...block, visible: !block.visible }); }} type="button">{block.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          <button aria-label="Duplicate block" onClick={(event) => { event.stopPropagation(); onDuplicate(); }} type="button"><Copy size={14} /></button>
          <button aria-label="Delete block" onClick={(event) => { event.stopPropagation(); onDelete(); }} type="button"><Trash2 size={14} /></button>
        </div>
      </div>
      {selected ? (
        <div className={styles.blockEditor}>
          <div className={styles.localeTabs}>
            <button data-active={editingLocale === "en"} onClick={() => setEditingLocale("en")} type="button">English</button>
            <button data-active={editingLocale === "mm"} onClick={() => setEditingLocale("mm")} type="button">မြန်မာ</button>
          </div>
          {!(["divider", "spacer", "rich_text"] as AdminBlockType[]).includes(block.blockType) ? (
            <div className={styles.field}>
              <label>Title · {editingLocale.toUpperCase()}</label>
              <input className={styles.input} onChange={(event) => updateTitle(event.target.value)} value={activeTitle} />
            </div>
          ) : null}
          {(["heading", "rich_text", "callout", "exercise"] as AdminBlockType[]).includes(block.blockType) ? (
            <div className={styles.field}>
              <label>{block.blockType === "heading" ? "Supporting copy" : "Content"} · {editingLocale.toUpperCase()}</label>
              <textarea className={styles.textarea} onChange={(event) => updateContent({ text: event.target.value })} value={activeContent.text ?? ""} />
            </div>
          ) : null}
          {block.blockType === "heading" ? <NumberField label="Heading level" max={3} min={1} onChange={(value) => updateConfig("level", value)} value={Number(block.config.level ?? 2)} /> : null}
          {block.blockType === "spacer" ? <NumberField label="Height · px" max={160} min={8} onChange={(value) => updateConfig("height", value)} value={Number(block.config.height ?? 24)} /> : null}
          {block.blockType === "image" || block.blockType === "video" ? (
            <>
              <div className={styles.field}>
                <label>Upload {block.blockType === "video" ? "short video · max 75 MB" : "image"}</label>
                <label className={styles.buttonSecondary} style={{ cursor: uploading ? "wait" : "pointer", justifyContent: "center" }}><Upload size={14} />{uploading ? "Uploading…" : "Choose file"}<input hidden disabled={uploading} accept={block.blockType === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"} type="file" onChange={(event) => void uploadMedia(event.target.files?.[0])} /></label>
                {uploadError ? <span className={styles.actionMessage}>{uploadError}</span> : null}
              </div>
              <div className={styles.field}>
                <label>{block.blockType === "video" ? "Video" : "Image"} URL</label>
                <input className={styles.input} onChange={(event) => updateConfig("url", event.target.value)} placeholder="https://…" type="url" value={String(block.config.url ?? "")} />
              </div>
              <div className={styles.field}>
                <label>Caption · {editingLocale.toUpperCase()}</label>
                <input className={styles.input} onChange={(event) => updateContent({ caption: event.target.value })} value={activeContent.caption ?? ""} />
              </div>
              {block.blockType === "image" ? <div className={styles.field}><label>Alternative text · {editingLocale.toUpperCase()}</label><input className={styles.input} onChange={(event) => updateContent({ alt: event.target.value })} value={activeContent.alt ?? ""} /></div> : null}
            </>
          ) : null}
          {block.blockType === "timer" ? (
            <div className={styles.formGrid}>
              <NumberField label="Seconds" max={3600} min={1} onChange={(value) => updateConfig("seconds", value)} value={Number(block.config.seconds ?? 90)} />
              <div className={styles.field}><label>Button label · {editingLocale.toUpperCase()}</label><input className={styles.input} onChange={(event) => updateContent({ label: event.target.value })} value={activeContent.label ?? ""} /></div>
            </div>
          ) : null}
          {block.blockType === "checklist" ? (
            <div className={styles.field}>
              <label>Items · one per line · {editingLocale.toUpperCase()}</label>
              <textarea className={styles.textarea} onChange={(event) => updateContent({ items: event.target.value.split("\n") })} value={(activeContent.items ?? []).join("\n")} />
            </div>
          ) : null}
          {block.blockType === "exercise" ? (
            <div className={styles.formGrid}>
              <NumberField label="Sets" max={12} min={1} onChange={(value) => updateConfig("sets", value)} value={Number(block.config.sets ?? 3)} />
              <div className={styles.field}><label>Reps</label><input className={styles.input} onChange={(event) => updateConfig("reps", event.target.value)} value={String(block.config.reps ?? "8–12")} /></div>
              <NumberField label="Rest · seconds" max={600} min={0} onChange={(value) => updateConfig("restSeconds", value)} value={Number(block.config.restSeconds ?? 90)} />
              <NumberField label="Target · kg" max={250} min={0} onChange={(value) => updateConfig("targetKg", value)} value={Number(block.config.targetKg ?? 0)} />
            </div>
          ) : null}
          {block.blockType === "quiz" ? (
            <>
              <div className={styles.field}><label>Question · {editingLocale.toUpperCase()}</label><textarea className={styles.textarea} onChange={(event) => updateContent({ question: event.target.value })} value={activeContent.question ?? ""} /></div>
              <div className={styles.field}><label>Options · one per line · {editingLocale.toUpperCase()}</label><textarea className={styles.textarea} onChange={(event) => updateContent({ options: event.target.value.split("\n") })} value={(activeContent.options ?? []).join("\n")} /></div>
              <NumberField label="Correct option · starts at 1" max={Math.max(1, activeContent.options?.length ?? 1)} min={1} onChange={(value) => updateContent({ correctOption: value - 1 })} value={(activeContent.correctOption ?? 0) + 1} />
            </>
          ) : null}
          {block.blockType === "button" ? (
            <div className={styles.formGrid}>
              <div className={styles.field}><label>Label · {editingLocale.toUpperCase()}</label><input className={styles.input} onChange={(event) => updateContent({ label: event.target.value })} value={activeContent.label ?? ""} /></div>
              <div className={styles.field}><label>Destination</label><input className={styles.input} onChange={(event) => updateConfig("href", event.target.value)} value={String(block.config.href ?? "#")} /></div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className={styles.field}><label>{label}</label><input className={styles.input} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} /></div>;
}

function PreviewBlock({ block, locale }: { block: AdminTemplateBlock; locale: Locale }) {
  const content = locale === "mm" ? block.contentMm : block.contentEn;
  const title = locale === "mm" ? block.titleMm : block.titleEn;
  if (!block.visible) return null;
  if (block.blockType === "heading") return <div className={styles.previewBlock}><h2>{title || content.text}</h2>{title && content.text ? <p>{content.text}</p> : null}</div>;
  if (block.blockType === "rich_text") return <div className={styles.previewBlock}><p>{content.text}</p></div>;
  if (block.blockType === "callout") return <div className={`${styles.previewBlock} ${styles.previewCallout}`}><strong>{title}</strong><p>{content.text}</p></div>;
  if (block.blockType === "divider") return <div className={styles.previewDivider} />;
  if (block.blockType === "spacer") return <div style={{ height: Math.min(100, Number(block.config.height ?? 24)) }} />;
  if (block.blockType === "image") {
    const url = String(block.config.url ?? "");
    return <div className={styles.previewBlock}><div className={styles.previewMedia} style={url ? { backgroundImage: `linear-gradient(rgba(6,17,26,.08), rgba(6,17,26,.08)), url(${JSON.stringify(url)})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{url ? null : <ImageIcon size={24} />}</div>{content.caption ? <p>{content.caption}</p> : null}</div>;
  }
  if (block.blockType === "video") {
    const url = String(block.config.url ?? "");
    return <div className={styles.previewBlock}>{url ? <video className={styles.previewMedia} controls preload="metadata" src={url} /> : <div className={styles.previewMedia}><Video size={24} /></div>}{content.caption ? <p>{content.caption}</p> : null}</div>;
  }
  if (block.blockType === "timer") {
    const seconds = Number(block.config.seconds ?? 90);
    return <div className={styles.previewTimer}><div><strong>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</strong><p>{title}</p></div><span>{content.label}</span></div>;
  }
  if (block.blockType === "checklist") return <div className={styles.previewChecklist}>{title ? <strong>{title}</strong> : null}{(content.items ?? []).filter(Boolean).map((item, index) => <div className={styles.previewCheckItem} key={`${item}-${index}`}><i />{item}</div>)}</div>;
  if (block.blockType === "exercise") return <div className={styles.previewExercise}><strong>{title}</strong><span>{String(block.config.sets ?? 3)} SETS × {String(block.config.reps ?? "8–12")} REPS · {String(block.config.restSeconds ?? 90)}S REST</span><p>{content.text}</p></div>;
  if (block.blockType === "quiz") return <div className={styles.previewQuiz}><strong>{content.question}</strong>{(content.options ?? []).filter(Boolean).map((option, index) => <span key={`${option}-${index}`}>{String.fromCharCode(65 + index)} · {option}</span>)}</div>;
  return <div className={styles.previewButton}>{content.label || title}</div>;
}

export function TemplateBuilder({ initialTemplate, locale }: { initialTemplate: AdminTemplate; locale: Locale }) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate);
  const [activeDocumentId, setActiveDocumentId] = useState(initialTemplate.documents[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeDocument = useMemo(() => template.documents.find((document) => document.id === activeDocumentId) ?? template.documents[0], [activeDocumentId, template.documents]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function mutate(next: AdminTemplate) {
    setTemplate(next);
    setDirty(true);
    setMessage("");
  }

  function updateActiveDocument(updater: (document: AdminTemplateDocument) => AdminTemplateDocument) {
    if (!activeDocument) return;
    mutate({ ...template, documents: template.documents.map((document) => document.id === activeDocument.id ? updater(document) : document) });
  }

  function updateBlock(nextBlock: AdminTemplateBlock) {
    updateActiveDocument((document) => ({ ...document, blocks: document.blocks.map((block) => block.id === nextBlock.id ? nextBlock : block) }));
  }

  function addBlock(blockType: AdminBlockType) {
    const block = createBlock(blockType);
    updateActiveDocument((document) => ({ ...document, blocks: [...document.blocks, block] }));
    setSelectedBlockId(block.id);
  }

  function onDragEnd(event: DragEndEvent) {
    if (!activeDocument || !event.over || event.active.id === event.over.id) return;
    const oldIndex = activeDocument.blocks.findIndex((block) => block.id === event.active.id);
    const newIndex = activeDocument.blocks.findIndex((block) => block.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateActiveDocument((document) => ({ ...document, blocks: arrayMove(document.blocks, oldIndex, newIndex) }));
  }

  function addDocument() {
    const count = template.documents.length + 1;
    const document: AdminTemplateDocument = { id: newId(), screenKey: `custom_${count}`, dayNumber: null, titleMm: `Screen ${count}`, titleEn: `Screen ${count}`, blocks: [] };
    mutate({ ...template, documents: [...template.documents, document] });
    setActiveDocumentId(document.id);
    setSelectedBlockId(null);
  }

  function removeDocument() {
    if (!activeDocument || template.documents.length <= 1 || !window.confirm(`Delete “${activeDocument.titleEn}” and all of its blocks?`)) return;
    const documents = template.documents.filter((document) => document.id !== activeDocument.id);
    mutate({ ...template, documents });
    setActiveDocumentId(documents[0].id);
    setSelectedBlockId(null);
  }

  async function save() {
    if (pending) return;
    setMessage("Saving…");
    startTransition(async () => {
      const result = await saveTemplateDraft({
        locale,
        templateId: template.id,
        versionId: template.versionId,
        slug: template.slug,
        nameMm: template.nameMm,
        nameEn: template.nameEn,
        descriptionMm: template.descriptionMm,
        descriptionEn: template.descriptionEn,
        documents: template.documents,
      });
      setMessage(result.message);
      if (result.ok) {
        setDirty(false);
        if (result.versionId && result.versionId !== template.versionId) setTemplate((current) => ({ ...current, versionId: result.versionId!, versionStatus: "draft", versionNo: current.versionNo + 1 }));
        router.refresh();
      }
    });
  }

  function publish() {
    if (dirty) {
      setMessage("Save the draft before publishing");
      return;
    }
    startTransition(async () => {
      const result = await publishTemplateVersion(template.id, template.versionId, locale);
      setMessage(result.message);
      if (result.ok) {
        setTemplate((current) => ({ ...current, versionStatus: "published" }));
        router.refresh();
      }
    });
  }

  if (!activeDocument) return null;
  return (
    <div className={styles.builderShell}>
      <aside className={styles.documentRail}>
        <div className={styles.railHeading}><strong>Screens · {String(template.documents.length).padStart(2, "0")}</strong><button aria-label="Add screen" className={styles.iconButton} onClick={addDocument} type="button"><Plus size={14} /></button></div>
        <div className={styles.documentList}>
          {template.documents.map((document, index) => (
            <button className={styles.documentTab} data-active={document.id === activeDocument.id} key={document.id} onClick={() => { setActiveDocumentId(document.id); setSelectedBlockId(null); }} type="button">
              <strong>{document.titleEn}</strong><span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.builderCanvas}>
        <div className={styles.builderToolbar}>
          <div>
            <p className={styles.eyebrow}>Template studio · Version {template.versionNo}</p>
            <h1>{template.nameEn}</h1>
            <p>{dirty ? "Unsaved changes" : `${template.versionStatus} version · all changes saved`}</p>
          </div>
          <div className={styles.toolbarActions}>
            <button className={styles.buttonSecondary} disabled={pending || !dirty} onClick={() => void save()} type="button">{pending ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />} Save draft</button>
            <button className={styles.button} disabled={pending || template.versionStatus === "published"} onClick={publish} type="button"><Send size={14} /> Publish</button>
          </div>
        </div>

        <div className={styles.documentSettings}>
          <div className={styles.field}><label>English screen title</label><input className={styles.input} onChange={(event) => updateActiveDocument((document) => ({ ...document, titleEn: event.target.value }))} value={activeDocument.titleEn} /></div>
          <div className={styles.field}><label>Myanmar screen title</label><input className={styles.input} onChange={(event) => updateActiveDocument((document) => ({ ...document, titleMm: event.target.value }))} value={activeDocument.titleMm} /></div>
          <div className={styles.field}><label>Screen key</label><input className={styles.input} onChange={(event) => updateActiveDocument((document) => ({ ...document, screenKey: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} value={activeDocument.screenKey} /></div>
          <div className={styles.field}><label>Program day · optional</label><input className={styles.input} max={48} min={1} onChange={(event) => updateActiveDocument((document) => ({ ...document, dayNumber: event.target.value ? Number(event.target.value) : null }))} placeholder="No fixed day" type="number" value={activeDocument.dayNumber ?? ""} /></div>
        </div>

        <details className={`${styles.blockPalette} ${styles.templateDetails}`}>
          <summary className={styles.blockPaletteTitle}>Template names and descriptions</summary>
          <div className={styles.formGrid}>
            <div className={styles.field}><label>English name</label><input className={styles.input} onChange={(event) => mutate({ ...template, nameEn: event.target.value })} value={template.nameEn} /></div>
            <div className={styles.field}><label>Myanmar name</label><input className={styles.input} onChange={(event) => mutate({ ...template, nameMm: event.target.value })} value={template.nameMm} /></div>
            <div className={styles.field}><label>English description</label><textarea className={styles.textarea} onChange={(event) => mutate({ ...template, descriptionEn: event.target.value })} value={template.descriptionEn} /></div>
            <div className={styles.field}><label>Myanmar description</label><textarea className={styles.textarea} onChange={(event) => mutate({ ...template, descriptionMm: event.target.value })} value={template.descriptionMm} /></div>
          </div>
        </details>

        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
          <SortableContext items={activeDocument.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.blocks}>
              {activeDocument.blocks.map((block) => (
                <SortableBlock
                  block={block}
                  key={block.id}
                  locale={locale}
                  onChange={updateBlock}
                  onDelete={() => { updateActiveDocument((document) => ({ ...document, blocks: document.blocks.filter((item) => item.id !== block.id) })); setSelectedBlockId(null); }}
                  onDuplicate={() => { const duplicate = { ...structuredClone(block), id: newId() }; updateActiveDocument((document) => { const index = document.blocks.findIndex((item) => item.id === block.id); const blocks = [...document.blocks]; blocks.splice(index + 1, 0, duplicate); return { ...document, blocks }; }); setSelectedBlockId(duplicate.id); }}
                  onSelect={() => setSelectedBlockId((current) => current === block.id ? null : block.id)}
                  selected={selectedBlockId === block.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className={styles.blockPalette}>
          <p className={styles.blockPaletteTitle}>Add a block to {activeDocument.titleEn}</p>
          <div className={styles.blockTypeGrid}>
            {adminBlockTypes.map((type) => {
              const Icon = blockMeta[type].icon;
              return <button className={styles.blockTypeButton} key={type} onClick={() => addBlock(type)} type="button"><Icon size={17} />{blockMeta[type].label}</button>;
            })}
          </div>
          <div className={styles.formActions}>
            <span className={styles.actionMessage} data-ok={!dirty && Boolean(message)}>{message}</span>
            <button className={styles.buttonDanger} disabled={template.documents.length <= 1} onClick={removeDocument} type="button"><Trash2 size={13} /> Delete screen</button>
          </div>
        </div>
      </section>

      <aside className={styles.previewRail}>
        <div className={styles.previewHeading}>
          <strong><MonitorSmartphone size={14} /> Customer preview</strong>
          <span>{previewLocale.toUpperCase()}</span>
        </div>
        <div className={styles.localeTabs} style={{ marginBottom: 14, paddingTop: 0 }}>
          <button data-active={previewLocale === "en"} onClick={() => setPreviewLocale("en")} type="button">English</button>
          <button data-active={previewLocale === "mm"} onClick={() => setPreviewLocale("mm")} type="button">မြန်မာ</button>
        </div>
        <div className={styles.previewMeta}>
          <span>Screen key</span><strong>{activeDocument.screenKey}</strong>
          <span>Blocks</span><strong>{String(activeDocument.blocks.length).padStart(2, "0")}</strong>
          <span>Target day</span><strong>{activeDocument.dayNumber ? `D${activeDocument.dayNumber}` : "Flexible"}</strong>
        </div>
        <div className={styles.phone} lang={previewLocale === "mm" ? "my" : "en"}>
          <div className={styles.phoneTop}><strong>{previewLocale === "mm" ? activeDocument.titleMm : activeDocument.titleEn}</strong><span>Project Peak</span></div>
          <div className={styles.phoneBody}>{activeDocument.blocks.map((block) => <PreviewBlock block={block} key={block.id} locale={previewLocale} />)}</div>
        </div>
      </aside>
    </div>
  );
}
