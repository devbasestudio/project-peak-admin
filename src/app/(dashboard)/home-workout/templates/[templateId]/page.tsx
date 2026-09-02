import Link from "next/link";
import { CalendarRange, Film } from "lucide-react";
import { notFound } from "next/navigation";
import { ExerciseVideoManager } from "@/components/admin/exercise-video-manager";
import { ProgramStructureBuilder } from "@/components/admin/program-structure-builder";
import { getAdminTemplateExercises, getAdminTemplateHeader, getAdminTemplateProgram } from "@/lib/data";
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
    getAdminTemplateHeader(templateId),
    getAdminTemplateExercises(templateId),
    getAdminTemplateProgram(templateId),
  ]);
  if (!template || !program) notFound();

  const activeView = query.view === "videos" ? "videos" : "program";
  return (
    <>
      <section className={styles.templateWorkspaceNav}>
        <div>
          <p className={styles.eyebrow}>HOME WORKOUT · TEMPLATE</p>
          <h1>{template.nameMm || template.nameEn}</h1>
          <p>Week၊ Session၊ Exercise အစီအစဉ်နဲ့ Exercise video တွေကို သီးသန့်ခွဲပြီး ပြင်နိုင်ပါတယ်။ Customer လမ်းညွှန် Screens တွေကို App code ထဲမှာ တစ်သတ်မှတ်တည်း ထည့်ထားပါတယ်။</p>
        </div>
        <nav aria-label="Template editor sections">
          <Link aria-current={activeView === "program" ? "page" : undefined} data-active={activeView === "program"} href={`/home-workout/templates/${templateId}`}>
            <CalendarRange size={18} />
            <span><strong>Program Builder</strong><small>Phase၊ Week၊ Session၊ Exercise</small></span>
          </Link>
          <Link aria-current={activeView === "videos" ? "page" : undefined} data-active={activeView === "videos"} href={`/home-workout/templates/${templateId}?view=videos`}>
            <Film size={18} />
            <span><strong>Exercise Videos</strong><small>အဓိကနည်း၊ အစားထိုးနည်း</small></span>
          </Link>
        </nav>
      </section>
      {activeView === "program" ? <ProgramStructureBuilder initialProgram={program} /> : null}
      {activeView === "videos" ? <ExerciseVideoManager templateId={templateId} library={exerciseLibrary} /> : null}
    </>
  );
}
