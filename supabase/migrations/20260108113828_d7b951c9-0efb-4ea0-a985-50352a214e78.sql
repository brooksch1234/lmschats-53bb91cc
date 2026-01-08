-- Create table to track user network presence
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Users can view their own presence
CREATE POLICY "Users can view their own presence" 
ON public.user_presence 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own presence
CREATE POLICY "Users can insert their own presence" 
ON public.user_presence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own presence
CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for faster IP lookups
CREATE INDEX idx_user_presence_ip ON public.user_presence(ip_address);
CREATE INDEX idx_user_presence_last_seen ON public.user_presence(last_seen);