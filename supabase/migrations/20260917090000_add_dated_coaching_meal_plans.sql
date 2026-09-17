alter table public.coaching_nutrition_items
  add column if not exists plan_date date;

create index if not exists idx_coaching_nutrition_items_user_date_meal_sort
  on public.coaching_nutrition_items (user_id, plan_date, meal_type, sort_order, id);

comment on column public.coaching_nutrition_items.plan_date is
  'Optional date for a client-specific meal plan. NULL rows remain reusable legacy defaults.';
