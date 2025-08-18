// Test script to verify referenced content is included in digests
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testReferencedContent() {
  console.log('Testing referenced content in digests...\n');

  // Get a sample of content with referenced content
  const { data, error } = await supabase
    .from('content')
    .select(
      `
      id,
      title,
      description,
      content_body,
      reference_type,
      referenced_content,
      platform,
      creators!inner(
        display_name
      )
    `
    )
    .not('reference_type', 'is', null)
    .not('referenced_content', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching content:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} posts with referenced content:\n`);

  data?.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.creators.display_name} (${item.platform})`
    );
    console.log(`   Type: ${item.reference_type}`);
    console.log(
      `   Main content: "${item.content_body?.substring(0, 50) || 'N/A'}..."`
    );

    if (item.referenced_content) {
      const ref = item.referenced_content;
      console.log(
        `   Referenced author: ${ref.author?.name || ref.author?.username || 'Unknown'}`
      );
      console.log(
        `   Referenced text: "${ref.text?.substring(0, 100) || 'N/A'}..."`
      );
      if (ref.media_urls?.length > 0) {
        console.log(`   Has ${ref.media_urls.length} media item(s)`);
      }
    }
    console.log('');
  });

  // Test that short content with references would be included
  const { data: shortContent, error: shortError } = await supabase
    .from('content')
    .select(
      `
      id,
      content_body,
      reference_type,
      referenced_content
    `
    )
    .lt('length(content_body)', 50)
    .not('reference_type', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3);

  if (!shortError && shortContent?.length > 0) {
    console.log(
      '\nShort posts with referenced content (these should show context):'
    );
    shortContent.forEach((item) => {
      console.log(
        `- "${item.content_body || '[empty]'}" -> ${item.reference_type} with ${item.referenced_content ? 'content' : 'no content'}`
      );
    });
  }
}

testReferencedContent();
