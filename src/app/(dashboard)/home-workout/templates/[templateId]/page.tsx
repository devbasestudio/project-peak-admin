import Link from "next/link";
import { CalendarRange, Film } from "lucide-react";
import { notFound } from "next/navigation";
import { ProgramStructureBuilder } from "@/components/admin/program-structure-builder";
import { getAdminTemplateHeader, getAdminTemplateProgram } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const [template, program] = await Promise.all([
    getAdminTemplateHeader(templateId),
    getAdminTemplateProgram(templateId),
  ]);
  if (!template || !program) notFound();

  return (
    <>
      <section className={styles.templateWorkspaceNav}>
        <div>
          <p className={styles.eyebrow}>HOME WORKOUT · TEMPLATE</p>
          <h1>{template.nameMm || template.nameEn}</h1>
          <p>Week၊ Session နဲ့ Exercise အစီအစဉ်ကို ဒီမှာပြင်ပါ။ Exercise နဲ့ Video တွေကတော့ ဘုံ Library တစ်ခုတည်းကနေရွေးပါတယ်။</p>
        </div>
        <nav aria-label="Template editor sections">
          <Link aria-current="page" data-active href={`/home-workout/templates/${templateId}`}>
            <CalendarRange size={18} />
            <span><strong>Program Builder</strong><small>Phase၊ Week၊ Session၊ Exercise</small></span>
          </Link>
          <Link href="/exercises">
            <Film size={18} />
            <span><strong>Common Exercises</strong><small>Exercise + Video တစ်ခါပဲထည့်မယ်</small></span>
          </Link>
        </nav>
      </section>
      <ProgramStructureBuilder initialProgram={program} />
    </>
  );
}
