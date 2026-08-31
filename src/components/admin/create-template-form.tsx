"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { createProgramTemplate } from "@/app/admin-actions";
import type { Locale } from "@/lib/i18n";
import type { AdminActionResult } from "./types";
import styles from "./admin.module.css";

const initialState: AdminActionResult = { ok: false, message: "" };

export function CreateTemplateForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProgramTemplate, initialState);

  useEffect(() => {
    if (state.ok && state.templateId) router.push(`/home-workout/templates/${state.templateId}`);
  }, [locale, router, state]);

  return (
    <form action={formAction}>
      <input name="locale" type="hidden" value={locale} />
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="nameEn">English name</label>
          <input className={styles.input} id="nameEn" name="nameEn" placeholder="12 Week Home Workout" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="nameMm">Myanmar name</label>
          <input className={styles.input} id="nameMm" name="nameMm" placeholder="၁၂ ပတ် Home Workout" required />
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="slug">Slug</label>
          <input className={styles.input} id="slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="12-week-home-workout" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="descriptionEn">English description</label>
          <textarea className={styles.textarea} id="descriptionEn" name="descriptionEn" placeholder="A focused description for the coach workspace." />
        </div>
        <div className={styles.field}>
          <label htmlFor="descriptionMm">Myanmar description</label>
          <textarea className={styles.textarea} id="descriptionMm" name="descriptionMm" placeholder="Program အကြောင်း အကျဉ်းချုပ်" />
        </div>
      </div>
      <div className={styles.formActions}>
        {state.message ? <span className={styles.actionMessage} data-ok={state.ok}>{state.message}</span> : null}
        <button className={styles.button} disabled={pending} type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={15} /> : <ArrowRight aria-hidden="true" size={15} />}
          {pending ? "Creating…" : "Create and edit"}
        </button>
      </div>
    </form>
  );
}
