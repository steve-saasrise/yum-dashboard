-- MIGRATION SCRIPT: Clean up database structure
-- Run AFTER backup script

-- 1. First, add missing creators to junction table (those with lounge_id but not in junction)
INSERT INTO creator_lounges (creator_id, lounge_id, created_at)
SELECT 
    c.id,
    c.lounge_id,
    NOW()
FROM creators c
WHERE c.lounge_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM creator_lounges cl 
    WHERE cl.creator_id = c.id
  );

-- 2. Show what will be kept (junction table is source of truth)
SELECT 
    c.id,
    c.display_name,
    string_agg(l.name, ', ' ORDER BY l.name) as lounges_after_migration
FROM creators c
LEFT JOIN creator_lounges cl ON c.id = cl.creator_id
LEFT JOIN lounges l ON cl.lounge_id = l.id
GROUP BY c.id, c.display_name
HAVING COUNT(cl.lounge_id) > 0
ORDER BY c.display_name;

-- 3. Drop the redundant lounge_id column from creators table
ALTER TABLE creators DROP COLUMN IF EXISTS lounge_id;

-- 4. Drop the unused user_lounges table
DROP TABLE IF EXISTS user_lounges;

-- 5. Verify the migration
SELECT 
    'Tables after migration:' as info,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('creators', 'lounges', 'creator_lounges', 'user_lounges')
ORDER BY table_name;

-- 6. Show creator-lounge relationships
SELECT 
    COUNT(DISTINCT creator_id) as creators_with_lounges,
    COUNT(*) as total_relationships
FROM creator_lounges;