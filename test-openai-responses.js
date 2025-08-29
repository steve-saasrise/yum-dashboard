// Test script to verify OpenAI Responses API with web search
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testResponsesAPI() {
  try {
    console.log('Testing OpenAI Responses API with web search...\n');
    
    // Test 1: Check if responses API exists
    if (client.responses && client.responses.create) {
      console.log('✅ Responses API is available in the SDK\n');
    } else {
      console.log('❌ Responses API not found in SDK\n');
      return;
    }

    // Test 2: Try to use web search
    console.log('Attempting to search for real AI news...\n');
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ 
        type: 'web_search',
        search_context_size: 'medium'
      }],
      input: 'Search for the latest news about AI and machine learning from the last 24 hours. Return 3 key developments.',
    });

    console.log('Response received:');
    console.log('================');
    console.log(response.output_text);
    console.log('\n');

    // Check for citations
    if (response.content && response.content[0] && response.content[0].annotations) {
      console.log('Citations found:');
      response.content[0].annotations.forEach((ann, i) => {
        if (ann.type === 'url_citation') {
          console.log(`${i + 1}. ${ann.title || 'Source'}: ${ann.url}`);
        }
      });
    } else {
      console.log('No citations found in response');
    }

  } catch (error) {
    console.error('Error testing Responses API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testResponsesAPI();