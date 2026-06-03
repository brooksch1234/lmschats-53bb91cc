CREATE TABLE public.chat_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  game_type text NOT NULL,
  player1_id uuid NOT NULL,
  player2_id uuid NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_turn uuid,
  status text NOT NULL DEFAULT 'pending',
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_games TO authenticated;
GRANT ALL ON public.chat_games TO service_role;

ALTER TABLE public.chat_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their games"
ON public.chat_games FOR SELECT TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Users can create games in their connections"
ON public.chat_games FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = player1_id
  AND EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.id = chat_games.connection_id
      AND ((c.user1_id = player1_id AND c.user2_id = player2_id)
           OR (c.user2_id = player1_id AND c.user1_id = player2_id))
  )
);

CREATE POLICY "Players can update their games"
ON public.chat_games FOR UPDATE TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id)
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can delete their games"
ON public.chat_games FOR DELETE TO authenticated
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE TRIGGER update_chat_games_updated_at
BEFORE UPDATE ON public.chat_games
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chat_games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_games;