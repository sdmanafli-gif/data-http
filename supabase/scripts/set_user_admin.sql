-- Set one user as admin by email.
-- Run in Supabase Dashboard → SQL Editor.
-- Replace 'YOUR_EMAIL@example.com' with your actual login email.
--
-- We temporarily disable the "only admin can change role" trigger so this
-- update can run from the SQL Editor (where there is no logged-in user).

ALTER TABLE public.profiles DISABLE TRIGGER profiles_deny_role_change;

UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'ilkin.kazimov.global@gmail.com';

ALTER TABLE public.profiles ENABLE TRIGGER profiles_deny_role_change;
