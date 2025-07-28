import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function testAdminAPI() {
  const baseUrl = 'http://localhost:3000';

  console.log('Testing admin API route...\n');

  try {
    // First, we need to authenticate
    console.log(
      'Note: This test requires you to be logged in as an admin in your browser.'
    );
    console.log('The API uses cookies for authentication.\n');

    // Test the GET endpoint
    console.log('Testing GET /api/admin/users');
    console.log('Run this in your browser console while logged in as admin:');
    console.log(`
fetch('/api/admin/users')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
    `);
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminAPI();
