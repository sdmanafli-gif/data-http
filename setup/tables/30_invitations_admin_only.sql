-- ============================================================
-- Invitations: admin-only create / read / update
-- Signup still uses get_invitation_by_token (security definer).
-- ============================================================

drop policy if exists "Authenticated can read invitations" on public.invitations;
drop policy if exists "Authenticated can create invitations" on public.invitations;
drop policy if exists "Admins can read invitations" on public.invitations;
drop policy if exists "Admins can create invitations" on public.invitations;
drop policy if exists "Admins can update invitations" on public.invitations;

create policy "Admins can read invitations" on public.invitations
  for select to authenticated
  using (public.is_admin());

create policy "Admins can create invitations" on public.invitations
  for insert to authenticated
  with check (public.is_admin() and invited_by = auth.uid());

create policy "Admins can update invitations" on public.invitations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
