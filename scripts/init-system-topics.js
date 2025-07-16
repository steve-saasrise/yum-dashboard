#!/usr/bin/env node

/**
 * Script to initialize system topics in the database
 * Run with: npm run init-topics
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

const SYSTEM_TOPICS = [
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

async function initSystemTopics() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Initializing system topics...\n');

  for (const topicName of SYSTEM_TOPICS) {
    try {
      // Check if topic already exists
      const { data: existingTopic, error: fetchError } = await supabase
        .from('topics')
        .select('id')
        .eq('name', topicName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`Error checking topic ${topicName}:`, fetchError);
        continue;
      }

      if (existingTopic) {
        console.log(`⏭️  Topic "${topicName}" already exists, skipping...`);
        continue;
      }

      // Create the topic
      const { data, error } = await supabase
        .from('topics')
        .insert({
          name: topicName,
          is_system_topic: true,
          description: `System topic for ${topicName.toLowerCase()} content`,
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating topic ${topicName}:`, error);
      } else {
        console.log(`✅ Created system topic: ${topicName}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error for topic ${topicName}:`, error);
    }
  }

  console.log('\n✨ System topics initialization complete!');
}

// Run the script
initSystemTopics().catch(console.error);
