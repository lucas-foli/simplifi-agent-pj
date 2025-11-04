-- Add restrictive authentication policy to profiles table
-- This ensures that ALL access to profiles requires authentication
-- Even if other policies are permissive, this RESTRICTIVE policy must pass

CREATE POLICY "profiles_require_authentication" ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);
