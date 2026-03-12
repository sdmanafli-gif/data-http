-- Run this once in Supabase Dashboard → SQL Editor
-- 1) Creates profiles table and RLS
-- 2) Backfills a profile for every existing auth user (fixes "Database error querying schema")
--
-- LOGIN FIX: Supabase does not let you create users by inserting into auth.users.
-- Create your user in Dashboard: Authentication → Users → Add user → set email and password (e.g. xtramen221).
-- Then run this script. Then run the line below (with your email) to make that user admin:
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';

-- ========== 1. Tables and policies ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'store_manager' CHECK (role IN ('admin', 'store_manager')),
  email text,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_manager_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- First user (when no profiles exist) gets admin; all later sign-ups get store_manager
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assign_role text;
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN 'store_manager' ELSE 'admin' END INTO assign_role;
  INSERT INTO public.profiles (id, role, email)
  VALUES (new.id, assign_role, new.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_manager_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Users can read own config" ON public.store_manager_config;
CREATE POLICY "Users can read own config" ON public.store_manager_config FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can read all config" ON public.store_manager_config;
CREATE POLICY "Admins can read all config" ON public.store_manager_config FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can insert config" ON public.store_manager_config;
CREATE POLICY "Admins can insert config" ON public.store_manager_config FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update config" ON public.store_manager_config;
CREATE POLICY "Admins can update config" ON public.store_manager_config FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete config" ON public.store_manager_config;
CREATE POLICY "Admins can delete config" ON public.store_manager_config FOR DELETE USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.profiles_deny_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can change role';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_deny_role_change ON public.profiles;
CREATE TRIGGER profiles_deny_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_deny_role_change();

-- ========== 2. Backfill: create profile for every existing auth user ==========
INSERT INTO public.profiles (id, role, email)
SELECT id, 'store_manager', email FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

-- ========== 3. Set one user as admin (change the email to yours) ==========
-- Uncomment and set your email, then run this file again or run just this line:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
