import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateCreatorAvatar(creatorName: string, imageUrl: string) {
  try {
    // Find creator
    const { data: creator } = await supabase
      .from('creators')
      .select('id, display_name')
      .eq('display_name', creatorName)
      .single();
    
    if (!creator) {
      console.log('❌ Creator not found:', creatorName);
      return false;
    }

    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.log('❌ Failed to download image for', creatorName);
      return false;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Upload to storage
    const fileName = `${creator.id}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('creators')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.log('❌ Upload error for', creatorName, uploadError.message);
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
      console.log('❌ Update error for', creatorName, updateError.message);
      return false;
    }
    
    console.log('✅', creatorName);
    return true;
  } catch (error) {
    console.log('❌', creatorName, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// If running directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 2) {
    updateCreatorAvatar(args[0], args[1]).then(() => process.exit(0));
  } else {
    console.log('Usage: tsx update-single-avatar.ts "Creator Name" "Image URL"');
    process.exit(1);
  }
}