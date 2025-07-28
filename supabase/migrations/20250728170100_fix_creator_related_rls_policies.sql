-- Drop old policies that reference non-existent user_id column
DROP POLICY IF EXISTS "Users can delete URLs for own creators" ON public.creator_urls;
DROP POLICY IF EXISTS "Users can insert URLs for own creators" ON public.creator_urls;
DROP POLICY IF EXISTS "Users can update URLs for own creators" ON public.creator_urls;
DROP POLICY IF EXISTS "Users can view URLs for own creators" ON public.creator_urls;

DROP POLICY IF EXISTS "Users can delete creator_topics for own creators" ON public.creator_lounges;
DROP POLICY IF EXISTS "Users can insert creator_topics for own creators" ON public.creator_lounges;
DROP POLICY IF EXISTS "Users can update creator_topics for own creators" ON public.creator_lounges;
DROP POLICY IF EXISTS "Users can view creator_topics for own creators" ON public.creator_lounges;

-- Create new policies for creator_urls that allow curators and admins
CREATE POLICY "Curators and admins can insert creator URLs"
  ON public.creator_urls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

CREATE POLICY "Curators and admins can update creator URLs"
  ON public.creator_urls
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

CREATE POLICY "Curators and admins can delete creator URLs"
  ON public.creator_urls
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

-- Create new policies for creator_lounges that allow curators and admins
CREATE POLICY "Curators and admins can insert creator lounges"
  ON public.creator_lounges
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

CREATE POLICY "Curators and admins can update creator lounges"
  ON public.creator_lounges
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

CREATE POLICY "Curators and admins can delete creator lounges"
  ON public.creator_lounges
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );