import Link from "next/link";
import { ArrowUpRight, Layers3 } from "lucide-react";
import { CreateTemplateForm } from "@/components/admin/create-template-form";
import { getAdminTemplates } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function TemplatesPage() {
  const templates = await getAdminTemplates();
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{templates.length} ခုရှိ</p>
          <h1 className={styles.pageTitle}>Program Template</h1>
          <p className={styles.pageDescription}>Phase 1/2၊ Week 1–12၊ Session 48 ခု၊ Exercise Sets/Reps/Rest နဲ့ Videos တွေကို ပြင်နိုင်ပါတယ်။ Customer လမ်းညွှန် Screens တွေကို App ထဲမှာ အဆင်ပြေအောင် တစ်သတ်မှတ်တည်း ထည့်ထားပါတယ်။ Published template ကိုပြင်လျှင် Draft version အသစ်ဖြစ်ပြီး ရှိပြီးသား customer data မပြောင်းပါဘူး။</p>
        </div>
      </div>
      {templates.length ? (
        <div className={styles.templatesGrid}>
          {templates.map((template) => (
            <Link className={styles.templateCard} href={`/home-workout/templates/${template.id}`} key={template.id}>
              <div className={styles.templateCardTop}><span className={styles.templateMark}><Layers3 size={18} /></span><span className={styles.status} data-status={template.latest?.status ?? "draft"}>{template.latest?.status ?? "empty"}</span></div>
              <h2>{template.name_en}</h2>
              <p>{template.description_mm || template.description_en || "ဖော်ပြချက်မရှိသေးပါ။"}</p>
              <div className={styles.templateMeta}><span>V{template.latest?.version_no ?? 0} · 12 weeks · 48 sessions</span><ArrowUpRight size={15} /></div>
            </Link>
          ))}
        </div>
      ) : null}
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <div className={styles.panelHeader}><h2>Template အသစ်လုပ်မယ်</h2><span className={styles.muted}>12 ပတ် Program အစီအစဉ်အသစ် စပါမယ်</span></div>
        <div className={styles.panelBody}><CreateTemplateForm locale="mm" /></div>
      </section>
    </>
  );
}
