-- BACKUP SCRIPT: Save current state before cleanup
-- Run this to create backup tables before making changes

-- 1. Backup creators table with lounge_id
CREATE TABLE creators_backup_with_lounge AS 
SELECT * FROM creators;

-- 2. Backup creator_lounges junction table
CREATE TABLE creator_lounges_backup AS 
SELECT * FROM creator_lounges;

-- 3. Backup user_lounges table (even though it's empty)
CREATE TABLE user_lounges_backup AS 
SELECT * FROM user_lounges;

-- 4. Show creators with mismatched or missing lounge data
SELECT 
    c.id,
    c.display_name,
    c.lounge_id,
    cl.lounge_id as junction_lounge_id,
    l1.name as direct_lounge_name,
    l2.name as junction_lounge_name,
    CASE 
        WHEN cl.lounge_id IS NULL THEN 'Missing in junction - will be added'
        WHEN cl.lounge_id != c.lounge_id THEN 'Different lounge - junction table will be used'
        ELSE 'OK'
    END as action
FROM creators c
LEFT JOIN creator_lounges cl ON c.id = cl.creator_id
LEFT JOIN lounges l1 ON c.lounge_id = l1.id
LEFT JOIN lounges l2 ON cl.lounge_id = l2.id
WHERE c.lounge_id IS NOT NULL
ORDER BY action, c.display_name;

-- Count summary
SELECT 
    COUNT(*) as total_creators,
    COUNT(lounge_id) as with_lounge_id,
    COUNT(DISTINCT c.id) FILTER (WHERE cl.creator_id IS NOT NULL) as in_junction_table
FROM creators c
LEFT JOIN creator_lounges cl ON c.id = cl.creator_id;