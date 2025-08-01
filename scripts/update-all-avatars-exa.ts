import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import {
  updateCreatorWithExaSearch,
  updateAvatar,
} from './update-avatars-with-exa';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function searchAndUpdateCreator(creatorName: string): Promise<boolean> {
  const result = await updateCreatorWithExaSearch(creatorName);

  if (typeof result === 'boolean') {
    return result;
  }

  if (result && result.needsSearch) {
    // Use Exa to search for creator profile picture
    // We'll search for professional headshots, company websites, and media coverage
    console.log(`  🔍 Searching Exa for ${creatorName}...`);

    // This will be called from the main function with Exa
    return false; // Placeholder - will be handled by Exa search
  }

  return false;
}

async function getAllCreators() {
  const { data: creators } = await supabase
    .from('creators')
    .select('id, display_name, avatar_url')
    .order('display_name');

  return creators || [];
}

// Export for calling from main script
export { searchAndUpdateCreator, updateAvatar, getAllCreators };

// Main execution
if (require.main === module) {
  console.log('Starting Exa-powered avatar update process...');
  console.log('Use the main script to run with Exa integration.');
}
