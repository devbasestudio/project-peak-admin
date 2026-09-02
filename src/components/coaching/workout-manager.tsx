"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Plus, Save, Trash2 } from "lucide-react";
import { saveCoachingWorkout } from "@/app/coaching-actions";
import styles from "./content-managers.module.css";

type Client={id:string;username:string;email:string;registration?:{name?:string|null}|null};
type Exercise={id?:number;exercise_name:string;target_sets:number|null;target_reps:string|null};
type Workout={id:number;user_id:string;date:string;split_name:string;completed:boolean;exercises:Exercise[]};
type LibraryExercise={id:number;split_name:string;exercise_name:string;sets_default:number|null;reps_default:string|null};
type EditExercise={id?:number;exerciseName:string;targetSets:number;targetReps:string};
const blankExercise=():EditExercise=>({exerciseName:"",targetSets:3,targetReps:"8-12"});

export function WorkoutManager({clients,workouts,library,today}:{clients:Client[];workouts:Workout[];library:LibraryExercise[];today:string}){
  const router=useRouter();
  const [clientId,setClientId]=useState(clients[0]?.id??"");
  const [workoutId,setWorkoutId]=useState<number>();
  const [date,setDate]=useState(today);
  const [splitName,setSplitName]=useState("Full Body");
  const [exercises,setExercises]=useState<EditExercise[]>([blankExercise()]);
  const [message,setMessage]=useState("");
  const [ok,setOk]=useState(false);
  const [pending,startTransition]=useTransition();
  const visible=useMemo(()=>workouts.filter(row=>row.user_id===clientId),[clientId,workouts]);
  const libraryBySplit=useMemo(()=>{const groups=new Map<string,LibraryExercise[]>();for(const item of library){const rows=groups.get(item.split_name)??[];rows.push(item);groups.set(item.split_name,rows);}return [...groups.entries()];},[library]);
  const selectedClient=clients.find(row=>row.id===clientId);

  function selectWorkout(row:Workout){
    setWorkoutId(row.id);setDate(row.date);setSplitName(row.split_name);
    setExercises(row.exercises.length?row.exercises.map(ex=>({id:ex.id,exerciseName:ex.exercise_name,targetSets:ex.target_sets??3,targetReps:ex.target_reps??"8-12"})):[blankExercise()]);
    setMessage("");
  }
  function fresh(){setWorkoutId(undefined);setDate(today);setSplitName("Full Body");setExercises([blankExercise()]);setMessage("");}
  function pickExercise(index:number,name:string){
    const selected=library.find(item=>item.exercise_name===name);
    setExercises(rows=>rows.map((row,position)=>position===index?{...row,exerciseName:name,targetSets:selected?.sets_default??row.targetSets,targetReps:selected?.reps_default??row.targetReps}:row));
  }
  function save(){
    setMessage("");
    startTransition(async()=>{
      const result=await saveCoachingWorkout({id:workoutId,userId:clientId,date,splitName,exercises});
      setOk(result.ok);setMessage(result.message);
      if(result.ok&&result.workoutId){setWorkoutId(result.workoutId);router.refresh();}
    });
  }

  return <div className={styles.page}>
    <header className={styles.hero}><div><p>1:1 COACHING · WORKOUTS</p><h1>Workout ကို ရက်အလိုက်ပြင်မယ်</h1><span>Client ရွေး၊ ဆော့မယ့်ရက်ရွေး၊ Library ထဲက exercise ကို dropdown နဲ့ရွေးပြီး Save နှိပ်ရုံပါ။</span></div>{message?<div className={styles.status} data-ok={ok}>{message}</div>:null}</header>
    <ol className={styles.steps}><li><b>1</b><span><strong>Client ရွေးမယ်</strong><small>{selectedClient?.email||"—"}</small></span></li><li><b>2</b><span><strong>ရက်နဲ့ Session</strong><small>{date} · {splitName}</small></span></li><li><b>3</b><span><strong>Exercise သိမ်းမယ်</strong><small>{exercises.length} exercises</small></span></li></ol>
    {clients.length===0?<div className={styles.empty}>Payment approve လုပ်ထားတဲ့ 1:1 client မရှိသေးပါ။</div>:<div className={styles.layout}>
      <aside className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.kicker}>CLIENT + HISTORY</p><h2>ဘယ်သူ့ Plan လဲ?</h2></div><button className={styles.secondary} onClick={fresh}>အသစ်</button></div>
        <div className={styles.panelBody}><label className={styles.field}><span>Client</span><select value={clientId} onChange={event=>{setClientId(event.target.value);fresh();}}>{clients.map(client=><option key={client.id} value={client.id}>{client.registration?.name||client.username||client.email} · {client.email}</option>)}</select></label></div>
        <div className={styles.sessionList}>{visible.length?visible.map(row=><button className={styles.session} data-active={row.id===workoutId} key={row.id} onClick={()=>selectWorkout(row)}><time>{row.date}</time><span><strong>{row.split_name}</strong><small>{row.exercises.length} exercises · {row.completed?"ပြီး":"လုပ်ရန်"}</small></span><Dumbbell size={17}/></button>):<div className={styles.empty}>ဒီ Client အတွက် session မရှိသေးပါ။ “အသစ်” နှိပ်ပြီး စပါ။</div>}</div>
      </aside>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.kicker}>{workoutId?"EDIT SESSION":"NEW SESSION"}</p><h2>{workoutId?"Workout ပြင်မယ်":"Workout အသစ်ထည့်မယ်"}</h2></div><Link className={styles.link} href="/coaching/exercises">Exercise + Video စီမံမယ် →</Link></div>
        <div className={styles.panelBody}>
          <div className={styles.row}><label className={styles.field}><span>ဆော့မယ့်ရက်</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label className={styles.field}><span>Session နာမည်</span><input value={splitName} onChange={event=>setSplitName(event.target.value)} placeholder="ဥပမာ Push A"/></label></div>
          {library.length===0?<div className={styles.help}><strong>Exercise Library မရှိသေးပါ</strong><br/><Link className={styles.link} href="/coaching/exercises">Library မှာ Exercise အရင်ထည့်ပါ →</Link></div>:null}
          <div className={styles.exerciseList}>{exercises.map((exercise,index)=><div className={styles.exercise} key={exercise.id??`new-${index}`}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <label><span>Exercise</span><select value={exercise.exerciseName} onChange={event=>pickExercise(index,event.target.value)}><option value="">Exercise ရွေးပါ</option>{exercise.exerciseName&&!library.some(item=>item.exercise_name===exercise.exerciseName)?<option value={exercise.exerciseName}>{exercise.exerciseName} (အဟောင်း)</option>:null}{libraryBySplit.map(([group,rows])=><optgroup label={group} key={group}>{rows.map(item=><option key={item.id} value={item.exercise_name}>{item.exercise_name}</option>)}</optgroup>)}</select></label>
            <label><span>Sets</span><input type="number" min="1" max="20" value={exercise.targetSets} onChange={event=>setExercises(rows=>rows.map((row,position)=>position===index?{...row,targetSets:Number(event.target.value)}:row))}/></label>
            <label><span>Reps</span><input value={exercise.targetReps} onChange={event=>setExercises(rows=>rows.map((row,position)=>position===index?{...row,targetReps:event.target.value}:row))} placeholder="8-12"/></label>
            <button aria-label={`${exercise.exerciseName||"Exercise"} ဖယ်မယ်`} className={styles.iconButton} disabled={exercises.length===1} onClick={()=>setExercises(rows=>rows.filter((_,position)=>position!==index))}><Trash2 size={17}/></button>
          </div>)}</div>
          <div className={styles.actions}><button className={styles.secondary} disabled={!library.length} onClick={()=>setExercises(rows=>[...rows,blankExercise()])}><Plus size={17}/>Exercise ထည့်မယ်</button><button className={styles.button} disabled={pending||!clientId||!date||!splitName.trim()||exercises.some(exercise=>!exercise.exerciseName.trim())} onClick={save}><Save size={17}/>{pending?"သိမ်းနေတယ်…":"Workout သိမ်းမယ်"}</button></div>
        </div>
      </section>
    </div>}
  </div>;
}
