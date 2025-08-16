require('dotenv').config({ path: '.env.local' });

async function checkTodaysContent() {
  const API_URL = 'http://localhost:3000/api/test-relevancy';

  console.log("Checking relevancy for today's content...\n");
  console.log('='.repeat(60));

  try {
    // Run multiple batches
    for (let i = 0; i < 5; i++) {
      console.log(`\nRunning batch ${i + 1}/5...`);

      const response = await fetch(API_URL);
      const data = await response.json();

      if (data.success) {
        console.log(`✓ Processed ${data.results.processed} items`);

        if (data.examples && data.examples.length > 0) {
          console.log('Recent evaluations:');
          data.examples.forEach((ex) => {
            const score = parseFloat(ex.relevancy_score);
            const emoji = score >= 70 ? '✅' : score >= 50 ? '⚠️' : '❌';
            console.log(`  ${emoji} [${score}] ${ex.title}`);
          });
        }
      } else {
        console.log('❌ Error:', data.error);
      }

      // Wait between batches
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log('\n' + '='.repeat(60));
    console.log("✅ Completed relevancy checks for today's content");
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTodaysContent();
