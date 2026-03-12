-- 1) Create public.profiles and related objects if they don't exist (run this once)
-- 2) Create admin user said.manafli@gmail.com / xtramen221

-- ========== PART 1: Tables and RLS (skip if you already ran migration 00015) ==========
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
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

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

-- ========== PART 2: Create admin user ==========
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'said.manafli@gmail.com',
    crypt('xtramen221', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    uid,
    uid,
    jsonb_build_object('sub', uid::text, 'email', 'said.manafli@gmail.com'),
    'email',
    uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.profiles (id, role, email)
  VALUES (uid, 'admin', 'said.manafli@gmail.com')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = 'said.manafli@gmail.com', updated_at = NOW();

  RAISE NOTICE 'Admin user created: said.manafli@gmail.com';
END $$;
