-- Add INSERT policy for content table to allow curators and admins to create content
CREATE POLICY "Curators and admins can insert content"
  ON public.content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

-- Add UPDATE policy for content table to allow curators and admins to update content
CREATE POLICY "Curators and admins can update content"
  ON public.content
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

-- Add DELETE policy for content table to allow curators and admins to delete content
CREATE POLICY "Curators and admins can delete content"
  ON public.content
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );