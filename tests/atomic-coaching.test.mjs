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
  for (const table of ["coaching_profiles", "coaching_registrations", "coaching_programs", "coaching_workouts", "coaching_workout_exercises", "coaching_daily_trackers", "coaching_journaling"]) {
    const sql = base.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(sql, table); await db.exec(sql);
  }
  await db.exec(`alter table coaching_workout_exercises add column shared_exercise_id uuid references shared_exercises(id), add column rest_seconds integer default 90;
    alter table coaching_daily_trackers add column wake_time text;
    alter table coaching_journaling add constraint test_failure check(diet_status <> 'FAIL');
    insert into auth.users values('${client}'); insert into coaching_profiles(id) values('${client}');
    insert into shared_exercises values('${exercise}','Push up');`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261007090000_atomic_coaching_writes.sql", import.meta.url), "utf8"));
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
