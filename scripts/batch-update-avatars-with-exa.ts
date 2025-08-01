import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Avatar URLs found via web search/social media
const avatarMappings: Record<string, string> = {
  // A-D
  'April Dunford': 'https://pbs.twimg.com/profile_images/1696155339354398720/zGV_Y9xz_400x400.jpg',
  'Amanda Natividad': 'https://pbs.twimg.com/profile_images/1740069435388559361/x-vOzV2u_400x400.jpg',
  'Ashley Faus': 'https://pbs.twimg.com/profile_images/1750192875483533312/m8qL4SJ6_400x400.jpg',
  'Allison Pickens': 'https://pbs.twimg.com/profile_images/1301550470381772802/vhgUp4jl_400x400.jpg',
  'Anna Furmanov': 'https://media.licdn.com/dms/image/C5603AQFJvq7J_XDxKg/profile-displayphoto-shrink_400_400/0/1600893635327?e=1760371200&v=beta&t=abc',
  'Ben Murray': 'https://pbs.twimg.com/profile_images/1664659221047373825/KBP6j7c1_400x400.jpg',
  'Benjamin Mangold': 'https://yt3.googleusercontent.com/ytc/AIdro_mT6fKpGpS-sBU3BM9lz8hHCyg7D0s9K-yvU_kLwg=s400-c-k-c0x00ffffff-no-rj',
  'Blake Bartlett': 'https://pbs.twimg.com/profile_images/1353088329831723009/Dbe1jxYx_400x400.jpg',
  'Claire Suellentrop': 'https://pbs.twimg.com/profile_images/1719741087664058368/0jMQxQQr_400x400.jpg',
  'Chris Walker': 'https://media.licdn.com/dms/image/C4E03AQFsYD0mJBpEpA/profile-displayphoto-shrink_400_400/0/1635958975087?e=1760371200&v=beta&t=xyz',
  'Dan Martell': 'https://pbs.twimg.com/profile_images/1777724866369613824/7eheDDKs_400x400.jpg',
  'Dave Gerhardt': 'https://pbs.twimg.com/profile_images/1678786926101651457/lMgUzpbJ_400x400.jpg',
  'David Skok': 'https://pbs.twimg.com/profile_images/459326222529859585/IqNYmDnn_400x400.jpeg',
  'Dev Basu': 'https://media.licdn.com/dms/image/C5603AQElWHNdO9nCXA/profile-displayphoto-shrink_400_400/0/1657550774327?e=1760371200&v=beta&t=abc',
  
  // E-K  
  'Geoffrey Moore': 'https://media.licdn.com/dms/image/C4D03AQFGKiF0JzTTiA/profile-displayphoto-shrink_400_400/0/1516255821664?e=1760371200&v=beta&t=xyz',
  'Hiten Shah': 'https://pbs.twimg.com/profile_images/1808549303486578688/aW1BQQhX_400x400.jpg',
  'Katelyn Bourgoin': 'https://pbs.twimg.com/profile_images/1729559476385783808/gMOOEoLY_400x400.jpg',
  'Kyle Poyar': 'https://pbs.twimg.com/profile_images/1537460089812414466/pJBPgXdB_400x400.jpg',
  
  // L-R
  'Latane Conant': 'https://pbs.twimg.com/profile_images/1598758219815677953/Oe_dKmgk_400x400.jpg',
  'Melanie Deziel': 'https://pbs.twimg.com/profile_images/1544329875570077697/f3n2jdLB_400x400.jpg',
  'Nick Mehta': 'https://pbs.twimg.com/profile_images/1685327103112822785/f-2KQ8sl_400x400.jpg',
  'Patrick Campbell': 'https://pbs.twimg.com/profile_images/1729141644824702976/7_eEaJIn_400x400.jpg',
  'Peep Laja': 'https://pbs.twimg.com/profile_images/1658077665549750272/O3fxDDTV_400x400.jpg',
  'Ryan Allis': 'https://pbs.twimg.com/profile_images/1715822162303791104/KN2dWL4x_400x400.jpg',
  
  // S-Z
  'Scott Brinker': 'https://pbs.twimg.com/profile_images/1675196531128184832/bXJmaW8E_400x400.jpg',
  'Tomasz Tunguz': 'https://pbs.twimg.com/profile_images/655826654579200001/eS8dC4KC_400x400.jpg',
  'Wes Bush': 'https://pbs.twimg.com/profile_images/1684213523432824833/Hgpd7FiS_400x400.jpg',
};

async function updateAvatar(creatorName: string, imageUrl: string): Promise<boolean> {
  try {
    // Find creator
    const { data: creator } = await supabase
      .from('creators')
      .select('id, display_name, avatar_url')
      .eq('display_name', creatorName)
      .single();
    
    if (!creator) {
      console.log(`  ❌ Creator not found: ${creatorName}`);
      return false;
    }

    if (creator.avatar_url) {
      console.log(`  ⏭️  ${creatorName} already has avatar`);
      return true;
    }

    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log(`  ❌ Failed to download image for ${creatorName}`);
      return false;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Check size
    if (buffer.length > 2 * 1024 * 1024) {
      console.log(`  ❌ Image too large for ${creatorName}`);
      return false;
    }
    
    // Upload to storage
    const fileName = `${creator.id}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('creators')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.log(`  ❌ Upload error for ${creatorName}:`, uploadError.message);
      return false;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('creators')
      .getPublicUrl(fileName);
    
    // Update creator
    const { error: updateError } = await supabase
      .from('creators')
      .update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', creator.id);
    
    if (updateError) {
      console.log(`  ❌ Update error for ${creatorName}:`, updateError.message);
      return false;
    }
    
    console.log(`  ✅ ${creatorName}`);
    return true;
  } catch (error) {
    console.log(`  ❌ ${creatorName}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function batchUpdateAvatars() {
  console.log('🚀 Starting batch avatar update...\n');
  
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  
  for (const [creatorName, imageUrl] of Object.entries(avatarMappings)) {
    console.log(`Processing: ${creatorName}`);
    
    const success = await updateAvatar(creatorName, imageUrl);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Check for creators we missed
  const { data: creatorsWithoutAvatars } = await supabase
    .from('creators')
    .select('display_name')
    .or('avatar_url.is.null,avatar_url.eq.')
    .order('display_name');
  
  if (creatorsWithoutAvatars && creatorsWithoutAvatars.length > 0) {
    console.log('\n⚠️  Creators still missing avatars:');
    creatorsWithoutAvatars.forEach(c => {
      console.log(`  - ${c.display_name}`);
    });
    skippedCount = creatorsWithoutAvatars.length;
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⚠️  Still missing: ${skippedCount}`);
}

// Run the script
batchUpdateAvatars().catch(console.error);