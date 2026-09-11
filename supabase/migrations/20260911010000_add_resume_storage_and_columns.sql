-- 1. Create storage bucket for resumes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage policies for resumes bucket
-- Allow public viewing/downloading of resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Resumes'
  ) THEN
    CREATE POLICY "Public Access Resumes"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resumes');
  END IF;
END $$;

-- Allow upload of resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Upload Resumes'
  ) THEN
    CREATE POLICY "Allow Upload Resumes"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'resumes');
  END IF;
END $$;

-- Allow update/overwrite of resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Update Resumes'
  ) THEN
    CREATE POLICY "Allow Update Resumes"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'resumes');
  END IF;
END $$;

-- Allow deletion of resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Delete Resumes'
  ) THEN
    CREATE POLICY "Allow Delete Resumes"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'resumes');
  END IF;
END $$;

-- 3. Add resume_url and resume_storage_path to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_storage_path TEXT;
