-- ============================================================
-- Admin MFA management via RPC (no Edge Function required)
-- Stores service role in private schema; only security definer RPCs read it.
-- Frontend: supabase.rpc('admin_mfa_list' | 'admin_mfa_unenroll' | 'admin_mfa_unenroll_all')
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

create or replace function public.admin_mfa_list(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  svc text;
  base_url text;
  res extensions.http_response;
  payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admin can manage MFA';
  end if;

  svc := private.get_secret('service_role_key');
  base_url := rtrim(private.get_secret('supabase_url'), '/');
  if svc is null or base_url is null then
    raise exception 'Admin MFA secrets not configured. Run scripts/setup-admin-mfa-rpc.mjs';
  end if;

  select * into res from extensions.http((
    'GET',
    base_url || '/auth/v1/admin/users/' || target_user_id::text || '/factors',
    array[
      extensions.http_header('Authorization', 'Bearer ' || svc),
      extensions.http_header('apikey', svc),
      extensions.http_header('Content-Type', 'application/json')
    ],
    null,
    null
  )::extensions.http_request);

  if res.status < 200 or res.status >= 300 then
    raise exception 'MFA list failed (%): %', res.status, coalesce(res.content, '');
  end if;

  payload := coalesce(res.content::jsonb, '[]'::jsonb);
  if jsonb_typeof(payload) = 'object' and payload ? 'factors' then
    return jsonb_build_object('factors', payload->'factors');
  end if;
  if jsonb_typeof(payload) = 'array' then
    return jsonb_build_object('factors', payload);
  end if;
  return jsonb_build_object('factors', '[]'::jsonb);
end;
$$;

create or replace function public.admin_mfa_unenroll(target_user_id uuid, factor_id text)
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
    raise exception 'Only admin can manage MFA';
  end if;
  if factor_id is null or length(trim(factor_id)) = 0 then
    raise exception 'factor_id required';
  end if;

  svc := private.get_secret('service_role_key');
  base_url := rtrim(private.get_secret('supabase_url'), '/');
  if svc is null or base_url is null then
    raise exception 'Admin MFA secrets not configured. Run scripts/setup-admin-mfa-rpc.mjs';
  end if;

  select * into res from extensions.http((
    'DELETE',
    base_url || '/auth/v1/admin/users/' || target_user_id::text || '/factors/' || trim(factor_id),
    array[
      extensions.http_header('Authorization', 'Bearer ' || svc),
      extensions.http_header('apikey', svc)
    ],
    null,
    null
  )::extensions.http_request);

  if res.status < 200 or res.status >= 300 then
    raise exception 'MFA unenroll failed (%): %', res.status, coalesce(res.content, '');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_mfa_unenroll_all(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  listed jsonb;
  factors jsonb;
  elem jsonb;
  fid text;
  removed int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admin can manage MFA';
  end if;

  listed := public.admin_mfa_list(target_user_id);
  factors := coalesce(listed->'factors', '[]'::jsonb);

  for elem in select * from jsonb_array_elements(factors)
  loop
    fid := elem->>'id';
    if fid is not null and length(fid) > 0 then
      perform public.admin_mfa_unenroll(target_user_id, fid);
      removed := removed + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'removed', removed);
end;
$$;

revoke all on function public.admin_mfa_list(uuid) from public;
revoke all on function public.admin_mfa_unenroll(uuid, text) from public;
revoke all on function public.admin_mfa_unenroll_all(uuid) from public;

grant execute on function public.admin_mfa_list(uuid) to authenticated;
grant execute on function public.admin_mfa_unenroll(uuid, text) to authenticated;
grant execute on function public.admin_mfa_unenroll_all(uuid) to authenticated;
