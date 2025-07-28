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
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
});

async function checkCreatorsSchema() {
  console.log('=== Checking Creators Table Schema ===\n');

  try {
    // First, let's see what columns the creators table has
    const { data: emptyCreator, error } = await supabase
      .from('creators')
      .select('*')
      .limit(0);

    console.log('Query error (if any):', error);

    // Get an actual creator to see its structure
    const { data: sampleCreator, error: sampleError } = await supabase
      .from('creators')
      .select('*')
      .limit(1)
      .single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      // PGRST116 is "no rows found"
      console.log('Error getting sample creator:', sampleError);
    } else if (sampleCreator) {
      console.log('Sample creator structure:', Object.keys(sampleCreator));
      console.log('Full sample creator:', sampleCreator);
    }

    // Check if RLS is enabled using a raw SQL query
    const { data: rlsCheck, error: rlsError } = await supabase
      .rpc('query_raw', {
        query: `
        SELECT 
          schemaname,
          tablename,
          rowsecurity
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'creators'
      `,
      })
      .single();

    if (!rlsError) {
      console.log('\nRLS status from pg_tables:', rlsCheck);
    } else {
      // Try another approach
      console.log('\nRLS check error:', rlsError);
    }

    // Check policies using raw SQL
    const { data: policies, error: policiesError } = await supabase.rpc(
      'query_raw',
      {
        query: `
        SELECT 
          policyname,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'creators'
      `,
      }
    );

    if (!policiesError) {
      console.log('\nPolicies on creators table:', policies);
    } else {
      console.log('\nPolicies check error:', policiesError);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Check if we can simulate the same insert that's failing
async function simulateCreatorInsert() {
  console.log('\n=== Simulating API Insert ===\n');

  const testUserId = 'c699a1b9-6364-41cd-a6f3-c475b2f1818b'; // LLM test user ID

  try {
    // First, let's check what the API is trying to insert
    const creatorData = {
      display_name: 'API Test Creator',
      bio: 'Testing API insert simulation',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Note: No user_id field in the API's insert
    };

    console.log('Data that API tries to insert:', creatorData);

    // Try to insert with auth context (similar to what API does)
    const { data: authUser } =
      await supabase.auth.admin.getUserById(testUserId);
    console.log('\nAuth user found:', authUser?.user?.email);

    // Check if the creator table expects a user_id
    const { data: insertTest, error: insertError } = await supabase
      .from('creators')
      .insert({
        ...creatorData,
        display_name: 'Schema Test Creator',
      })
      .select()
      .single();

    if (insertError) {
      console.log('\nInsert without user_id error:', insertError);

      // Try with user_id
      const { data: insertWithUser, error: userError } = await supabase
        .from('creators')
        .insert({
          ...creatorData,
          display_name: 'Schema Test Creator 2',
          user_id: testUserId,
        })
        .select()
        .single();

      if (userError) {
        console.log('\nInsert with user_id error:', userError);
      } else {
        console.log('\nInsert with user_id successful:', insertWithUser);
        // Clean up
        if (insertWithUser?.id) {
          await supabase.from('creators').delete().eq('id', insertWithUser.id);
        }
      }
    } else {
      console.log('\nInsert without user_id successful:', insertTest);
      // Clean up
      if (insertTest?.id) {
        await supabase.from('creators').delete().eq('id', insertTest.id);
      }
    }
  } catch (error) {
    console.error('Simulation error:', error);
  }
}

// Execute the checks
checkCreatorsSchema()
  .then(() => {
    return simulateCreatorInsert();
  })
  .then(() => {
    console.log('\n=== Schema Check Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
