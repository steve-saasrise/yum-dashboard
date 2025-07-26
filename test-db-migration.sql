-- Test queries to verify migration
-- 1. List all lounges
SELECT id, name, description FROM lounges LIMIT 5;

-- 2. Check if any creators have lounges assigned
SELECT COUNT(*) as relationships FROM creator_lounges;

-- 3. List tables to confirm renames
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('lounges', 'creator_lounges', 'user_lounges', 'topics', 'creator_topics', 'user_topics');
EOF < /dev/null