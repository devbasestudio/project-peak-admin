-- Serialize every meal writer, including older deployed app versions.
create or replace function public.lock_coaching_meal_client()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(case when TG_OP='DELETE' then OLD.user_id else NEW.user_id end::text,'shared-meals'),702));
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end;
$$;
create trigger coaching_meal_write_lock before insert or update or delete on public.coaching_nutrition_items
for each row execute function public.lock_coaching_meal_client();

create or replace function public.admin_mutate_coaching_meals(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare
  request_id uuid := (p_input->>'requestId')::uuid;
  uid uuid := (p_input->>'userId')::uuid;
  operation text := p_input->>'operation';
  stored public.coaching_admin_mutations%rowtype;
  result jsonb;
  dates date[];
  source_date date := (p_input->>'sourceDate')::date;
  row_id bigint := (p_input->>'id')::bigint;
  affected integer;
begin
  if request_id is null or uid is null or operation not in ('save','copy','delete') then raise exception 'Invalid meal request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,700));
  select * into stored from public.coaching_admin_mutations where coaching_admin_mutations.request_id=request_id;
  if found then
    if stored.payload<>p_input then raise exception 'Retry payload changed'; end if;
    return stored.result;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,702));
  if not exists(select 1 from public.coaching_profiles where id=uid) then raise exception 'Client missing'; end if;
  if operation='copy' then
    select array_agg(distinct value::date order by value::date) into dates from jsonb_array_elements_text(p_input->'targetDates');
    if source_date is null or coalesce(cardinality(dates),0) not between 1 and 31 then raise exception 'Invalid dates'; end if;
    if exists(select 1 from public.coaching_nutrition_items where user_id=uid and program_type='personal_coaching' and plan_date=any(dates)) then
      raise exception 'Target already has meals' using errcode='23505';
    end if;
    -- Match client UI precedence independently for each meal slot: dated client,
    -- legacy client, then shared defaults. Never copy another client's meals.
    with source as (
      select n.*,dense_rank() over(partition by meal_type order by
        case when user_id=uid and plan_date=source_date then 1
             when user_id=uid and plan_date is null then 2 else 3 end) priority
      from public.coaching_nutrition_items n where program_type='personal_coaching'
        and (user_id=uid or user_id is null) and (plan_date=source_date or plan_date is null)
    )
    insert into public.coaching_nutrition_items(user_id,program_type,meal_type,plan_date,food_name,food_name_mm,portion,calories,protein_g,carbs_g,fat_g,benefits_text,sort_order)
    select uid,program_type,meal_type,d,food_name,food_name_mm,portion,calories,protein_g,carbs_g,fat_g,benefits_text,sort_order
    from source cross join unnest(dates) d where priority=1;
    get diagnostics affected = row_count;
    if affected=0 then raise exception 'Source has no meals'; end if;
    result:=jsonb_build_object('count',cardinality(dates),'itemCount',affected);
  elsif operation='delete' then
    -- Meal logs reference the item with ON DELETE CASCADE: retain logged items.
    perform 1 from public.coaching_nutrition_items where id=row_id and user_id=uid for update;
    if not found then raise exception 'Meal missing'; end if;
    if exists(select 1 from public.coaching_nutrition_logs where nutrition_item_id=row_id) then
      raise exception 'Meal has client logs' using errcode='55000';
    end if;
    delete from public.coaching_nutrition_items where id=row_id and user_id=uid;
    result:=jsonb_build_object('mealId',row_id);
  else
    if nullif(trim(p_input->>'foodName'),'') is null or (p_input->>'planDate')::date is null or
       p_input->>'mealType' not in ('breakfast','lunch','snack','dinner','evening') then raise exception 'Invalid meal'; end if;
    if row_id is null then
      insert into public.coaching_nutrition_items(user_id,program_type,meal_type,plan_date,food_name)
      values(uid,'personal_coaching',p_input->>'mealType',(p_input->>'planDate')::date,p_input->>'foodName') returning id into row_id;
    end if;
    update public.coaching_nutrition_items set meal_type=p_input->>'mealType',plan_date=(p_input->>'planDate')::date,
      food_name=p_input->>'foodName',food_name_mm=nullif(p_input->>'foodNameMm',''),portion=nullif(p_input->>'portion',''),
      calories=(p_input->>'calories')::int,protein_g=(p_input->>'protein')::numeric,carbs_g=(p_input->>'carbs')::numeric,
      fat_g=(p_input->>'fat')::numeric,benefits_text=nullif(p_input->>'benefits',''),sort_order=(p_input->>'sortOrder')::int
    where id=row_id and user_id=uid;
    if not found then raise exception 'Meal belongs to another client'; end if;
    result:=jsonb_build_object('mealId',row_id);
  end if;
  insert into public.coaching_admin_mutations values(request_id,p_input,result,now());
  return result;
end;
$$;
revoke all on function public.admin_mutate_coaching_meals(jsonb) from public,anon,authenticated;
grant execute on function public.admin_mutate_coaching_meals(jsonb) to service_role;

create or replace function public.admin_save_coaching_template_atomic(p_user_id uuid,p_name text,p_sections jsonb,p_mark_ready boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.coaching_registrations%rowtype;
begin
  if p_mark_ready then
    select * into strict r from public.coaching_registrations where user_id=p_user_id for update;
    if r.payment_status not in ('approved','ready') then raise exception 'Approve payment first' using errcode='55000'; end if;
  end if;
  insert into public.coaching_custom_tracker_templates(user_id,name,sections,active,updated_at)
  values(p_user_id,p_name,p_sections,true,now()) on conflict(user_id)
  do update set name=excluded.name,sections=excluded.sections,active=true,updated_at=now();
  if p_mark_ready then
    update public.coaching_profiles set onboarding_complete=true,updated_at=now() where id=p_user_id;
    if not found then raise exception 'Client profile missing'; end if;
    update public.coaching_registrations set payment_status='ready',status='ready',ready_at=coalesce(ready_at,now()),updated_at=now() where id=r.id;
  end if;
end;
$$;
revoke all on function public.admin_save_coaching_template_atomic(uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_save_coaching_template_atomic(uuid,text,jsonb,boolean) to service_role;

create or replace function public.admin_coaching_client_summary(p_user_ids uuid[])
returns table(user_id uuid,log_count bigint,checkin_count bigint,latest_date date,latest_weight numeric)
language sql stable security invoker set search_path='' as $$
  select u, (select count(*) from public.coaching_daily_trackers t where t.user_id=u),
    (select count(*) from public.coaching_weekly_checkins c where c.user_id=u), l.date,l.body_weight
  from unnest(p_user_ids) u left join lateral (
    select date,body_weight from public.coaching_daily_trackers where user_id=u order by date desc,id desc limit 1
  ) l on true;
$$;
revoke all on function public.admin_coaching_client_summary(uuid[]) from public,anon,authenticated;
grant execute on function public.admin_coaching_client_summary(uuid[]) to service_role;
