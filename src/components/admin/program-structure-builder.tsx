"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Dumbbell,
  Layers3,
  LoaderCircle,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { publishTemplateVersion, saveTemplateProgramStructure } from "@/app/admin-actions";
import type { AdminProgramDay, AdminProgramDayItem, AdminProgramStructure } from "./types";
import styles from "./program-structure-builder.module.css";

const sessionTypeLabel = { push: "PUSH", pull: "PULL", challenge: "CHALLENGE" } as const;

function normalizedProgram(program: AdminProgramStructure): AdminProgramStructure {
  const byNumber = new Map(program.days.map((day) => [day.dayNumber, day]));
  return {
    ...program,
    days: Array.from({ length: 48 }, (_, index) => {
      const dayNumber = index + 1;
      const existing = byNumber.get(dayNumber);
      if (existing) return existing;
      const dayType = dayNumber % 2 === 1 ? "push" : "pull";
      return {
        id: crypto.randomUUID(),
        dayNumber,
        dayType,
        phase: dayNumber <= 12 ? 1 : 2,
        titleMm: dayType === "push" ? "Push လေ့ကျင့်ခန်း" : "Pull လေ့ကျင့်ခန်း",
        titleEn: dayType === "push" ? "Push session" : "Pull session",
        items: [],
      } satisfies AdminProgramDay;
    }),
  };
}

export function ProgramStructureBuilder({ initialProgram }: { initialProgram: AdminProgramStructure }) {
  const router = useRouter();
  const [program, setProgram] = useState(() => normalizedProgram(initialProgram));
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const weekDays = useMemo(
    () => program.days.filter((day) => Math.ceil(day.dayNumber / 4) === selectedWeek),
    [program.days, selectedWeek],
  );
  const activeDay = program.days.find((day) => day.dayNumber === selectedDayNumber) ?? weekDays[0];
  const weekPhase = weekDays[0]?.phase ?? 1;
  const totalItems = program.days.reduce((total, day) => total + day.items.length, 0);
  const phaseWeeks = ([1, 2] as const).map((phase) => ({
    phase,
    weeks: Array.from({ length: 12 }, (_, index) => index + 1).filter((week) => {
      const firstDay = program.days.find((day) => Math.ceil(day.dayNumber / 4) === week);
      return firstDay?.phase === phase;
    }),
  }));

  function mutateDays(updater: (days: AdminProgramDay[]) => AdminProgramDay[]) {
    setProgram((current) => ({ ...current, days: updater(current.days) }));
    setDirty(true);
    setMessage("");
  }

  function updateDay(dayNumber: number, updater: (day: AdminProgramDay) => AdminProgramDay) {
    mutateDays((days) => days.map((day) => day.dayNumber === dayNumber ? updater(day) : day));
  }

  function chooseWeek(week: number) {
    setSelectedWeek(week);
    setSelectedDayNumber((week - 1) * 4 + 1);
  }

  function setPhase(phase: 1 | 2) {
    mutateDays((days) => days.map((day) => Math.ceil(day.dayNumber / 4) === selectedWeek ? { ...day, phase } : day));
  }

  function updateItem(itemIndex: number, values: Partial<AdminProgramDayItem>) {
    if (!activeDay) return;
    updateDay(activeDay.dayNumber, (day) => ({
      ...day,
      items: day.items.map((item, index) => index === itemIndex ? { ...item, ...values } : item),
    }));
  }

  function addExercise() {
    if (!activeDay) return;
    const used = new Set(activeDay.items.map((item) => item.exerciseSlug));
    const exercise = program.exercises.find((candidate) => !used.has(candidate.slug));
    if (!exercise) {
      setMessage("ဒီ Session ထဲမှာ Exercise library အကုန်ထည့်ပြီးပါပြီ");
      return;
    }
    updateDay(activeDay.dayNumber, (day) => ({
      ...day,
      items: [...day.items, {
        id: crypto.randomUUID(),
        exerciseSlug: exercise.slug,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        targetKg: 0,
        restSeconds: 90,
        effort: "",
      }],
    }));
  }

  function removeExercise(itemIndex: number) {
    if (!activeDay) return;
    updateDay(activeDay.dayNumber, (day) => ({ ...day, items: day.items.filter((_, index) => index !== itemIndex) }));
  }

  function moveExercise(itemIndex: number, direction: -1 | 1) {
    if (!activeDay) return;
    const target = itemIndex + direction;
    if (target < 0 || target >= activeDay.items.length) return;
    updateDay(activeDay.dayNumber, (day) => {
      const items = [...day.items];
      [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
      return { ...day, items };
    });
  }

  function save() {
    if (pending || !dirty) return;
    setMessage("Program အစီအစဉ် သိမ်းနေပါတယ်…");
    startTransition(async () => {
      const result = await saveTemplateProgramStructure({
        locale: "mm",
        templateId: program.templateId,
        versionId: program.versionId,
        days: program.days.map((day) => ({
          dayNumber: day.dayNumber,
          dayType: day.dayType,
          phase: day.phase,
          titleMm: day.titleMm,
          titleEn: day.titleEn,
          items: day.items.map((item) => ({
            exerciseSlug: item.exerciseSlug,
            sets: item.sets,
            repsMin: item.repsMin,
            repsMax: item.repsMax,
            targetKg: item.targetKg,
            restSeconds: item.restSeconds,
            effort: item.effort,
          })),
        })),
      });
      setMessage(result.message);
      if (result.ok) {
        setDirty(false);
        if (result.versionId && result.versionId !== program.versionId) {
          setProgram((current) => ({ ...current, versionId: result.versionId!, versionStatus: "draft", versionNo: current.versionNo + 1 }));
        }
        router.refresh();
      }
    });
  }

  function publish() {
    if (pending || dirty || program.versionStatus === "published") return;
    setMessage("Customer သုံးနိုင်အောင် Publish လုပ်နေပါတယ်…");
    startTransition(async () => {
      const result = await publishTemplateVersion(program.templateId, program.versionId, "mm");
      setMessage(result.message);
      if (result.ok) {
        setProgram((current) => ({ ...current, versionStatus: "published" }));
        router.refresh();
      }
    });
  }

  if (!activeDay) return null;

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p>PROGRAM BUILDER · VERSION {program.versionNo}</p>
          <h2>12 ပတ် Program ကို တစ်နေရာထဲက ပြင်မယ်</h2>
          <span>{dirty ? "မသိမ်းရသေးတဲ့ ပြင်ဆင်မှုရှိပါတယ်" : program.versionStatus === "published" ? "Published ဖြစ်ပြီးပါပြီ" : "Draft သိမ်းပြီးပါပြီ"}</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} disabled={pending || !dirty} onClick={save} type="button">
            {pending ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />} Draft သိမ်းမယ်
          </button>
          <button className={styles.primaryButton} disabled={pending || dirty || program.versionStatus === "published"} onClick={publish} type="button">
            <Send size={17} /> Customer သုံးရန် Publish
          </button>
        </div>
      </header>

      <div className={styles.stats}>
        <span><strong>2</strong> Phases</span>
        <span><strong>12</strong> Weeks</span>
        <span><strong>48</strong> Sessions</span>
        <span><strong>{totalItems}</strong> Exercise rows</span>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.weekRail}>
          <div className={styles.railTitle}><Layers3 size={17} /><strong>Phase & Week</strong></div>
          {phaseWeeks.map(({ phase, weeks }) => (
            <div className={styles.phaseGroup} key={phase}>
              <div><span>PHASE {phase}</span><small>{weeks.length} ပတ်</small></div>
              <nav aria-label={`Phase ${phase} weeks`}>
                {weeks.map((week) => (
                  <button data-active={week === selectedWeek} key={week} onClick={() => chooseWeek(week)} type="button">
                    <span>Week {String(week).padStart(2, "0")}</span><ChevronRight size={14} />
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        <main className={styles.editor}>
          <div className={styles.weekHeader}>
            <div><p>WEEK {String(selectedWeek).padStart(2, "0")}</p><h3>Session 4 ခုကို ပြင်မယ်</h3></div>
            <label><span>ဒီ Week ရဲ့ Phase</span><select value={weekPhase} onChange={(event) => setPhase(Number(event.target.value) as 1 | 2)}><option value={1}>Phase 1</option><option value={2}>Phase 2</option></select></label>
          </div>

          <div className={styles.sessionTabs} role="tablist" aria-label={`Week ${selectedWeek} sessions`}>
            {weekDays.map((day, index) => (
              <button aria-selected={day.dayNumber === activeDay.dayNumber} data-active={day.dayNumber === activeDay.dayNumber} key={day.dayNumber} onClick={() => setSelectedDayNumber(day.dayNumber)} role="tab" type="button">
                <span>SESSION {index + 1}</span><strong>{sessionTypeLabel[day.dayType]}</strong><small>Day {day.dayNumber} · {day.items.length} exercises</small>
              </button>
            ))}
          </div>

          <div className={styles.sessionEditor}>
            <div className={styles.sectionTitle}><span>{String(activeDay.dayNumber).padStart(2, "0")}</span><div><p>SESSION DETAILS</p><h3>Day {activeDay.dayNumber} ကိုပြင်မယ်</h3></div></div>
            <div className={styles.formGrid}>
              <label><span>Session အမျိုးအစား</span><select value={activeDay.dayType} onChange={(event) => updateDay(activeDay.dayNumber, (day) => ({ ...day, dayType: event.target.value as AdminProgramDay["dayType"] }))}><option value="push">Push</option><option value="pull">Pull</option><option value="challenge">Challenge</option></select></label>
              <label><span>မြန်မာ ခေါင်းစဉ်</span><input value={activeDay.titleMm} onChange={(event) => updateDay(activeDay.dayNumber, (day) => ({ ...day, titleMm: event.target.value }))} /></label>
              <label><span>English title</span><input value={activeDay.titleEn} onChange={(event) => updateDay(activeDay.dayNumber, (day) => ({ ...day, titleEn: event.target.value }))} /></label>
            </div>

            <div className={styles.exerciseHeader}><div><p>EXERCISES</p><h3>{activeDay.items.length} ခုရှိပါတယ်</h3></div><button onClick={addExercise} type="button"><Plus size={16} /> Exercise ထည့်မယ်</button></div>
            <div className={styles.exerciseList}>
              {activeDay.items.map((item, itemIndex) => {
                const exercise = program.exercises.find((candidate) => candidate.slug === item.exerciseSlug);
                return (
                  <article className={styles.exerciseCard} key={item.id}>
                    <div className={styles.exerciseTop}>
                      <span className={styles.exerciseNumber}>{String(itemIndex + 1).padStart(2, "0")}</span>
                      <label><span>Exercise</span><select value={item.exerciseSlug} onChange={(event) => updateItem(itemIndex, { exerciseSlug: event.target.value })}>{program.exercises.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{candidate.nameEn} · {candidate.nameMm}</option>)}</select></label>
                      <div className={styles.rowActions}>
                        <button aria-label="အပေါ်ရွှေ့မယ်" disabled={itemIndex === 0} onClick={() => moveExercise(itemIndex, -1)} type="button"><ArrowUp size={15} /></button>
                        <button aria-label="အောက်ရွှေ့မယ်" disabled={itemIndex === activeDay.items.length - 1} onClick={() => moveExercise(itemIndex, 1)} type="button"><ArrowDown size={15} /></button>
                        <button aria-label="Exercise ဖယ်မယ်" onClick={() => removeExercise(itemIndex)} type="button"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className={styles.exerciseMeta}><Dumbbell size={14} /><span>{exercise?.equipmentEn || exercise?.equipmentMm || "Equipment မသတ်မှတ်ရသေး"}</span></div>
                    <div className={styles.numberGrid}>
                      <NumberInput label="Sets" min={1} max={20} value={item.sets} onChange={(sets) => updateItem(itemIndex, { sets })} />
                      <NumberInput label="Reps အနည်းဆုံး" min={0} max={999} value={item.repsMin} onChange={(repsMin) => updateItem(itemIndex, { repsMin, repsMax: Math.max(repsMin, item.repsMax) })} />
                      <NumberInput label="Reps အများဆုံး" min={item.repsMin} max={999} value={item.repsMax} onChange={(repsMax) => updateItem(itemIndex, { repsMax })} />
                      <NumberInput label="Target kg" min={0} max={9999} step={0.5} value={item.targetKg} onChange={(targetKg) => updateItem(itemIndex, { targetKg })} />
                      <NumberInput label="နားချိန် · sec" min={0} max={3600} value={item.restSeconds} onChange={(restSeconds) => updateItem(itemIndex, { restSeconds })} />
                      <label><span>Coach note / Effort</span><input value={item.effort} onChange={(event) => updateItem(itemIndex, { effort: event.target.value })} placeholder="ဥပမာ RPE 8" /></label>
                    </div>
                  </article>
                );
              })}
              {!activeDay.items.length ? <div className={styles.empty}><Dumbbell size={24} /><strong>Exercise မရှိသေးပါ</strong><p>“Exercise ထည့်မယ်” ကိုနှိပ်ပြီး စတင်ပါ။</p></div> : null}
            </div>
          </div>
        </main>
      </div>

      <footer className={styles.saveBar}>
        <div>{message ? <span data-success={!dirty}><Check size={15} />{message}</span> : <span>{dirty ? "ပြင်ထားတာတွေ မသိမ်းရသေးပါ" : "အပြောင်းအလဲအားလုံး သိမ်းပြီးပါပြီ"}</span>}</div>
        <button disabled={pending || !dirty} onClick={save} type="button">{pending ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />} အားလုံးသိမ်းမယ်</button>
      </footer>
    </section>
  );
}

function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input max={max} min={min} step={step} type="number" value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))} /></label>;
}
