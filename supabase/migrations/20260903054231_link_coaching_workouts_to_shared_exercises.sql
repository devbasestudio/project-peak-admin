alter table public.coaching_workout_exercises
add column if not exists shared_exercise_id uuid references public.shared_exercises(id) on delete set null;

create index if not exists coaching_workout_exercises_shared_exercise_idx
on public.coaching_workout_exercises(shared_exercise_id);

update public.coaching_workout_exercises workout
set shared_exercise_id = shared.id
from public.shared_exercises shared
where workout.shared_exercise_id is null
  and lower(workout.exercise_name) = lower(shared.name_en);
