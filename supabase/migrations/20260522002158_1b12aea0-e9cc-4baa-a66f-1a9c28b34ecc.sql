-- 1. Profiles: require auth to view
DROP POLICY IF EXISTS "Users can lookup profiles by connection code" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. user_roles: block direct UPDATEs entirely
DROP POLICY IF EXISTS "No one can update user_roles" ON public.user_roles;
CREATE POLICY "No one can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 3. group_messages: restrict UPDATEs to is_pinned only via trigger
CREATE OR REPLACE FUNCTION public.group_messages_restrict_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.media_url IS DISTINCT FROM OLD.media_url
     OR NEW.message_type IS DISTINCT FROM OLD.message_type
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only is_pinned may be updated on group_messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_messages_restrict_update_trg ON public.group_messages;
CREATE TRIGGER group_messages_restrict_update_trg
BEFORE UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.group_messages_restrict_update();

-- 4. message_reactions INSERT: require access to the target message
DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.connections c ON c.id = m.connection_id
      WHERE m.id = message_reactions.message_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_messages gm
      JOIN public.group_members mem ON mem.group_id = gm.group_id
      WHERE gm.id = message_reactions.message_id
        AND mem.user_id = auth.uid()
    )
  )
);

-- 5. poll_votes INSERT: require group membership
DROP POLICY IF EXISTS "Users can vote on polls" ON public.poll_votes;
CREATE POLICY "Users can vote on polls"
ON public.poll_votes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.polls p
    JOIN public.group_members gm ON gm.group_id = p.group_id
    WHERE p.id = poll_votes.poll_id
      AND gm.user_id = auth.uid()
  )
);

-- 6. Chat-media storage: prevent anonymous listing (public URLs still work)
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Authenticated users can list chat media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');

-- 7. Revoke direct execute on security-definer helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_user_banned(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;