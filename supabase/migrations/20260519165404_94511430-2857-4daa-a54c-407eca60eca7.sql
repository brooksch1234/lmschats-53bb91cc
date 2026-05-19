
-- Reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);

-- User bans table
CREATE TABLE public.user_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  banned_by UUID NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_bans_user ON public.user_bans(user_id, active);

-- Helper: is user currently banned
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id UUID)
RETURNS TABLE(banned BOOLEAN, reason TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT TRUE, ub.reason, ub.expires_at
  FROM public.user_bans ub
  WHERE ub.user_id = _user_id
    AND ub.active = TRUE
    AND (ub.expires_at IS NULL OR ub.expires_at > now())
  ORDER BY COALESCE(ub.expires_at, 'infinity'::timestamptz) DESC
  LIMIT 1
$$;

-- RLS policies on user_bans
CREATE POLICY "Admins can view all bans"
  ON public.user_bans FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own ban"
  ON public.user_bans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can create bans"
  ON public.user_bans FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = banned_by);

CREATE POLICY "Admins can update bans"
  ON public.user_bans FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bans"
  ON public.user_bans FOR DELETE
  USING (has_role(auth.uid(), 'admin'));
