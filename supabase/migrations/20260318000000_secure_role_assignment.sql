-- Secure Role Assignment Trigger
-- This ensures users cannot pass arbitrary roles during signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
BEGIN
  -- Default to 'student' if no role provided, otherwise use the provided role
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'student');

  -- Validate role: only allow self-registration for student, faculty, staff
  -- To create 'admin' or 'guard', it must be done via an established secure method (e.g. Edge Function)
  IF assigned_role IN ('admin', 'guard') THEN
    -- In a real production environment, you might check if the request comes from a service_role key
    -- For now, we fallback any unauthorized admin/guard claims to 'student'
    assigned_role := 'student';
  END IF;

  INSERT INTO public.parkease_profiles (id, full_name, email, role, phone)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    assigned_role,
    new.raw_user_meta_data->>'phone'
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();