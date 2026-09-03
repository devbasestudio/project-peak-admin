-- 1:1 day plans now select from shared_exercises directly. The legacy table
-- remains only for existing automatic templates and exercise swaps, so common
-- category edits must not rewrite its split names.
drop trigger if exists shared_exercise_sync_coaching_library on public.shared_exercises;
drop trigger if exists shared_exercise_video_sync_coaching_library on public.shared_exercise_videos;
drop function if exists private.sync_shared_exercise_to_coaching_library();

-- These original rows were created through the old UI whose default split was
-- Full Body. Restore that value after the one-time compatibility seed.
update public.coaching_exercise_library
set split_name = 'Full Body'
where id in (1, 2, 3)
  and exercise_name in ('Goblet squat', 'One-arm row', 'Push-up');
