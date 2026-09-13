alter table public.coaching_workout_exercises
  add column if not exists rest_seconds integer;

update public.coaching_workout_exercises workout_exercise
set rest_seconds = coalesce(
  (
    select shared.default_rest_seconds
    from public.shared_exercises shared
    where shared.id = workout_exercise.shared_exercise_id
  ),
  90
)
where workout_exercise.rest_seconds is null;

alter table public.coaching_workout_exercises
  alter column rest_seconds set default 90,
  alter column rest_seconds set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'coaching_workout_exercises_rest_seconds_check'
      and conrelid = 'public.coaching_workout_exercises'::regclass
  ) then
    alter table public.coaching_workout_exercises
      add constraint coaching_workout_exercises_rest_seconds_check
      check (rest_seconds between 0 and 3600);
  end if;
end
$$;

create or replace function public.clone_coaching_workout_to_next_week(
  p_source_workout_id bigint
)
returns table(workout_id bigint, workout_date date)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_workout public.coaching_workouts%rowtype;
  cloned_workout public.coaching_workouts%rowtype;
  target_date date;
begin
  select * into source_workout
  from public.coaching_workouts
  where id = p_source_workout_id;

  if not found then
    raise exception 'Source coaching workout not found' using errcode = '22023';
  end if;
  if source_workout.completed is not true then
    raise exception 'Only a completed coaching workout can be duplicated' using errcode = '55000';
  end if;

  target_date := source_workout.date + 7;
  perform pg_advisory_xact_lock(hashtextextended(source_workout.user_id::text || ':' || target_date::text, 1));

  if exists (
    select 1 from public.coaching_workouts
    where user_id = source_workout.user_id and date = target_date
  ) then
    raise exception 'A coaching workout already exists on the target date' using errcode = '23505';
  end if;

  insert into public.coaching_workouts(user_id, date, split_name, completed, user_notes, user_feelings)
  values (source_workout.user_id, target_date, source_workout.split_name, false, null, null)
  returning * into cloned_workout;

  insert into public.coaching_workout_exercises(
    workout_id, shared_exercise_id, exercise_name, target_sets, target_reps,
    rest_seconds, actual_weight, actual_reps
  )
  select
    cloned_workout.id, source_exercise.shared_exercise_id, source_exercise.exercise_name,
    source_exercise.target_sets, source_exercise.target_reps,
    source_exercise.rest_seconds, null, null
  from public.coaching_workout_exercises source_exercise
  where source_exercise.workout_id = source_workout.id
  order by source_exercise.id;

  return query select cloned_workout.id, cloned_workout.date;
end;
$$;

revoke all on function public.clone_coaching_workout_to_next_week(bigint) from public, anon, authenticated;
grant execute on function public.clone_coaching_workout_to_next_week(bigint) to service_role;
