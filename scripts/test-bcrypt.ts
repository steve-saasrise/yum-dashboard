import bcrypt from 'bcryptjs';

async function testBcrypt() {
  const password = 'hello123';
  const hash = '$2b$10$gjKMrfrSyqqr0SQmCDATqu4l7C77B.00.f3hogPvlu6WaNK.xeyg2';

  console.log('Testing bcrypt verification:');
  console.log('Password:', password);
  console.log('Hash:', hash);

  const result = await bcrypt.compare(password, hash);
  console.log('Verification result:', result);

  // Also test with a fresh hash
  const newHash = await bcrypt.hash(password, 10);
  console.log('\nNew hash:', newHash);
  const newResult = await bcrypt.compare(password, newHash);
  console.log('New hash verification:', newResult);
}

testBcrypt();
