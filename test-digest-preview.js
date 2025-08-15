// Test script to preview digest content
const fetch = require('node-fetch');

async function testDigestPreview() {
  try {
    // First, login as admin to get auth token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'steve@saasrise.com',
        password: 'admin-password', // You'll need to provide the actual password
      }),
    });

    if (!loginResponse.ok) {
      console.log('Note: This test requires admin access. Please use the admin account.');
      console.log('Alternatively, you can test the digest preview manually.');
      return;
    }

    const { token } = await loginResponse.json();

    // Test preview for SaaS lounge
    const previewResponse = await fetch(
      'http://localhost:3000/api/test-digest?loungeId=5a33821a-4dc9-4951-a081-096a891744ae&email=llm-test@dailynews.com&preview=true',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const preview = await previewResponse.json();
    console.log('Digest Preview for SaaS Lounge:');
    console.log('================================');
    console.log(`Lounge: ${preview.lounge?.name}`);
    console.log(`Total content items: ${preview.contentCount}`);
    console.log(`YouTube videos: ${preview.youtubeCount}`);
    console.log('\nFirst 3 items:');
    preview.content?.forEach((item, index) => {
      console.log(`\n${index + 1}. [${item.platform}] ${item.title}`);
      console.log(`   Creator: ${item.creator?.display_name}`);
      console.log(`   URL: ${item.url}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Note: This is a test script to demonstrate the issue
console.log('To test the digest preview, you can:');
console.log('1. Login as admin (steve@saasrise.com)');
console.log('2. Navigate to: http://localhost:3000/api/test-digest?loungeId=5a33821a-4dc9-4951-a081-096a891744ae&email=llm-test@dailynews.com&preview=true');
console.log('\nOr use curl:');
console.log("curl 'http://localhost:3000/api/test-digest?loungeId=5a33821a-4dc9-4951-a081-096a891744ae&email=llm-test@dailynews.com&preview=true' -H 'Authorization: Bearer YOUR_TOKEN'");