-- Create security definer function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.group_chats;
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;

-- Create corrected policies using the security definer function
CREATE POLICY "Users can view groups they are members of" 
ON public.group_chats 
FOR SELECT 
USING (
  auth.uid() = creator_id OR 
  public.is_group_member(auth.uid(), id)
);

CREATE POLICY "Users can view group members" 
ON public.group_members 
FOR SELECT 
USING (
  public.is_group_member(auth.uid(), group_id)
);