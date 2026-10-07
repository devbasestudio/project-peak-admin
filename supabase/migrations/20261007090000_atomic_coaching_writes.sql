-- Additive hardening: no existing client records are rewritten.
create table if not exists public.coaching_admin_mutations (
  request_id uuid primary key,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.coaching_admin_mutations enable row level security;
revoke all on public.coaching_admin_mutations from public, anon, authenticated;
grant select, insert on public.coaching_admin_mutations to service_role;

create or replace function public.admin_save_coaching_workout_atomic(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare
  request_id uuid := (p_input->>'requestId')::uuid;
  client_id uuid := (p_input->>'userId')::uuid;
  edit_id bigint := (p_input->>'id')::bigint;
  selected_date date := (p_input->>'date')::date;
  target_date date;
  dates date[];
  workout_id bigint;
  first_id bigint;
  exercise jsonb;
  exercise_id bigint;
  kept bigint[];
  canonical_name text;
  stored public.coaching_admin_mutations%rowtype;
  result jsonb;
begin
  if request_id is null or client_id is null or selected_date is null or
     length(trim(p_input->>'splitName')) not between 1 and 120 or
     jsonb_array_length(p_input->'exercises') not between 1 and 30 then
    raise exception 'Invalid workout payload' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 700));
  select * into stored from public.coaching_admin_mutations m where m.request_id = request_id;
  if found then
    if stored.payload <> p_input then raise exception 'Retry payload changed' using errcode = '22023'; end if;
    return stored.result;
  end if;
  -- Serialize plan writes for this client, including conflict checks.
  perform pg_advisory_xact_lock(hashtextextended(client_id::text, 701));
  if not exists(select 1 from public.coaching_profiles where id = client_id) then
    raise exception 'Client not found' using errcode = '22023';
  end if;
  select array_agg(distinct d order by d) into dates from (
    select selected_date d union all
    select value::date from jsonb_array_elements_text(coalesce(p_input->'targetDates', '[]'::jsonb))
  ) requested;
  if cardinality(dates) > 31 or (edit_id is not null and cardinality(dates) <> 1) then
    raise exception 'Invalid date selection' using errcode = '22023';
  end if;
  if edit_id is not null then
    perform 1 from public.coaching_workouts where id = edit_id and user_id = client_id and not completed for update;
    if not found then raise exception 'Workout missing, completed or belongs to another client' using errcode = '22023'; end if;
  elsif cardinality(dates) > 1 or coalesce((p_input->>'strictDates')::boolean, false) then
    if exists(select 1 from public.coaching_workouts where user_id = client_id and date = any(dates)) then
      raise exception 'Selected date already has a workout; no changes saved' using errcode = '23505';
    end if;
  end if;
  foreach target_date in array dates loop
    if edit_id is not null then
      workout_id := edit_id;
      update public.coaching_workouts set date = target_date, split_name = p_input->>'splitName' where id = workout_id;
    else
      insert into public.coaching_workouts(user_id,date,split_name,completed)
      values(client_id,target_date,p_input->>'splitName',false) returning id into workout_id;
    end if;
    if target_date = selected_date then first_id := workout_id; end if;
    kept := '{}'::bigint[];
    for exercise in select value from jsonb_array_elements(p_input->'exercises') loop
      select name_en into canonical_name from public.shared_exercises where id = (exercise->>'libraryExerciseId')::uuid;
      if not found or (exercise->>'targetSets')::int not between 1 and 20 or
        (exercise->>'restSeconds')::int not between 0 and 3600 or
        length(trim(exercise->>'targetReps')) not between 1 and 40 then
        raise exception 'Invalid library exercise or prescription' using errcode = '22023';
      end if;
      exercise_id := case when edit_id is not null then (exercise->>'id')::bigint else null end;
      if exercise_id is not null then
        if exercise_id = any(kept) then raise exception 'Duplicate exercise row' using errcode = '22023'; end if;
        update public.coaching_workout_exercises set
          shared_exercise_id = (exercise->>'libraryExerciseId')::uuid, exercise_name = canonical_name,
          target_sets = (exercise->>'targetSets')::int, target_reps = exercise->>'targetReps',
          rest_seconds = (exercise->>'restSeconds')::int
        where id = exercise_id and coaching_workout_exercises.workout_id = workout_id;
        if not found then raise exception 'Exercise does not belong to workout' using errcode = '22023'; end if;
      else
        insert into public.coaching_workout_exercises(workout_id,shared_exercise_id,exercise_name,target_sets,target_reps,rest_seconds)
        values(workout_id,(exercise->>'libraryExerciseId')::uuid,canonical_name,(exercise->>'targetSets')::int,exercise->>'targetReps',(exercise->>'restSeconds')::int)
        returning id into exercise_id;
      end if;
      kept := array_append(kept, exercise_id);
    end loop;
    if exists(select 1 from public.coaching_workout_exercises e where e.workout_id = workout_id and not(e.id = any(kept)) and (e.actual_weight is not null or e.actual_reps is not null)) then
      raise exception 'Cannot remove an exercise with client logs' using errcode = '22023';
    end if;
    delete from public.coaching_workout_exercises e where e.workout_id = workout_id and not(e.id = any(kept));
  end loop;
  result := jsonb_build_object('workoutId', first_id, 'count', cardinality(dates));
  insert into public.coaching_admin_mutations values(request_id,p_input,result,now());
  return result;
end;
$$;
revoke all on function public.admin_save_coaching_workout_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_coaching_workout_atomic(jsonb) to service_role;

create or replace function public.admin_review_coaching_payment_atomic(p_registration_id bigint, p_decision text)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.coaching_registrations%rowtype;
begin
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
  select * into strict r from public.coaching_registrations where id = p_registration_id for update;
  if r.user_id is null then raise exception 'Client account missing'; end if;
  if r.payment_status in ('approved','ready') then
    if p_decision = 'approve' then return; end if;
    raise exception 'Cannot reject an already approved payment';
  end if;
  if p_decision = 'reject' then
    update public.coaching_registrations set status='rejected',payment_status='rejected',updated_at=now() where id=r.id;
    return;
  end if;
  if coalesce((r.intake_answers->>'payment_confirmed')::boolean,false) is not true or
    nullif(r.photo_front,'') is null or nullif(r.photo_back,'') is null or nullif(r.photo_side,'') is null then
    raise exception 'Payment confirmation and three body photos are required';
  end if;
  update public.coaching_profiles set role='user',updated_at=now() where id=r.user_id;
  if not found then raise exception 'Client profile missing'; end if;
  insert into public.coaching_programs(user_id,duration_weeks,program_type,start_date)
  values(r.user_id,12,'personal_coaching',current_date)
  on conflict(user_id) do update set start_date=current_date, updated_at=now();
  update public.coaching_registrations set status='approved',payment_status='approved',approved_at=now(),updated_at=now() where id=r.id;
end;
$$;
revoke all on function public.admin_review_coaching_payment_atomic(bigint,text) from public, anon, authenticated;
grant execute on function public.admin_review_coaching_payment_atomic(bigint,text) to service_role;

create or replace function public.save_coaching_daily_atomic(p_date date, p_tracker jsonb, p_journal jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t public.coaching_daily_trackers%rowtype;
  j public.coaching_journaling%rowtype;
begin
  if uid is null or p_date is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  insert into public.coaching_daily_trackers(user_id,date) values(uid,p_date) on conflict(user_id,date) do nothing;
  select * into strict t from public.coaching_daily_trackers where user_id=uid and date=p_date for update;
  -- Only caller-provided fields change; omitted legacy fields are preserved.
  t := jsonb_populate_record(t, p_tracker - array['id','user_id','date','created_at']);
  update public.coaching_daily_trackers set body_weight=t.body_weight,steps=t.steps,sleep_score=t.sleep_score,
    water_3l=t.water_3l,omega_3=t.omega_3,bed_phone_filter=t.bed_phone_filter,meal_plan_adhered=t.meal_plan_adhered,
    toilet=t.toilet,wake_time=t.wake_time,phone_off_time=t.phone_off_time,water_liters=t.water_liters,
    one_win=t.one_win,one_struggle=t.one_struggle,tracker_values=t.tracker_values where user_id=uid and date=p_date;
  if p_journal <> '{}'::jsonb then
    insert into public.coaching_journaling(user_id,date) values(uid,p_date) on conflict(user_id,date) do nothing;
    select * into strict j from public.coaching_journaling where user_id=uid and date=p_date for update;
    j := jsonb_populate_record(j, p_journal - array['id','user_id','date','created_at']);
    update public.coaching_journaling set diet_status=j.diet_status,satisfied_with=j.satisfied_with,difficult_with=j.difficult_with where user_id=uid and date=p_date;
  end if;
end;
$$;
revoke all on function public.save_coaching_daily_atomic(date,jsonb,jsonb) from public, anon;
grant execute on function public.save_coaching_daily_atomic(date,jsonb,jsonb) to authenticated;
