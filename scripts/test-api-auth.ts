import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

async function testWithDifferentClients() {
  console.log('=== Testing with Different Supabase Clients ===\n');

  const testUserId = 'c699a1b9-6364-41cd-a6f3-c475b2f1818b'; // LLM test user

  // Test 1: Service role client (bypasses RLS)
  console.log('1. Testing with service role client:');
  const serviceClient = createClient(supabaseUrl!, supabaseServiceKey!);

  const { data: serviceInsert, error: serviceError } = await serviceClient
    .from('creators')
    .insert({
      display_name: 'Service Role Test',
      bio: 'Created with service role',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (serviceError) {
    console.log('Service role insert error:', serviceError);
  } else {
    console.log('Service role insert successful:', serviceInsert?.id);
    // Clean up
    await serviceClient.from('creators').delete().eq('id', serviceInsert.id);
  }

  // Test 2: Anon client without auth
  console.log('\n2. Testing with anon client (no auth):');
  const anonClient = createClient(supabaseUrl!, supabaseAnonKey!);

  const { data: anonInsert, error: anonError } = await anonClient
    .from('creators')
    .insert({
      display_name: 'Anon Test',
      bio: 'Created with anon key',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (anonError) {
    console.log('Anon insert error:', anonError.message);
  } else {
    console.log('Anon insert successful:', anonInsert?.id);
  }

  // Test 3: Check if RLS is actually enabled
  console.log('\n3. Checking RLS status:');
  const { data: rlsData, error: rlsError } =
    await serviceClient.rpc('check_rls_status');

  if (rlsError) {
    // Try manual check
    const { data: tableCheck } = await serviceClient
      .from('creators')
      .select('*')
      .limit(0);

    console.log(
      'RLS appears to be:',
      tableCheck !== null ? 'ENABLED' : 'UNKNOWN'
    );
  } else {
    console.log('RLS status:', rlsData);
  }

  // Test 4: Get the actual session/auth state
  console.log('\n4. Checking auth state in API context:');

  // First, let's get a proper session token for the test user
  const { data: signInData, error: signInError } =
    await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: 'llm-test@dailynews.com',
    });

  if (signInError) {
    console.log('Error generating auth link:', signInError);
  } else {
    console.log('Auth link generated for test user');
  }

  // Test 5: Check the exact RLS policy
  console.log('\n5. Testing RLS policy conditions:');

  // Get user details
  const { data: userData } = await serviceClient
    .from('users')
    .select('id, email, role')
    .eq('id', testUserId)
    .single();

  console.log('Test user in database:', userData);

  // Check if we can query as this user
  const { data: userAuth } =
    await serviceClient.auth.admin.getUserById(testUserId);
  console.log('User auth metadata:', userAuth?.user?.user_metadata);
}

async function testRLSDirectly() {
  console.log('\n=== Direct RLS Testing ===\n');

  // Create a client that mimics what the API uses
  const apiClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
    },
  });

  // Manually set auth header to simulate authenticated request
  const testUserId = 'c699a1b9-6364-41cd-a6f3-c475b2f1818b';

  // Try to create a JWT for testing
  console.log('Testing with simulated auth...');

  // This would normally come from cookies in the API
  const { data: testData, error: testError } = await apiClient
    .from('creators')
    .insert({
      display_name: 'RLS Direct Test',
      bio: 'Testing RLS directly',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select();

  console.log('Direct RLS test result:', testError?.message || 'Success');
}

// Execute tests
testWithDifferentClients()
  .then(() => testRLSDirectly())
  .then(() => {
    console.log('\n=== Tests Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
