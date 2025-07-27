import { createServerClient } from '@supabase/ssr';
import bcrypt from 'bcryptjs';

async function createSteveCurator() {
  const email = 'steve@saasrise.com';
  const password = 'hello123';

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('Creating curator with email:', email);
  console.log('Password hash created');

  // Insert the curator
  const { data, error } = await supabase
    .from('curators')
    .insert({
      email,
      password_hash: passwordHash,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating curator:', error);
    return;
  }

  console.log('Curator created successfully!');
  console.log('ID:', data.id);
  console.log('Email:', data.email);
  console.log('\nYou can now login with:');
  console.log('Email:', email);
  console.log('Password:', password);
}

// Run the script
createSteveCurator().catch(console.error);
