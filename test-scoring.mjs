#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from './lib/services/relevancy-service.ts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testScoring() {
  console.log('Testing relevancy scoring...\n');
  
  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('Failed to create relevancy service');
    process.exit(1);
  }

  try {
    // Get items to score
    const items = await relevancyService.getContentForRelevancyCheck(5);
    console.log(`Found ${items.length} items to score\n`);
    
    if (items.length === 0) {
      console.log('No items need scoring');
      return;
    }

    // Show what we're about to score
    for (const item of items) {
      console.log(`- ${item.content_title} (${item.lounge_name})`);
    }
    console.log('\nProcessing scores...\n');

    // Process the scoring
    const results = await relevancyService.processRelevancyChecks(5);
    console.log('Results:', results);

    // Check what got scored
    const { data: scored } = await supabase
      .from('content')
      .select('id, title, relevancy_score, relevancy_reason')
      .in('id', items.map(i => i.content_id))
      .not('relevancy_score', 'is', null);

    console.log('\nScored items:');
    for (const item of scored || []) {
      console.log(`- ${item.title}: ${item.relevancy_score} - ${item.relevancy_reason}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testScoring();