-- User status/mood system
CREATE TABLE public.user_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online',
  mood TEXT,
  custom_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user status"
  ON public.user_status FOR SELECT USING (true);

CREATE POLICY "Users can update their own status"
  ON public.user_status FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own status"
  ON public.user_status FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Polls system for group chats
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  ends_at TIMESTAMP WITH TIME ZONE,
  anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view polls"
  ON public.polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = polls.group_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_id = polls.group_id AND user_id = auth.uid()
    )
  );

-- Poll votes
CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes on polls they can see"
  ON public.poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.group_members gm ON p.group_id = gm.group_id
      WHERE p.id = poll_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can vote on polls"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their vote"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Mini games scores/leaderboard
CREATE TABLE public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  game_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game scores"
  ON public.game_scores FOR SELECT USING (true);

CREATE POLICY "Users can submit their own scores"
  ON public.game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- Indexes
CREATE INDEX idx_polls_group_id ON public.polls(group_id);
CREATE INDEX idx_game_scores_game_type ON public.game_scores(game_type, score DESC);
CREATE INDEX idx_game_scores_user ON public.game_scores(user_id);