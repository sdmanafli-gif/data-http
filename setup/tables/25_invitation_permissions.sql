-- ============================================================
-- Invitation / profile permissions + copy on accept
-- Run after 02_auth_profiles_invitations.sql
-- ============================================================

alter table public.invitations
  add column if not exists permissions jsonb not null default '{}'::jsonb;

comment on column public.profiles.permissions is
  'UI access: tabs, columns, dataScope (sira_no). Empty {} = full access for managers.';
comment on column public.invitations.permissions is
  'Copied onto profiles.permissions when the invite is accepted.';

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
  inv_perms jsonb := '{}'::jsonb;
  email_l text := lower(trim(new.email));
begin
  if not exists (select 1 from public.profiles limit 1) then
    assign_role := 'admin';
  else
    select i.id, i.role, coalesce(i.permissions, '{}'::jsonb)
      into inv_id, inv_role, inv_perms
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

  insert into public.profiles (id, role, email, permissions)
  values (new.id, assign_role, new.email, coalesce(inv_perms, '{}'::jsonb))
  on conflict (id) do update
    set email = excluded.email,
        permissions = case
          when excluded.permissions is not null
               and excluded.permissions <> '{}'::jsonb
            then excluded.permissions
          else public.profiles.permissions
        end,
        updated_at = now();

  return new;
end;
$$;

-- Admins may update any profile including role + permissions (existing policies).
-- Ensure managers cannot escalate their own role (trigger already blocks non-admin role change).

create or replace function public.profiles_deny_permission_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Non-admins may not change their own permissions blob
  if old.permissions is distinct from new.permissions
     and not public.is_admin() then
    raise exception 'Only admin can change permissions';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_deny_permission_escalation on public.profiles;
create trigger profiles_deny_permission_escalation
  before update on public.profiles
  for each row execute function public.profiles_deny_permission_escalation();
