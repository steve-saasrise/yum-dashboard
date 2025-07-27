-- Update content table RLS policies for role-based access control

-- Drop existing user-based policies
DROP POLICY IF EXISTS "Users can insert content for their creators" ON public.content;
DROP POLICY IF EXISTS "Users can update content for their creators" ON public.content;

-- Create new role-based policies for content management
CREATE POLICY "Curators and admins can insert content" ON public.content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

CREATE POLICY "Curators and admins can update content" ON public.content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

CREATE POLICY "Curators and admins can delete content" ON public.content
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('curator', 'admin')
    )
  );

-- Add comment documenting the role-based policies
COMMENT ON POLICY "Curators and admins can insert content" ON public.content IS 'Curators and admins can insert content';
COMMENT ON POLICY "Curators and admins can update content" ON public.content IS 'Curators and admins can update content';
COMMENT ON POLICY "Curators and admins can delete content" ON public.content IS 'Curators and admins can delete content';