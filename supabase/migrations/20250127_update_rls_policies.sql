-- Update RLS policies for role-based access control

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lounges;
DROP POLICY IF EXISTS "Enable insert for users" ON public.lounges;
DROP POLICY IF EXISTS "Enable update for users" ON public.lounges;
DROP POLICY IF EXISTS "Enable delete for users" ON public.lounges;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.creators;
DROP POLICY IF EXISTS "Enable insert for users" ON public.creators;
DROP POLICY IF EXISTS "Enable update for users" ON public.creators;
DROP POLICY IF EXISTS "Enable delete for users" ON public.creators;

-- Users table policies
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Lounges table policies
CREATE POLICY "All authenticated users can view lounges" ON public.lounges
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- System lounges are visible to all
      is_system_lounge = true OR
      -- User's own lounges
      user_id = auth.uid() OR
      -- Admins can see all lounges
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Curators and admins can create lounges" ON public.lounges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

CREATE POLICY "Users can update own lounges, admins can update any" ON public.lounges
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own lounges, admins can delete any" ON public.lounges
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Creators table policies
CREATE POLICY "All authenticated users can view creators" ON public.creators
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Curators and admins can create creators" ON public.creators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

CREATE POLICY "Curators and admins can update creators" ON public.creators
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

CREATE POLICY "Curators and admins can delete creators" ON public.creators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Creator URLs table policies
CREATE POLICY "All authenticated users can view creator URLs" ON public.creator_urls
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Curators and admins can manage creator URLs" ON public.creator_urls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Topics table policies (if not already set)
CREATE POLICY IF NOT EXISTS "All authenticated users can view topics" ON public.topics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Curators and admins can manage topics" ON public.topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Creator Topics table policies
CREATE POLICY IF NOT EXISTS "All authenticated users can view creator topics" ON public.creator_topics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Curators and admins can manage creator topics" ON public.creator_topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Creator Lounges table policies
CREATE POLICY IF NOT EXISTS "All authenticated users can view creator lounges" ON public.creator_lounges
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Curators and admins can manage creator lounges" ON public.creator_lounges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Content table policies
CREATE POLICY IF NOT EXISTS "All authenticated users can view content" ON public.content
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "System can manage content" ON public.content
  FOR ALL USING (auth.uid() = 'system'::uuid);

-- Add comment documenting the role-based policies
COMMENT ON POLICY "Curators and admins can create lounges" ON public.lounges IS 'Only users with curator or admin role can create lounges';
COMMENT ON POLICY "Curators and admins can create creators" ON public.creators IS 'Only users with curator or admin role can create creators';