import Link from "next/link";
import { Blocks, Film } from "lucide-react";
import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/admin/template-builder";
import { ExerciseVideoManager } from "@/components/admin/exercise-video-manager";
import { getAdminTemplate, getAdminTemplateExercises } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function TemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ templateId }, query] = await Promise.all([params, searchParams]);
  const [template, exerciseLibrary] = await Promise.all([
    getAdminTemplate(templateId),
    getAdminTemplateExercises(templateId),
  ]);
  if (!template) notFound();

  const activeView = query.view === "videos" ? "videos" : "content";
  return (
    <>
      <section className={styles.templateWorkspaceNav}>
        <div>
          <p className={styles.eyebrow}>HOME WORKOUT · TEMPLATE</p>
          <h1>{template.nameMm || template.nameEn}</h1>
          <p>ပြင်ချင်တဲ့အပိုင်းကို အောက်က tab နှစ်ခုထဲကနေ ရွေးပါ။ Content ကိုပြင်ပြီးတိုင်း Draft သိမ်းပါ။</p>
        </div>
        <nav aria-label="Template editor sections">
          <Link aria-current={activeView === "content" ? "page" : undefined} data-active={activeView === "content"} href={`/home-workout/templates/${templateId}`}>
            <Blocks size={18} />
            <span><strong>Content Editor</strong><small>စာသား၊ Timer၊ Block ပြင်မယ်</small></span>
          </Link>
          <Link aria-current={activeView === "videos" ? "page" : undefined} data-active={activeView === "videos"} href={`/home-workout/templates/${templateId}?view=videos`}>
            <Film size={18} />
            <span><strong>Exercise Videos</strong><small>အဓိကနည်း၊ အစားထိုးနည်း</small></span>
          </Link>
        </nav>
      </section>
      {activeView === "videos"
        ? <ExerciseVideoManager templateId={templateId} library={exerciseLibrary} />
        : <TemplateBuilder initialTemplate={template} locale="mm" />}
    </>
  );
}
