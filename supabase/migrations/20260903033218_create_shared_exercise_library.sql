-- One source of truth for movements used by Home Workout and 1:1 Coaching.
create table if not exists public.exercise_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercise_categories_name_unique
on public.exercise_categories (lower(name));

create table if not exists public.shared_exercises (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.exercise_categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_mm text not null,
  name_en text not null,
  cue_mm text,
  cue_en text,
  equipment_mm text,
  equipment_en text,
  muscle_group text,
  default_sets smallint not null default 3 check (default_sets between 1 and 20),
  default_reps_min smallint not null default 8 check (default_reps_min between 0 and 999),
  default_reps_max smallint not null default 12 check (default_reps_max between default_reps_min and 999),
  default_rest_seconds integer not null default 90 check (default_rest_seconds between 0 and 3600),
  unilateral boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_exercises_category_order_idx
on public.shared_exercises(category_id, sort_order, name_en);

create table if not exists public.shared_exercise_videos (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.shared_exercises(id) on delete cascade,
  role text not null check (role in ('primary', 'alternative')),
  asset_id uuid not null references public.media_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, role)
);

alter table public.template_exercises
add column if not exists shared_exercise_id uuid references public.shared_exercises(id) on delete set null;

alter table public.program_exercises
add column if not exists shared_exercise_id uuid references public.shared_exercises(id) on delete set null;

-- Keep the existing 1:1 member flow as a compatibility read model while the
-- common library remains the only place an admin edits exercise metadata.
alter table public.coaching_exercise_library
add column if not exists shared_exercise_id uuid references public.shared_exercises(id) on delete set null;

create unique index if not exists coaching_exercise_library_shared_exercise_unique
on public.coaching_exercise_library(shared_exercise_id)
where shared_exercise_id is not null;

alter table public.exercise_categories enable row level security;
alter table public.shared_exercises enable row level security;
alter table public.shared_exercise_videos enable row level security;

revoke all on public.exercise_categories, public.shared_exercises, public.shared_exercise_videos from anon, authenticated;
grant select on public.exercise_categories, public.shared_exercises, public.shared_exercise_videos to authenticated;

create policy exercise_categories_authenticated_read on public.exercise_categories
for select to authenticated using (true);
create policy shared_exercises_authenticated_read on public.shared_exercises
for select to authenticated using (true);
create policy shared_exercise_videos_authenticated_read on public.shared_exercise_videos
for select to authenticated using (true);

drop trigger if exists exercise_categories_set_updated_at on public.exercise_categories;
create trigger exercise_categories_set_updated_at before update on public.exercise_categories
for each row execute function private.set_updated_at();
drop trigger if exists shared_exercises_set_updated_at on public.shared_exercises;
create trigger shared_exercises_set_updated_at before update on public.shared_exercises
for each row execute function private.set_updated_at();
drop trigger if exists shared_exercise_videos_set_updated_at on public.shared_exercise_videos;
create trigger shared_exercise_videos_set_updated_at before update on public.shared_exercise_videos
for each row execute function private.set_updated_at();

insert into public.exercise_categories(name, sort_order)
values ('Upper Body', 10), ('Lower Body', 20), ('Core', 30), ('Full Body', 40), ('General', 50)
on conflict do nothing;

-- Preserve the existing Home Workout movement catalogue and its videos.
with ranked as (
  select e.*,
         row_number() over (partition by e.slug order by v.version_no desc, e.position) as rank
  from public.template_exercises e
  join public.template_versions v on v.id = e.template_version_id
  where not e.is_assessment_only
), source as (
  select * from ranked where rank = 1
)
insert into public.shared_exercises (
  category_id, slug, name_mm, name_en, cue_mm, cue_en,
  equipment_mm, equipment_en, muscle_group, unilateral, sort_order
)
select c.id, s.slug, s.name_mm, s.name_en, s.cue_mm, s.cue_en,
       s.equipment_mm, s.equipment_en, s.body_part, s.unilateral, s.position
from source s
join public.exercise_categories c on lower(c.name) = case coalesce(s.body_part, '')
  when 'upper' then 'upper body'
  when 'lower' then 'lower body'
  when 'core' then 'core'
  when 'full' then 'full body'
  else 'general'
end
on conflict (slug) do update set
  name_mm = excluded.name_mm,
  name_en = excluded.name_en,
  cue_mm = excluded.cue_mm,
  cue_en = excluded.cue_en,
  equipment_mm = excluded.equipment_mm,
  equipment_en = excluded.equipment_en,
  muscle_group = excluded.muscle_group,
  unilateral = excluded.unilateral;

with ranked as (
  select e.id, e.slug,
         row_number() over (partition by e.slug order by tv.version_no desc, e.position) as rank
  from public.template_exercises e
  join public.template_versions tv on tv.id = e.template_version_id
  where not e.is_assessment_only
)
insert into public.shared_exercise_videos(exercise_id, role, asset_id)
select se.id, video.role, video.asset_id
from ranked source
join public.shared_exercises se on se.slug = source.slug
join public.template_exercise_videos video on video.template_exercise_id = source.id
where source.rank = 1
on conflict (exercise_id, role) do update set asset_id = excluded.asset_id;

-- Add 1:1-only movements without changing any existing client workout row.
insert into public.shared_exercises (
  category_id, slug, name_mm, name_en, muscle_group,
  default_sets, default_reps_min, default_reps_max, default_rest_seconds, sort_order
)
select c.id,
       trim(both '-' from regexp_replace(lower(e.exercise_name), '[^a-z0-9]+', '-', 'g')),
       e.exercise_name,
       e.exercise_name,
       e.muscle_group,
       coalesce(e.sets_default, 3),
       8,
       12,
       coalesce(e.rest_seconds, 90),
       coalesce(e.sort_order, 0)
from public.coaching_exercise_library e
join public.exercise_categories c on lower(c.name) = 'general'
where trim(both '-' from regexp_replace(lower(e.exercise_name), '[^a-z0-9]+', '-', 'g')) <> ''
on conflict (slug) do nothing;

update public.coaching_exercise_library legacy
set shared_exercise_id = shared.id
from public.shared_exercises shared
where legacy.shared_exercise_id is null
  and lower(legacy.exercise_name) = lower(shared.name_en);

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
on conflict (shared_exercise_id) where shared_exercise_id is not null do update set
  split_name = excluded.split_name,
  exercise_name = excluded.exercise_name,
  muscle_group = excluded.muscle_group,
  sets_default = excluded.sets_default,
  reps_default = excluded.reps_default,
  rest_seconds = excluded.rest_seconds,
  form_video_url = excluded.form_video_url,
  sort_order = excluded.sort_order;

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

drop trigger if exists shared_exercise_sync_coaching_library on public.shared_exercises;
create trigger shared_exercise_sync_coaching_library
after insert or update on public.shared_exercises
for each row execute function private.sync_shared_exercise_to_coaching_library();

drop trigger if exists shared_exercise_video_sync_coaching_library on public.shared_exercise_videos;
create trigger shared_exercise_video_sync_coaching_library
after insert or update on public.shared_exercise_videos
for each row execute function private.sync_shared_exercise_to_coaching_library();

create or replace function private.attach_shared_exercise_lineage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.shared_exercise_id is null then
    if tg_table_name = 'template_exercises' then
      select id into new.shared_exercise_id from public.shared_exercises where slug = new.slug;
    elsif new.source_template_exercise_id is not null then
      select shared_exercise_id into new.shared_exercise_id
      from public.template_exercises where id = new.source_template_exercise_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists template_exercises_shared_lineage on public.template_exercises;
create trigger template_exercises_shared_lineage before insert on public.template_exercises
for each row execute function private.attach_shared_exercise_lineage();
drop trigger if exists program_exercises_shared_lineage on public.program_exercises;
create trigger program_exercises_shared_lineage before insert on public.program_exercises
for each row execute function private.attach_shared_exercise_lineage();

-- Save a 48-session draft and materialize any newly selected common exercise
-- into that version. Existing customer programs remain immutable snapshots.
create or replace function public.save_template_program_structure(
  p_template_id uuid,
  p_version_id uuid,
  p_days jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested public.template_versions%rowtype;
  v_version_id uuid;
  v_day jsonb;
  v_item jsonb;
  v_day_id uuid;
  v_exercise_id uuid;
  v_shared public.shared_exercises%rowtype;
  v_item_position bigint;
  v_position smallint;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role authorization required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) <> 48 then
    raise exception 'Program structure must contain all 48 sessions';
  end if;
  if (
    select count(distinct (day_row.value ->> 'dayNumber')::integer)
    from jsonb_array_elements(p_days) as day_row(value)
    where (day_row.value ->> 'dayNumber')::integer between 1 and 48
  ) <> 48 then
    raise exception 'Session numbers must be unique and cover 1 through 48';
  end if;

  select * into v_requested from public.template_versions
  where id = p_version_id and template_id = p_template_id for update;
  if not found then raise exception 'Template version not found' using errcode = 'P0002'; end if;
  v_version_id := case when v_requested.status = 'draft'
    then v_requested.id else public.clone_template_version(v_requested.id) end;

  for v_day in select value from jsonb_array_elements(p_days) loop
    if (v_day ->> 'phase')::integer not in (1, 2) then raise exception 'Phase must be 1 or 2'; end if;
    if v_day ->> 'dayType' not in ('push', 'pull', 'challenge') then raise exception 'Invalid session type'; end if;
    if jsonb_array_length(coalesce(v_day -> 'items', '[]'::jsonb)) > 20 then raise exception 'A session cannot have more than 20 exercises'; end if;
    insert into public.template_days(template_version_id,day_number,day_type,phase,title_mm,title_en)
    values (v_version_id,(v_day->>'dayNumber')::integer,(v_day->>'dayType')::public.day_type,(v_day->>'phase')::integer,nullif(btrim(v_day->>'titleMm'),''),nullif(btrim(v_day->>'titleEn'),''))
    on conflict (template_version_id,day_number) do update set
      day_type=excluded.day_type,phase=excluded.phase,title_mm=excluded.title_mm,title_en=excluded.title_en,updated_at=now();
  end loop;

  delete from public.template_day_items item using public.template_days day
  where item.template_day_id=day.id and day.template_version_id=v_version_id;

  for v_day in select value from jsonb_array_elements(p_days) loop
    select id into v_day_id from public.template_days
    where template_version_id=v_version_id and day_number=(v_day->>'dayNumber')::integer;
    for v_item, v_item_position in
      select value, ordinality from jsonb_array_elements(coalesce(v_day->'items','[]'::jsonb)) with ordinality
    loop
      select id into v_exercise_id from public.template_exercises
      where template_version_id=v_version_id and slug=v_item->>'exerciseSlug';

      select * into v_shared from public.shared_exercises where slug=v_item->>'exerciseSlug';
      if not found then raise exception 'Exercise % is not in the common library', v_item->>'exerciseSlug'; end if;

      if v_exercise_id is null then
        select coalesce(max(position),0)+1 into v_position from public.template_exercises where template_version_id=v_version_id;
        insert into public.template_exercises(
          template_version_id,shared_exercise_id,slug,name_mm,name_en,cue_mm,cue_en,
          video_asset_id,equipment_mm,equipment_en,unilateral,body_part,is_assessment_only,position
        ) values (
          v_version_id,v_shared.id,v_shared.slug,v_shared.name_mm,v_shared.name_en,v_shared.cue_mm,v_shared.cue_en,
          (select asset_id from public.shared_exercise_videos where exercise_id=v_shared.id and role='primary'),
          v_shared.equipment_mm,v_shared.equipment_en,v_shared.unilateral,null,false,v_position
        ) returning id into v_exercise_id;
      else
        update public.template_exercises set
          shared_exercise_id=v_shared.id,name_mm=v_shared.name_mm,name_en=v_shared.name_en,
          cue_mm=v_shared.cue_mm,cue_en=v_shared.cue_en,equipment_mm=v_shared.equipment_mm,
          equipment_en=v_shared.equipment_en,unilateral=v_shared.unilateral,
          video_asset_id=(select asset_id from public.shared_exercise_videos where exercise_id=v_shared.id and role='primary'),
          updated_at=now()
        where id=v_exercise_id;
      end if;

      insert into public.template_exercise_videos(template_exercise_id,position,role,asset_id,title_mm,title_en,cue_mm,cue_en)
      select v_exercise_id,case video.role when 'primary' then 1 else 2 end,video.role,video.asset_id,
             case video.role when 'primary' then 'အဓိကနည်း' else 'အစားထိုးနည်း' end,
             case video.role when 'primary' then 'Main movement' else 'Alternative movement' end,
             v_shared.cue_mm,v_shared.cue_en
      from public.shared_exercise_videos video where video.exercise_id=v_shared.id
      on conflict (template_exercise_id,role) do update set
        asset_id=excluded.asset_id,title_mm=excluded.title_mm,title_en=excluded.title_en,
        cue_mm=excluded.cue_mm,cue_en=excluded.cue_en,updated_at=now();

      insert into public.template_day_items(template_day_id,template_exercise_id,position,sets,reps_min,reps_max,target_kg,rest_seconds,effort)
      values (v_day_id,v_exercise_id,v_item_position,(v_item->>'sets')::integer,(v_item->>'repsMin')::integer,(v_item->>'repsMax')::integer,(v_item->>'targetKg')::numeric,(v_item->>'restSeconds')::integer,null);
    end loop;
  end loop;

  update public.template_versions set updated_at=now() where id=v_version_id;
  update public.program_templates set updated_at=now() where id=p_template_id;
  return v_version_id;
end;
$$;

revoke all on function public.save_template_program_structure(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_template_program_structure(uuid,uuid,jsonb) to service_role;
