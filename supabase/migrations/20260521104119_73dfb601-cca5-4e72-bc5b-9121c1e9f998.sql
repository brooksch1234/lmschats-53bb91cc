
ALTER TABLE public.messages
  ADD CONSTRAINT msg_length_check
  CHECK (content IS NULL OR char_length(content) <= 5000) NOT VALID;

ALTER TABLE public.group_messages
  ADD CONSTRAINT grp_msg_length_check
  CHECK (content IS NULL OR char_length(content) <= 5000) NOT VALID;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcement_title_check
  CHECK (char_length(title) <= 200) NOT VALID;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcement_content_check
  CHECK (char_length(content) <= 10000) NOT VALID;
