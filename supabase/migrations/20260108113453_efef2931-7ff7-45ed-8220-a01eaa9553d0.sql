-- Add RLS policy to allow looking up profiles by connection code (for connecting)
CREATE POLICY "Users can lookup profiles by connection code" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Drop the old restrictive policies that only allowed viewing own/connected profiles
DROP POLICY IF EXISTS "Users can view connected profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;