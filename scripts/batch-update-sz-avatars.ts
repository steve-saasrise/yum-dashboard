import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Avatar URLs found through Exa search for S-Z creators
const avatarMappings: Record<string, string> = {
  'Scott Brinker': 'https://media.licdn.com/dms/image/v2/D4E03AQGcRjpOA3ccVA/profile-displayphoto-shrink_200_200/B4EZXxaFSGHgAg-/0/1743511901710?e=2147483647&v=beta&t=17cokVG7uJYpZKNCMH18wutgF_JAWICUy_4XvfE2YKo',
  'Tomasz Tunguz': 'https://media.licdn.com/dms/image/v2/C5603AQGCc80Wc2nOpg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1568235988604?e=2147483647&v=beta&t=y4iCFNG-ZoRcsV3zvqjJP5IcqJSUYBT9VGjABsov7WI',
  'Wes Bush': 'https://media.licdn.com/dms/image/v2/D5603AQGA3mQgDPn4Ow/profile-displayphoto-shrink_200_200/B56ZRxMz03GsAc-/0/1737065971411?e=2147483647&v=beta&t=Js5P-i9FA6tEU0WJh5iyPAH6yDq_03pT4bwo0scdmFY',
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
  console.log('🚀 Starting batch avatar update for S-Z creators...\n');
  
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
}

// Run the script
batchUpdateAvatars().catch(console.error);