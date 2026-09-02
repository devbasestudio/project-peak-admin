-- Idempotent UI demo data for the owner's 1:1 coaching account.
-- Existing daily logs, check-ins, workouts and photos are preserved.
begin;

do $$
declare
  v_user_id uuid;
  v_day integer;
  v_workout record;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('phyodynamics@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Target user phyodynamics@gmail.com was not found';
  end if;

  insert into public.coaching_profiles (id, username, email, role, onboarding_complete, updated_at)
  values (v_user_id, 'Phyo Dynamic Academy', 'phyodynamics@gmail.com', 'user', true, now())
  on conflict (id) do update set
    email = excluded.email,
    role = 'user',
    onboarding_complete = true,
    updated_at = now();

  update public.coaching_registrations
  set payment_status = 'ready', status = 'ready', ready_at = coalesce(ready_at, now()), updated_at = now()
  where user_id = v_user_id;

  insert into public.coaching_programs (user_id, duration_weeks, target_calories, macros_p, macros_c, macros_f, program_type, start_date, updated_at)
  values (v_user_id, 12, 2150, 145, 235, 70, 'personal_coaching', current_date - 21, now())
  on conflict (user_id) do update set
    duration_weeks = excluded.duration_weeks,
    target_calories = excluded.target_calories,
    macros_p = excluded.macros_p,
    macros_c = excluded.macros_c,
    macros_f = excluded.macros_f,
    program_type = excluded.program_type,
    start_date = least(public.coaching_programs.start_date, excluded.start_date),
    updated_at = now();

  insert into public.coaching_user_profiles (user_id, height_cm, starting_weight, age, body_fat_percent, desired_body_text, updated_at)
  values (v_user_id, 175, 72.4, 29, 22, 'Lean, athletic body with consistent energy and sustainable habits.', now())
  on conflict (user_id) do update set
    height_cm = coalesce(public.coaching_user_profiles.height_cm, excluded.height_cm),
    starting_weight = coalesce(public.coaching_user_profiles.starting_weight, excluded.starting_weight),
    age = coalesce(public.coaching_user_profiles.age, excluded.age),
    body_fat_percent = coalesce(public.coaching_user_profiles.body_fat_percent, excluded.body_fat_percent),
    desired_body_text = coalesce(nullif(public.coaching_user_profiles.desired_body_text, ''), excluded.desired_body_text),
    updated_at = now();

  insert into public.coaching_custom_tracker_templates (user_id, name, sections, active, updated_at)
  values (
    v_user_id,
    'Project Peak 1:1 — Transformation Daily System',
    '[
      {"title":"Morning","icon":"ph-sun-horizon","fields":[
        {"id":"body_weight","label":"Morning weight","type":"number","icon":"ph-scales","fixed":true},
        {"id":"wake_time","label":"Wake-up time","type":"time","icon":"ph-clock"},
        {"id":"sleep","label":"Sleep quality","type":"select","icon":"ph-moon","options":["Low","OK","Great"]},
        {"id":"readiness","label":"Morning readiness","type":"select","icon":"ph-gauge","options":["Low","Ready","Strong"]}
      ]},
      {"title":"Mid-day","icon":"ph-sun","fields":[
        {"id":"workout","label":"Workout complete","type":"checkbox","icon":"ph-barbell"},
        {"id":"steps","label":"Daily steps","type":"counter","icon":"ph-person-simple-walk"},
        {"id":"water","label":"Water (litres)","type":"number","icon":"ph-drop"},
        {"id":"meal_photo","label":"Meal photo","type":"photo","icon":"ph-camera"}
      ]},
      {"title":"Night","icon":"ph-moon-stars","fields":[
        {"id":"meal_plan","label":"Meal plan followed","type":"checkbox","icon":"ph-bowl-food"},
        {"id":"win","label":"Today''s win","type":"text","icon":"ph-trend-up"},
        {"id":"struggle","label":"Main struggle","type":"text","icon":"ph-warning-circle"},
        {"id":"phone_off","label":"Phone-off time","type":"time","icon":"ph-device-mobile-slash"}
      ]}
    ]'::jsonb,
    true,
    now()
  )
  on conflict (user_id) do update set
    name = excluded.name,
    sections = excluded.sections,
    active = true,
    updated_at = now();

  insert into public.coaching_weekly_schedule (user_id, day_of_week, split_name, is_rest)
  values
    (v_user_id, 0, 'Recovery', true),
    (v_user_id, 1, 'Upper Strength', false),
    (v_user_id, 2, 'Zone 2 + Mobility', false),
    (v_user_id, 3, 'Lower Strength', false),
    (v_user_id, 4, 'Recovery', true),
    (v_user_id, 5, 'Full Body', false),
    (v_user_id, 6, 'Steps + Stretch', false)
  on conflict (user_id, day_of_week) do update set split_name = excluded.split_name, is_rest = excluded.is_rest;

  for v_day in 1..21 loop
    insert into public.coaching_daily_trackers (
      user_id, date, body_weight, steps, sleep_score, water_3l, omega_3,
      bed_phone_filter, meal_plan_adhered, toilet, phone_off_time, water_liters,
      wake_time, one_win, one_struggle, tracker_values
    ) values (
      v_user_id,
      current_date - (22 - v_day),
      round((72.35 - v_day * 0.085)::numeric, 2),
      6200 + v_day * 170,
      6 + (v_day % 4),
      v_day % 5 <> 0,
      v_day % 4 <> 0,
      v_day % 3 <> 0,
      v_day % 6 <> 0,
      v_day % 4 <> 1,
      case when v_day % 3 = 0 then '22:15' else '22:45' end,
      round((2.1 + (v_day % 5) * 0.25)::numeric, 1),
      case when v_day % 2 = 0 then '06:30' else '06:50' end,
      case when v_day % 4 = 0 then 'Training form felt stronger today.' else 'Completed the plan even on a busy day.' end,
      case when v_day % 5 = 0 then 'Late meeting made meals harder.' else null end,
      jsonb_build_object(
        'workout', v_day % 2 = 0,
        'sleep', case when v_day % 4 = 0 then 'Great' when v_day % 3 = 0 then 'Low' else 'OK' end,
        'readiness', case when v_day % 5 = 0 then 'Low' when v_day % 2 = 0 then 'Strong' else 'Ready' end,
        'meal_plan', v_day % 6 <> 0,
        'water', round((2.1 + (v_day % 5) * 0.25)::numeric, 1),
        'win', case when v_day % 4 = 0 then 'Added one clean rep.' else 'Kept the daily system going.' end
      )
    )
    on conflict (user_id, date) do nothing;
  end loop;

  insert into public.coaching_weekly_checkins (
    user_id, week_number, avg_weight, energy_workout, energy_workout_notes,
    energy_daily, energy_daily_notes, motivation, motivation_notes,
    struggle_notes, improvement_notes, upcoming_disruptions, changes_wanted, admin_feedback
  ) values
    (v_user_id, 1, 71.85, 7, 'Technique improved through the week.', 7, 'Afternoon energy was steadier.', 8, 'Clear plan made consistency easier.', 'Meal timing on meeting days.', 'Completed every planned session.', 'Two late work nights next week.', 'Need a faster breakfast option.', 'Strong first week. Keep the morning routine unchanged and prepare breakfast the night before.'),
    (v_user_id, 2, 71.25, 8, 'Reps felt smoother and more controlled.', 8, 'Less afternoon fatigue.', 8, 'Progress is visible in the logs.', 'Sleep dropped on one night.', 'Steps and water were more consistent.', 'Weekend family event.', 'Keep one flexible meal.', 'Good trend. Use the flexible meal at the event and return to the next planned meal.'),
    (v_user_id, 3, 70.72, 8, 'Added reps without losing form.', 8, 'Daily focus improved.', 9, 'The system now feels normal.', 'Shoulder felt tight after work.', 'Weight, habits and workout quality all improved.', 'Long travel day on Friday.', 'Add a travel-day mobility plan.', 'Excellent consistency. Use the 10-minute mobility option on Friday and keep load conservative.'),
    (v_user_id, 4, 70.45, 9, 'Best training week so far.', 8, 'Energy remained stable.', 9, 'Ready for the next progression.', 'One meal was missed during travel.', 'Recovered quickly and did not skip the system.', 'No major disruption expected.', 'Increase lower-body challenge slightly.', 'Progress is on track. Add one set to the first lower-body movement next week.')
  on conflict (user_id, week_number) do nothing;

  for v_day in 1..12 loop
    insert into public.coaching_workouts (user_id, date, split_name, completed, user_notes, user_feelings)
    select
      v_user_id,
      current_date - (24 - v_day * 2),
      case when v_day % 3 = 1 then 'Upper Strength' when v_day % 3 = 2 then 'Lower Strength' else 'Full Body' end,
      v_day <= 10,
      case when v_day <= 10 then 'Completed with controlled form.' else null end,
      case when v_day % 4 = 0 then 'Strong' else 'Good' end
    where not exists (
      select 1 from public.coaching_workouts existing
      where existing.user_id = v_user_id and existing.date = current_date - (24 - v_day * 2)
    );
  end loop;

  for v_workout in
    select id, split_name, completed
    from public.coaching_workouts
    where user_id = v_user_id and date >= current_date - 30
  loop
    insert into public.coaching_workout_exercises (workout_id, exercise_name, target_sets, target_reps, actual_weight, actual_reps)
    select v_workout.id, exercise.exercise_name, exercise.target_sets, exercise.target_reps,
      case when v_workout.completed then exercise.actual_weight else null end,
      case when v_workout.completed then exercise.actual_reps else null end
    from (values
      ('Goblet squat', 3, '8–12', '20 kg', '10, 10, 9'),
      ('Push-up', 3, '8–15', 'Bodyweight', '12, 11, 10'),
      ('One-arm row', 3, '10–12', '12 kg', '12, 12, 11')
    ) as exercise(exercise_name, target_sets, target_reps, actual_weight, actual_reps)
    where not exists (
      select 1 from public.coaching_workout_exercises existing
      where existing.workout_id = v_workout.id and existing.exercise_name = exercise.exercise_name
    );
  end loop;

  for v_day in 1..10 loop
    insert into public.coaching_journaling (user_id, date, diet_status, satisfied_with, difficult_with)
    values (
      v_user_id,
      current_date - (11 - v_day),
      case when v_day % 4 = 0 then 'Flexible meal' else 'On plan' end,
      'Kept the next action clear and completed it.',
      case when v_day % 4 = 0 then 'Work schedule changed meal timing.' else 'No major issue.' end
    )
    on conflict (user_id, date) do nothing;
  end loop;
end
$$;

commit;
