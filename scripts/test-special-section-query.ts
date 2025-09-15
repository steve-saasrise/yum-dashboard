import { getNewsDataService } from '../lib/services/newsdata-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testSpecialSectionQuery() {
  const newsDataService = getNewsDataService();
  
  console.log('Testing special section query for SaaS...\n');
  
  // Test the special section query
  const specialQuery = 'SaaS funding OR SaaS acquisition OR SaaS merger OR Series A OR Series B OR Series C';
  
  console.log('Query:', specialQuery);
  console.log('Fetching...\n');
  
  try {
    const response = await newsDataService.fetchNewsByQuery(
      specialQuery,
      {
        size: 10,
        language: 'en',
        category: ['business', 'technology'],
      }
    );
    
    console.log(`Found ${response.results.length} articles\n`);
    
    // Display first 5 articles
    response.results.slice(0, 5).forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   Source: ${article.source_name || article.source_id}`);
      console.log(`   Priority: ${article.source_priority || 'N/A'}`);
      console.log(`   Categories: ${article.category?.join(', ') || 'N/A'}`);
      console.log(`   Description: ${article.description?.substring(0, 150)}...`);
      console.log('');
    });
    
    // Check for funding-related content
    const fundingArticles = response.results.filter(article => {
      const text = `${article.title} ${article.description} ${article.content}`.toLowerCase();
      return text.includes('funding') || 
             text.includes('series') || 
             text.includes('raised') || 
             text.includes('acquisition') ||
             text.includes('merger') ||
             text.includes('million') ||
             text.includes('billion');
    });
    
    console.log(`\nArticles with funding keywords: ${fundingArticles.length}/${response.results.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSpecialSectionQuery().catch(console.error);