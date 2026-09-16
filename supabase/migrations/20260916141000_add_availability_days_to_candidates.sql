-- Migration: 20260916141000_add_availability_days_to_candidates.sql
-- Description: Add availability_days column to candidates table

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS availability_days TEXT[] DEFAULT '{}'::text[];
