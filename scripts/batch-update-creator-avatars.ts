import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Known avatar mappings for popular creators (fallback)
const knownAvatars: Record<string, string> = {
  'April Dunford': 'https://pbs.twimg.com/profile_images/1696155339354398720/zGV_Y9xz_400x400.jpg',
  'Dave Gerhardt': 'https://pbs.twimg.com/profile_images/1678786926101651457/lMgUzpbJ_400x400.jpg',
  'Dan Martell': 'https://pbs.twimg.com/profile_images/1777724866369613824/7eheDDKs_400x400.jpg',
  'Kyle Poyar': 'https://pbs.twimg.com/profile_images/1537460089812414466/pJBPgXdB_400x400.jpg',
  'Hiten Shah': 'https://pbs.twimg.com/profile_images/1808549303486578688/aW1BQQhX_400x400.jpg',
  'Patrick Campbell': 'https://pbs.twimg.com/profile_images/1729141644824702976/7_eEaJIn_400x400.jpg',
  'Wes Bush': 'https://pbs.twimg.com/profile_images/1684213523432824833/Hgpd7FiS_400x400.jpg',
  'Blake Bartlett': 'https://media.licdn.com/dms/image/v2/C4E03AQGKw-7DOGFbgQ/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516929134018',
  'David Skok': 'https://pbs.twimg.com/profile_images/459326222529859585/IqNYmDnn_400x400.jpeg',
  'Geoffrey Moore': 'https://media.licdn.com/dms/image/v2/C4D03AQFGKiF0JzTTiA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516255821664',
  'Scott Brinker': 'https://pbs.twimg.com/profile_images/1675196531128184832/bXJmaW8E_400x400.jpg',
  'Tomasz Tunguz': 'https://pbs.twimg.com/profile_images/655826654579200001/eS8dC4KC_400x400.jpg',
  'Peep Laja': 'https://pbs.twimg.com/profile_images/1658077665549750272/O3fxDDTV_400x400.jpg',
  'Amanda Natividad': 'https://pbs.twimg.com/profile_images/1740069435388559361/x-vOzV2u_400x400.jpg',
  'Ashley Faus': 'https://pbs.twimg.com/profile_images/1750192875483533312/m8qL4SJ6_400x400.jpg',
  'Nick Mehta': 'https://pbs.twimg.com/profile_images/1685327103112822785/f-2KQ8sl_400x400.jpg',
  'Latane Conant': 'https://pbs.twimg.com/profile_images/1598758219815677953/Oe_dKmgk_400x400.jpg',
  'Claire Suellentrop': 'https://pbs.twimg.com/profile_images/1719741087664058368/0jMQxQQr_400x400.jpg',
  'Katelyn Bourgoin': 'https://pbs.twimg.com/profile_images/1729559476385783808/gMOOEoLY_400x400.jpg',
  'Allison Pickens': 'https://pbs.twimg.com/profile_images/1301550470381772802/vhgUp4jl_400x400.jpg',
  'Ben Murray': 'https://pbs.twimg.com/profile_images/1664659221047373825/KBP6j7c1_400x400.jpg',
};

async function downloadAndUploadAvatar(
  imageUrl: string,
  creatorId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check size
    if (buffer.length > 2 * 1024 * 1024) {
      console.log('  ⚠️  Image too large, skipping');
      return null;
    }

    const fileExt = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${creatorId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('creators')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.log('  ❌ Upload error:', uploadError.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('creators')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.log('  ❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function updateCreatorAvatars() {
  console.log('🚀 Starting batch avatar update...\n');

  // Get all creators without avatars
  const { data: creators, error } = await supabase
    .from('creators')
    .select('id, display_name, avatar_url')
    .or('avatar_url.is.null,avatar_url.eq.')
    .order('display_name');

  if (error || !creators) {
    console.error('Failed to fetch creators:', error);
    return;
  }

  console.log(`Found ${creators.length} creators without avatars\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const creator of creators) {
    console.log(`📸 Processing: ${creator.display_name}`);

    // Check if we have a known avatar URL
    const knownUrl = knownAvatars[creator.display_name];
    
    if (knownUrl) {
      console.log(`  ✓ Found known avatar URL`);
      const publicUrl = await downloadAndUploadAvatar(knownUrl, creator.id);
      
      if (publicUrl) {
        const { error: updateError } = await supabase
          .from('creators')
          .update({ 
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', creator.id);

        if (!updateError) {
          console.log(`  ✅ Avatar updated successfully!\n`);
          successCount++;
        } else {
          console.log(`  ❌ Failed to update database\n`);
          failCount++;
        }
      } else {
        console.log(`  ❌ Failed to upload avatar\n`);
        failCount++;
      }
    } else {
      console.log(`  ⏭️  No known avatar URL (would use Exa API here)\n`);
      skipCount++;
      
      // In production, you would use Exa here:
      // const searchQuery = `"${creator.display_name}" profile picture site:twitter.com OR site:linkedin.com`;
      // const results = await exaClient.search({ query: searchQuery, numResults: 3 });
      // // Extract and process avatar URL from results...
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📝 Total: ${creators.length}`);
}

// Run the script
updateCreatorAvatars().catch(console.error);