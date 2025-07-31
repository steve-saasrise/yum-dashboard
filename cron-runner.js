#!/usr/bin/env node

const https = require('https');

// Get environment variables
const cronSecret = process.env.CRON_SECRET;
const appDomain =
  process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;

if (!cronSecret) {
  console.error('Error: CRON_SECRET not set');
  process.exit(1);
}

if (!appDomain) {
  console.error('Error: RAILWAY_PUBLIC_DOMAIN not set');
  process.exit(1);
}

// Remove protocol if present
const hostname = appDomain.replace(/^https?:\/\//, '');

console.log(`Starting content fetch job at ${new Date().toISOString()}`);
console.log(`Calling: https://${hostname}/api/cron/fetch-content`);

// Add timeout protection - exit before Railway kills the process
const jobTimeout = setTimeout(() => {
  console.error('Job timeout after 55 minutes - exiting gracefully');
  process.exit(1);
}, 3300000); // 55 minutes (Railway timeout is 60 minutes)

const options = {
  hostname: hostname,
  port: 443,
  path: '/api/cron/fetch-content',
  method: 'GET',
  headers: {
    Authorization: `Bearer ${cronSecret}`,
  },
  timeout: 300000, // 5 minute timeout
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Content fetch completed successfully:');
      console.log(JSON.stringify(result, null, 2));
      clearTimeout(jobTimeout); // Clear the timeout on success
      process.exit(0);
    } catch (error) {
      console.error('Failed to parse response:', data);
      clearTimeout(jobTimeout);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Request timeout after 5 minutes');
  req.destroy();
  process.exit(1);
});

req.end();
