import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Last batch of avatar URLs - using Substack and other sources
const avatarMappings: Record<string, string> = {
  // Found from Substack/other sources
  'Allison Pickens': 'https://substackcdn.com/image/fetch/w_176,h_176,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fee22aad6-a400-4124-9aa0-3e3317bdcc1f_482x482.jpeg',
  'Amanda Natividad': 'https://pbs.twimg.com/profile_images/1288939415708782592/i7R0Kd-E_400x400.jpg',
  'Anna Furmanov': 'https://substackcdn.com/image/fetch/w_176,h_176,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa7c9e17e-7d49-47c7-afce-f088b8e088e9_400x400.jpeg',
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
  console.log('🚀 Starting last batch avatar update...\n');
  
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
    console.log('\nNote: These remaining creators may require manual upload or have restricted profile images.');
  } else {
    console.log('\n🎉 All creators now have avatars!');
  }
}

// Run the script
batchUpdateAvatars().catch(console.error);