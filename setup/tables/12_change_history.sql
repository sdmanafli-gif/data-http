-- ============================================================
-- Change history (Tarixçə) — audit log for Depo / Müştəri / Nağd
-- ============================================================
-- Records insert / update / delete with field-level diffs.
-- Actor = auth.uid() when signed in (joined to profiles for label).
-- ============================================================

create table if not exists public.change_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  item_label text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,
  changes jsonb not null default '{}'::jsonb,
  snapshot jsonb
);

create index if not exists idx_change_history_table_created
  on public.change_history (table_name, created_at desc);
create index if not exists idx_change_history_record
  on public.change_history (table_name, record_id, created_at desc);

alter table public.change_history enable row level security;
drop policy if exists "Allow all for anon" on public.change_history;
create policy "Allow all for anon" on public.change_history
  for all using (true) with check (true);

-- Columns we never treat as user-facing "changes"
create or replace function public.change_history_skip_key(k text)
returns boolean
language sql
immutable
as $$
  select k in (
    'id',
    'created_at',
    'updated_at',
    'gozlenilen_gelir',
    'faktiki_gelir',
    'qalan_borc',
    'xeyir',
    'xeyir_faizle'
  );
$$;

create or replace function public.change_history_actor_label()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lbl text;
begin
  if uid is null then
    return null;
  end if;
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), uid::text)
    into lbl
    from public.profiles p
   where p.id = uid;
  return lbl;
end;
$$;

create or replace function public.change_history_item_label(tbl text, row_data jsonb)
returns text
language plpgsql
immutable
as $$
declare
  parts text[] := array[]::text[];
  sira text;
  model text;
  imei text;
  name text;
  kime text;
begin
  sira := nullif(trim(coalesce(row_data->>'sira_no', '')), '');
  model := nullif(trim(coalesce(row_data->>'model', '')), '');
  imei := nullif(trim(coalesce(row_data->>'imei_1', '')), '');
  name := nullif(trim(coalesce(row_data->>'ad_soyad', '')), '');
  kime := nullif(trim(coalesce(row_data->>'kime', '')), '');

  if sira is not null then
    parts := array_append(parts, '#' || sira);
  end if;

  if tbl = 'musteri_bazasi' then
    if name is not null then parts := array_append(parts, name); end if;
    if model is not null then parts := array_append(parts, model); end if;
  elsif tbl = 'nagd_satish' then
    if kime is not null then parts := array_append(parts, kime); end if;
    if model is not null then parts := array_append(parts, model); end if;
    if imei is not null then parts := array_append(parts, imei); end if;
  else
    -- depo (and fallback)
    if model is not null then parts := array_append(parts, model); end if;
    if imei is not null then parts := array_append(parts, imei); end if;
  end if;

  if array_length(parts, 1) is null then
    return coalesce(row_data->>'id', 'qeyd');
  end if;
  return array_to_string(parts, ' · ');
end;
$$;

create or replace function public.change_history_diff(old_row jsonb, new_row jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := '{}'::jsonb;
  k text;
  old_v jsonb;
  new_v jsonb;
  ek text;
  old_extra jsonb;
  new_extra jsonb;
  old_ev jsonb;
  new_ev jsonb;
begin
  -- Scalar / non-jsonb columns present on either side
  for k in
    select distinct key
      from (
        select jsonb_object_keys(coalesce(old_row, '{}'::jsonb)) as key
        union
        select jsonb_object_keys(coalesce(new_row, '{}'::jsonb)) as key
      ) keys
  loop
    if public.change_history_skip_key(k) then
      continue;
    end if;
    if k = 'extra' then
      continue;
    end if;

    old_v := case when old_row is null then null else old_row -> k end;
    new_v := case when new_row is null then null else new_row -> k end;

    if old_v is distinct from new_v then
      result := result || jsonb_build_object(
        k,
        jsonb_build_object(
          'old', case when old_row is null then null else old_row ->> k end,
          'new', case when new_row is null then null else new_row ->> k end
        )
      );
    end if;
  end loop;

  -- Flatten extra jsonb key-by-key
  old_extra := coalesce(old_row -> 'extra', '{}'::jsonb);
  new_extra := coalesce(new_row -> 'extra', '{}'::jsonb);
  if jsonb_typeof(old_extra) <> 'object' then old_extra := '{}'::jsonb; end if;
  if jsonb_typeof(new_extra) <> 'object' then new_extra := '{}'::jsonb; end if;

  for ek in
    select distinct key
      from (
        select jsonb_object_keys(old_extra) as key
        union
        select jsonb_object_keys(new_extra) as key
      ) ekeys
  loop
    old_ev := old_extra -> ek;
    new_ev := new_extra -> ek;
    if old_ev is distinct from new_ev then
      result := result || jsonb_build_object(
        'extra.' || ek,
        jsonb_build_object(
          'old', old_extra ->> ek,
          'new', new_extra ->> ek
        )
      );
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.change_history_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text := tg_table_name;
  rid uuid;
  act text;
  lbl text;
  diffs jsonb;
  snap jsonb;
  actor uuid := auth.uid();
  actor_lbl text := public.change_history_actor_label();
begin
  if tg_op = 'INSERT' then
    act := 'insert';
    rid := new.id;
    snap := to_jsonb(new);
    -- Create events: label + snapshot only (no noisy full-row "diff")
    diffs := '{}'::jsonb;
    lbl := public.change_history_item_label(tbl, snap);
  elsif tg_op = 'UPDATE' then
    act := 'update';
    rid := new.id;
    snap := to_jsonb(new);
    diffs := public.change_history_diff(to_jsonb(old), snap);
    if diffs = '{}'::jsonb then
      return new;
    end if;
    lbl := public.change_history_item_label(tbl, snap);
  elsif tg_op = 'DELETE' then
    act := 'delete';
    rid := old.id;
    snap := to_jsonb(old);
    diffs := public.change_history_diff(snap, null);
    lbl := public.change_history_item_label(tbl, snap);
  else
    return null;
  end if;

  insert into public.change_history (
    table_name, record_id, action, item_label, actor_id, actor_label, changes, snapshot
  ) values (
    tbl, rid, act, lbl, actor, actor_lbl, coalesce(diffs, '{}'::jsonb), snap
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_change_history_depo on public.depo;
create trigger trg_change_history_depo
  after insert or update or delete on public.depo
  for each row execute function public.change_history_log();

drop trigger if exists trg_change_history_musteri_bazasi on public.musteri_bazasi;
create trigger trg_change_history_musteri_bazasi
  after insert or update or delete on public.musteri_bazasi
  for each row execute function public.change_history_log();

drop trigger if exists trg_change_history_nagd_satish on public.nagd_satish;
create trigger trg_change_history_nagd_satish
  after insert or update or delete on public.nagd_satish
  for each row execute function public.change_history_log();
