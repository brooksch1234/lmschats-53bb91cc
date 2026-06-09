
CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.call_sessions TO authenticated;
GRANT ALL ON public.call_sessions TO service_role;

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their calls"
  ON public.call_sessions FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Caller can create calls"
  ON public.call_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update calls"
  ON public.call_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX idx_call_sessions_pair_recent ON public.call_sessions (connection_id, ended_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
