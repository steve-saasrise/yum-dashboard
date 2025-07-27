import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSStatus() {
  console.log('=== Checking RLS Status ===\n');

  try {
    // Check if RLS is enabled on creators table
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('check_rls_enabled', { table_name: 'creators' });

    if (rlsError) {
      // Try a different approach
      const { data: tableInfo, error: tableError } = await supabase
        .from('pg_tables')
        .select('*')
        .eq('schemaname', 'public')
        .eq('tablename', 'creators')
        .single();

      console.log('Table info query error:', tableError);
      console.log('Table info:', tableInfo);
    } else {
      console.log('RLS enabled on creators table:', rlsStatus);
    }

    // Check RLS policies on creators table
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'creators' });

    if (policiesError) {
      // Alternative approach using direct SQL
      const { data: policiesAlt, error: policiesAltError } = await supabase
        .rpc('get_table_policies', { schema_name: 'public', table_name: 'creators' });
      
      if (policiesAltError) {
        console.log('Error fetching policies:', policiesAltError);
      } else {
        console.log('\nPolicies on creators table:', policiesAlt);
      }
    } else {
      console.log('\nPolicies on creators table:', policies);
    }

    // Check the test user's role
    const { data: testUser, error: userError } = await supabase
      .from('users')
      .select('id, email, role, created_at, updated_at')
      .eq('email', 'llm-test@dailynews.com')
      .single();

    if (userError) {
      console.log('\nError fetching test user:', userError);
    } else {
      console.log('\nTest user details:', testUser);
    }

    // Check if there are any creators owned by the test user
    if (testUser) {
      const { data: userCreators, error: creatorsError } = await supabase
        .from('creators')
        .select('*')
        .eq('user_id', testUser.id);

      if (creatorsError) {
        console.log('\nError fetching user creators:', creatorsError);
      } else {
        console.log('\nCreators owned by test user:', userCreators?.length || 0);
      }
    }

    // Try to directly query policies from system tables
    const { data: systemPolicies, error: systemError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'creators');

    if (systemError) {
      console.log('\nError querying system policies:', systemError);
    } else {
      console.log('\nSystem policies for creators table:', systemPolicies);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Also create a function to test the insert directly
async function testCreatorInsert() {
  console.log('\n=== Testing Direct Insert ===\n');

  try {
    const testData = {
      display_name: 'Direct Test Creator',
      bio: 'Testing direct insert with service role',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('Attempting to insert:', testData);

    const { data, error } = await supabase
      .from('creators')
      .insert(testData)
      .select()
      .single();

    if (error) {
      console.log('Insert error:', error);
    } else {
      console.log('Insert successful:', data);
      
      // Clean up
      if (data?.id) {
        const { error: deleteError } = await supabase
          .from('creators')
          .delete()
          .eq('id', data.id);
        
        if (deleteError) {
          console.log('Cleanup error:', deleteError);
        } else {
          console.log('Test creator cleaned up');
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error during insert test:', error);
  }
}

// Run the checks
checkRLSStatus().then(() => {
  return testCreatorInsert();
}).then(() => {
  console.log('\n=== Check Complete ===');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});