-- Add comments_device column to inventory for device-specific notes

alter table public.inventory
  add column if not exists comments_device text;

