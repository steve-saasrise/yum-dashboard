import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '../lib/services/relevancy-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runRelevancyCheck() {
  console.log('Starting manual relevancy check...');
  
  // Create Supabase service client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const relevancyService = getRelevancyService(supabase);
  
  if (!relevancyService) {
    console.error('OpenAI API key not configured');
    process.exit(1);
  }

  try {
    // Process up to 100 items
    const results = await relevancyService.processRelevancyChecks(100);
    console.log('Relevancy check completed:', results);
  } catch (error) {
    console.error('Error running relevancy checks:', error);
    process.exit(1);
  }
}

runRelevancyCheck();