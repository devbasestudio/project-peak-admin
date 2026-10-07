alter table public.coaching_daily_trackers add column if not exists revision bigint not null default 0;
create or replace function public.bump_coaching_daily_revision()
returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then NEW.revision:=0; else NEW.revision:=OLD.revision+1; end if;
  return NEW;
end;
$$;
create trigger coaching_daily_revision before insert or update on public.coaching_daily_trackers
for each row execute function public.bump_coaching_daily_revision();

create table public.coaching_daily_write_receipts (
  user_id uuid not null references public.coaching_profiles(id) on delete cascade,
  request_id uuid not null, payload_hash text not null, revision bigint not null,
  created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table public.coaching_daily_write_receipts enable row level security;
revoke all on public.coaching_daily_write_receipts from public,anon,authenticated;
grant select,insert on public.coaching_daily_write_receipts to authenticated;
create policy own_daily_receipts_read on public.coaching_daily_write_receipts for select to authenticated using(user_id=auth.uid());
create policy own_daily_receipts_insert on public.coaching_daily_write_receipts for insert to authenticated with check(user_id=auth.uid());

create or replace function public.save_coaching_daily_versioned(p_date date,p_tracker jsonb,p_journal jsonb,p_expected_revision bigint,p_request_id uuid)
returns bigint language plpgsql security invoker set search_path='' as $$
declare
  uid uuid:=auth.uid(); current_revision bigint;
  fingerprint text:=md5(jsonb_build_array(p_date,p_tracker,p_journal,p_expected_revision)::text);
  receipt public.coaching_daily_write_receipts%rowtype;
begin
  if uid is null or p_date is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Invalid daily save' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_request_id::text,703));
  select * into receipt from public.coaching_daily_write_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'Retry payload changed' using errcode='22023'; end if;
    return receipt.revision;
  end if;
  insert into public.coaching_daily_trackers(user_id,date) values(uid,p_date) on conflict(user_id,date) do nothing;
  select revision into strict current_revision from public.coaching_daily_trackers where user_id=uid and date=p_date for update;
  if current_revision<>p_expected_revision then raise exception 'Daily log changed on another screen' using errcode='40001'; end if;
  perform public.save_coaching_daily_atomic(p_date,p_tracker,p_journal);
  select revision into strict current_revision from public.coaching_daily_trackers where user_id=uid and date=p_date;
  insert into public.coaching_daily_write_receipts(user_id,request_id,payload_hash,revision) values(uid,p_request_id,fingerprint,current_revision);
  return current_revision;
end;
$$;
revoke all on function public.save_coaching_daily_versioned(date,jsonb,jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_coaching_daily_versioned(date,jsonb,jsonb,bigint,uuid) to authenticated;
