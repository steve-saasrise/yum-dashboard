require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testRelevancy() {
  console.log('Testing relevancy system with fixed stored procedure...\n');

  // Get content to check
  const { data: contentToCheck, error } = await supabase.rpc(
    'get_content_for_relevancy_check',
    { p_limit: 10 }
  );

  if (error) {
    console.error('Error calling stored procedure:', error);
    return;
  }

  console.log(`Found ${contentToCheck?.length || 0} items to check\n`);

  if (!contentToCheck || contentToCheck.length === 0) {
    console.log('No unchecked content found');
    return;
  }

  // Process each item
  for (const item of contentToCheck.slice(0, 5)) {
    console.log(`\nChecking: ${item.content_title?.substring(0, 60)}...`);
    console.log(`  Lounge: ${item.lounge_name}`);
    console.log(`  Creator: ${item.creator_name}`);

    try {
      // Build the prompt based on lounge
      let loungeContext = '';
      if (item.lounge_name === 'SaaS' || item.lounge_name === 'AI') {
        loungeContext = `
KEEP (Score 60+):
- ANY business, technology, or professional content
- Cross-domain content (AI in SaaS, crypto ventures, etc.) is WELCOME
- Product launches, company news, industry analysis
- Technical content, engineering, development
- Marketing, sales, growth strategies
- Pricing, metrics, case studies
- Professional insights and experiences

FILTER OUT (Score <60):
- Pure motivational quotes with no business context
- Personal daily routines unrelated to work
- Birthday wishes, personal celebrations
- Generic life advice without professional context`;
      }

      const prompt = `You are a content curator. Be INCLUSIVE - when in doubt, keep the content.

LOUNGE: ${item.lounge_name}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${item.creator_name}
Content: ${item.content_description || item.content_title}

Score 0-100 based on relevance to the lounge. Be lenient - only filter obvious off-topic content.
The threshold is 60, so aim higher unless clearly off-topic.

Respond in JSON:
{
  "score": <0-100>,
  "reason": "<briefly explain relevance>"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content relevancy evaluator. Always respond in valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`  Score: ${result.score}`);
      console.log(`  Reason: ${result.reason?.substring(0, 100)}...`);

      // Update the content with the score
      const { error: updateError } = await supabase
        .from('content')
        .update({
          relevancy_score: result.score,
          relevancy_reason: result.reason,
          relevancy_checked_at: new Date().toISOString(),
        })
        .eq('id', item.content_id);

      if (updateError) {
        console.error('  Error updating score:', updateError.message);
      } else {
        console.log('  ✅ Score saved to database');
        
        // Auto-delete if score is too low
        if (result.score < 60) {
          // Check if already deleted
          const { data: existing } = await supabase
            .from('deleted_content')
            .select('id')
            .eq('platform_content_id', item.content_id)
            .single();

          if (!existing) {
            const { error: deleteError } = await supabase
              .from('deleted_content')
              .insert({
                platform_content_id: item.content_id,
                platform: 'content',
                creator_id: item.creator_id,
                deletion_reason: 'low_relevancy',
                title: item.content_title,
                url: item.content_url,
              });

            if (!deleteError) {
              console.log('  🗑️  Auto-deleted due to low relevancy');
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Error processing: ${error.message}`);
    }
  }

  // Check how many items now have scores
  const { count } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .not('relevancy_score', 'is', null);

  console.log(`\n✅ Total content with relevancy scores: ${count}`);
}

testRelevancy().catch(console.error);