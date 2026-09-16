-- Migration: 20260916140000_enable_rls_all_tables.sql
-- Description: Enable Row Level Security (RLS) and create read/write policies for all public ATS tables to resolve Supabase Security Advisor errors.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'jobs',
    'document_checklists',
    'candidates',
    'scorecard_templates',
    'recruiters',
    'evaluations',
    'activity_logs',
    'candidate_documents',
    'candidate_evaluations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 1. Enable Row Level Security
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', t);
    
    -- 2. Create Read (SELECT) policy if it does not exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = t 
        AND policyname = format('Allow read access to %s', t)
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true);', format('Allow read access to %s', t), t);
    END IF;

    -- 3. Create Write (INSERT, UPDATE, DELETE) policy if it does not exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = t 
        AND policyname = format('Allow write access to %s', t)
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', format('Allow write access to %s', t), t);
    END IF;
  END LOOP;
END $$;
