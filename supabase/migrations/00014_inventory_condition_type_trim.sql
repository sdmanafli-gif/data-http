-- Allow condition_type with leading/trailing spaces (trimmed for check)
-- Fixes import when CSV has "teze " or "kohne " instead of "teze"/"kohne"

alter table public.inventory
  drop constraint if exists inventory_condition_type_check;

alter table public.inventory
  add constraint inventory_condition_type_check
  check (condition_type is null or trim(condition_type) in ('teze', 'kohne'));
