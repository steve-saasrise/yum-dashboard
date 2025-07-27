import bcrypt from 'bcryptjs';

async function generatePasswordHash() {
  const password = 'hello123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nRun this SQL to update the password:');
  console.log(
    `UPDATE curators SET password_hash = '${hash}' WHERE email = 'steve@saasrise.com';`
  );
}

generatePasswordHash();
