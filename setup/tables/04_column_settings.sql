-- ============================================================
-- Customizable columns for Müştəri Bazası
-- ============================================================

alter table public.musteri_bazasi
  add column if not exists extra jsonb not null default '{}'::jsonb;

create table if not exists public.ui_column_settings (
  id uuid primary key default gen_random_uuid(),
  table_key text not null unique,
  columns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.ui_column_settings enable row level security;

drop policy if exists "Anyone can read column settings" on public.ui_column_settings;
drop policy if exists "Authenticated can upsert column settings" on public.ui_column_settings;

create policy "Anyone can read column settings"
  on public.ui_column_settings for select
  using (true);

create policy "Authenticated can upsert column settings"
  on public.ui_column_settings for all to authenticated
  using (true) with check (true);
