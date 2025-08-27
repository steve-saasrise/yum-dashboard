-- Add content_type column to creators table
-- This allows classification of creators as either 'social' or 'news' content providers

-- Create enum type for content types
CREATE TYPE content_type AS ENUM ('social', 'news');

-- Add content_type column to creators table with default value 'social'
ALTER TABLE creators 
ADD COLUMN content_type content_type DEFAULT 'social' NOT NULL;

-- Add index for faster filtering by content type
CREATE INDEX idx_creators_content_type ON creators(content_type);

-- Add comment for documentation
COMMENT ON COLUMN creators.content_type IS 'Classification of creator content as either social media or news content';