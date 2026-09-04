import 'dotenv/config';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

async function main() {
  // Test login page
  let res = await fetch('http://localhost:3000/login');
  console.log('GET /login:', res.status);

  // Test unauth root
  res = await fetch('http://localhost:3000/', { redirect: 'manual' });
  console.log('GET / (no auth):', res.status, res.headers.get('location'));

  // Test with bearer token
  res = await fetch('http://localhost:3000/api/stats', {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    redirect: 'manual',
  });
  console.log('GET /api/stats (bearer):', res.status);
  if (res.status === 200) {
    const data = await res.json();
    console.log('Stats:', JSON.stringify(data));
  }

  // Test with query token
  res = await fetch(`http://localhost:3000/api/stats?token=${ADMIN_TOKEN}`, {
    redirect: 'manual',
  });
  console.log('GET /api/stats (query):', res.status);
  if (res.status === 200) {
    const data = await res.json();
    console.log('Stats:', JSON.stringify(data));
  }

  // Test dashboard root with token
  res = await fetch(`http://localhost:3000/?token=${ADMIN_TOKEN}`, {
    redirect: 'manual',
  });
  console.log('GET / (query token):', res.status);
  if (res.status === 200) {
    const html = await res.text();
    console.log('Dashboard HTML length:', html.length);
    console.log('Has stats-grid:', html.includes('stats-grid'));
    console.log('Has Total Users:', html.includes('Total Users'));
  }

  // Test users page
  res = await fetch(`http://localhost:3000/users?token=${ADMIN_TOKEN}`, {
    redirect: 'manual',
  });
  console.log('GET /users:', res.status);
  if (res.status === 200) {
    const html = await res.text();
    console.log('Users HTML length:', html.length);
    console.log('Has 964254039:', html.includes('964254039'));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
