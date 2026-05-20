
-- Add privacy setting for username search
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_username_search BOOLEAN NOT NULL DEFAULT true;

-- Allow admins to grant admin role to other users
CREATE POLICY "Admins can grant roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to revoke roles (but not their own admin)
CREATE POLICY "Admins can revoke roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND NOT (user_id = auth.uid() AND role = 'admin')
  );

-- Allow users to delete their own DM messages
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Allow users to delete their own group messages
CREATE POLICY "Users can delete their own group messages"
  ON public.group_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
