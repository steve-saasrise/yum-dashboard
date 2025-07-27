// Script to create a curator account via API
async function createCurator() {
  const response = await fetch('http://localhost:3000/api/curator/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'steve@saasrise.com',
      password: 'hello123',
      confirmPassword: 'hello123',
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Curator created successfully!', data);
  } else {
    const error = await response.json();
    console.error('Failed to create curator:', error);
  }
}

createCurator();
