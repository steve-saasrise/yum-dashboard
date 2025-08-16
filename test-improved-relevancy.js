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

async function testImprovedRelevancy() {
  // Get a mix of content to test - both previously checked and unchecked
  const { data: testContent } = await supabase
    .from('content')
    .select(
      `
      id,
      title,
      description,
      url,
      platform,
      relevancy_score,
      relevancy_reason,
      creator_id,
      creators!inner(
        display_name
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`Testing improved relevancy on ${testContent.length} items\n`);
  console.log('='.repeat(80));

  // Get lounge info for SaaS
  const { data: saasLounge } = await supabase
    .from('lounges')
    .select('id, name, theme_description, relevancy_threshold')
    .eq('name', 'SaaS')
    .single();

  const results = [];
  let improved = 0;
  let worsened = 0;
  let unchanged = 0;

  for (const content of testContent.slice(0, 20)) {
    // Test first 20 items
    const loungeContext = `
IMPORTANT CONTEXT for SaaS Lounge:
- ANY discussion of software pricing, subscriptions, or recurring revenue IS relevant
- Tools mentioned with per-year pricing (e.g., $60k/year) are SaaS products
- GTM (Go-to-Market), CAC, LTV, churn, MRR, ARR are SaaS metrics
- Enterprise software spending, tool consolidation, and buying decisions ARE relevant
- SaaStr, Y Combinator discussions about software businesses ARE relevant
- Generic motivational content is NOT relevant unless it specifically addresses SaaS challenges

Examples of RELEVANT content:
- "We're seeing AI tools at $60k/year" → Discusses SaaS pricing
- "Tool consolidation is coming" → Enterprise SaaS buying patterns
- "Our MRR grew 50% by..." → SaaS metrics
- "How we reduced churn" → SaaS operations

Examples of IRRELEVANT content:
- "Believe in yourself" → Generic motivation
- "I woke up at 5am today" → Personal routine
- "The stock market is volatile" → General finance`;

    const prompt = `You are a curator for a specialized content lounge. Think like a subscriber who pays for focused, high-quality content.

LOUNGE: "SaaS"
THEME: ${saasLounge.theme_description}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${content.creators.display_name}
Content: ${content.description || content.title}

EVALUATION APPROACH:
1. Would a SaaS professional/enthusiast want to read this?
2. Does it provide actionable insights, data, or valuable perspective on SaaS?
3. Consider the ENTIRE content, not just keywords
4. Industry leaders often discuss multiple topics - focus on the MAIN message
5. If it mentions specific tools, pricing, metrics, or companies in the space, it's likely relevant

SCORING GUIDE:
- 85-100: Core SaaS content with valuable insights
- 70-84: Relevant to SaaS professionals, useful information
- 50-69: Partially relevant, mentions SaaS concepts but not focused
- 30-49: Tangentially related, minimal value to SaaS audience
- 0-29: Off-topic (personal musings, generic advice, unrelated fields)

Respond in JSON:
{
  "score": <number>,
  "reason": "<explain what the content is about and why it is/isn't relevant to SaaS>"
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
      const oldScore = content.relevancy_score || 0;
      const newScore = result.score;

      // Track changes
      if (oldScore > 0) {
        if (newScore > oldScore + 10) improved++;
        else if (newScore < oldScore - 10) worsened++;
        else unchanged++;
      }

      results.push({
        title: content.title.substring(0, 50),
        oldScore,
        newScore,
        change: newScore - oldScore,
        reason: result.reason,
        url: content.url,
      });

      // Show interesting cases
      if (
        Math.abs(newScore - oldScore) > 20 ||
        content.url.includes('1956486227949170805')
      ) {
        console.log(`\n📌 ${content.title}`);
        console.log(`   Author: ${content.creators.display_name}`);
        console.log(
          `   Old Score: ${oldScore} → New Score: ${newScore} (${newScore > oldScore ? '📈' : '📉'} ${Math.abs(newScore - oldScore)} points)`
        );
        console.log(`   Reason: ${result.reason.substring(0, 150)}...`);
        if (content.description) {
          console.log(
            `   Content: "${content.description.substring(0, 100)}..."`
          );
        }
      }
    } catch (error) {
      console.error(`Error evaluating ${content.title}:`, error.message);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF CHANGES:');
  console.log(`📈 Improved: ${improved} items (score increased by >10 points)`);
  console.log(`📉 Worsened: ${worsened} items (score decreased by >10 points)`);
  console.log(
    `➡️  Unchanged: ${unchanged} items (score changed by ≤10 points)`
  );

  // Show biggest changes
  console.log('\n' + '='.repeat(80));
  console.log('BIGGEST SCORE CHANGES:');
  const sorted = results.sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change)
  );
  sorted.slice(0, 5).forEach((item) => {
    console.log(`\n${item.change > 0 ? '📈' : '📉'} ${item.title}`);
    console.log(
      `   ${item.oldScore} → ${item.newScore} (${item.change > 0 ? '+' : ''}${item.change} points)`
    );
    console.log(`   ${item.reason.substring(0, 150)}...`);
  });
}

testImprovedRelevancy()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
