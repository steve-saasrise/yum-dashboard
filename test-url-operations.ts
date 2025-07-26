// Test script for URL operations
// Run with: npx tsx test-url-operations.ts

const BASE_URL = 'http://localhost:3000';

// You'll need to set these values based on your current session
const COOKIE = ''; // Add your session cookie here
const CREATOR_ID = ''; // Add a creator ID you own

async function testUrlOperations() {
  console.log('Testing URL Operations for Creator URL Management\n');

  // Test URLs
  const testUrls = [
    'https://www.youtube.com/@testchannel',
    'https://twitter.com/testuser',
    'https://www.linkedin.com/in/testperson',
    'https://www.threads.net/@testthreads',
    'https://example.com/feed.rss',
  ];

  console.log('Instructions:');
  console.log(
    '1. Open the browser developer tools and copy your session cookie'
  );
  console.log('2. Find a creator ID from your dashboard');
  console.log('3. Update the COOKIE and CREATOR_ID variables in this file');
  console.log('4. Run: npx tsx test-url-operations.ts\n');

  if (!COOKIE || !CREATOR_ID) {
    console.log('Please set COOKIE and CREATOR_ID variables first!');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Cookie: COOKIE,
  };

  // Test 1: Get existing URLs
  console.log('Test 1: Getting existing URLs for creator...');
  try {
    const response = await fetch(
      `${BASE_URL}/api/creators/${CREATOR_ID}/urls`,
      {
        headers,
      }
    );
    const data = await response.json();
    console.log('Response:', response.status, data);
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Add a new URL
  console.log('Test 2: Adding a new YouTube URL...');
  try {
    const response = await fetch(
      `${BASE_URL}/api/creators/${CREATOR_ID}/urls`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: testUrls[0],
        }),
      }
    );
    const data = await response.json();
    console.log('Response:', response.status, data);

    if (data.data?.id) {
      console.log('Created URL ID:', data.data.id);

      // Test 3: Update the URL
      console.log('\nTest 3: Updating the URL...');
      const updateResponse = await fetch(
        `${BASE_URL}/api/creators/${CREATOR_ID}/urls/${data.data.id}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            url: 'https://www.youtube.com/@updatedchannel',
          }),
        }
      );
      const updateData = await updateResponse.json();
      console.log('Update Response:', updateResponse.status, updateData);

      // Test 4: Try to add duplicate platform
      console.log('\nTest 4: Attempting to add duplicate YouTube URL...');
      const dupResponse = await fetch(
        `${BASE_URL}/api/creators/${CREATOR_ID}/urls`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: 'https://www.youtube.com/@anotherchannel',
          }),
        }
      );
      const dupData = await dupResponse.json();
      console.log('Duplicate Response:', dupResponse.status, dupData);

      // Test 5: Delete the URL
      console.log('\nTest 5: Deleting the URL...');
      const deleteResponse = await fetch(
        `${BASE_URL}/api/creators/${CREATOR_ID}/urls/${data.data.id}`,
        {
          method: 'DELETE',
          headers,
        }
      );
      const deleteData = await deleteResponse.json();
      console.log('Delete Response:', deleteResponse.status, deleteData);
    }
    console.log('---\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 6: Test last URL protection
  console.log('Test 6: Testing last URL protection...');
  console.log('This test requires manual testing in the UI');
  console.log(
    'Try to delete all URLs from a creator - the last one should be protected'
  );
  console.log('---\n');

  console.log('Testing complete!');
}

// Run the tests
testUrlOperations();
