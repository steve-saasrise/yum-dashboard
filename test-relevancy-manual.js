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

async function checkRelevancy() {
  // Test Dan Martell's tweets
  const items = [
    {
      content_id: 'bd0e2fbf-53a0-4e14-9017-9946a7d06b7d',
      title: 'Tweet by @danmartell',
      description:
        "Want confidence?\n\nRemind yourself of the wins you've already made\n\nThat's it.",
      lounge: 'SaaS',
      theme:
        'Content about SaaS (Software as a Service) businesses, including: SaaS business models, metrics (MRR, ARR, churn, LTV, CAC), growth strategies, B2B marketing and sales, product management, pricing strategies, customer success, startup funding, acquisitions, and software development specifically for SaaS applications.',
    },
    {
      content_id: '6fe13e81-f29f-4f7f-b77b-ba8e28408b63',
      title: 'Tweet by @danmartell',
      description:
        'Design the life you WANT or settle for the one you GET by default.',
      lounge: 'SaaS',
      theme:
        'Content about SaaS (Software as a Service) businesses, including: SaaS business models, metrics (MRR, ARR, churn, LTV, CAC), growth strategies, B2B marketing and sales, product management, pricing strategies, customer success, startup funding, acquisitions, and software development specifically for SaaS applications.',
    },
    {
      content_id: '8079a0a9-98ad-4a5c-9455-08bebd9b39ae',
      title: 'Tweet by @jasonlk',
      description:
        'Met with an exec at a Top 10 public tech company this week\n\nTo get "smart about AI", every employee gets full access to ChatGPT, Claude and Perplexity\n\nWhich is great\n\nBut how long will they spend for all 3?\n\nA rationalization is coming to AI spend.',
      lounge: 'SaaS',
      theme:
        'Content about SaaS (Software as a Service) businesses, including: SaaS business models, metrics (MRR, ARR, churn, LTV, CAC), growth strategies, B2B marketing and sales, product management, pricing strategies, customer success, startup funding, acquisitions, and software development specifically for SaaS applications.',
    },
  ];

  for (const item of items) {
    try {
      const prompt = `You are a content relevancy evaluator. Analyze if the following content is relevant to the specified theme.

Theme: "${item.lounge}"
Theme Description: ${item.theme}

Content to evaluate:
Title: ${item.title}
Description: ${item.description}

Evaluate the relevancy of this content to the theme. Consider:
1. Does the main topic align with the theme?
2. Would someone interested in this theme find this content valuable?
3. Is this content informative/educational about the theme, or just a casual mention?

Respond in JSON format:
{
  "score": <0-100, where 100 is perfectly relevant>,
  "reason": "<brief explanation of why this score was given>"
}

Be strict with scoring:
- 90-100: Directly and substantially about the theme
- 70-89: Clearly related to the theme with valuable insights
- 50-69: Somewhat related but not the main focus
- 30-49: Only tangentially related or casual mention
- 0-29: Not related to the theme`;

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

      console.log('\n---');
      console.log('Content:', item.description.substring(0, 50) + '...');
      console.log('Score:', result.score);
      console.log('Reason:', result.reason);

      // Update in database
      await supabase
        .from('content')
        .update({
          relevancy_score: result.score,
          relevancy_reason: result.reason,
          relevancy_checked_at: new Date().toISOString(),
        })
        .eq('id', item.content_id);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

checkRelevancy().then(() => {
  console.log('\nRelevancy check complete!');
  process.exit(0);
});
