#!/usr/bin/env node

/**
 * Create a test account for viewer access
 * This creates a user with viewer role for testing purposes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createViewerTestAccount() {
  console.log('🔧 Creating test account for viewer access...');

  const testEmail = 'viewer-test@dailynews.com';
  const testPassword = 'ViewerTest123!@#';

  try {
    // First, check if user already exists
    const { data: existingUser } = await supabase.auth.admin
      .getUserById('viewer-test-user-id')
      .catch(() => ({ data: null }));

    if (existingUser) {
      console.log('✅ Test account already exists');
      console.log('\n📧 Login Credentials:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      return;
    }

    // Create user in auth.users
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });

    if (authError) {
      console.error('❌ Error creating auth user:', authError.message);
      return;
    }

    console.log('✅ Created auth user:', authUser.user.id);

    // Create user in public.users with viewer role
    const { error: publicError } = await supabase.from('users').insert({
      id: authUser.user.id,
      email: testEmail,
      password_hash: 'supabase-auth', // Placeholder since Supabase handles auth
      role: 'viewer', // Give viewer access for testing
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (publicError) {
      console.error('❌ Error creating public user:', publicError.message);
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return;
    }

    console.log('✅ Created public user with viewer role');
    console.log('\n📧 Login Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(
      '\n🔐 Access Level: Viewer (read-only access, cannot create/edit content)'
    );
    console.log('\n🌐 Login URL: http://localhost:3000/auth/login');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
createViewerTestAccount().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});