-- Drop the overly restrictive content insert policy
DROP POLICY IF EXISTS "Curators and admins can insert content" ON public.content;

-- Create a new policy that allows authenticated users to insert content
-- This is needed for the content refresh endpoint which runs with user auth
CREATE POLICY "Authenticated users can insert content"
  ON public.content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow insert if the user has access to view the creator
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = content.creator_id
    )
  );

-- Also update the UPDATE policy to be consistent
DROP POLICY IF EXISTS "Curators and admins can update content" ON public.content;

CREATE POLICY "Authenticated users can update content"
  ON public.content
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow update if the user has access to view the creator
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = content.creator_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = content.creator_id
    )
  );