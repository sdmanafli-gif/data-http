-- ============================================================
-- Auth: profiles (admin | manager) + invitations
-- ============================================================
-- First sign-up → admin
-- Later sign-ups need a pending invitation → manager
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'manager'
    check (role in ('admin', 'manager')),
  email text,
  display_name text,
  -- Admin can later store per-manager UI limits (columns, filters, scope)
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'manager'
    check (role in ('admin', 'manager')),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_invitations_email on public.invitations (lower(email));
create index if not exists idx_invitations_token on public.invitations (token);
create index if not exists idx_invitations_status on public.invitations (status);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assign_role text;
  inv_id uuid;
  inv_role text;
  email_l text := lower(trim(new.email));
begin
  if not exists (select 1 from public.profiles limit 1) then
    assign_role := 'admin';
  else
    select i.id, i.role
      into inv_id, inv_role
      from public.invitations i
     where i.status = 'pending'
       and lower(trim(i.email)) = email_l
       and (i.expires_at is null or i.expires_at > now())
       and (
         nullif(trim(coalesce(new.raw_user_meta_data->>'invite_token', '')), '') is null
         or i.token = trim(new.raw_user_meta_data->>'invite_token')
       )
     order by i.created_at desc
     limit 1;

    if inv_id is null then
      raise exception 'Qeydiyyat yalnız dəvət ilə mümkündür';
    end if;

    assign_role := coalesce(inv_role, 'manager');
    update public.invitations
       set status = 'accepted',
           accepted_at = now()
     where id = inv_id;
  end if;

  insert into public.profiles (id, role, email)
  values (new.id, assign_role, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.profiles_deny_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Only admin can change role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_deny_role_change on public.profiles;
create trigger profiles_deny_role_change
  before update on public.profiles
  for each row execute function public.profiles_deny_role_change();

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Users can read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Admins can read all profiles" on public.profiles
  for select using (public.is_admin());
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can update any profile" on public.profiles
  for update using (public.is_admin());

-- Invitations: logged-in users can create & read; anyone can read own pending by token (for signup check)
drop policy if exists "Authenticated can read invitations" on public.invitations;
drop policy if exists "Authenticated can create invitations" on public.invitations;
drop policy if exists "Admins can update invitations" on public.invitations;
drop policy if exists "Public can read pending invite by token" on public.invitations;

create policy "Authenticated can read invitations" on public.invitations
  for select to authenticated using (true);

create policy "Authenticated can create invitations" on public.invitations
  for insert to authenticated
  with check (invited_by = auth.uid());

create policy "Admins can update invitations" on public.invitations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Validate invite token during sign-up (does not expose all pending emails)
create or replace function public.get_invitation_by_token(invite_token text)
returns table (email text, role text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.role, i.expires_at
    from public.invitations i
   where i.token = invite_token
     and i.status = 'pending'
     and (i.expires_at is null or i.expires_at > now())
   limit 1;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;
