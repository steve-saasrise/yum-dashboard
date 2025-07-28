-- Add INSERT policy for creators table to allow curators and admins to create creators
CREATE POLICY "Curators and admins can create creators"
  ON public.creators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );

-- Also add UPDATE and DELETE policies for curators and admins
CREATE POLICY "Curators and admins can update creators"
  ON public.creators
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

CREATE POLICY "Curators and admins can delete creators"
  ON public.creators
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'curator' OR users.role = 'admin')
    )
  );