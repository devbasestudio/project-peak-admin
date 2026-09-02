"use client";

import { useMemo, useState, useTransition } from "react";
import { Dumbbell, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveCoachingWorkout } from "@/app/coaching-actions";
import styles from "./content-managers.module.css";

type Client = { id:string; username:string; email:string; registration?:{name?:string|null}|null };
type Exercise = { id?:number; exercise_name:string; target_sets:number|null; target_reps:string|null };
type Workout = { id:number; user_id:string; date:string; split_name:string; completed:boolean; exercises:Exercise[] };
type EditExercise = { id?:number; exerciseName:string; targetSets:number; targetReps:string };

const blankExercise = ():EditExercise => ({ exerciseName:"", targetSets:3, targetReps:"8-12" });

export function WorkoutManager({clients,workouts,today}:{clients:Client[];workouts:Workout[];today:string}){
  const router=useRouter();
  const [clientId,setClientId]=useState(clients[0]?.id??"");
  const [workoutId,setWorkoutId]=useState<number|undefined>();
  const [date,setDate]=useState(today);
  const [splitName,setSplitName]=useState("Full Body");
  const [exercises,setExercises]=useState<EditExercise[]>([blankExercise()]);
  const [message,setMessage]=useState("");
  const [ok,setOk]=useState(false);
  const [pending,startTransition]=useTransition();
  const visible=useMemo(()=>workouts.filter(row=>row.user_id===clientId),[clientId,workouts]);
  const selectedClient=clients.find(row=>row.id===clientId);
  function selectWorkout(row:Workout){setWorkoutId(row.id);setDate(row.date);setSplitName(row.split_name);setExercises(row.exercises.length?row.exercises.map(ex=>({id:ex.id,exerciseName:ex.exercise_name,targetSets:ex.target_sets??3,targetReps:ex.target_reps??"8-12"})):[blankExercise()]);setMessage("");}
  function fresh(){setWorkoutId(undefined);setDate(today);setSplitName("Full Body");setExercises([blankExercise()]);setMessage("");}
  function save(){setMessage("");startTransition(async()=>{const result=await saveCoachingWorkout({id:workoutId,userId:clientId,date,splitName,exercises});setOk(result.ok);setMessage(result.message);if(result.ok&&result.workoutId){setWorkoutId(result.workoutId);router.refresh();}});}
  return <div className={styles.page}>
    <header className={styles.hero}><div><p>1:1 COACHING · WORKOUTS</p><h1>Workout ကို ရက်အလိုက်ပြင်မယ်</h1><span>Client ရွေး၊ ဆော့မယ့်ရက်ရွေး၊ exercise တွေထည့်ပြီး Save တစ်ချက်နှိပ်ရုံပါ။ သိမ်းထားတာ client ရဲ့ Workout screen မှာပြန်ပေါ်ပါမယ်။</span></div>{message?<div className={styles.status} data-ok={ok}>{message}</div>:null}</header>
    <ol className={styles.steps}><li><b>1</b><span><strong>Client ရွေးမယ်</strong><small>{selectedClient?.email||"—"}</small></span></li><li><b>2</b><span><strong>ရက်နဲ့ Session</strong><small>{date} · {splitName}</small></span></li><li><b>3</b><span><strong>Exercise သိမ်းမယ်</strong><small>{exercises.length} exercises</small></span></li></ol>
    {clients.length===0?<div className={styles.empty}>Payment approve လုပ်ထားတဲ့ 1:1 client မရှိသေးပါ။</div>:<div className={styles.layout}>
      <aside className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>CLIENT + HISTORY</p><h2>ဘယ်သူ့ Plan လဲ?</h2></div><button className={styles.secondary} onClick={fresh}>အသစ်</button></div><div className={styles.panelBody}><label className={styles.field}><span>Client</span><select value={clientId} onChange={e=>{setClientId(e.target.value);fresh();}}>{clients.map(c=><option key={c.id} value={c.id}>{c.registration?.name||c.username||c.email} · {c.email}</option>)}</select></label></div><div className={styles.sessionList}>{visible.length?visible.map(row=><button className={styles.session} data-active={row.id===workoutId} key={row.id} onClick={()=>selectWorkout(row)}><time>{row.date}</time><span><strong>{row.split_name}</strong><small>{row.exercises.length} exercises · {row.completed?"ပြီး":"လုပ်ရန်"}</small></span><Dumbbell size={17}/></button>):<div className={styles.empty}>ဒီ Client အတွက် session မရှိသေးပါ။ “အသစ်” နှိပ်ပြီး စပါ။</div>}</div></aside>
      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>{workoutId?"EDIT SESSION":"NEW SESSION"}</p><h2>{workoutId?"Workout ပြင်မယ်":"Workout အသစ်ထည့်မယ်"}</h2></div><span>နံပါတ်ကို တိုက်ရိုက်ရိုက်နိုင်ပါတယ်</span></div><div className={styles.panelBody}><div className={styles.row}><label className={styles.field}><span>ဆော့မယ့်ရက်</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className={styles.field}><span>Session နာမည်</span><input value={splitName} onChange={e=>setSplitName(e.target.value)} placeholder="ဥပမာ Push A"/></label></div><div className={styles.exerciseList}>{exercises.map((ex,index)=><div className={styles.exercise} key={ex.id??`new-${index}`}><span>{String(index+1).padStart(2,"0")}</span><label><span>Exercise</span><input value={ex.exerciseName} onChange={e=>setExercises(rows=>rows.map((row,i)=>i===index?{...row,exerciseName:e.target.value}:row))} placeholder="ဥပမာ Dumbbell bench press"/></label><label><span>Sets</span><input type="number" min="1" max="20" value={ex.targetSets} onChange={e=>setExercises(rows=>rows.map((row,i)=>i===index?{...row,targetSets:Number(e.target.value)}:row))}/></label><label><span>Reps</span><input value={ex.targetReps} onChange={e=>setExercises(rows=>rows.map((row,i)=>i===index?{...row,targetReps:e.target.value}:row))} placeholder="8-12"/></label><button aria-label={`${ex.exerciseName||"Exercise"} ဖယ်မယ်`} className={styles.iconButton} disabled={exercises.length===1} onClick={()=>setExercises(rows=>rows.filter((_,i)=>i!==index))}><Trash2 size={17}/></button></div>)}</div><div className={styles.actions}><button className={styles.secondary} onClick={()=>setExercises(rows=>[...rows,blankExercise()])}><Plus size={17}/>Exercise ထည့်မယ်</button><button className={styles.button} disabled={pending||!clientId||!date||!splitName.trim()||exercises.some(ex=>!ex.exerciseName.trim())} onClick={save}><Save size={17}/>{pending?"သိမ်းနေတယ်…":"Workout သိမ်းမယ်"}</button></div></div></section>
    </div>}
  </div>;
}
