-- Add role column to users table for RBAC
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer' 
CHECK (role IN ('viewer', 'curator', 'admin'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Update existing users based on their current access patterns
-- Set users who created lounges or creators as curators
UPDATE public.users u
SET role = 'curator'
WHERE EXISTS (
  SELECT 1 FROM public.lounges l WHERE l.user_id = u.id
) OR EXISTS (
  SELECT 1 FROM public.creators c WHERE c.user_id = u.id
);

-- You can manually promote specific users to admin role
-- Example (uncomment and replace with actual email):
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@example.com';

-- Add comment to document the role column
COMMENT ON COLUMN public.users.role IS 'User role for access control: viewer (read-only), curator (can manage content), admin (full access)';