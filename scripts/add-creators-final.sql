-- 1. Apple Machine Learning
WITH creator_1_id AS (
  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Apple Machine Learning',
    'The Research Journal for Apple on ML',
    'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)
SELECT

  gen_random_uuid(), id, 'https://machinelearning.apple.com/feed.xml', 'rss', true, NOW(), NOW() FROM creator_1_id
;

-- 2. Gary Marcus
WITH creator_2_id AS (
  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Gary Marcus',
    'Scientist, author, and serial entrepreneur; founded Robust.AI and Geometric Intelligence',
    'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)
SELECT

  gen_random_uuid(), id, 'https://twitter.com/GaryMarcus', 'twitter', true, NOW(), NOW() FROM creator_2_id
UNION ALL SELECT
  gen_random_uuid(), id, 'https://www.linkedin.com/in/gary-marcus-b6384b4', 'linkedin', false, NOW(), NOW() FROM creator_2_id
UNION ALL SELECT
  gen_random_uuid(), id, 'https://garymarcus.substack.com/feed', 'rss', false, NOW(), NOW() FROM creator_2_id
;

-- 3. Google DeepMind
WITH creator_3_id AS (
  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Google DeepMind',
    'A leading AI research lab',
    'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)
SELECT

  gen_random_uuid(), id, 'https://deepmind.com/blog/feed/basic/', 'rss', true, NOW(), NOW() FROM creator_3_id
;

-- 4. Microsoft Research
WITH creator_4_id AS (
  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Microsoft Research',
    'The AI research division of Microsoft',
    'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)
SELECT

  gen_random_uuid(), id, 'https://www.microsoft.com/en-us/research/feed/', 'rss', true, NOW(), NOW() FROM creator_4_id
;

-- 5. Nick Turley
WITH creator_5_id AS (
  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Nick Turley',
    'Head of ChatGPT from OpenAI',
    'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
    'active',
    NOW(),
    NOW()
  )
  RETURNING id
)
INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)
SELECT

  gen_random_uuid(), id, 'https://x.com/nickaturley', 'twitter', true, NOW(), NOW() FROM creator_5_id
UNION ALL SELECT
  gen_random_uuid(), id, 'https://www.linkedin.com/in/nicholasturley/', 'linkedin', false, NOW(), NOW() FROM creator_5_id
;

