import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  // First check if there are any creators with RSS urls
  const { data: allCreators, error: allError } = await supabase.from('creators')
    .select(`
      id,
      name,
      user_id,
      creator_urls (
        url,
        platform
      )
    `);

  console.log('All creators:', JSON.stringify(allCreators, null, 2));
  if (allError) console.error('All creators error:', allError);

  // Try the actual query from the endpoint
  const { data: rssCreators, error: rssError } = await supabase
    .from('creators')
    .select(
      `
      id,
      name,
      creator_urls!inner (
        url,
        platform
      )
    `
    )
    .eq('creator_urls.platform', 'rss');

  console.log('RSS creators:', JSON.stringify(rssCreators, null, 2));
  if (rssError) console.error('RSS creators error:', rssError);
}

test();
