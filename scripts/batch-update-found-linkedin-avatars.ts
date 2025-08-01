import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// LinkedIn avatar URLs found through search
const avatarMappings: Record<string, string> = {
  'April Dunford': 'https://media.licdn.com/dms/image/v2/D5603AQH5md87CyynIw/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1679929667218?e=2147483647&v=beta&t=MkVr47X14z0uzor2-_Lm67LAzuNYZnHX_HzLIJBrwu8',
  'Allison Pickens': 'https://media.licdn.com/dms/image/v2/D4E03AQEKhfe4XoSKWQ/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1690595284683?e=2147483647&v=beta&t=HBBgYFi2aP56X4KJc01toHobVayZx342SF1ixg7srIs',
  'Ashley Faus': 'https://www.digitalmarketing-conference.com/northamerica/wp-content/uploads/2021/01/ashleyfaus_headshot.jpg',
  'Benjamin Mangold': 'https://media.licdn.com/dms/image/v2/C4E03AQGz5PMI23itZg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1517704189632?e=2147483647&v=beta&t=B8Vnzy0dJYn_Ogn2ZdAiChzp7DLTFFYxunhIoUK2-NM',
  'Ben Murray': 'https://www.thesaascfo.com/wp-content/uploads/2024/01/Murray-Headshot-150x150.png',
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
  console.log('🚀 Starting batch avatar update for LinkedIn-found creators...\n');
  
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