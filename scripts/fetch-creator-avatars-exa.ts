import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin access
);

interface CreatorWithUrls {
  id: string;
  display_name: string;
  avatar_url: string | null;
  creator_urls: {
    platform: string;
    url: string;
    normalized_url: string;
  }[];
}

// Helper function to download and upload avatar
async function downloadAndUploadAvatar(
  imageUrl: string,
  creatorId: string,
  creatorName: string
): Promise<string | null> {
  try {
    console.log(`Downloading avatar from: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to download image: ${response.statusText}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      console.error('URL does not point to an image');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check file size (2MB limit)
    if (buffer.length > 2 * 1024 * 1024) {
      console.error('Image file too large (>2MB)');
      return null;
    }

    // Generate file name
    const fileExt = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${creatorId}-${Date.now()}.${fileExt}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('creators')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('creators').getPublicUrl(fileName);

    console.log(`✓ Avatar uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error downloading/uploading avatar:', error);
    return null;
  }
}

// Function to search for creator avatars using their social profiles
async function findCreatorAvatar(
  creator: CreatorWithUrls
): Promise<string | null> {
  console.log(`Searching for avatar: ${creator.display_name}`);

  // Priority order for platforms
  const platformPriority = ['linkedin', 'twitter', 'youtube'];

  // Sort URLs by platform priority
  const sortedUrls = creator.creator_urls.sort((a, b) => {
    const aIndex = platformPriority.indexOf(a.platform) || 999;
    const bIndex = platformPriority.indexOf(b.platform) || 999;
    return aIndex - bIndex;
  });

  // Try each platform
  for (const urlInfo of sortedUrls) {
    console.log(`  Checking ${urlInfo.platform}: ${urlInfo.url}`);

    // Here you would use Exa API to:
    // 1. Search for the profile page
    // 2. Extract the profile image URL
    // 3. Return the highest quality version

    // For demonstration, we'll construct search queries that would be used with Exa
    let searchQuery = '';

    switch (urlInfo.platform) {
      case 'linkedin':
        searchQuery = `site:linkedin.com "${creator.display_name}" profile photo`;
        break;
      case 'twitter':
        searchQuery = `site:twitter.com OR site:x.com "${creator.display_name}" profile picture`;
        break;
      case 'youtube':
        searchQuery = `site:youtube.com "${creator.display_name}" channel avatar`;
        break;
      default:
        searchQuery = `"${creator.display_name}" profile picture headshot professional`;
    }

    console.log(`  Would search Exa with: ${searchQuery}`);

    // In production, you would:
    // const results = await exaClient.search({
    //   query: searchQuery,
    //   numResults: 5,
    //   crawl: true
    // });
    //
    // Then extract image URLs from the results
    // and return the best quality one
  }

  return null;
}

// Main function to update all creator avatars
async function updateAllCreatorAvatars() {
  try {
    // Get creators without avatars
    const { data: creators, error: fetchError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        avatar_url,
        creator_urls!inner(
          platform,
          url,
          normalized_url
        )
      `
      )
      .or('avatar_url.is.null,avatar_url.eq.')
      .order('display_name');

    if (fetchError) {
      console.error('Error fetching creators:', fetchError);
      return;
    }

    console.log(`Found ${creators?.length || 0} creators without avatars\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const creator of creators || []) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Processing: ${creator.display_name}`);
      console.log(
        `URLs: ${creator.creator_urls.map((u: any) => u.platform).join(', ')}`
      );

      // Find avatar URL using Exa or other methods
      const avatarUrl = await findCreatorAvatar(creator);

      if (avatarUrl) {
        // Download and upload the avatar
        const publicUrl = await downloadAndUploadAvatar(
          avatarUrl,
          creator.id,
          creator.display_name
        );

        if (publicUrl) {
          // Update the creator's avatar_url
          const { error: updateError } = await supabase
            .from('creators')
            .update({
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', creator.id);

          if (updateError) {
            console.error(
              `Failed to update avatar for ${creator.display_name}:`,
              updateError
            );
            failureCount++;
          } else {
            console.log(
              `✓ Successfully updated avatar for ${creator.display_name}`
            );
            successCount++;
          }
        } else {
          console.log(`✗ Failed to upload avatar for ${creator.display_name}`);
          failureCount++;
        }
      } else {
        console.log(`✗ No avatar found for ${creator.display_name}`);
        failureCount++;
      }

      // Add a delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('Avatar update process completed!');
    console.log(`Success: ${successCount}`);
    console.log(`Failures: ${failureCount}`);
    console.log(`Total processed: ${creators?.length || 0}`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Export functions for use in other scripts
export { downloadAndUploadAvatar, findCreatorAvatar, updateAllCreatorAvatars };

// Run if called directly
if (require.main === module) {
  updateAllCreatorAvatars();
}
