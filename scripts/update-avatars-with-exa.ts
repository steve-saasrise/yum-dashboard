import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function updateCreatorWithExaSearch(creatorName: string) {
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

    console.log(`\n🔍 Searching for ${creatorName}...`);
    
    // This is where we'll call Exa from the main script
    return { creator, needsSearch: true };
  } catch (error) {
    console.log(`  ❌ ${creatorName}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function updateAvatar(creatorId: string, creatorName: string, imageUrl: string) {
  const publicUrl = await downloadAndUploadAvatar(imageUrl, creatorId);
  
  if (!publicUrl) {
    console.log(`  ❌ Failed to upload avatar for ${creatorName}`);
    return false;
  }

  const { error: updateError } = await supabase
    .from('creators')
    .update({ 
      avatar_url: publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', creatorId);
  
  if (updateError) {
    console.log(`  ❌ Update error for ${creatorName}:`, updateError.message);
    return false;
  }
  
  console.log(`  ✅ ${creatorName} avatar updated!`);
  return true;
}

// Export for use in main script
export { updateCreatorWithExaSearch, updateAvatar };

// If running directly
if (require.main === module) {
  console.log('Please run update-all-avatars-exa.ts instead');
}