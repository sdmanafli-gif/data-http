-- ============================================================
-- Admin delete user via RPC (no Edge Function required)
-- Uses private.app_secrets (same as admin MFA RPCs).
-- Frontend: supabase.rpc('admin_delete_user', { target_user_id })
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on table private.app_secrets from public, anon, authenticated;

create or replace function private.get_secret(p_key text)
returns text
language sql
stable
security definer
set search_path = private
as $$
  select value from private.app_secrets where key = p_key limit 1;
$$;

revoke all on function private.get_secret(text) from public, anon, authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  svc text;
  base_url text;
  res extensions.http_response;
begin
  if not public.is_admin() then
    raise exception 'Only admin can delete users';
  end if;

  if target_user_id is null then
    raise exception 'target_user_id required';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  svc := private.get_secret('service_role_key');
  base_url := rtrim(private.get_secret('supabase_url'), '/');
  if svc is null or base_url is null then
    raise exception 'Admin secrets not configured. Run scripts/setup-admin-delete-user-rpc.mjs';
  end if;

  -- Delete profile first so any open client session fails profile check immediately
  delete from public.profiles where id = target_user_id;

  -- Remove Auth user (invalidates refresh tokens / future getUser)
  select * into res from extensions.http((
    'DELETE',
    base_url || '/auth/v1/admin/users/' || target_user_id::text,
    array[
      extensions.http_header('Authorization', 'Bearer ' || svc),
      extensions.http_header('apikey', svc),
      extensions.http_header('Content-Type', 'application/json')
    ],
    null,
    null
  )::extensions.http_request);

  if res.status < 200 or res.status >= 300 then
    raise exception 'Delete user failed (%): %', res.status, coalesce(res.content, '');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

comment on function public.admin_delete_user(uuid) is
  'Admin-only: delete auth user via Auth Admin API (service role in private.app_secrets)';
