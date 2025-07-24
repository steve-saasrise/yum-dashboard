-- Migration: Add AI summary fields to content table
-- Description: Adds fields for storing AI-generated summaries with dual lengths, metadata tracking, and status management

-- Create enum for summary status if it doesn't exist
DO $$ BEGIN
    CREATE TYPE summary_status AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add AI summary columns to content table
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS ai_summary_short TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_long TEXT,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS summary_model VARCHAR(50),
ADD COLUMN IF NOT EXISTS summary_status summary_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS summary_error_message TEXT,
ADD COLUMN IF NOT EXISTS summary_word_count_short INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS summary_word_count_long INTEGER DEFAULT 0;

-- Add check constraints for summary word counts
ALTER TABLE public.content
ADD CONSTRAINT check_summary_short_word_count CHECK (summary_word_count_short <= 30),
ADD CONSTRAINT check_summary_long_word_count CHECK (summary_word_count_long <= 100);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_summary_status ON public.content(summary_status);
CREATE INDEX IF NOT EXISTS idx_content_summary_generated_at ON public.content(summary_generated_at);
CREATE INDEX IF NOT EXISTS idx_content_summary_status_created ON public.content(summary_status, created_at) 
WHERE summary_status = 'pending';

-- Add comment to table documenting the new fields
COMMENT ON COLUMN public.content.ai_summary_short IS 'AI-generated summary of 30 words or less for quick scanning';
COMMENT ON COLUMN public.content.ai_summary_long IS 'AI-generated summary of 100 words or less for detailed overview';
COMMENT ON COLUMN public.content.summary_generated_at IS 'Timestamp when summaries were generated';
COMMENT ON COLUMN public.content.summary_model IS 'AI model used for summary generation (e.g., gpt-4, claude-3)';
COMMENT ON COLUMN public.content.summary_status IS 'Current status of summary generation';
COMMENT ON COLUMN public.content.summary_error_message IS 'Error message if summary generation failed';
COMMENT ON COLUMN public.content.summary_word_count_short IS 'Word count of the short summary';
COMMENT ON COLUMN public.content.summary_word_count_long IS 'Word count of the long summary';

-- Create a function to automatically update summary word counts
CREATE OR REPLACE FUNCTION update_summary_word_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update short summary word count
    IF NEW.ai_summary_short IS NOT NULL THEN
        NEW.summary_word_count_short := array_length(string_to_array(trim(NEW.ai_summary_short), ' '), 1);
    ELSE
        NEW.summary_word_count_short := 0;
    END IF;
    
    -- Update long summary word count
    IF NEW.ai_summary_long IS NOT NULL THEN
        NEW.summary_word_count_long := array_length(string_to_array(trim(NEW.ai_summary_long), ' '), 1);
    ELSE
        NEW.summary_word_count_long := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update word counts when summaries are modified
CREATE TRIGGER update_content_summary_word_counts
BEFORE INSERT OR UPDATE OF ai_summary_short, ai_summary_long ON public.content
FOR EACH ROW
EXECUTE FUNCTION update_summary_word_counts();

-- Create a view for content that needs AI summaries
CREATE OR REPLACE VIEW public.content_pending_summaries AS
SELECT 
    c.id,
    c.creator_id,
    c.platform,
    c.title,
    c.description,
    c.content_body,
    c.published_at,
    c.word_count,
    c.summary_status,
    cr.display_name as creator_name,
    cr.user_id
FROM public.content c
JOIN public.creators cr ON c.creator_id = cr.id
WHERE c.summary_status = 'pending'
    AND c.processing_status = 'processed'
    AND (c.content_body IS NOT NULL OR c.description IS NOT NULL)
    AND LENGTH(COALESCE(c.content_body, c.description, '')) > 50
ORDER BY c.published_at DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.content_pending_summaries TO authenticated;

-- Add RLS policy for the view
ALTER VIEW public.content_pending_summaries OWNER TO authenticated;

-- Create a function to mark content for re-summarization
CREATE OR REPLACE FUNCTION mark_content_for_resummary(content_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.content
    SET 
        summary_status = 'pending',
        summary_error_message = NULL,
        updated_at = NOW()
    WHERE id = ANY(content_ids)
        AND processing_status = 'processed';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_content_for_resummary(UUID[]) TO authenticated;

-- Add helpful comments
COMMENT ON VIEW public.content_pending_summaries IS 'View of content items that need AI summary generation';
COMMENT ON FUNCTION mark_content_for_resummary(UUID[]) IS 'Marks specified content items for re-summarization';