import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key present:', !!supabaseServiceKey);
console.log('Service Key length:', supabaseServiceKey?.length);

async function testServiceRole() {
  try {
    // Create service role client
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('\nFetching all users with service role...');
    const { data: users, error } = await serviceSupabase
      .from('users')
      .select('id, email, role')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log(`\nFound ${users?.length || 0} users:`);
    users?.forEach((user) => {
      console.log(`- ${user.email} (${user.role})`);
    });
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testServiceRole();
