-- Add display_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Create table for online tic-tac-toe game sessions
CREATE TABLE public.tictactoe_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_x_id uuid NOT NULL,
  player_o_id uuid,
  board jsonb NOT NULL DEFAULT '["","","","","","","","",""]'::jsonb,
  current_turn text NOT NULL DEFAULT 'X',
  winner text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tictactoe_games ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view games they are part of"
ON public.tictactoe_games
FOR SELECT
USING (auth.uid() = player_x_id OR auth.uid() = player_o_id OR status = 'waiting');

CREATE POLICY "Users can create games"
ON public.tictactoe_games
FOR INSERT
WITH CHECK (auth.uid() = player_x_id);

CREATE POLICY "Players can update their games"
ON public.tictactoe_games
FOR UPDATE
USING (auth.uid() = player_x_id OR auth.uid() = player_o_id);

CREATE POLICY "Creators can delete waiting games"
ON public.tictactoe_games
FOR DELETE
USING (auth.uid() = player_x_id AND status = 'waiting');

-- Enable realtime for tic-tac-toe
ALTER PUBLICATION supabase_realtime ADD TABLE public.tictactoe_games;