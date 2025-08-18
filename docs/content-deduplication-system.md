# Content Deduplication System

## Overview

The content deduplication system automatically detects and manages duplicate content across platforms, preventing users from seeing the same content multiple times while allowing curators to manage duplicates. This ensures a clean feed experience without redundant content.

## How It Works

### Database Schema

The deduplication system uses three key columns in the `content` table:

```sql
-- Content table additions for deduplication
ALTER TABLE content ADD COLUMN content_hash TEXT;
ALTER TABLE content ADD COLUMN duplicate_group_id UUID;
ALTER TABLE content ADD COLUMN is_primary BOOLEAN DEFAULT true;

-- Indexes for performance
CREATE INDEX idx_content_hash ON content(content_hash);
CREATE INDEX idx_duplicate_group ON content(duplicate_group_id);
CREATE INDEX idx_is_primary ON content(is_primary);
```

- **content_hash**: SHA-256 hash of normalized content for duplicate detection
- **duplicate_group_id**: UUID that links duplicate content together in groups
- **is_primary**: Boolean flag indicating which version is shown to users (only primary content is visible to regular users)

### Detection Algorithm

#### 1. Content Fingerprinting

- Normalizes text by removing special characters and extra whitespace
- Creates a signature from the first 100 significant words
- Used for fuzzy matching on social media platforms

#### 2. Fuzzy Matching

- Uses Jaccard similarity coefficient for text comparison
- **85% similarity threshold** for near-duplicate detection
- Only applied to social media platforms (Twitter, LinkedIn, Threads)
- Helps catch cross-posted content with minor variations

#### 3. Platform Priority

When duplicates are detected, the primary content is selected based on platform priority:

1. **YouTube** (priority: 10) - Highest quality, original content
2. **Twitter** (priority: 8) - Real-time updates, high engagement
3. **LinkedIn** (priority: 7) - Professional content
4. **Threads** (priority: 6) - Meta's platform
5. **RSS/Website** (priority: 4-5) - Lowest priority

If platforms are equal, newer content becomes primary.

### Processing Flow

#### During Content Ingestion

1. **Generate Hash**: Create content hash using `generateContentHash()`
2. **Check for Duplicates**:
   - First by exact hash match
   - Then by similarity for social media (85% threshold)
3. **Assign to Group**:
   - If duplicate found: Join existing `duplicate_group_id`
   - If new: Create new group or mark as standalone
4. **Determine Primary**:
   - Use platform priority and publish date
   - Update existing primary if needed

#### Content Display

**Regular Users (Viewers)**:

- Only see primary content via `.eq('is_primary', true)` filter
- Duplicates are completely hidden from feed
- Email digests also filter to primary content only

**Privileged Users (Curators/Admins)**:

- See ALL content including duplicates
- Visual indicators for duplicate content:
  - 🔗 Blue banner: "Duplicate content: Hidden from users"
  - ✅ Green banner: "Primary version: This content represents a duplicate group"
  - Grey overlay (opacity-60) on duplicate cards
  - Undo button to override deduplication

## Implementation Components

### Backend Services

#### ContentDeduplicationService

**Location**: `/lib/services/content-deduplication.ts`

Key functions:

```typescript
// Generate content hash for deduplication
generateContentHash(content: ContentForDeduplication): string

// Find duplicates by hash
findDuplicatesByHash(contentHash: string): Promise<DuplicateInfo>

// Find similar content using fuzzy matching
findSimilarContentByCreator(
  creatorId: string,
  contentText: string,
  platform: string,
  similarityThreshold: number = 0.85
): Promise<DuplicateInfo>

// Process content for deduplication during ingestion
processContentForDeduplication(content: ContentInput): Promise<DeduplicationResult>

// Manually set primary content in a group
setPrimaryContent(duplicateGroupId: string, newPrimaryId: string): Promise<void>
```

#### API Endpoints

**Content Feed API** (`/app/api/content/route.ts`):

```typescript
// Filter duplicates for regular users (lines 232-236)
if (!isPrivilegedUser) {
  contentQuery = contentQuery.eq('is_primary', true);
}

// Include duplicate fields for privileged users (lines 528-532)
...(isPrivilegedUser && {
  content_hash: item.content_hash,
  duplicate_group_id: item.duplicate_group_id,
  is_primary: item.is_primary,
})
```

**DELETE Endpoint** (`/app/api/content?action=unduplicate`):

```typescript
// Undo duplicate detection (lines 868-880)
if (action === 'unduplicate') {
  // Set is_primary = true to show content to all users
  await supabase
    .from('content')
    .update({ is_primary: true })
    .eq('id', content_id);
}
```

#### Digest Service

**Location**: `/lib/services/digest-service.ts`

Email digests filter duplicates (lines 167, 218):

```typescript
.eq('is_primary', true) // Only show primary content in digests
```

### Frontend Components

#### ContentCard Component

**Location**: `/components/daily-news-dashboard.tsx`

Duplicate detection and display (lines 802-803):

```typescript
const isDuplicate = item.duplicate_group_id && !item.is_primary;
const isPrimary = item.is_primary === true;
```

Duplicate banners (lines 926-938):

```typescript
{isDuplicate && canDelete && (
  <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-900/20">
    <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
      🔗 Duplicate content: Hidden from users (primary version is shown instead)
    </p>
  </div>
)}
```

Undo button for duplicates (lines 1068-1091):

```typescript
{canDelete && isDuplicate && onUndoDuplicate && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 text-green-600 hover:text-green-700"
    onClick={() => onUndoDuplicate(item.id)}
  >
    <Icons.undo className="h-4 w-4" />
  </Button>
)}
```

#### IntersectionObserverGrid

**Location**: `/components/intersection-observer-grid.tsx`

Passes duplicate fields to ContentCard (lines 109-112):

```typescript
duplicate_group_id: item.duplicate_group_id === null ? undefined : item.duplicate_group_id,
is_primary: item.is_primary === null ? undefined : item.is_primary,
content_hash: item.content_hash === null ? undefined : item.content_hash,
```

#### useInfiniteContent Hook

**Location**: `/hooks/use-infinite-content.tsx`

Undo duplicate function (lines 212-237):

```typescript
const undoDuplicate = useCallback(
  async (contentId: string) => {
    const params = new URLSearchParams({
      content_id: contentId,
      action: 'unduplicate',
    });

    await fetch(`/api/content?${params.toString()}`, {
      method: 'DELETE',
    });

    toast.success('Content will now be shown to all users');
    refetch();
  },
  [refetch]
);
```

## Testing

### Test Script

**Location**: `/scripts/test-improved-deduplication.ts`

Tests the deduplication algorithm with real content:

- Fetches Taylor Swift posts from different platforms
- Calculates text similarity (97.1% for test case)
- Verifies fingerprinting and hash generation
- Updates database to group duplicates

### Running Tests

```bash
# Test the deduplication algorithm
npm run test:dedup

# Or run directly
tsx scripts/test-improved-deduplication.ts
```

### Backfill Scripts

For processing existing content:

- `/scripts/backfill-content-deduplication.ts` - Process all content
- `/scripts/backfill-recent-content-deduplication.ts` - Process last week's content

## Manual Controls

### Viewing Duplicate Groups

```sql
-- See all duplicate groups
SELECT
  duplicate_group_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(platform, ', ') as platforms,
  STRING_AGG(title, ' | ') as titles
FROM content
WHERE duplicate_group_id IS NOT NULL
GROUP BY duplicate_group_id
ORDER BY COUNT(*) DESC;
```

### Finding Undetected Duplicates

```sql
-- Find potential duplicates by similar titles
SELECT
  c1.id, c1.title, c1.platform,
  c2.id, c2.title, c2.platform
FROM content c1
JOIN content c2 ON c1.creator_id = c2.creator_id
WHERE c1.id < c2.id
  AND similarity(c1.title, c2.title) > 0.8
  AND c1.duplicate_group_id IS NULL;
```

### Manually Grouping Duplicates

```sql
-- Create a duplicate group manually
UPDATE content
SET
  duplicate_group_id = 'new-uuid-here',
  is_primary = CASE
    WHEN id = 'primary-content-id' THEN true
    ELSE false
  END
WHERE id IN ('content-id-1', 'content-id-2', 'content-id-3');
```

## Design Decisions

### Why 85% Similarity Threshold?

- Catches most cross-posted content with minor edits
- Avoids false positives from similar but distinct content
- Based on testing with real social media posts
- Can be adjusted per platform if needed

### Why Platform Priority?

- YouTube typically has the most complete content (full videos)
- Twitter/X has high engagement and real-time relevance
- RSS/Website content often lacks engagement metrics
- Ensures best version is shown to users

### Why Keep All Duplicates?

- Preserves engagement metrics from each platform
- Allows curators to override automatic decisions
- Maintains complete content history
- Enables future analytics on cross-platform performance

## Comparison with Relevancy System

Both systems follow the same pattern:

| Aspect            | Relevancy Filtering                        | Deduplication                     |
| ----------------- | ------------------------------------------ | --------------------------------- |
| **Regular Users** | Hide low-relevancy content                 | Hide duplicate content            |
| **Filter**        | `.not('relevancy_checked_at', 'is', null)` | `.eq('is_primary', true)`         |
| **Admin View**    | See all with banners                       | See all with banners              |
| **Banner Color**  | Purple (auto), Yellow (manual)             | Blue (duplicate), Green (primary) |
| **Undo Action**   | Restore deleted content                    | Set as primary                    |
| **Email Digests** | Filter by relevancy score                  | Filter to primary only            |

## Troubleshooting

### Duplicates Not Being Detected

1. Check if content has `content_hash` populated
2. Verify similarity threshold (85%) is appropriate
3. Ensure `ContentService.processContent()` runs deduplication
4. Check if platforms are in the fuzzy matching list

### Wrong Content Marked as Primary

1. Review platform priority settings
2. Check publish dates (newer wins on same platform)
3. Manually set primary using curator tools
4. Consider adjusting priority weights

### Duplicate Banners Not Showing

1. Verify user has curator/admin role
2. Check `duplicate_group_id` and `is_primary` fields are passed to frontend
3. Ensure `intersection-observer-grid.tsx` includes duplicate fields in `renderItem`
4. Confirm `canDelete` prop is true for privileged users

### Performance Issues

1. Ensure indexes exist on `content_hash`, `duplicate_group_id`, `is_primary`
2. Consider batching deduplication processing
3. Monitor similarity calculation time for large texts
4. Use database-level deduplication for exact matches

## Future Enhancements

### Potential Improvements

1. **ML-based similarity**: Use embeddings for semantic similarity
2. **Configurable thresholds**: Per-platform or per-lounge settings
3. **Duplicate analytics**: Track which platforms get most engagement
4. **Auto-merge metadata**: Combine best fields from all duplicates
5. **User preferences**: Let users choose preferred platforms
6. **Cross-creator detection**: Find duplicates across different creators
