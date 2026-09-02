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
  v_item_position bigint;
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

  select * into v_requested
  from public.template_versions
  where id = p_version_id and template_id = p_template_id
  for update;
  if not found then
    raise exception 'Template version not found' using errcode = 'P0002';
  end if;

  if v_requested.status = 'draft' then
    v_version_id := v_requested.id;
  else
    v_version_id := public.clone_template_version(v_requested.id);
  end if;

  for v_day in select value from jsonb_array_elements(p_days)
  loop
    if (v_day ->> 'phase')::integer not in (1, 2) then
      raise exception 'Phase must be 1 or 2';
    end if;
    if v_day ->> 'dayType' not in ('push', 'pull', 'challenge') then
      raise exception 'Invalid session type';
    end if;
    if jsonb_array_length(coalesce(v_day -> 'items', '[]'::jsonb)) > 20 then
      raise exception 'A session cannot have more than 20 exercises';
    end if;

    insert into public.template_days (
      template_version_id,
      day_number,
      day_type,
      phase,
      title_mm,
      title_en
    ) values (
      v_version_id,
      (v_day ->> 'dayNumber')::integer,
      (v_day ->> 'dayType')::public.day_type,
      (v_day ->> 'phase')::integer,
      nullif(btrim(v_day ->> 'titleMm'), ''),
      nullif(btrim(v_day ->> 'titleEn'), '')
    )
    on conflict (template_version_id, day_number) do update
    set day_type = excluded.day_type,
        phase = excluded.phase,
        title_mm = excluded.title_mm,
        title_en = excluded.title_en,
        updated_at = now();
  end loop;

  delete from public.template_day_items item
  using public.template_days day
  where item.template_day_id = day.id
    and day.template_version_id = v_version_id;

  for v_day in select value from jsonb_array_elements(p_days)
  loop
    select id into v_day_id
    from public.template_days
    where template_version_id = v_version_id
      and day_number = (v_day ->> 'dayNumber')::integer;

    for v_item, v_item_position in
      select value, ordinality
      from jsonb_array_elements(coalesce(v_day -> 'items', '[]'::jsonb)) with ordinality
    loop
      select id into v_exercise_id
      from public.template_exercises
      where template_version_id = v_version_id
        and slug = v_item ->> 'exerciseSlug';
      if not found then
        raise exception 'Exercise % is not part of this template version', v_item ->> 'exerciseSlug';
      end if;

      insert into public.template_day_items (
        template_day_id,
        template_exercise_id,
        position,
        sets,
        reps_min,
        reps_max,
        target_kg,
        rest_seconds,
        effort
      ) values (
        v_day_id,
        v_exercise_id,
        v_item_position,
        (v_item ->> 'sets')::integer,
        (v_item ->> 'repsMin')::integer,
        (v_item ->> 'repsMax')::integer,
        (v_item ->> 'targetKg')::numeric,
        (v_item ->> 'restSeconds')::integer,
        nullif(btrim(v_item ->> 'effort'), '')
      );
    end loop;
  end loop;

  update public.template_versions
  set updated_at = now()
  where id = v_version_id;

  update public.program_templates
  set updated_at = now()
  where id = p_template_id;

  return v_version_id;
end;
$$;

revoke all on function public.save_template_program_structure(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_template_program_structure(uuid, uuid, jsonb) to service_role;
