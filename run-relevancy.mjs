#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runRelevancyChecks() {
  console.log('Fetching unscored content...');
  
  // Get unscored content
  const { data: items, error } = await supabase.rpc('get_content_for_relevancy_check', {
    p_limit: 100
  });
  
  if (error) {
    console.error('Error fetching content:', error);
    return;
  }
  
  console.log(`Found ${items?.length || 0} items to score`);
  
  if (!items || items.length === 0) {
    console.log('No items to score');
    return;
  }
  
  // Process each item
  for (const item of items) {
    console.log(`Scoring: ${item.content_title} (${item.lounge_name})`);
    
    try {
      const prompt = `You are a content curator. Score this content for relevance to the ${item.lounge_name} lounge.

Content: ${item.content_title}
${item.content_description || ''}

Score 0-100 based on relevance. Respond in JSON:
{
  "score": <0-100>,
  "reason": "<briefly explain relevance>"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a content relevancy evaluator. Always respond in valid JSON format.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Update the score
      await supabase
        .from('content')
        .update({
          relevancy_score: result.score || 75,
          relevancy_reason: result.reason || 'Scored by manual script',
          relevancy_checked_at: new Date().toISOString(),
        })
        .eq('id', item.content_id);
        
      console.log(`  → Score: ${result.score}`);
    } catch (err) {
      console.error(`  → Error scoring item:`, err.message);
    }
  }
  
  console.log('Done!');
}

runRelevancyChecks().catch(console.error);