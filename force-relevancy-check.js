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

async function forceRelevancyCheck() {
  console.log('Running relevancy checks on last 24 hours of content...\n');
  console.log('='.repeat(80));

  // Get unchecked content from last 24 hours
  const { data: contentToCheck } = await supabase
    .from('content')
    .select(
      `
      id,
      title,
      description,
      url,
      platform,
      creator_id,
      platform_content_id,
      creators!inner(
        display_name
      )
    `
    )
    .is('relevancy_checked_at', null)
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(50);

  console.log(`Found ${contentToCheck?.length || 0} unchecked items\n`);

  if (!contentToCheck || contentToCheck.length === 0) {
    console.log('No content to check');
    return;
  }

  // Get all lounges
  const { data: lounges } = await supabase
    .from('lounges')
    .select('id, name, theme_description, relevancy_threshold')
    .eq('is_system_lounge', true);

  const results = [];
  const processedContent = new Set();

  for (const content of contentToCheck) {
    // Check against each lounge the creator belongs to
    const { data: creatorLounges } = await supabase
      .from('creator_lounges')
      .select('lounge_id')
      .eq('creator_id', content.creator_id);

    if (!creatorLounges || creatorLounges.length === 0) continue;

    for (const cl of creatorLounges) {
      const lounge = lounges.find((l) => l.id === cl.lounge_id);
      if (!lounge) continue;

      // Build lounge-specific context
      let loungeContext = '';
      if (lounge.name === 'SaaS') {
        loungeContext = `
IMPORTANT CONTEXT for SaaS Lounge:
- ANY discussion of software pricing, subscriptions, or recurring revenue IS relevant
- Tools mentioned with per-year pricing (e.g., $60k/year) are SaaS products
- GTM (Go-to-Market), CAC, LTV, churn, MRR, ARR are SaaS metrics
- Enterprise software spending, tool consolidation, and buying decisions ARE relevant
- SaaStr, Y Combinator discussions about software businesses ARE relevant
- Generic motivational content is NOT relevant unless it specifically addresses SaaS challenges`;
      }

      const prompt = `You are a curator for a specialized content lounge. Think like a subscriber who pays for focused, high-quality content.

LOUNGE: "${lounge.name}"
THEME: ${lounge.theme_description}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${content.creators.display_name}
Content: ${content.description || content.title}

EVALUATION APPROACH:
1. Would a ${lounge.name} professional/enthusiast want to read this?
2. Does it provide actionable insights, data, or valuable perspective on ${lounge.name}?
3. Consider the ENTIRE content, not just keywords
4. Industry leaders often discuss multiple topics - focus on the MAIN message
5. If it mentions specific tools, pricing, metrics, or companies in the space, it's likely relevant

SCORING GUIDE:
- 85-100: Core ${lounge.name} content with valuable insights
- 70-84: Relevant to ${lounge.name} professionals, useful information
- 50-69: Partially relevant, mentions ${lounge.name} concepts but not focused
- 30-49: Tangentially related, minimal value to ${lounge.name} audience
- 0-29: Off-topic (personal musings, generic advice, unrelated fields)

Respond in JSON:
{
  "score": <number>,
  "reason": "<explain what the content is about and why it is/isn't relevant to ${lounge.name}>"
}`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a content relevancy evaluator. Always respond in valid JSON format.',
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

        results.push({
          contentId: content.id,
          loungeId: lounge.id,
          loungeName: lounge.name,
          score: result.score,
          reason: result.reason,
          threshold: lounge.relevancy_threshold,
          title: content.title,
          creator: content.creators.display_name,
        });

        // Show progress
        if (!processedContent.has(content.id)) {
          processedContent.add(content.id);
          const emoji =
            result.score >= lounge.relevancy_threshold ? '✅' : '❌';
          console.log(
            `${emoji} [${result.score}] ${content.title.substring(0, 50)} (${lounge.name})`
          );

          if (result.score < 50) {
            console.log(`   → ${result.reason.substring(0, 100)}...`);
          }
        }
      } catch (error) {
        console.error(`Error checking ${content.title}:`, error.message);
      }
    }
  }

  // Update relevancy scores in database
  console.log('\n' + '='.repeat(80));
  console.log('Updating database...\n');

  const contentScores = new Map();
  let autoDeleteCount = 0;

  for (const result of results) {
    // Keep highest score for each content item
    const existing = contentScores.get(result.contentId);
    if (!existing || existing.score < result.score) {
      contentScores.set(result.contentId, {
        score: result.score,
        reason: result.reason,
        loungeId: result.loungeId,
        threshold: result.threshold,
      });
    }
  }

  // Update scores and auto-delete low relevancy
  for (const [contentId, data] of contentScores) {
    // Update score
    await supabase
      .from('content')
      .update({
        relevancy_score: data.score,
        relevancy_reason: data.reason,
        relevancy_checked_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    // Auto-delete if below threshold
    if (data.score < data.threshold) {
      const { data: content } = await supabase
        .from('content')
        .select('platform_content_id, platform, creator_id, title, url')
        .eq('id', contentId)
        .single();

      if (content) {
        const { error } = await supabase.from('deleted_content').insert({
          platform_content_id: content.platform_content_id,
          platform: content.platform,
          creator_id: content.creator_id,
          deleted_by: null,
          deleted_at: new Date().toISOString(),
          deletion_reason: 'low_relevancy',
          title: content.title,
          url: content.url,
        });

        if (!error) {
          autoDeleteCount++;
        }
      }
    }
  }

  // Summary
  console.log('SUMMARY:');
  console.log(`✅ Processed ${processedContent.size} unique content items`);
  console.log(`📊 Generated ${results.length} relevancy evaluations`);
  console.log(`🗑️  Auto-deleted ${autoDeleteCount} low-relevancy items`);

  // Score distribution
  const distribution = { high: 0, medium: 0, low: 0 };
  for (const [, data] of contentScores) {
    if (data.score >= 70) distribution.high++;
    else if (data.score >= 50) distribution.medium++;
    else distribution.low++;
  }

  console.log('\nScore distribution:');
  console.log(`  High (70+): ${distribution.high} items`);
  console.log(`  Medium (50-69): ${distribution.medium} items`);
  console.log(`  Low (<50): ${distribution.low} items`);
}

forceRelevancyCheck()
  .then(() => {
    console.log('\n✅ Relevancy check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
