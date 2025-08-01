import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Additional avatar URLs found through Exa search
const avatarMappings: Record<string, string> = {
  // A-D creators
  'Amanda Natividad': 'https://media.licdn.com/dms/image/v2/D5603AQGJc78D5Vx3GA/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1699910875125?e=2147483647&v=beta&t=NcMQgxWILxBEcwJ9OvIOobF-zZ-zqxOGUvdTflm2Mxc',
  'Dave Gerhardt': 'https://davegerhardt.com/hs-fs/hubfs/DG%20Smiling.png?width=1818&height=2331&name=DG%20Smiling.png',
  'Dan Martell': 'https://media.licdn.com/dms/image/v2/D5603AQHXr4QFmG8jOw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1730237361082?e=2147483647&v=beta&t=BWWnMiS-E1DViV1WcDmZ0zqxIMg__6hm-NAxc0gN_QA',
  'Blake Bartlett': 'https://openviewpartners.com/wp-content/uploads/2016/03/Team-Member-Featured-Image-Header_Blake-Bartlett_2023.png',
  'David Skok': 'https://media.licdn.com/dms/image/v2/C4E03AQFwEbF2AUB-sw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1609890698410?e=2147483647&v=beta&t=UcoolXybtlsq27dX7QgJY8jbQloCfKogZyIDGjaDvjc',
  
  // Failed ones to retry with better URLs
  'Nick Mehta': 'https://pbs.twimg.com/profile_images/1685327103112822785/f-2KQ8sl_400x400.jpg',
  'Peep Laja': 'https://pbs.twimg.com/profile_images/1658077665549750272/O3fxDDTV_400x400.jpg',
  'Wes Bush': 'https://media.licdn.com/dms/image/v2/D5603AQGA3mQgDPn4Ow/profile-displayphoto-shrink_200_200/B56ZRxMz03GsAc-/0/1737065971411?e=2147483647&v=beta&t=Js5P-i9FA6tEU0WJh5iyPAH6yDq_03pT4bwo0scdmFY',
  'Katelyn Bourgoin': 'https://media.licdn.com/dms/image/v2/D5603AQE7wZrGEQ_Otg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1728654161419?e=2147483647&v=beta&t=s8NCIUrOB7y69yUQ3a_0WRo-kJsgjrjEuH22SDUqQ5c',
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

    if (buffer.length > 2 * 1024 * 1024) {
      console.log('  ⚠️  Image too large, skipping');
      return null;
    }

    const fileExt = contentType.split('/')[1].replace('jpeg', 'jpg').replace('png', 'png');
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

    // Download and upload image
    const publicUrl = await downloadAndUploadAvatar(imageUrl, creator.id);
    
    if (!publicUrl) {
      console.log(`  ❌ Failed to upload avatar for ${creatorName}`);
      return false;
    }

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
    
    console.log(`  ✅ ${creatorName} avatar updated!`);
    return true;
  } catch (error) {
    console.log(`  ❌ ${creatorName}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function batchUpdateAvatars() {
  console.log('🚀 Starting batch avatar update for remaining creators...\n');
  
  let successCount = 0;
  let failureCount = 0;
  
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
  
  console.log('\n📊 Summary:');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  
  // Check final status
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
  }
}

// Run the script
batchUpdateAvatars().catch(console.error);