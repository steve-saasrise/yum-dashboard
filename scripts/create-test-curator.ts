import { CuratorAuthService } from '@/lib/services/curator-auth-service';

async function createTestCurator() {
  const email = 'test@curator.com';
  const password = 'testpass123';

  console.log('Creating test curator account...');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  try {
    const curator = await CuratorAuthService.createCurator(email, password);

    if (curator) {
      console.log('Test curator created successfully!');
      console.log('Curator ID:', curator.id);
    } else {
      console.log('Failed to create test curator');
    }
  } catch (error) {
    console.error('Error creating test curator:', error);
  }
}

createTestCurator();
