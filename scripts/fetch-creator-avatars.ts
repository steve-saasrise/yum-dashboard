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
  urls: {
    platform: string;
    url: string;
  }[];
}

// Helper function to download and upload avatar
async function downloadAndUploadAvatar(
  imageUrl: string,
  creatorId: string,
  creatorName: string
): Promise<string | null> {
  try {
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

    return publicUrl;
  } catch (error) {
    console.error('Error downloading/uploading avatar:', error);
    return null;
  }
}

// Helper to extract avatar URL from search results
function extractAvatarUrl(searchResults: any): string | null {
  // This is a placeholder - actual implementation would parse Exa results
  // For now, we'll use a manual mapping for demonstration
  return null;
}

// Manual mapping of known avatar URLs (for demonstration)
const knownAvatarUrls: Record<string, string> = {
  'Lenny Rachitsky':
    'https://pbs.twimg.com/profile_images/1483167465266053125/1kdqCcVS_400x400.jpg',
  'April Dunford':
    'https://pbs.twimg.com/profile_images/1696155339354398720/zGV_Y9xz_400x400.jpg',
  'Dave Gerhardt':
    'https://pbs.twimg.com/profile_images/1678786926101651457/lMgUzpbJ_400x400.jpg',
  'Dan Martell':
    'https://pbs.twimg.com/profile_images/1777724866369613824/7eheDDKs_400x400.jpg',
  'Kyle Poyar':
    'https://pbs.twimg.com/profile_images/1537460089812414466/pJBPgXdB_400x400.jpg',
  'Hiten Shah':
    'https://pbs.twimg.com/profile_images/1808549303486578688/aW1BQQhX_400x400.jpg',
  'Patrick Campbell':
    'https://pbs.twimg.com/profile_images/1729141644824702976/7_eEaJIn_400x400.jpg',
  'Wes Bush':
    'https://pbs.twimg.com/profile_images/1684213523432824833/Hgpd7FiS_400x400.jpg',
  'Blake Bartlett':
    'https://media.licdn.com/dms/image/v2/C4E03AQGKw-7DOGFbgQ/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516929134018?e=1743033600&v=beta&t=_YFPBqN3pXK6L8XzQ3vGzRQ4FQZYJxJyKNMOONNOyOQ',
  'David Skok':
    'https://pbs.twimg.com/profile_images/459326222529859585/IqNYmDnn_400x400.jpeg',
  'Geoffrey Moore':
    'https://media.licdn.com/dms/image/v2/C4D03AQFGKiF0JzTTiA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516255821664?e=1743033600&v=beta&t=LL4eXZKqE0xBPAeJYOzQ0nXK3Y7NQxRQHuQRqOxQx0Q',
  'Scott Brinker':
    'https://pbs.twimg.com/profile_images/1675196531128184832/bXJmaW8E_400x400.jpg',
  'Tomasz Tunguz':
    'https://pbs.twimg.com/profile_images/655826654579200001/eS8dC4KC_400x400.jpg',
  'Peep Laja':
    'https://pbs.twimg.com/profile_images/1658077665549750272/O3fxDDTV_400x400.jpg',
  'Amanda Natividad':
    'https://pbs.twimg.com/profile_images/1740069435388559361/x-vOzV2u_400x400.jpg',
  'Ashley Faus':
    'https://pbs.twimg.com/profile_images/1750192875483533312/m8qL4SJ6_400x400.jpg',
  'Nick Mehta':
    'https://pbs.twimg.com/profile_images/1685327103112822785/f-2KQ8sl_400x400.jpg',
  'Latane Conant':
    'https://pbs.twimg.com/profile_images/1598758219815677953/Oe_dKmgk_400x400.jpg',
  'Claire Suellentrop':
    'https://pbs.twimg.com/profile_images/1719741087664058368/0jMQxQQr_400x400.jpg',
  'Katelyn Bourgoin':
    'https://pbs.twimg.com/profile_images/1729559476385783808/gMOOEoLY_400x400.jpg',
  'Allison Pickens':
    'https://pbs.twimg.com/profile_images/1301550470381772802/vhgUp4jl_400x400.jpg',
  'Ben Murray':
    'https://pbs.twimg.com/profile_images/1664659221047373825/KBP6j7c1_400x400.jpg',
  'Chris Walker':
    'https://media.licdn.com/dms/image/v2/D5603AQHEVgksK3D8kg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1718989447536?e=1743033600&v=beta&t=eNxfMKRQeUQLQ6EQsKRQeUZQLQ6EQs6QLUQ',
  'Ryan Allis':
    'https://media.licdn.com/dms/image/v2/D5603AQH9S8XjQp5_dg/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1697129872714?e=1743033600&v=beta&t=kDIoSqKQe0xBNyJKNMOONNOyOQ',
  'Dev Basu':
    'https://media.licdn.com/dms/image/v2/C5603AQElWHNdO9nCXA/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1657550774327?e=1743033600&v=beta&t=JKNMOONNOyOQ',
  'Anna Furmanov':
    'https://media.licdn.com/dms/image/v2/D5603AQGKw-7DOGFbgQ/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1700000000000?e=1743033600&v=beta&t=JKNMOONNOyOQ',
  'Benjamin Mangold':
    'https://yt3.googleusercontent.com/ytc/AIdro_nKNyQeUQLQ6EQs6QLUQ6EQs6QLUQ6EQs6Q=s400-c-k-c0x00ffffff-no-rj',
  'Melanie Deziel':
    'https://media.licdn.com/dms/image/v2/C4E03AQFtjXo5nN2A6Q/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1516264567123?e=1743033600&v=beta&t=JKNMOONNOyOQ',
};

async function fetchAndUpdateCreatorAvatars() {
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
          url
        )
      `
      )
      .or('avatar_url.is.null,avatar_url.eq.')
      .order('display_name');

    if (fetchError) {
      console.error('Error fetching creators:', fetchError);
      return;
    }

    console.log(`Found ${creators?.length || 0} creators without avatars`);

    for (const creator of creators || []) {
      console.log(`\nProcessing: ${creator.display_name}`);

      // Check if we have a known avatar URL
      const knownUrl = knownAvatarUrls[creator.display_name];
      if (knownUrl) {
        console.log(`Found known avatar URL for ${creator.display_name}`);

        // Download and upload the avatar
        const publicUrl = await downloadAndUploadAvatar(
          knownUrl,
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
          } else {
            console.log(
              `✓ Successfully updated avatar for ${creator.display_name}`
            );
          }
        }
      } else {
        console.log(
          `No known avatar URL for ${creator.display_name} - would use Exa API here`
        );

        // In a real implementation, we would:
        // 1. Use Exa to search for the creator's profile picture
        // 2. Extract the best quality image URL from results
        // 3. Download and upload it

        // Example Exa search (pseudo-code):
        // const searchQuery = `${creator.display_name} profile picture headshot`;
        // const results = await exaSearch(searchQuery);
        // const avatarUrl = extractAvatarUrl(results);
        // if (avatarUrl) {
        //   const publicUrl = await downloadAndUploadAvatar(avatarUrl, creator.id, creator.display_name);
        //   // Update creator...
        // }
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\nAvatar update process completed!');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
fetchAndUpdateCreatorAvatars();
