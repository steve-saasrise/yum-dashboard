import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin access
);

// Demo: Update Lenny Rachitsky's avatar
async function updateLennyAvatar() {
  const creatorName = 'Lenny Rachitsky';
  const avatarUrl =
    'https://media.muckrack.com/profile/images/6959312/lenny-rachitsky.jpeg.256x256_q100_crop-smart.jpg';

  try {
    // Find Lenny's creator ID
    const { data: creator, error: findError } = await supabase
      .from('creators')
      .select('id, display_name, avatar_url')
      .eq('display_name', creatorName)
      .single();

    if (findError || !creator) {
      console.error('Creator not found:', findError);
      return;
    }

    console.log(`Found creator: ${creator.display_name} (ID: ${creator.id})`);
    console.log(`Current avatar: ${creator.avatar_url || 'None'}`);

    // Download the image
    console.log(`\nDownloading avatar from: ${avatarUrl}`);
    const response = await fetch(avatarUrl);

    if (!response.ok) {
      console.error('Failed to download image:', response.statusText);
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Downloaded ${buffer.length} bytes`);

    // Generate file name
    const fileExt = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${creator.id}-${Date.now()}.${fileExt}`;

    // Upload to Supabase storage
    console.log(`\nUploading to storage as: ${fileName}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('creators')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('creators').getPublicUrl(fileName);

    console.log(`Upload successful! Public URL: ${publicUrl}`);

    // Update creator's avatar_url
    const { error: updateError } = await supabase
      .from('creators')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', creator.id);

    if (updateError) {
      console.error('Failed to update creator:', updateError);
      return;
    }

    console.log(`\n✓ Successfully updated ${creatorName}'s avatar!`);
    console.log(`Avatar URL: ${publicUrl}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the demo
updateLennyAvatar();
