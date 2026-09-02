import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Dumbbell,
  Footprints,
  Gauge,
  Moon,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getCoachingClientProgress } from "@/lib/data";
import styles from "./client-progress.module.css";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dayNames = ["တနင်္ဂနွေ", "တနင်္လာ", "အင်္ဂါ", "ဗုဒ္ဓဟူး", "ကြာသပတေး", "သောကြာ", "စနေ"];

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function displayDateTime(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function WeightChart({ rows }: { rows: Array<{ date: string; body_weight: unknown }> }) {
  const points = rows
    .filter((row) => numeric(row.body_weight) !== null)
    .slice(0, 21)
    .reverse()
    .map((row) => ({ date: row.date, weight: numeric(row.body_weight) as number }));
  if (points.length < 2) return <div className={styles.chartEmpty}>Weight log နှစ်ရက်ပြည့်ရင် trend graph ပေါ်လာပါမယ်။</div>;
  const weights = points.map((point) => point.weight);
  const minimum = Math.min(...weights);
  const maximum = Math.max(...weights);
  const spread = Math.max(maximum - minimum, 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: 18 + (index / Math.max(points.length - 1, 1)) * 584,
    y: 18 + ((maximum - point.weight) / spread) * 124,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `18,150 ${line} 602,150`;
  return (
    <div className={styles.chartWrap}>
      <svg aria-label={`Weight trend from ${points[0].weight} to ${points.at(-1)?.weight} kilograms`} role="img" viewBox="0 0 620 166">
        <defs><linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#11add5" stopOpacity=".28"/><stop offset="1" stopColor="#11add5" stopOpacity="0"/></linearGradient></defs>
        <line x1="18" x2="602" y1="150" y2="150" />
        <polygon fill="url(#weight-fill)" points={area} />
        <polyline points={line} />
        {coordinates.map((point) => <circle cx={point.x} cy={point.y} key={point.date} r="4" />)}
      </svg>
      <div className={styles.chartLabels}><span>{displayDate(points[0].date)}</span><strong>{minimum.toFixed(1)}–{maximum.toFixed(1)} kg</strong><span>{displayDate(points.at(-1)?.date ?? points[0].date)}</span></div>
    </div>
  );
}

export default async function CoachingClientProgressPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  if (!uuidPattern.test(clientId)) notFound();
  const client = await getCoachingClientProgress(clientId);
  if (!client) notFound();

  const currentWeight = client.trackers.find((row) => numeric(row.body_weight) !== null);
  const currentWeightValue = numeric(currentWeight?.body_weight);
  const startingWeight = numeric(client.bodyProfile?.starting_weight) ?? numeric(client.registration?.weight);
  const weightChange = currentWeightValue !== null && startingWeight !== null ? currentWeightValue - startingWeight : null;
  const completedWorkouts = client.workouts.filter((workout) => workout.completed).length;
  const workoutRate = client.workouts.length ? Math.round((completedWorkouts / client.workouts.length) * 100) : 0;
  const programStart = client.program?.start_date ? new Date(`${client.program.start_date}T00:00:00Z`) : null;
  const elapsedDays = programStart ? Math.max(0, Math.floor((new Date(client.generatedAt).getTime() - programStart.getTime()) / 86_400_000)) : 0;
  const currentWeek = client.program ? Math.min(client.program.duration_weeks, Math.floor(elapsedDays / 7) + 1) : null;
  const recentLogs = client.trackers.slice(0, 14);
  const habitChecks = recentLogs.flatMap((row) => [row.water_3l, row.omega_3, row.bed_phone_filter, row.meal_plan_adhered, row.toilet]);
  const habitRate = habitChecks.length ? Math.round((habitChecks.filter(Boolean).length / habitChecks.length) * 100) : 0;
  const averageSteps = recentLogs.length ? Math.round(recentLogs.reduce((total, row) => total + (numeric(row.steps) ?? 0), 0) / recentLogs.length) : 0;
  const averageSleep = (() => {
    const values = recentLogs.map((row) => numeric(row.sleep_score)).filter((value): value is number => value !== null);
    return values.length ? (values.reduce((total, value) => total + value, 0) / values.length).toFixed(1) : "—";
  })();
  const templateSections = Array.isArray(client.template?.sections) ? client.template.sections as Array<{ title?: string; fields?: Array<{ id?: string; label?: string; type?: string }> }> : [];
  const templateFieldCount = templateSections.reduce((total, section) => total + (Array.isArray(section.fields) ? section.fields.length : 0), 0);
  const intake = client.registration?.intake_answers && typeof client.registration.intake_answers === "object" && !Array.isArray(client.registration.intake_answers)
    ? Object.entries(client.registration.intake_answers as Record<string, unknown>).filter(([, value]) => value !== null && value !== "")
    : [];
  const progressPhotos = client.checkins.filter((checkin) => checkin.progressPhotoUrl);
  const baselinePhotos = client.registration ? Object.entries(client.registration.photos).filter((entry): entry is [string, string] => Boolean(entry[1])) : [];

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/coaching/clients"><ArrowLeft size={16}/>1:1 Clients ပြန်သွားမယ်</Link>

      <header className={styles.hero}>
        <div className={styles.identity}>
          <span className={styles.avatar}>{(client.profile.username || client.profile.email || "P").slice(0, 1).toUpperCase()}</span>
          <div><p>CLIENT PROGRESS · LIVE</p><h1>{client.profile.username || client.registration?.name || "1:1 Client"}</h1><span>{client.profile.email}</span></div>
        </div>
        <div className={styles.heroStatus}><span data-status={client.registration?.payment_status ?? "pending"}>{client.registration?.payment_status === "ready" ? "PLAN ACTIVE" : (client.registration?.payment_status ?? "pending").toUpperCase()}</span><strong>{client.program ? `Week ${currentWeek} / ${client.program.duration_weeks}` : "Program မသတ်မှတ်ရသေး"}</strong><small>{client.program ? `${displayDate(client.program.start_date)} မှ စတင်` : "Template မစတင်ရသေးပါ"}</small></div>
      </header>

      <section className={styles.metrics} aria-label="Client progress summary">
        <article><span><Scale size={17}/></span><small>လက်ရှိ Weight</small><strong>{currentWeightValue !== null ? `${currentWeightValue.toFixed(1)} kg` : "—"}</strong><p>{weightChange !== null ? <>{weightChange <= 0 ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}စမှတ်ထက် {Math.abs(weightChange).toFixed(1)} kg {weightChange <= 0 ? "လျော့" : "တိုး"}</> : "Starting weight မရှိသေး"}</p></article>
        <article><span><Dumbbell size={17}/></span><small>Workout ပြီးစီးမှု</small><strong>{workoutRate}%</strong><p>{completedWorkouts} / {client.workouts.length} sessions completed</p></article>
        <article><span><Gauge size={17}/></span><small>Habit Consistency</small><strong>{habitRate}%</strong><p>နောက်ဆုံး {recentLogs.length} logs အပေါ်တွက်ထား</p></article>
        <article><span><ClipboardCheck size={17}/></span><small>Weekly Check-ins</small><strong>{client.checkins.length}</strong><p>{client.checkins[0] ? `နောက်ဆုံး Week ${client.checkins[0].week_number}` : "မဖြည့်ရသေး"}</p></article>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>WEIGHT TREND</p><h2>ခန္ဓာကိုယ် အပြောင်းအလဲ</h2></div><Scale size={20}/></div>
          <WeightChart rows={client.trackers}/>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>LAST 14 LOGS</p><h2>နေ့စဉ် ပုံမှန်လုပ်နိုင်မှု</h2></div><Sparkles size={20}/></div>
          <div className={styles.quickStats}><div><Footprints size={16}/><span>Average steps</span><strong>{averageSteps.toLocaleString()}</strong></div><div><Moon size={16}/><span>Average sleep</span><strong>{averageSleep}</strong></div><div><Droplets size={16}/><span>Habit score</span><strong>{habitRate}%</strong></div></div>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}><div><p>DAILY ACTIVITY</p><h2>နောက်ဆုံးနေ့စဉ်မှတ်တမ်းများ</h2></div><CalendarDays size={20}/></div>
        {recentLogs.length ? <div className={styles.logGrid}>{recentLogs.map((log) => {
          const trackerValues = log.tracker_values && typeof log.tracker_values === "object" && !Array.isArray(log.tracker_values) ? log.tracker_values as Record<string, unknown> : {};
          const completed = [log.water_3l, log.omega_3, log.bed_phone_filter, log.meal_plan_adhered, log.toilet].filter(Boolean).length;
          return <article key={log.id}><div><strong>{displayDate(log.date)}</strong><span>{completed}/5 habits</span></div><dl><div><dt>Weight</dt><dd>{numeric(log.body_weight) !== null ? `${numeric(log.body_weight)?.toFixed(1)} kg` : "—"}</dd></div><div><dt>Steps</dt><dd>{numeric(log.steps)?.toLocaleString() ?? "—"}</dd></div><div><dt>Water</dt><dd>{numeric(log.water_liters) !== null ? `${numeric(log.water_liters)} L` : log.water_3l ? "Done" : "—"}</dd></div></dl>{log.one_win || trackerValues.win ? <p><CheckCircle2 size={14}/>{String(log.one_win || trackerValues.win)}</p> : null}</article>;
        })}</div> : <div className={styles.empty}>Client နေ့စဉ် log ဖြည့်ပြီးတာနဲ့ ဒီမှာပေါ်လာပါမယ်။</div>}
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>WORKOUT HISTORY</p><h2>Session Progress</h2></div><Dumbbell size={20}/></div>
          {client.workouts.length ? <div className={styles.timeline}>{client.workouts.slice(0, 12).map((workout) => <article key={workout.id} data-complete={workout.completed}><span><CheckCircle2 size={16}/></span><div><strong>{workout.split_name}</strong><small>{displayDate(workout.date)} · {workout.exercises.length} exercises</small>{workout.user_notes ? <p>{workout.user_notes}</p> : null}</div><b>{workout.completed ? "DONE" : "PLANNED"}</b></article>)}</div> : <div className={styles.empty}>Workout session မစရသေးပါ။</div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>WEEKLY REVIEW</p><h2>Check-in Detail</h2></div><ClipboardCheck size={20}/></div>
          {client.checkins.length ? <div className={styles.checkins}>{client.checkins.map((checkin) => <details key={checkin.id} open={checkin === client.checkins[0]}><summary><span>W{String(checkin.week_number).padStart(2, "0")}</span><div><strong>{numeric(checkin.avg_weight) !== null ? `${numeric(checkin.avg_weight)?.toFixed(1)} kg average` : "Weekly check-in"}</strong><small>{displayDateTime(checkin.created_at)}</small></div><b>Energy {checkin.energy_daily ?? "—"}/10</b></summary><div className={styles.checkinBody}><dl><div><dt>Workout energy</dt><dd>{checkin.energy_workout ?? "—"}/10</dd></div><div><dt>Daily energy</dt><dd>{checkin.energy_daily ?? "—"}/10</dd></div><div><dt>Motivation</dt><dd>{checkin.motivation ?? "—"}/10</dd></div></dl>{checkin.improvement_notes ? <p><strong>တိုးတက်မှု</strong>{checkin.improvement_notes}</p> : null}{checkin.struggle_notes ? <p><strong>အခက်အခဲ</strong>{checkin.struggle_notes}</p> : null}{checkin.admin_feedback ? <blockquote><strong>Coach feedback</strong>{checkin.admin_feedback}</blockquote> : null}</div></details>)}</div> : <div className={styles.empty}>Weekly check-in မရှိသေးပါ။</div>}
        </section>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>CUSTOM TEMPLATE</p><h2>{client.template?.name || "Template မရှိသေး"}</h2></div><Target size={20}/></div>
          {templateSections.length ? <><div className={styles.templateMeta}><span>{templateSections.length} sections</span><span>{templateFieldCount} fields</span><span>{client.template?.active ? "Active" : "Inactive"}</span></div><div className={styles.templateSections}>{templateSections.map((section, index) => <article key={`${section.title}-${index}`}><span>0{index + 1}</span><div><strong>{section.title || `Section ${index + 1}`}</strong>{(section.fields ?? []).map((field) => <small key={field.id || field.label}>{field.label || "Unnamed field"} · {field.type}</small>)}</div></article>)}</div></> : <div className={styles.empty}>ဒီ client အတွက် template မဆောက်ရသေးပါ။</div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}><div><p>CLIENT PROFILE</p><h2>Goal နှင့် အခြေခံအချက်အလက်</h2></div><Target size={20}/></div>
          <dl className={styles.profileFacts}><div><dt>Program</dt><dd>{client.registration?.program_name || client.program?.program_type || "—"}</dd></div><div><dt>Height</dt><dd>{client.bodyProfile?.height_cm ? `${client.bodyProfile.height_cm} cm` : client.registration?.height || "—"}</dd></div><div><dt>Starting weight</dt><dd>{startingWeight !== null ? `${startingWeight} kg` : "—"}</dd></div><div><dt>Goal</dt><dd>{client.bodyProfile?.desired_body_text || "—"}</dd></div></dl>
          {intake.length ? <div className={styles.intake}>{intake.map(([key, value]) => <div key={key}><strong>{key.replaceAll("_", " ")}</strong><p>{String(value)}</p></div>)}</div> : null}
          {client.schedule.length ? <div className={styles.schedule}>{client.schedule.map((day) => <span data-rest={day.is_rest} key={day.id}><small>{dayNames[day.day_of_week]}</small><strong>{day.is_rest ? "Rest" : day.split_name || "Train"}</strong></span>)}</div> : null}
        </section>
      </div>

      {baselinePhotos.length || progressPhotos.length ? <section className={styles.card}><div className={styles.cardHead}><div><p>VISUAL PROGRESS</p><h2>Body photos</h2></div><Sparkles size={20}/></div><div className={styles.photos}>{baselinePhotos.map(([slot, url]) => <figure key={slot}><Image alt={`${slot} baseline`} height={480} src={url} unoptimized width={360}/><figcaption>Baseline · {slot}</figcaption></figure>)}{progressPhotos.map((checkin) => <figure key={checkin.id}><Image alt={`Week ${checkin.week_number} progress`} height={480} src={checkin.progressPhotoUrl as string} unoptimized width={360}/><figcaption>Week {checkin.week_number} progress</figcaption></figure>)}</div></section> : null}
    </div>
  );
}
