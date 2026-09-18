-- Migration: 20260918170500_add_reviewing_to_pipeline_stage_check.sql
-- Description: Update candidates_pipeline_stage_check constraint to include 'reviewing' stage

ALTER TABLE candidates 
DROP CONSTRAINT IF EXISTS candidates_pipeline_stage_check;

ALTER TABLE candidates 
ADD CONSTRAINT candidates_pipeline_stage_check 
CHECK (pipeline_stage IN (
  'new_application',
  'reviewing',
  'screening',
  'interview',
  'completing_requirements',
  'offer',
  'background_checks',
  'hired',
  'disqualified'
));
