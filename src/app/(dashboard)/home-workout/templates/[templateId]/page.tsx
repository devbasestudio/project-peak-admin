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
          <p>Program အစီအစဉ်၊ customer အတွက် လမ်းညွှန်စာမျက်နှာနဲ့ Exercise video တွေကို သီးသန့်ခွဲပြီး ပြင်နိုင်ပါတယ်။</p>
        </div>
        <nav aria-label="Template editor sections">
          <Link aria-current={activeView === "program" ? "page" : undefined} data-active={activeView === "program"} href={`/home-workout/templates/${templateId}`}>
            <CalendarRange size={18} />
            <span><strong>Program Builder</strong><small>Phase၊ Week၊ Session၊ Exercise</small></span>
          </Link>
          <Link aria-current={activeView === "content" ? "page" : undefined} data-active={activeView === "content"} href={`/home-workout/templates/${templateId}?view=content`}>
            <Blocks size={18} />
            <span><strong>လမ်းညွှန် Screens</strong><small>Baseline၊ Day guide၊ Completion</small></span>
          </Link>
          <Link aria-current={activeView === "videos" ? "page" : undefined} data-active={activeView === "videos"} href={`/home-workout/templates/${templateId}?view=videos`}>
            <Film size={18} />
            <span><strong>Exercise Videos</strong><small>အဓိကနည်း၊ အစားထိုးနည်း</small></span>
          </Link>
        </nav>
      </section>
      {activeView === "program" ? <ProgramStructureBuilder initialProgram={program} /> : null}
      {activeView === "content" ? (
        <>
          <section className={styles.templatePurpose}>
            <Blocks size={20} />
            <div>
              <strong>ဒီနေရာက ဘာအတွက်လဲ?</strong>
              <p>Customer က Baseline စမ်းသပ်ချိန်၊ Workout စမယ့်အချိန်နဲ့ Program ပြီးဆုံးချိန်မှာ မြင်ရမယ့် လမ်းညွှန်စာသား၊ Timer၊ Checklist၊ ပုံနဲ့ Video တွေကို ပြင်ဖို့ပါ။ Week၊ Session၊ Sets၊ Reps ပြင်ချင်ရင် “Program Builder” ကိုသုံးပါ။</p>
            </div>
          </section>
          <TemplateBuilder initialTemplate={template} locale="mm" />
        </>
      ) : null}
      {activeView === "videos" ? <ExerciseVideoManager templateId={templateId} library={exerciseLibrary} /> : null}
    </>
  );
}
