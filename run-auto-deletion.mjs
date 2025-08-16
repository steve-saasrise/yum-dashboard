#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAutoDeletion() {
  console.log('Running auto-deletion logic with fixed multi-lounge handling...\n');
  
  // Get all content with scores and their lounge associations
  const { data: contentWithLounges, error: fetchError } = await supabase.rpc('get_content_with_lounge_thresholds');
  
  if (fetchError) {
    // Fallback to manual query if function doesn't exist
    const { data: contentData, error } = await supabase
      .from('content')
      .select(`
        id,
        platform_content_id,
        platform,
        creator_id,
        title,
        url,
        relevancy_score,
        creators!inner(
          id,
          creator_lounges!inner(
            lounge_id,
            lounges!inner(
              id,
              name,
              relevancy_threshold
            )
          )
        )
      `)
      .not('relevancy_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('Error fetching content:', error);
      return;
    }
    
    // Process the content
    let deletedCount = 0;
    let keptCount = 0;
    let alreadyDeletedCount = 0;
    
    for (const content of contentData || []) {
      // Get all lounges this content belongs to
      const lounges = content.creators?.creator_lounges?.map(cl => ({
        id: cl.lounges.id,
        name: cl.lounges.name,
        threshold: cl.lounges.relevancy_threshold || 60
      })) || [];
      
      // Check if content should be deleted
      // Only delete if score is below threshold for ALL lounges
      let shouldDelete = lounges.length > 0;
      let failedLounges = [];
      let passedLounges = [];
      
      for (const lounge of lounges) {
        if (content.relevancy_score >= lounge.threshold) {
          shouldDelete = false;
          passedLounges.push(`${lounge.name}(${content.relevancy_score}≥${lounge.threshold})`);
        } else {
          failedLounges.push(`${lounge.name}(${content.relevancy_score}<${lounge.threshold})`);
        }
      }
      
      if (shouldDelete && failedLounges.length > 0) {
        // Check if already deleted
        const { data: existing } = await supabase
          .from('deleted_content')
          .select('id')
          .eq('platform_content_id', content.platform_content_id)
          .eq('platform', content.platform)
          .eq('creator_id', content.creator_id)
          .single();
        
        if (existing) {
          alreadyDeletedCount++;
        } else {
          // Insert into deleted_content
          const { error: deleteError } = await supabase
            .from('deleted_content')
            .insert({
              platform_content_id: content.platform_content_id,
              platform: content.platform,
              creator_id: content.creator_id,
              deleted_by: null,
              deleted_at: new Date().toISOString(),
              deletion_reason: 'low_relevancy',
              title: content.title,
              url: content.url
            });
          
          if (deleteError) {
            console.error(`Error deleting ${content.id}:`, deleteError.message);
          } else {
            deletedCount++;
            console.log(`✗ Deleted: "${content.title?.substring(0, 50)}..." Score: ${content.relevancy_score} Failed: [${failedLounges.join(', ')}]`);
          }
        }
      } else if (passedLounges.length > 0) {
        // Check if this was incorrectly deleted before
        const { data: wasDeleted } = await supabase
          .from('deleted_content')
          .select('id, deletion_reason')
          .eq('platform_content_id', content.platform_content_id)
          .eq('platform', content.platform)
          .eq('creator_id', content.creator_id)
          .eq('deletion_reason', 'low_relevancy')
          .single();
        
        if (wasDeleted) {
          // Remove from deleted_content since it passes at least one threshold
          const { error: restoreError } = await supabase
            .from('deleted_content')
            .delete()
            .eq('id', wasDeleted.id);
          
          if (!restoreError) {
            console.log(`✓ Restored: "${content.title?.substring(0, 50)}..." Score: ${content.relevancy_score} Passed: [${passedLounges.join(', ')}]`);
            keptCount++;
          }
        } else {
          keptCount++;
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Newly deleted: ${deletedCount}`);
    console.log(`Already deleted: ${alreadyDeletedCount}`);
    console.log(`Kept/Restored: ${keptCount}`);
    console.log(`Total processed: ${contentData?.length || 0}`);
  }
}

runAutoDeletion().catch(console.error);