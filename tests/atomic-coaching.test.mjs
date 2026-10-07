import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
let db;
const client = "00000000-0000-4000-8000-000000000001";
const exercise = "00000000-0000-4000-8000-000000000002";
before(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$ select '${client}'::uuid $$;
    create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;
    create table public.shared_exercises(id uuid primary key,name_en text not null);`);
  const base = await readFile(new URL("./fixtures/coaching-schema.sql", import.meta.url), "utf8");
  for (const table of ["coaching_profiles", "coaching_registrations", "coaching_programs", "coaching_workouts", "coaching_workout_exercises", "coaching_daily_trackers", "coaching_journaling", "coaching_custom_tracker_templates", "coaching_nutrition_items", "coaching_nutrition_logs", "coaching_weekly_checkins"]) {
    const sql = base.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(sql, table); await db.exec(sql);
  }
  await db.exec(`alter table coaching_workout_exercises add column shared_exercise_id uuid references shared_exercises(id), add column rest_seconds integer default 90;
    alter table coaching_daily_trackers add column wake_time text;
    alter table coaching_journaling add constraint test_failure check(diet_status <> 'FAIL');
    insert into auth.users values('${client}'); insert into coaching_profiles(id) values('${client}');
    insert into shared_exercises values('${exercise}','Push up');`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261007090000_atomic_coaching_writes.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20261007100000_coaching_plan_safety.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20261007101000_coaching_daily_versions.sql", import.meta.url), "utf8"));
});
after(async () => { await db?.close(); });
const input = (extra = {}) => ({ requestId: randomUUID(), userId: client, date: "2026-10-10", splitName: "Test", targetDates: [], exercises: [{libraryExerciseId:exercise,targetSets:3,targetReps:"8-12",restSeconds:90}], ...extra });
const save = async (payload) => (await db.query("select admin_save_coaching_workout_atomic($1::jsonb) result", [JSON.stringify(payload)])).rows[0].result;
test("invalid later exercise rolls back parent and earlier exercise inserts", async () => {
  const p = input(); p.exercises.push({...p.exercises[0],libraryExerciseId:randomUUID()});
  await assert.rejects(save(p), /Invalid library/);
  assert.equal((await db.query("select count(*)::int n from coaching_workouts")).rows[0].n, 0);
});
test("multi-date save is idempotent and conflicting retries cannot overwrite", async () => {
  const p=input({targetDates:["2026-10-12","2026-10-14"]});
  const first=await save(p); assert.equal(first.count,3); assert.deepEqual(await save(p),first);
  assert.equal((await db.query("select count(*)::int n from coaching_workout_exercises")).rows[0].n,3);
  await assert.rejects(save({...p,splitName:"changed"}),/Retry payload changed/);
  await assert.rejects(save({...p,requestId:randomUUID()}),/already has a workout/);
});
test("wrong child ID cannot leave a partially edited parent", async () => {
  const p=input({date:"2026-10-20"}); const saved=await save(p);
  await assert.rejects(save({...p,id:saved.workoutId,requestId:randomUUID(),splitName:"should rollback",exercises:[{...p.exercises[0],id:99999}]}),/does not belong/);
  assert.equal((await db.query("select split_name from coaching_workouts where id=$1",[saved.workoutId])).rows[0].split_name,"Test");
});
test("daily patches preserve omitted fields and journal failure rolls back tracker", async () => {
  await db.query("select save_coaching_daily_atomic($1,$2,$3)",["2026-10-07",JSON.stringify({steps:4000,sleep_score:8}),"{}"]);
  await db.query("select save_coaching_daily_atomic($1,$2,$3)",["2026-10-07",JSON.stringify({one_win:"Good"}),"{}"]);
  await assert.rejects(db.query("select save_coaching_daily_atomic($1,$2,$3)",["2026-10-07",JSON.stringify({steps:5}),JSON.stringify({diet_status:"FAIL"})]));
  const row=(await db.query("select steps,sleep_score,one_win from coaching_daily_trackers")).rows[0];
  assert.deepEqual(row,{steps:4000,sleep_score:8,one_win:"Good"});
});
test("approval retry preserves program start date and cannot become rejected", async () => {
  const r=await db.query(`insert into coaching_registrations(user_id,intake_answers,photo_front,photo_back,photo_side) values($1,'{"payment_confirmed":true}','front','back','side') returning id`,[client]);
  const id=r.rows[0].id;
  await db.query("select admin_review_coaching_payment_atomic($1,'approve')",[id]);
  await db.exec("update coaching_programs set start_date='2026-01-01'");
  await db.query("select admin_review_coaching_payment_atomic($1,'approve')",[id]);
  assert.equal((await db.query("select start_date::text from coaching_programs")).rows[0].start_date,"2026-01-01");
  await assert.rejects(db.query("select admin_review_coaching_payment_atomic($1,'reject')",[id]),/already approved/);
});

const meal = (extra={}) => ({requestId:randomUUID(),operation:"save",userId:client,planDate:"2026-10-08",mealType:"breakfast",foodName:"Test meal",calories:300,protein:20,carbs:40,fat:5,sortOrder:0,...extra});
const mutateMeal = async (p) => (await db.query("select admin_mutate_coaching_meals($1) result",[JSON.stringify(p)])).rows[0].result;
test("meal retry creates one item, copying dates is atomic and repeat safe", async()=>{
  const p=meal();const saved=await mutateMeal(p);assert.deepEqual(await mutateMeal(p),saved);
  const copy={requestId:randomUUID(),operation:"copy",userId:client,sourceDate:"2026-10-08",targetDates:["2026-10-09","2026-10-10"]};
  assert.equal((await mutateMeal(copy)).count,2);assert.equal((await mutateMeal(copy)).count,2);
  await assert.rejects(mutateMeal({...copy,requestId:randomUUID(),targetDates:["2026-10-10","2026-10-11"]}),/already has meals/);
  assert.equal((await db.query("select count(*)::int n from coaching_nutrition_items where plan_date='2026-10-11'")).rows[0].n,0);
});
test("logged meal cannot cascade-delete client history",async()=>{
  const {mealId}=await mutateMeal(meal({foodName:"Logged"}));
  await db.query("insert into coaching_nutrition_logs(user_id,date,nutrition_item_id) values($1,'2026-10-08',$2)",[client,mealId]);
  await assert.rejects(mutateMeal({requestId:randomUUID(),operation:"delete",userId:client,id:mealId}),/client logs/);
  assert.equal((await db.query("select count(*)::int n from coaching_nutrition_logs")).rows[0].n,1);
});
test("meal copies choose dated client over legacy, and fill missing slots from defaults",async()=>{
  await db.query(`insert into coaching_nutrition_items(user_id,program_type,meal_type,food_name) values($1,'personal_coaching','breakfast','Legacy'),(null,'personal_coaching','lunch','Shared lunch')`,[client]);
  await mutateMeal({requestId:randomUUID(),operation:"copy",userId:client,sourceDate:"2026-10-08",targetDates:["2026-10-12"]});
  const names=(await db.query("select food_name from coaching_nutrition_items where plan_date='2026-10-12' order by food_name")).rows.map(r=>r.food_name);
  assert.deepEqual(names,["Logged","Shared lunch","Test meal"]);
});
test("template readiness validation leaves no partially saved template",async()=>{
  await db.exec("update coaching_registrations set payment_status='pending'");
  await assert.rejects(db.query("select admin_save_coaching_template_atomic($1,'New','[]',true)",[client]),/Approve payment first/);
  assert.equal((await db.query("select count(*)::int n from coaching_custom_tracker_templates")).rows[0].n,0);
  await db.exec("update coaching_registrations set payment_status='approved'");
  await db.query("select admin_save_coaching_template_atomic($1,'New','[]',true)",[client]);
  assert.equal((await db.query("select payment_status from coaching_registrations")).rows[0].payment_status,'ready');
});
test("client summary returns counts and latest only instead of whole histories",async()=>{
  await db.query("insert into coaching_weekly_checkins(user_id,week_number) values($1,1),($1,2)",[client]);
  const rows=(await db.query("select * from admin_coaching_client_summary($1)",[[client]])).rows;
  assert.equal(rows.length,1);assert.equal(Number(rows[0].log_count),1);assert.equal(Number(rows[0].checkin_count),2);
  assert.equal(Object.keys(rows[0]).length,5);
});

test("daily version prevents stale overwrite and retries a committed response only once",async()=>{
  const id=randomUUID();
  const args=['2026-10-15','{"steps":5000}','{}',0,id];
  const write=async(a)=>(await db.query('select save_coaching_daily_versioned($1,$2,$3,$4,$5) revision',a)).rows[0].revision;
  assert.equal(Number(await write(args)),1);assert.equal(Number(await write(args)),1);
  await assert.rejects(write(['2026-10-15','{"steps":1}','{}',0,randomUUID()]),/another screen/);
  await assert.rejects(write(['2026-10-15','{"steps":2}','{}',0,id]),/Retry payload changed/);
  assert.equal((await db.query("select steps from coaching_daily_trackers where date='2026-10-15'")).rows[0].steps,5000);
  // Older write APIs also increment the version so modern clients detect them.
  await db.query("select save_coaching_daily_atomic('2026-10-15','{\"steps\":6000}','{}')");
  await assert.rejects(write(['2026-10-15','{"steps":3}','{}',1,randomUUID()]),/another screen/);
});

test("member role cannot invoke admin mutations or see another user's save receipts",async()=>{
  const other='00000000-0000-4000-8000-000000000099';
  await db.query('insert into auth.users values($1);',[other]);
  await db.query('insert into coaching_profiles(id) values($1);',[other]);
  await db.query("insert into coaching_daily_write_receipts(user_id,request_id,payload_hash,revision) values($1,$2,'private',1)",[other,randomUUID()]);
  await db.exec('grant usage on schema auth to authenticated; set role authenticated;');
  try {
    assert.equal((await db.query('select count(*)::int n from coaching_daily_write_receipts where user_id=$1',[other])).rows[0].n,0);
    await assert.rejects(db.query("insert into coaching_daily_write_receipts(user_id,request_id,payload_hash,revision) values($1,$2,'forged',1)",[other,randomUUID()]),/row-level security/);
    await assert.rejects(db.query("select admin_mutate_coaching_meals('{}')"),/permission denied/);
    await assert.rejects(db.query("select admin_coaching_client_summary($1)",[[other]]),/permission denied/);
  } finally { await db.exec('reset role'); }
});
