-- Table to track last read timestamps per connection/group
CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, connection_id),
  UNIQUE(user_id, group_id),
  CHECK (
    (connection_id IS NOT NULL AND group_id IS NULL) OR 
    (connection_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view their own read status"
ON public.message_reads
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own read status
CREATE POLICY "Users can insert their own read status"
ON public.message_reads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own read status
CREATE POLICY "Users can update their own read status"
ON public.message_reads
FOR UPDATE
USING (auth.uid() = user_id);