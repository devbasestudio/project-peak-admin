"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, Copy, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteCoachingMeal, duplicateCoachingMealDay, saveCoachingMeal } from "@/app/coaching-actions";
import { MultiDatePicker } from "./multi-date-picker";
import styles from "./content-managers.module.css";

type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "evening";
type Meal = {
  id: number;
  user_id: string | null;
  program_type: string;
  meal_type: MealType;
  plan_date: string | null;
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
  userId: string;
  programType: "personal_coaching";
  mealType: MealType;
  planDate: string;
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
type Client = {
  id: string;
  username: string;
  email: string;
  registration?: { name?: string | null } | null;
};

const labels: Record<MealType, string> = {
  breakfast: "မနက်စာ",
  lunch: "နေ့လယ်စာ",
  snack: "အဆာပြေ",
  dinner: "ညစာ",
  evening: "ညပိုင်း",
};
const mealTypes = Object.keys(labels) as MealType[];
function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const blank = (userId: string, mealType: MealType, planDate = localDate()): MealForm => ({
  userId,
  programType: "personal_coaching",
  mealType,
  planDate,
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

export function MealManager({ clients, items, initialClientId }: { clients: Client[]; items: Meal[]; initialClientId: string }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [planDate, setPlanDate] = useState(localDate);
  const [targetDates, setTargetDates] = useState<string[]>(() => [addDays(localDate(), 1)]);
  const [form, setForm] = useState<MealForm>(() => blank(initialClientId, "breakfast", localDate()));
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const requests = useRef(new Map<string, { fingerprint: string; id: string }>());
  function requestId(operation: string, payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    const prior = requests.current.get(operation);
    if (prior?.fingerprint === fingerprint) return prior.id;
    const id = crypto.randomUUID();
    requests.current.set(operation, { fingerprint, id });
    return id;
  }
  async function invoke<T extends { ok: boolean; message: string }>(action: () => Promise<T>): Promise<T | { ok: false; message: string; mealId?: undefined }> {
    try { return await action(); }
    catch { return { ok: false, message: "Connection ပြတ်သွားပါတယ်။ ထပ်မပွားဘဲ ဒီအတိုင်း ပြန်သိမ်းနိုင်ပါတယ်။" }; }
  }
  const datedClientItems = useMemo(() => items.filter((item) => item.user_id === clientId && item.plan_date === planDate && item.meal_type === mealType), [clientId, items, mealType, planDate]);
  const legacyClientItems = useMemo(() => items.filter((item) => item.user_id === clientId && !item.plan_date && item.meal_type === mealType), [clientId, items, mealType]);
  const clientItems = datedClientItems.length ? datedClientItems : legacyClientItems;
  const defaultItems = useMemo(() => items.filter((item) => item.user_id === null && (!item.plan_date || item.plan_date === planDate) && item.meal_type === mealType), [items, mealType, planDate]);
  const usingDefaults = datedClientItems.length === 0 && (legacyClientItems.length > 0 || defaultItems.length > 0);
  const visible = clientItems.length ? clientItems : defaultItems;
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedClientName = selectedClient?.registration?.name || selectedClient?.username || selectedClient?.email || "Client ရွေးပါ";

  function edit(item: Meal) {
    setForm({
      id: item.user_id && item.plan_date === planDate ? item.id : undefined,
      userId: clientId,
      programType: "personal_coaching",
      mealType: item.meal_type,
      planDate,
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

  function fresh(nextType = mealType, nextClientId = clientId, nextDate = planDate) {
    requests.current.delete("save");
    setForm(blank(nextClientId, nextType, nextDate));
    setMessage("");
  }

  function chooseMealType(nextType: MealType) {
    setMealType(nextType);
    fresh(nextType);
  }

  function chooseDate(nextDate: string) {
    setPlanDate(nextDate);
    setTargetDates([addDays(nextDate, 1)]);
    fresh(mealType, clientId, nextDate);
  }

  function save() {
    startTransition(async () => {
      const result = await invoke(() => saveCoachingMeal({ ...form, requestId: requestId("save", form) }));
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        setForm((current) => JSON.stringify(current) === JSON.stringify(form) ? { ...current, id: result.mealId } : current);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!form.id || !window.confirm(`ဒီ meal ကို ${selectedClientName} ရဲ့ Plan ကနေ တကယ်ဖယ်မလား?`)) return;
    startTransition(async () => {
      const payload = { id: form.id, userId: clientId };
      const result = await invoke(() => deleteCoachingMeal({ ...payload, requestId: requestId("delete", payload) }));
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        fresh();
        router.refresh();
      }
    });
  }


  function assignDates() {
    startTransition(async () => {
      const payload = { userId: clientId, sourceDate: planDate, targetDates };
      const result = await invoke(() => duplicateCoachingMealDay({ ...payload, requestId: requestId("copy", payload) }));
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        setTargetDates([]);
        router.refresh();
      }
    });
  }

  function initializeDay() {
    startTransition(async () => {
      const payload = { userId: clientId, sourceDate: planDate, targetDate: planDate };
      const result = await invoke(() => duplicateCoachingMealDay({ ...payload, requestId: requestId("initialize", payload) }));
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) {
        fresh(mealType, clientId, planDate);
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
          <span>Client တစ်ယောက်ရွေးပြီး သူ့အတွက် သီးသန့်စားသောက်မှု Plan ကို ပြင်နိုင်ပါတယ်။</span>
        </div>
        {message ? <div className={styles.status} data-ok={ok}>{message}</div> : null}
      </header>

      <ol className={styles.steps} aria-label="Meal plan အသုံးပြုနည်း">
        <li><b>1</b><span><strong>Client ရွေးပါ</strong><small>{selectedClient?.email || "Approved Client ကိုရွေးပါ"}</small></span></li>
        <li><b>2</b><span><strong>ရက်နဲ့ Meal ရွေးပါ</strong><small>{planDate} · {labels[mealType]}</small></span></li>
        <li><b>3</b><span><strong>ပြင်ပြီး သိမ်းပါ</strong><small>{selectedClientName} ရဲ့ app မှာပေါ်ပါမယ်</small></span></li>
      </ol>

      <section className={`${styles.panel} ${styles.mealTypePanel}`}>
        <label className={`${styles.field} ${styles.clientPicker}`}>
          <span>ဘယ် Client အတွက်လဲ?</span>
          <select disabled={pending} value={clientId} onChange={(event) => { const nextClientId = event.target.value; setClientId(nextClientId); fresh(mealType, nextClientId); startTransition(() => router.replace(`/coaching/meals?client=${encodeURIComponent(nextClientId)}`)); }}>
            {clients.length ? clients.map((client) => <option key={client.id} value={client.id}>{client.registration?.name || client.username || client.email} · {client.email}</option>) : <option value="">Approved Client မရှိသေးပါ</option>}
          </select>
        </label>
        <label className={`${styles.field} ${styles.datePicker}`}>
          <span>ဘယ်ရက်အတွက်လဲ?</span>
          <input type="date" value={planDate} onChange={(event) => chooseDate(event.target.value)} />
        </label>
        <div className={styles.mealTypeControls}>
          <div className={styles.mealTypeIntro}><span>အခု ပြင်နေသည်</span><strong>{selectedClientName}</strong></div>
          <nav className={styles.mealTabs} aria-label="အစားအစာ အချိန်ရွေးမယ်">
            {mealTypes.map((type) => (
              <button type="button" data-active={mealType === type} key={type} onClick={() => chooseMealType(type)}>
                {mealType === type ? <Check size={15} /> : null}{labels[type]}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {clients.length ? <section className={styles.copyBar}>
        <span><CalendarDays size={19}/><span><strong>{planDate} Meal Plan ကို အသုံးချမယ့်ရက်များ</strong><small>တူညီတဲ့ Meal Plan စားမယ့်ရက်အားလုံးကို Calendar မှာ တစ်ခါတည်းရွေးပါ။</small></span></span>
        <MultiDatePicker key={planDate} selectedDates={targetDates} onChange={setTargetDates} disabledDates={[planDate]} initialDate={planDate}/>
        <button type="button" className={styles.secondary} disabled={pending || !clientId || !targetDates.length} onClick={assignDates}><Copy size={16}/>{pending ? "ထည့်နေတယ်…" : `${targetDates.length} ရက်ကို Meal Plan ထည့်မယ်`}</button>
      </section> : null}

      {clients.length === 0 ? <div className={styles.empty}>Payment approve လုပ်ထားတဲ့ 1:1 Client မရှိသေးပါ။ Clients မှာ approve အရင်လုပ်ပေးပါ။</div> : <div className={`${styles.layout} ${styles.mealLayout}`}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><p className={styles.kicker}>{labels[mealType]}</p><h2>ထည့်ထားတဲ့ အစားအစာ</h2></div>
            <button type="button" className={styles.secondary} onClick={() => usingDefaults ? initializeDay() : fresh()}><Plus size={16} />{usingDefaults ? "ဒီရက် Plan စမယ်" : "အသစ်ထည့်မယ်"}</button>
          </div>
          <div className={styles.panelBody}>
            {usingDefaults ? <div className={styles.help}><strong>အရင် Meal Plan ကို reference အဖြစ်ပြထားပါတယ်</strong><br />ရက်အလိုက် သီးသန့်ပြင်မယ်ဆို အောက်ကခလုတ်ကို အရင်နှိပ်ပါ။<button type="button" className={styles.inlineCopy} disabled={pending} onClick={initializeDay}><Copy size={15}/>{planDate} အတွက် Plan copy လုပ်မယ်</button></div> : null}
            <div className={styles.mealGrid}>
              {visible.length ? visible.map((item) => (
                <button type="button" className={styles.mealCard} key={item.id} onClick={() => usingDefaults ? initializeDay() : edit(item)}>
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
              <button type="button" className={styles.button} disabled={pending || !clientId || !form.foodName.trim()} onClick={save}><Save size={16} />{pending ? "သိမ်းနေတယ်…" : `${selectedClientName} အတွက် သိမ်းမယ်`}</button>
            </div>
          </div>
        </section>
      </div>}
    </div>
  );
}
