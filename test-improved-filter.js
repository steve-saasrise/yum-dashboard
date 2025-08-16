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

// Test cases that should be handled correctly
const testCases = [
  {
    content:
      'Met with an exec at a Top 10 tech company. Everyone gets ChatGPT, Claude and Perplexity. But how long will they pay for all 3? AI spend rationalization is coming. GTM tools at $60k/year are easy to justify when replacing humans, but consolidation is inevitable.',
    creator: 'Jason Lemkin',
    expected: 'KEEP',
    reason: 'Discusses AI tools, SaaS pricing, and enterprise spending',
  },
  {
    content:
      "Want confidence? Remind yourself of the wins you've already made. That's it.",
    creator: 'Dan Martell',
    expected: 'FILTER',
    reason: 'Generic motivational quote without business context',
  },
  {
    content:
      "OpenAI just hit 300M weekly active users. The growth rate is insane - faster than any consumer app we've seen.",
    creator: 'Tech Reporter',
    expected: 'KEEP',
    reason: 'AI business metrics and growth',
  },
  {
    content: 'Happy birthday to the best team ever! 🎉',
    creator: 'CEO',
    expected: 'FILTER',
    reason: 'Personal celebration',
  },
  {
    content:
      "Just tried a 48-hour fast. Energy levels through the roof after day 1. Here's what I learned about ketosis and mental clarity...",
    creator: 'Biohacker',
    expected: 'KEEP for Biohacking',
    reason: 'Health optimization content',
  },
  {
    content:
      'The Pomodoro Technique changed my productivity. 25 min focused work, 5 min break. Simple but effective for deep work.',
    creator: 'Productivity Coach',
    expected: 'KEEP for Personal Growth',
    reason: 'Productivity system with actionable advice',
  },
];

async function testImprovedFilter() {
  console.log('Testing improved relevancy filter...\n');
  console.log('='.repeat(60));

  // Get SaaS lounge info
  const { data: saasLounge } = await supabase
    .from('lounges')
    .select('*')
    .eq('name', 'SaaS')
    .single();

  for (const test of testCases) {
    console.log(`\n📝 Testing: "${test.content.substring(0, 60)}..."`);
    console.log(`   Author: ${test.creator}`);
    console.log(`   Expected: ${test.expected}`);

    // Determine which lounge context to use
    let loungeName = 'SaaS';
    let loungeContext = '';

    if (test.expected.includes('Biohacking')) {
      loungeName = 'Biohacking';
    } else if (test.expected.includes('Personal Growth')) {
      loungeName = 'Personal Growth';
    }

    // Business/Tech lounges
    if (loungeName === 'SaaS') {
      loungeContext = `
KEEP (Score 60+):
- ANY business, technology, or professional content
- Cross-domain content (AI in SaaS, crypto ventures, etc.) is WELCOME
- Product launches, company news, industry analysis
- Technical content, engineering, development
- Marketing, sales, growth strategies
- Pricing, metrics, case studies
- Professional insights and experiences
- Even brief business observations or questions

FILTER OUT (Score <60):
- Pure motivational quotes with no business context
- Personal daily routines unrelated to work
- Birthday wishes, personal celebrations
- Generic life advice without professional context
- Political rants unrelated to tech/business
- Sports, entertainment (unless business angle)
- Vague excitement without context ("So cool!", "Amazing!")`;
    }

    const prompt = `You are a content curator. Be INCLUSIVE - when in doubt, keep the content.

LOUNGE: ${loungeName}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${test.creator}
Content: ${test.content}

Score 0-100 based on relevance to the lounge. Be lenient - only filter obvious off-topic content.
The threshold is 60, so aim higher unless clearly off-topic.

Respond in JSON:
{
  "score": <0-100>,
  "reason": "<briefly explain relevance>"
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
      const verdict = result.score >= 60 ? 'KEEP' : 'FILTER';
      const correct = verdict === test.expected.split(' ')[0];

      console.log(
        `   Result: ${verdict} (score: ${result.score}) ${correct ? '✅' : '❌'}`
      );
      console.log(`   Reason: ${result.reason.substring(0, 100)}...`);
    } catch (error) {
      console.error(`   Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!\n');
}

testImprovedFilter()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
