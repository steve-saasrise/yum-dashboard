-- ROLLBACK SCRIPT: Restore original state if needed
-- Run this if you need to undo the migration

-- 1. Restore user_lounges table structure
CREATE TABLE IF NOT EXISTS user_lounges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lounge_id UUID NOT NULL REFERENCES lounges(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, lounge_id)
);

-- 2. Restore user_lounges data from backup
INSERT INTO user_lounges 
SELECT * FROM user_lounges_backup
ON CONFLICT DO NOTHING;

-- 3. Add back the lounge_id column to creators table
ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS lounge_id UUID REFERENCES lounges(id) ON DELETE SET NULL;

-- 4. Restore lounge_id values from backup
UPDATE creators c
SET lounge_id = cb.lounge_id
FROM creators_backup_with_lounge cb
WHERE c.id = cb.id;

-- 5. Restore original creator_lounges state
TRUNCATE creator_lounges;
INSERT INTO creator_lounges 
SELECT * FROM creator_lounges_backup;

-- 6. Clean up backup tables (optional - keep them for safety)
-- DROP TABLE IF EXISTS creators_backup_with_lounge;
-- DROP TABLE IF EXISTS creator_lounges_backup;
-- DROP TABLE IF EXISTS user_lounges_backup;

-- 7. Verify rollback
SELECT 
    'Rollback complete' as status,
    COUNT(*) as creators_with_lounge_id
FROM creators 
WHERE lounge_id IS NOT NULL;