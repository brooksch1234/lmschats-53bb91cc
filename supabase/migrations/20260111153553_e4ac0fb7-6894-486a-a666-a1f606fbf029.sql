-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_tags junction table
CREATE TABLE public.user_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  custom_color TEXT,
  equipped BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

-- Tags policies - everyone can view tags
CREATE POLICY "Anyone can view tags"
ON public.tags FOR SELECT
USING (true);

-- Only admins can manage tags
CREATE POLICY "Admins can insert tags"
ON public.tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update tags"
ON public.tags FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete non-system tags"
ON public.tags FOR DELETE
USING (
  NOT is_system AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- User tags policies
CREATE POLICY "Anyone can view user tags"
ON public.user_tags FOR SELECT
USING (true);

CREATE POLICY "Users can update their own tag colors and equipped status"
ON public.user_tags FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert user tags"
ON public.user_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Users can claim beta tag"
ON public.user_tags FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tags WHERE tags.id = tag_id AND tags.name = 'BETA'
  )
);

CREATE POLICY "Admins can delete user tags"
ON public.user_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Insert system tags
INSERT INTO public.tags (name, color, is_system) VALUES
  ('OWNER', '#eab308', true),
  ('ADMIN', '#ef4444', true),
  ('BETA', '#8b5cf6', true);

-- Give Brooks (user id: 9f760b00-1c7e-4655-9fe2-299853b33234) the OWNER tag
INSERT INTO public.user_tags (user_id, tag_id)
SELECT '9f760b00-1c7e-4655-9fe2-299853b33234', id FROM public.tags WHERE name = 'OWNER';

-- Give all admins the ADMIN tag
INSERT INTO public.user_tags (user_id, tag_id)
SELECT ur.user_id, t.id
FROM public.user_roles ur
CROSS JOIN public.tags t
WHERE ur.role = 'admin' AND t.name = 'ADMIN'
ON CONFLICT (user_id, tag_id) DO NOTHING;

-- Enable realtime for user_tags
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tags;