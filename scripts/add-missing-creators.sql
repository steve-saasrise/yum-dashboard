-- Add missing creators to the database
-- Using the AI lounge (b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1)

-- 1. Apple Machine Learning
INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Apple Machine Learning',
  'The Research Journal for Apple on ML',
  'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
  'active',
  NOW(),
  NOW()
);

-- 2. Gary Marcus
INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Gary Marcus',
  'Scientist, author, and serial entrepreneur; founded Robust.AI and Geometric Intelligence',
  'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
  'active',
  NOW(),
  NOW()
);

-- 3. Google DeepMind
INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Google DeepMind',
  'A leading AI research lab',
  'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
  'active',
  NOW(),
  NOW()
);

-- 4. Microsoft Research
INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Microsoft Research',
  'The AI research division of Microsoft',
  'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
  'active',
  NOW(),
  NOW()
);

-- 5. Nick Turley
INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Nick Turley',
  'Head of ChatGPT from OpenAI',
  'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1',
  'active',
  NOW(),
  NOW()
);