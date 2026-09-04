-- These three movements are used by the seeded 1:1 client workout. Reuse the
-- existing temporary demonstration until the trainer uploads movement-specific
-- clips from the shared Exercises screen.
with sample_asset as (
  select id
  from public.media_assets
  where bucket_id = 'program-media'
    and object_path = 'exercise-samples/primary-77916.mp4'
  limit 1
)
insert into public.shared_exercise_videos (exercise_id, role, asset_id)
select exercise.id, 'primary', sample_asset.id
from public.shared_exercises exercise
cross join sample_asset
where lower(trim(exercise.name_en)) in ('push-up', 'one-arm row', 'goblet squat')
on conflict (exercise_id, role) do update
set asset_id = excluded.asset_id,
    updated_at = now();
