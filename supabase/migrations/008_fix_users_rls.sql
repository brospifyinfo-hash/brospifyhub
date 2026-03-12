-- =============================================
-- Fix RLS for Users table - Allow service role full access
-- =============================================

-- The service_role key should bypass RLS by default in Supabase
-- But we need to ensure policies allow INSERT for new users

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Service role can update users" ON public.users;

-- Allow INSERT for new users (needed for upsert operations)
CREATE POLICY "Service role can insert users" 
  ON public.users 
  FOR INSERT 
  WITH CHECK (true);

-- Allow UPDATE for service role operations  
CREATE POLICY "Service role can update users" 
  ON public.users 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

-- Ensure the trigger function handles the user creation properly with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, credits)
  VALUES (NEW.id, 'user', 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();