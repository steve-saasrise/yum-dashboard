const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAdminCurator(email, password) {
  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert the curator
    const { data, error } = await supabase
      .from('curators')
      .insert({
        email: email,
        password_hash: passwordHash,
        is_admin: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating curator:', error);
      return;
    }

    console.log(`Successfully created admin curator: ${email}`);
    console.log('Curator ID:', data.id);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Add Ryan as admin
addAdminCurator('ryan@saasrise.com', 'hello123');
