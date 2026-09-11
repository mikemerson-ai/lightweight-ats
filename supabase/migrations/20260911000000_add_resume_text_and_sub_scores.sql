-- Add resume_text and sub_scores columns to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_text TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sub_scores JSONB DEFAULT '{}'::jsonb;
