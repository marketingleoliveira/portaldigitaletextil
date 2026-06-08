
-- profiles: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated users can view all active profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all active profiles"
ON public.profiles FOR SELECT TO authenticated
USING (is_active = true);

-- user_roles: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

-- goal_progress: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated users can view all progress for ranking" ON public.goal_progress;
CREATE POLICY "Authenticated users can view all progress for ranking"
ON public.goal_progress FOR SELECT TO authenticated
USING (true);

-- user_activity_sessions: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated users can view all activity sessions" ON public.user_activity_sessions;
CREATE POLICY "Authenticated users can view all activity sessions"
ON public.user_activity_sessions FOR SELECT TO authenticated
USING (true);

-- meeting_participants: remove dangerous permissive UPDATE
DROP POLICY IF EXISTS "Anyone can update their participant status" ON public.meeting_participants;

-- meeting_messages: fix broken subquery in SELECT policy
DROP POLICY IF EXISTS "Users can view messages in meetings they are part of" ON public.meeting_messages;
CREATE POLICY "Users can view messages in meetings they are part of"
ON public.meeting_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.meeting_participants mp
  WHERE mp.meeting_id = meeting_messages.meeting_id
    AND mp.user_id = auth.uid()
));
