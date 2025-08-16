import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '../lib/services/relevancy-service';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testQuoteTweetRelevancy() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('Relevancy service not configured');
    process.exit(1);
  }

  // Find a quote tweet in the database
  const { data: quoteTweets, error } = await supabase
    .from('content')
    .select(
      `
      *,
      creators!inner(id, display_name)
    `
    )
    .eq('reference_type', 'quote')
    .not('referenced_content', 'is', null)
    .limit(5);

  if (error) {
    console.error('Error fetching quote tweets:', error);
    process.exit(1);
  }

  // Always run mock tests first
  if (true) {
    console.log('Testing with mock quote tweet examples:');

    // Create a mock quote tweet for testing
    console.log('\nTesting with mock quote tweet examples:');

    // Example 1: Author says something personal but quotes SaaS content
    const mockItem1 = {
      content_id: 'mock-1',
      lounge_id: 'saas-lounge',
      lounge_name: 'SaaS',
      theme_description: 'Software as a Service businesses and strategies',
      content_title: 'Tweet by @testuser',
      content_description: 'Love this approach! 🎉',
      content_url: 'https://twitter.com/test',
      creator_name: 'Test User',
      reference_type: 'quote',
      referenced_content: {
        text: 'We just crossed $10M ARR by focusing on enterprise customers. Key was reducing churn from 5% to 2% monthly.',
        author: { username: 'saasfounder' },
      },
    };

    console.log('\n--- Test 1: Personal comment + SaaS quote ---');
    console.log('Author comment:', mockItem1.content_description);
    console.log('Quoted content:', mockItem1.referenced_content.text);

    // @ts-ignore - accessing private method
    const result1 = await relevancyService.checkSingleItem(mockItem1);
    console.log(`Score: ${result1.score}/100`);
    console.log(`Reason: ${result1.reason}`);
    console.log(`Would be deleted: ${result1.score < 60 ? 'YES ❌' : 'NO ✅'}`);

    // Example 2: SaaS commentary on non-SaaS content
    const mockItem2 = {
      content_id: 'mock-2',
      lounge_id: 'saas-lounge',
      lounge_name: 'SaaS',
      theme_description: 'Software as a Service businesses and strategies',
      content_title: 'Tweet by @testuser',
      content_description:
        'This is exactly how we think about customer retention in our SaaS product',
      content_url: 'https://twitter.com/test',
      creator_name: 'Test User',
      reference_type: 'quote',
      referenced_content: {
        text: 'The key to any relationship is consistency and showing up every day',
        author: { username: 'lifecoach' },
      },
    };

    console.log('\n--- Test 2: SaaS comment + generic quote ---');
    console.log('Author comment:', mockItem2.content_description);
    console.log('Quoted content:', mockItem2.referenced_content.text);

    // @ts-ignore - accessing private method
    const result2 = await relevancyService.checkSingleItem(mockItem2);
    console.log(`Score: ${result2.score}/100`);
    console.log(`Reason: ${result2.reason}`);
    console.log(`Would be deleted: ${result2.score < 60 ? 'YES ❌' : 'NO ✅'}`);

    // Example 3: Both personal/off-topic
    const mockItem3 = {
      content_id: 'mock-3',
      lounge_id: 'saas-lounge',
      lounge_name: 'SaaS',
      theme_description: 'Software as a Service businesses and strategies',
      content_title: 'Tweet by @testuser',
      content_description: 'So true! 😂',
      content_url: 'https://twitter.com/test',
      creator_name: 'Test User',
      reference_type: 'quote',
      referenced_content: {
        text: 'I am "still uses the phrase heebie-jeebies" years old.',
        author: { username: 'dharmesh' },
      },
    };

    console.log('\n--- Test 3: Personal comment + personal quote ---');
    console.log('Author comment:', mockItem3.content_description);
    console.log('Quoted content:', mockItem3.referenced_content.text);

    // @ts-ignore - accessing private method
    const result3 = await relevancyService.checkSingleItem(mockItem3);
    console.log(`Score: ${result3.score}/100`);
    console.log(`Reason: ${result3.reason}`);
    console.log(`Would be deleted: ${result3.score < 60 ? 'YES ❌' : 'NO ✅'}`);
  } else if (quoteTweets && quoteTweets.length > 0) {
    console.log(`Found ${quoteTweets.length} quote tweets in database\n`);

    for (const tweet of quoteTweets!) {
      // Get the lounge info
      const { data: loungeData } = await supabase
        .from('creator_lounges')
        .select('lounges!inner(id, name, theme_description)')
        .eq('creator_id', tweet.creators.id)
        .single();

      if (!loungeData) continue;

      const lounge = (loungeData as any).lounges;

      const testItem = {
        content_id: tweet.id,
        lounge_id: lounge.id,
        lounge_name: lounge.name,
        theme_description: lounge.theme_description,
        content_title: tweet.title,
        content_description: tweet.description,
        content_url: tweet.url,
        creator_name: tweet.creators.display_name,
        reference_type: tweet.reference_type,
        referenced_content: tweet.referenced_content,
      };

      console.log('--- Quote Tweet ---');
      console.log(`Creator: ${testItem.creator_name}`);
      console.log(`Lounge: ${testItem.lounge_name}`);
      console.log(`Author comment: "${testItem.content_description}"`);

      if (testItem.referenced_content) {
        console.log(
          `Quoted content: "${testItem.referenced_content.text || testItem.referenced_content.description || 'N/A'}"`
        );
        if (testItem.referenced_content.author?.username) {
          console.log(
            `Quoted author: @${testItem.referenced_content.author.username}`
          );
        }
      }

      // @ts-ignore - accessing private method
      const result = await relevancyService.checkSingleItem(testItem);

      console.log(`\nScore: ${result.score}/100`);
      console.log(`Reason: ${result.reason}`);
      console.log(
        `Would be deleted: ${result.score < 60 ? 'YES ❌' : 'NO ✅'}\n`
      );
      console.log('---\n');
    }
  }

  console.log('✅ Quote tweet relevancy testing complete');
  process.exit(0);
}

testQuoteTweetRelevancy().catch(console.error);
