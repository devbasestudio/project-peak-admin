"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteCoachingMeal, saveCoachingMeal } from "@/app/coaching-actions";
import styles from "./content-managers.module.css";

type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "evening";
type Meal = {
  id: number;
  program_type: string;
  meal_type: MealType;
  food_name: string;
  food_name_mm: string | null;
  portion: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  benefits_text: string | null;
  sort_order: number | null;
};
type MealForm = {
  id?: number;
  programType: "personal_coaching";
  mealType: MealType;
  foodName: string;
  foodNameMm: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  benefits: string;
  sortOrder: number;
};

const labels: Record<MealType, string> = {
  breakfast: "မနက်စာ",
  lunch: "နေ့လယ်စာ",
  snack: "အဆာပြေ",
  dinner: "ညစာ",
  evening: "ညပိုင်း",
};
const mealTypes = Object.keys(labels) as MealType[];
const blank = (mealType: MealType): MealForm => ({
  programType: "personal_coaching",
  mealType,
  foodName: "",
  foodNameMm: "",
  portion: "",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  benefits: "",
  sortOrder: 0,
});

export function MealManager({ items }: { items: Meal[] }) {
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [form, setForm] = useState<MealForm>(blank("breakfast"));
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () => items.filter((item) => item.meal_type === mealType),
    [items, mealType],
  );

  function edit(item: Meal) {
    setForm({
      id: item.id,
      programType: "personal_coaching",
      mealType: item.meal_type,
      foodName: item.food_name,
      foodNameMm: item.food_name_mm || "",
      portion: item.portion || "",
      calories: item.calories || 0,
      protein: Number(item.protein_g) || 0,
      carbs: Number(item.carbs_g) || 0,
      fat: Number(item.fat_g) || 0,
      benefits: item.benefits_text || "",
      sortOrder: item.sort_order || 0,
    });
    setMessage("");
  }

  function fresh(nextType = mealType) {
    setForm(blank(nextType));
    setMessage("");
  }

  function chooseMealType(nextType: MealType) {
    setMealType(nextType);
    fresh(nextType);
  }

  function save() {
    startTransition(async () => {
      const result = await saveCoachingMeal(form);
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    if (!form.id || !window.confirm("ဒီ meal ကို တကယ်ဖယ်မလား? Client တွေမှာ မပေါ်တော့ပါ။")) return;
    startTransition(async () => {
      const result = await deleteCoachingMeal({ id: form.id });
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        fresh();
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>1:1 COACHING · MEAL LIBRARY</p>
          <h1>စားသောက်မှု Plan</h1>
          <span>ဒီမှာထည့်ထားတဲ့ အစားအစာတွေကို 1:1 Client app ရဲ့ Meals စာမျက်နှာမှာ အသုံးပြုပါမယ်။</span>
        </div>
        {message ? <div className={styles.status} data-ok={ok}>{message}</div> : null}
      </header>

      <ol className={styles.steps} aria-label="Meal plan အသုံးပြုနည်း">
        <li><b>1</b><span><strong>အချိန်ရွေးပါ</strong><small>မနက်စာ၊ နေ့လယ်စာ စသည်</small></span></li>
        <li><b>2</b><span><strong>အသစ်ထည့် သို့မဟုတ် ပြင်ပါ</strong><small>ရှိပြီးသား card ကိုနှိပ်လည်းရပါတယ်</small></span></li>
        <li><b>3</b><span><strong>အချက်အလက်သိမ်းပါ</strong><small>Client app မှာ အလိုအလျောက်ပေါ်ပါမယ်</small></span></li>
      </ol>

      <section className={`${styles.panel} ${styles.mealTypePanel}`}>
        <div className={styles.mealTypeIntro}>
          <span>အခု ပြင်နေသည်</span>
          <strong>1:1 Coaching Meal Library</strong>
        </div>
        <nav className={styles.mealTabs} aria-label="အစားအစာ အချိန်ရွေးမယ်">
          {mealTypes.map((type) => (
            <button type="button" data-active={mealType === type} key={type} onClick={() => chooseMealType(type)}>
              {mealType === type ? <Check size={15} /> : null}{labels[type]}
            </button>
          ))}
        </nav>
      </section>

      <div className={`${styles.layout} ${styles.mealLayout}`}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><p className={styles.kicker}>{labels[mealType]}</p><h2>ထည့်ထားတဲ့ အစားအစာ</h2></div>
            <button type="button" className={styles.secondary} onClick={() => fresh()}><Plus size={16} />အသစ်ထည့်မယ်</button>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.mealGrid}>
              {visible.length ? visible.map((item) => (
                <button type="button" className={styles.mealCard} key={item.id} onClick={() => edit(item)}>
                  <span className={styles.mealCardCopy}>
                    <strong>{item.food_name_mm || item.food_name}</strong>
                    <small>{item.food_name_mm ? item.food_name : item.portion || "Portion မသတ်မှတ်ရသေး"}</small>
                  </span>
                  <span className={styles.macros}>
                    <i>{item.calories || 0} kcal</i><i>P {item.protein_g || 0}g</i><i>C {item.carbs_g || 0}g</i><i>F {item.fat_g || 0}g</i>
                  </span>
                  <span className={styles.mealEdit}><Pencil size={15} />ပြင်မယ်</span>
                </button>
              )) : <div className={styles.empty}>ဒီအချိန်အတွက် အစားအစာ မထည့်ရသေးပါ။ “အသစ်ထည့်မယ်” ကိုနှိပ်ပါ။</div>}
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><p className={styles.kicker}>{form.id ? "EDIT MEAL" : "NEW MEAL"}</p><h2>{form.id ? "အစားအစာ ပြင်မယ်" : "အစားအစာ အသစ်ထည့်မယ်"}</h2></div>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.row}>
              <label className={styles.field}><span>မြန်မာနာမည်</span><input value={form.foodNameMm} onChange={(event) => setForm({ ...form, foodNameMm: event.target.value })} placeholder="ဥပမာ ကြက်ဥနဲ့ Oats" /></label>
              <label className={styles.field}><span>English name *</span><input value={form.foodName} onChange={(event) => setForm({ ...form, foodName: event.target.value })} placeholder="Egg and oats" /></label>
            </div>
            <label className={styles.field}><span>Portion / ပမာဏ</span><input value={form.portion} onChange={(event) => setForm({ ...form, portion: event.target.value })} placeholder="ဥပမာ 1 bowl · 150g" /></label>
            <div className={styles.nutritionGrid}>
              <label className={styles.field}><span>Calories</span><input type="number" min="0" inputMode="numeric" value={form.calories} onChange={(event) => setForm({ ...form, calories: Number(event.target.value) })} /></label>
              <label className={styles.field}><span>Protein (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.protein} onChange={(event) => setForm({ ...form, protein: Number(event.target.value) })} /></label>
              <label className={styles.field}><span>Carbs (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.carbs} onChange={(event) => setForm({ ...form, carbs: Number(event.target.value) })} /></label>
              <label className={styles.field}><span>Fat (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.fat} onChange={(event) => setForm({ ...form, fat: Number(event.target.value) })} /></label>
            </div>
            <label className={styles.field}><span>ပြသမယ့်အစဉ်</span><input type="number" min="0" inputMode="numeric" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label>
            <label className={styles.field}><span>Coach ရှင်းပြချက် / Benefits</span><textarea value={form.benefits} onChange={(event) => setForm({ ...form, benefits: event.target.value })} placeholder="ဒီ meal ကို ဘာကြောင့်ရွေးထားတာလဲ ရေးနိုင်ပါတယ်" /></label>
            <div className={styles.actions}>
              {form.id ? <button type="button" className={styles.danger} disabled={pending} onClick={remove}><Trash2 size={16} />ဖယ်မယ်</button> : <span />}
              <button type="button" className={styles.button} disabled={pending || !form.foodName.trim()} onClick={save}><Save size={16} />{pending ? "သိမ်းနေတယ်…" : "Meal သိမ်းမယ်"}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
