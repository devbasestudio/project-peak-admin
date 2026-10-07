create table if not exists public.coaching_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Client', email text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  telegram_id text unique, onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coaching_registrations (
  id bigint generated always as identity primary key,
  user_id uuid references public.coaching_profiles(id) on delete set null,
  name text, username text, age integer, height text, weight numeric, email text, phone text,
  telegram_id text, workout_split text, program_key text, program_name text,
  duration_months integer not null default 3, program_price integer not null default 550000,
  payment_method text default 'KBZPay', status text not null default 'pending',
  payment_status text not null default 'pending', notes text,
  photo_front text, photo_back text, photo_side text, payment_screenshot text,
  intake_answers jsonb not null default '{}', approved_at timestamptz, ready_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coaching_programs (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references public.coaching_profiles(id) on delete cascade,
  duration_weeks integer not null default 12, target_calories integer, macros_p integer,
  macros_c integer, macros_f integer, program_type text not null default 'personal_coaching',
  start_date date not null default current_date, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coaching_workouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.coaching_profiles(id) on delete cascade,
  date date not null, split_name text not null, completed boolean not null default false,
  user_notes text, user_feelings text, created_at timestamptz not null default now()
);

create table if not exists public.coaching_workout_exercises (
  id bigint generated always as identity primary key,
  workout_id bigint not null references public.coaching_workouts(id) on delete cascade,
  exercise_name text not null, target_sets integer, target_reps text,
  actual_weight text, actual_reps text
);

create table if not exists public.coaching_daily_trackers (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.coaching_profiles(id) on delete cascade, date date not null,
  body_weight numeric(6,2), steps integer, sleep_score integer,
  water_3l boolean not null default false, omega_3 boolean not null default false,
  bed_phone_filter boolean not null default false, meal_plan_adhered boolean not null default false,
  toilet boolean not null default false, phone_off_time text, water_liters numeric(4,1),
  one_win text, one_struggle text, tracker_values jsonb not null default '{}',
  created_at timestamptz not null default now(), unique(user_id,date)
);

create table if not exists public.coaching_journaling (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.coaching_profiles(id) on delete cascade, date date not null,
  diet_status text, satisfied_with text, difficult_with text,
  created_at timestamptz not null default now(), unique(user_id,date)
);
