import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '../lib/services/relevancy-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testRelevancy() {
  console.log('🧪 Testing updated relevancy scoring...\n');

  // Create Supabase service client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get relevancy service
  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('❌ Relevancy service not configured');
    process.exit(1);
  }

  // Test Amanda's Taylor Swift post
  const testItem = {
    content_id: 'test-amanda-taylor',
    lounge_id: 'saas-lounge',
    lounge_name: 'SaaS',
    theme_description: 'SaaS business models, metrics, B2B software',
    content_title:
      "Taylor's podcast debut gives a clinic in controlling your brand",
    content_description:
      "Taylor's podcast debut gives a clinic in controlling your brand while staying genuine. She outlined why it was important to own her masters and gave her fans the respect they deserve—sharing the why behind the Easter eggs and product drops. Artists & founders: go direct and treat your audience like adults.",
    content_url: 'https://linkedin.com/test',
    creator_name: 'Amanda Natividad',
  };

  console.log('Testing content:');
  console.log(`  Creator: ${testItem.creator_name}`);
  console.log(`  Lounge: ${testItem.lounge_name}`);
  console.log(
    `  Content: "${testItem.content_description?.substring(0, 100)}..."\n`
  );

  // @ts-ignore - accessing private method for testing
  const result = await relevancyService.checkSingleItem(testItem);

  console.log('Results:');
  console.log(`  Score: ${result.score}/100`);
  console.log(`  Threshold: 60`);
  console.log(`  Would be deleted: ${result.score < 60 ? 'YES ❌' : 'NO ✅'}`);
  console.log(`  Reason: ${result.reason}\n`);

  if (result.score < 60) {
    console.log(
      '✅ Test passed! Content would now be filtered out of SaaS lounge.'
    );
  } else {
    console.log('⚠️  Content still scores too high for SaaS lounge.');
  }

  process.exit(0);
}

testRelevancy().catch(console.error);
