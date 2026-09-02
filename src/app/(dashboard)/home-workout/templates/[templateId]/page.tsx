import Link from "next/link";
import { Blocks, CalendarRange, Film } from "lucide-react";
import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/admin/template-builder";
import { ExerciseVideoManager } from "@/components/admin/exercise-video-manager";
import { ProgramStructureBuilder } from "@/components/admin/program-structure-builder";
import { getAdminTemplate, getAdminTemplateExercises, getAdminTemplateProgram } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function TemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ templateId }, query] = await Promise.all([params, searchParams]);
  const [template, exerciseLibrary, program] = await Promise.all([
    getAdminTemplate(templateId),
    getAdminTemplateExercises(templateId),
    getAdminTemplateProgram(templateId),
  ]);
  if (!template || !program) notFound();

  const activeView = query.view === "content" || query.view === "videos" ? query.view : "program";
  return (
    <>
      <section className={styles.templateWorkspaceNav}>
        <div>
          <p className={styles.eyebrow}>HOME WORKOUT · TEMPLATE</p>
          <h1>{template.nameMm || template.nameEn}</h1>
          <p>Phase၊ Week၊ Session၊ Exercise နဲ့ Screen content အကုန်လုံးကို အောက်ကနေ တစ်ဆင့်ချင်းပြင်နိုင်ပါတယ်။</p>
        </div>
        <nav aria-label="Template editor sections">
          <Link aria-current={activeView === "program" ? "page" : undefined} data-active={activeView === "program"} href={`/home-workout/templates/${templateId}`}>
            <CalendarRange size={18} />
            <span><strong>Program Builder</strong><small>Phase၊ Week၊ Session၊ Exercise</small></span>
          </Link>
          <Link aria-current={activeView === "content" ? "page" : undefined} data-active={activeView === "content"} href={`/home-workout/templates/${templateId}?view=content`}>
            <Blocks size={18} />
            <span><strong>Screen Content</strong><small>စာသား၊ Timer၊ Block</small></span>
          </Link>
          <Link aria-current={activeView === "videos" ? "page" : undefined} data-active={activeView === "videos"} href={`/home-workout/templates/${templateId}?view=videos`}>
            <Film size={18} />
            <span><strong>Exercise Videos</strong><small>အဓိကနည်း၊ အစားထိုးနည်း</small></span>
          </Link>
        </nav>
      </section>
      {activeView === "program" ? <ProgramStructureBuilder initialProgram={program} /> : null}
      {activeView === "content" ? <TemplateBuilder initialTemplate={template} locale="mm" /> : null}
      {activeView === "videos" ? <ExerciseVideoManager templateId={templateId} library={exerciseLibrary} /> : null}
    </>
  );
}
