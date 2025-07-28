import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log('Testing signup with:', testEmail);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    console.log('Signup response:');
    console.log('Data:', JSON.stringify(data, null, 2));
    console.log('Error:', error);

    if (error) {
      console.error('Signup failed:', error.message);
    } else if (data.user) {
      console.log('User created successfully!');
      console.log('User ID:', data.user.id);
      console.log('User email:', data.user.email);
      console.log(
        'Email confirmed:',
        data.user.email_confirmed_at ? 'Yes' : 'No'
      );
      console.log('Confirmation sent at:', data.user.confirmation_sent_at);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSignup();
