"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera, CheckSquare, Clock3, Hash, ListChecks, Minus, Plus, Save, Send, Type } from "lucide-react";
import { saveCoachingTemplate } from "@/app/coaching-actions";
import styles from "./template-builder.module.css";

type FieldType = "number"|"time"|"select"|"checkbox"|"counter"|"text"|"photo";
type Field = { id:string;label:string;type:FieldType;icon:string;fixed?:boolean;options?:string[] };
type Section = { title:"Morning"|"Mid-day"|"Night";icon:string;fields:Field[] };
type Client = { id:string;username:string;email:string;avatar_url?:string|null;registration?:{name?:string|null}|null };
type Template = { user_id:string;name:string;sections:unknown;updated_at:string };

const icons:Record<FieldType,React.ReactNode>={number:<Hash/>,time:<Clock3/>,select:<ListChecks/>,checkbox:<CheckSquare/>,counter:<Plus/>,text:<Type/>,photo:<Camera/>};
const iconNames:Record<FieldType,string>={number:"ph-hash",time:"ph-clock",select:"ph-list-checks",checkbox:"ph-check-square",counter:"ph-plus-circle",text:"ph-note-pencil",photo:"ph-camera"};
const starter:Section[]=[
  {title:"Morning",icon:"ph-sun-horizon",fields:[{id:"body_weight",label:"Morning weight",type:"number",icon:"ph-scales",fixed:true},{id:"sleep",label:"Sleep quality",type:"select",icon:"ph-moon",options:["Low","OK","Great"]}]},
  {title:"Mid-day",icon:"ph-sun",fields:[{id:"workout",label:"Workout complete",type:"checkbox",icon:"ph-barbell"},{id:"meal_photo",label:"Meal photo",type:"photo",icon:"ph-camera"},{id:"steps",label:"Steps",type:"counter",icon:"ph-person-simple-walk"}]},
  {title:"Night",icon:"ph-moon-stars",fields:[{id:"win",label:"Today’s win",type:"text",icon:"ph-trend-up"},{id:"struggle",label:"Main struggle",type:"text",icon:"ph-warning-circle"},{id:"water",label:"Water (litres)",type:"number",icon:"ph-drop"}]},
];
function normalize(value:unknown):Section[]{return Array.isArray(value)&&value.length===3?JSON.parse(JSON.stringify(value)):JSON.parse(JSON.stringify(starter));}

export function CoachingTemplateBuilder({clients,templates}:{clients:Client[];templates:Template[]}){
  const [clientId,setClientId]=useState(clients[0]?.id||"");
  const current=useMemo(()=>templates.find((item)=>item.user_id===clientId),[templates,clientId]);
  const [name,setName]=useState(current?.name||"My 1:1 Coaching Day");
  const [sections,setSections]=useState<Section[]>(normalize(current?.sections));
  const [message,setMessage]=useState(""); const [pending,startTransition]=useTransition();
  function selectClient(nextClientId:string){
    const nextTemplate=templates.find((item)=>item.user_id===nextClientId);
    setClientId(nextClientId);
    setName(nextTemplate?.name||"My 1:1 Coaching Day");
    setSections(normalize(nextTemplate?.sections));
    setMessage("");
  }
  function update(sectionIndex:number,fieldIndex:number,patch:Partial<Field>){setSections((all)=>all.map((section,si)=>si!==sectionIndex?section:{...section,fields:section.fields.map((field,fi)=>fi!==fieldIndex?field:{...field,...patch})}));}
  function add(sectionIndex:number){setSections((all)=>all.map((section,si)=>si!==sectionIndex?section:{...section,fields:[...section.fields,{id:`custom_${crypto.randomUUID().slice(0,8)}`,label:"New field",type:"text",icon:iconNames.text}]}));}
  function remove(sectionIndex:number,fieldIndex:number){setSections((all)=>all.map((section,si)=>si!==sectionIndex?section:{...section,fields:section.fields.filter((field,fi)=>fi!==fieldIndex||field.fixed)}));}
  function save(markReady:boolean){setMessage("");startTransition(async()=>{const result=await saveCoachingTemplate({userId:clientId,name,sections,markReady});setMessage(result.message);});}
  return <div className={styles.page}><div className={styles.head}><div><p>CLIENT-SPECIFIC · NO CODE</p><h1>Custom Template Builder</h1><span>Client ရွေး → လိုတဲ့ field ထည့် → Save လုပ်ပါ။ Client စသုံးလို့ရပြီဆိုရင် “Save + Dashboard ဖွင့်မယ်” ကိုနှိပ်ပါ။</span></div></div>{clients.length===0?<div className={styles.empty}><strong>Template ဆောက်ဖို့ client မရှိသေးပါ</strong><span>Payment approve အရင်လုပ်ပေးပါ။</span></div>:<><section className={styles.selectors}><label>Client<select value={clientId} onChange={(event)=>selectClient(event.target.value)}>{clients.map((client)=><option key={client.id} value={client.id}>{client.username||client.registration?.name||client.email}</option>)}</select></label><label>Template name<input value={name} onChange={(event)=>setName(event.target.value)}/></label></section><div className={styles.sections}>{sections.map((section,sectionIndex)=><section className={styles.section} key={section.title}><div className={styles.sectionHead}><span>0{sectionIndex+1}</span><div><strong>{section.title}</strong><small>{section.fields.length} fields</small></div></div><div className={styles.fields}>{section.fields.map((field,fieldIndex)=><article key={field.id}><span className={styles.typeIcon}>{icons[field.type]}</span><div className={styles.fieldInputs}><input value={field.label} onChange={(event)=>update(sectionIndex,fieldIndex,{label:event.target.value})}/><select value={field.type} disabled={field.fixed} onChange={(event)=>{const type=event.target.value as FieldType;update(sectionIndex,fieldIndex,{type,icon:iconNames[type],options:type==="select"?["Low","OK","Great"]:undefined});}}>{Object.keys(iconNames).map((type)=><option key={type} value={type}>{type}</option>)}</select>{field.type==="select"?<input placeholder="Low, OK, Great" value={(field.options||[]).join(", ")} onChange={(event)=>update(sectionIndex,fieldIndex,{options:event.target.value.split(",").map((item)=>item.trim()).filter(Boolean)})}/>:null}</div><button type="button" disabled={field.fixed} onClick={()=>remove(sectionIndex,fieldIndex)} aria-label="Field ဖယ်မယ်"><Minus/></button></article>)}</div><button className={styles.add} type="button" onClick={()=>add(sectionIndex)}><Plus/> Field ထည့်မယ်</button></section>)}</div><div className={styles.actions}><button disabled={pending} onClick={()=>save(false)}><Save/>{pending?"Saving…":"Save draft"}</button><button disabled={pending} data-primary onClick={()=>save(true)}><Send/>{pending?"Saving…":"Save + Dashboard ဖွင့်မယ်"}</button>{message?<p>{message}</p>:null}</div></>}</div>;
}
