-- Trigger records differ between shared_exercises and shared_exercise_videos.
-- Resolve the source exercise through JSON so both trigger shapes are safe.
create or replace function private.sync_shared_exercise_to_coaching_library()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercise_id uuid;
begin
  v_exercise_id := coalesce(
    nullif(to_jsonb(new) ->> 'exercise_id', '')::uuid,
    nullif(to_jsonb(new) ->> 'id', '')::uuid
  );
  insert into public.coaching_exercise_library(
    program_type, split_name, exercise_name, muscle_group,
    sets_default, reps_default, rest_seconds, form_video_url, sort_order,
    shared_exercise_id
  )
  select 'personal_coaching', category.name, shared.name_en, shared.muscle_group,
         shared.default_sets,
         concat(shared.default_reps_min, '-', shared.default_reps_max),
         shared.default_rest_seconds,
         case when video.asset_id is null then null else '/api/user/exercise-media?assetId=' || video.asset_id::text end,
         shared.sort_order, shared.id
  from public.shared_exercises shared
  join public.exercise_categories category on category.id = shared.category_id
  left join public.shared_exercise_videos video on video.exercise_id = shared.id and video.role = 'primary'
  where shared.id = v_exercise_id
  on conflict (shared_exercise_id) where shared_exercise_id is not null do update set
    split_name = excluded.split_name,
    exercise_name = excluded.exercise_name,
    muscle_group = excluded.muscle_group,
    sets_default = excluded.sets_default,
    reps_default = excluded.reps_default,
    rest_seconds = excluded.rest_seconds,
    form_video_url = excluded.form_video_url,
    sort_order = excluded.sort_order;
  return new;
end;
$$;
