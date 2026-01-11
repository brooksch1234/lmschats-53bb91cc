-- Add pinned column to group_messages
ALTER TABLE public.group_messages ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient pinned message queries
CREATE INDEX idx_group_messages_pinned ON public.group_messages (group_id, is_pinned) WHERE is_pinned = true;

-- Create policy to allow group members to pin messages
CREATE POLICY "Group members can update message pin status"
ON public.group_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
  )
);

-- Create policy to allow group creators to update group name
CREATE POLICY "Group creators can update group"
ON public.group_chats
FOR UPDATE
USING (creator_id = auth.uid())
WITH CHECK (creator_id = auth.uid());