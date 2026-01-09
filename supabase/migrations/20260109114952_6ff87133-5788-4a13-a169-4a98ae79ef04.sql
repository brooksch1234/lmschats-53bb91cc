-- Create friend_requests table
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

-- Create group_chats table
CREATE TABLE public.group_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice')),
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add message_type and media_url to existing messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice')),
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Enable RLS on all new tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Friend requests policies
CREATE POLICY "Users can view their own friend requests" 
ON public.friend_requests FOR SELECT 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create friend requests" 
ON public.friend_requests FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update requests sent to them" 
ON public.friend_requests FOR UPDATE 
USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete their own requests" 
ON public.friend_requests FOR DELETE 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Group chats policies
CREATE POLICY "Users can view groups they are members of" 
ON public.group_chats FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create groups" 
ON public.group_chats FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Group creators can update their groups" 
ON public.group_chats FOR UPDATE 
USING (auth.uid() = creator_id);

CREATE POLICY "Group creators can delete their groups" 
ON public.group_chats FOR DELETE 
USING (auth.uid() = creator_id);

-- Group members policies
CREATE POLICY "Users can view group members" 
ON public.group_members FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = group_id AND gm.user_id = auth.uid()
  )
);

CREATE POLICY "Group creators can add members" 
ON public.group_members FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_chats 
    WHERE id = group_id AND creator_id = auth.uid()
  ) OR auth.uid() = user_id
);

CREATE POLICY "Group creators can remove members" 
ON public.group_members FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.group_chats 
    WHERE id = group_id AND creator_id = auth.uid()
  ) OR auth.uid() = user_id
);

-- Group messages policies
CREATE POLICY "Group members can view messages" 
ON public.group_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send messages" 
ON public.group_messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  )
);

-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-media', 'chat-media', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat media
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Update triggers
CREATE TRIGGER update_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_chats_updated_at
BEFORE UPDATE ON public.group_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();