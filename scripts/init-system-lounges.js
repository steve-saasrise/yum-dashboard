#!/usr/bin/env node

/**
 * Script to initialize system lounges in the database
 * Run with: npm run init-lounges
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYSTEM_LOUNGES = [
  'Technology',
  'Business',
  'Education',
  'Entertainment',
  'Health',
  'Science',
  'Politics',
  'Sports',
  'Lifestyle',
  'News',
];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nMake sure to set these in your .env.local file');
  process.exit(1);
}

async function initSystemLounges() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Initializing system lounges...\n');

  for (const loungeName of SYSTEM_LOUNGES) {
    try {
      // Check if lounge already exists
      const { data: existingLounge, error: fetchError } = await supabase
        .from('lounges')
        .select('id')
        .eq('name', loungeName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`Error checking lounge ${loungeName}:`, fetchError);
        continue;
      }

      if (existingLounge) {
        console.log(`⏭️  Lounge "${loungeName}" already exists, skipping...`);
        continue;
      }

      // Create the lounge
      const { data, error } = await supabase
        .from('lounges')
        .insert({
          name: loungeName,
          is_system_lounge: true,
          description: `System lounge for ${loungeName.toLowerCase()} content`,
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating lounge ${loungeName}:`, error);
      } else {
        console.log(`✅ Created system lounge: ${loungeName}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error for lounge ${loungeName}:`, error);
    }
  }

  console.log('\n✨ System lounges initialization complete!');
}

// Run the script
initSystemLounges().catch(console.error);
