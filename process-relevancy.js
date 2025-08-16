require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { RelevancyService } = require('./lib/services/relevancy-service.ts');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function processRelevancy() {
  console.log('Processing relevancy checks...\n');

  // Create service instance
  const service = new RelevancyService(supabase);

  // Process relevancy checks
  const result = await service.processRelevancyChecks(50);

  console.log(`Processed: ${result.processed} items`);
  console.log(`Errors: ${result.errors}`);

  // Check how many were deleted
  const { count } = await supabase
    .from('deleted_content')
    .select('*', { count: 'exact', head: true })
    .eq('deletion_reason', 'low_relevancy');

  console.log(`Total auto-deleted: ${count || 0}`);
}

processRelevancy().catch((error) => {
  console.error('Error:', error.message);
});
