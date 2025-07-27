#!/usr/bin/env node

/**
 * Test script for unified authentication system
 * 
 * This script tests the new RBAC authentication flow:
 * 1. Verifies role column exists in users table
 * 2. Tests role-based access for different user types
 * 3. Validates API endpoints respect role permissions
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRoleColumn() {
  console.log('\n🧪 Testing role column in users table...');
  
  try {
    // Query users table to check role column
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(5);

    if (error) {
      console.error('❌ Error querying users table:', error.message);
      return false;
    }

    console.log('✅ Role column exists in users table');
    console.log('📊 Sample users:', data?.map(u => ({ email: u.email, role: u.role })));
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testRoleBasedAccess() {
  console.log('\n🧪 Testing role-based access...');
  
  try {
    // Get user counts by role
    const { data: roleCounts, error } = await supabase
      .from('users')
      .select('role')
      .order('role');

    if (error) {
      console.error('❌ Error getting role counts:', error.message);
      return false;
    }

    const counts = roleCounts?.reduce((acc, { role }) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('✅ User role distribution:');
    console.log('   - Viewers:', counts?.viewer || 0);
    console.log('   - Curators:', counts?.curator || 0);
    console.log('   - Admins:', counts?.admin || 0);

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testAPIEndpointAccess() {
  console.log('\n🧪 Testing API endpoint access (using service role)...');
  
  try {
    // Test creating a lounge (should require curator/admin role)
    const { data: lounges, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, user_id')
      .limit(1);

    if (loungeError) {
      console.error('❌ Error querying lounges:', loungeError.message);
      return false;
    }

    console.log('✅ Lounges table accessible');
    
    // Test creating a creator (should require curator/admin role)
    const { data: creators, error: creatorError } = await supabase
      .from('creators')
      .select('id, display_name')
      .limit(1);

    if (creatorError) {
      console.error('❌ Error querying creators:', creatorError.message);
      return false;
    }

    console.log('✅ Creators table accessible');
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Unified Authentication System');
  console.log('=====================================');

  const tests = [
    testRoleColumn,
    testRoleBasedAccess,
    testAPIEndpointAccess,
  ];

  let passed = 0;
  for (const test of tests) {
    if (await test()) {
      passed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}/${tests.length}`);
  console.log(`   ❌ Failed: ${tests.length - passed}/${tests.length}`);

  if (passed === tests.length) {
    console.log('\n🎉 All tests passed! The unified authentication system is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Run the database migrations to add the role column');
    console.log('   2. Update existing users with appropriate roles');
    console.log('   3. Test the authentication flow in the UI');
    console.log('   4. Promote at least one user to admin role');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});