import { createClient } from '@supabase/supabase-js';
import { getAISummaryService } from '../lib/services/ai-summary-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generatePendingSummaries() {
  // Create Supabase service client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Fetching pending content...');

  // Get all pending content
  const { data: pendingContent, error } = await supabase
    .from('content')
    .select('id, content_body')
    .eq('summary_status', 'pending')
    .not('content_body', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending content:', error);
    return;
  }

  console.log(
    `Found ${pendingContent?.length || 0} items with pending summaries`
  );

  if (!pendingContent || pendingContent.length === 0) {
    console.log('No pending content found');
    return;
  }

  const summaryService = getAISummaryService();
  const contentIds = pendingContent.map((item) => item.id);

  console.log('Starting batch summary generation...');

  try {
    const results = await summaryService.generateBatchSummaries(contentIds, {
      batchSize: 5,
      supabaseClient: supabase,
      maxCost: 5.0, // Limit to $5 for this run
    });

    console.log('\nSummary generation complete!');
    console.log(`Processed: ${results.processed}`);
    console.log(`Errors: ${results.errors}`);
    console.log(
      `Estimated cost: $${results.estimatedCost?.toFixed(4) || '0.0000'}`
    );
  } catch (error) {
    console.error('Error generating summaries:', error);
  }
}

// Run the script
generatePendingSummaries()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
