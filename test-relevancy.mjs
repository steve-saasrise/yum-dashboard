#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from './lib/services/relevancy-service.ts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Testing relevancy service...');
console.log('OpenAI Key exists:', !!process.env.OPENAI_API_KEY);

try {
  const relevancyService = getRelevancyService(supabase);

  if (!relevancyService) {
    console.error('❌ Relevancy service is null - OpenAI key issue?');
    process.exit(1);
  }

  console.log('✓ Relevancy service created');

  // Check for unscored content
  const { data: unscoredCount } = await supabase
    .from('content')
    .select('id', { count: 'exact', head: true })
    .is('relevancy_checked_at', null)
    .gte(
      'created_at',
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    );

  console.log('Unscored content count:', unscoredCount);

  // Try to process
  console.log('Processing relevancy checks...');
  const results = await relevancyService.processRelevancyChecks(10);
  console.log('Results:', results);
} catch (error) {
  console.error('Error:', error);
}
