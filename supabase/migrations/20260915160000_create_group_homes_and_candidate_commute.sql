-- Migration: 20260915160000_create_group_homes_and_candidate_commute.sql
-- Description: Create group_homes table, add commute & shift preference columns to candidates, and seed 15 group homes.

-- 1. Create group_homes table
CREATE TABLE IF NOT EXISTS group_homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Philadelphia',
  state TEXT NOT NULL DEFAULT 'PA',
  zip_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by zip_code and active status
CREATE INDEX IF NOT EXISTS idx_group_homes_zip_code ON group_homes(zip_code);
CREATE INDEX IF NOT EXISTS idx_group_homes_is_active ON group_homes(is_active);

-- Enable RLS
ALTER TABLE group_homes ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and anonymous users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_homes' AND policyname = 'Allow read access to group_homes'
  ) THEN
    CREATE POLICY "Allow read access to group_homes"
    ON group_homes FOR SELECT
    USING (true);
  END IF;
END $$;

-- Allow insert/update/delete for authenticated and anonymous users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_homes' AND policyname = 'Allow write access to group_homes'
  ) THEN
    CREATE POLICY "Allow write access to group_homes"
    ON group_homes FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 2. Update candidates table for commute and shift preferences
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS shift_preferences TEXT[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_candidates_zip_code ON candidates(zip_code);

-- 3. Seed initial 15 group homes (idempotent: skip if location name already exists)
INSERT INTO group_homes (name, address, city, state, zip_code, is_active)
SELECT name, address, city, state, zip_code, is_active
FROM (VALUES
  ('60th St', '1711 North 60th Street', 'Philadelphia', 'PA', '19151', true),
  ('Carrol St', '2526 Carrol St', 'Philadelphia', 'PA', '19142', true),
  ('Muhfeld St', '2607 S Muhfeld St', 'Philadelphia', 'PA', '19142', true),
  ('Wyalusing Ave', '5333 Wyalusing Avenue', 'Philadelphia', 'PA', '19131', true),
  ('Buist Ave', '7533 Buist Ave', 'Philadelphia', 'PA', '19153', true),
  ('Lindbergh Apt 113', '7701 Lindbergh Blvd Apt 113', 'Philadelphia', 'PA', '19153', true),
  ('Lindbergh Apt 1509', '7833 Lindbergh Blvd Apt 1509', 'Philadelphia', 'PA', '19153', true),
  ('Lindbergh Apt 804', '8400 Lindbergh Blvd Apt 804', 'Philadelphia', 'PA', '19153', true),
  ('Apt 1005 Lindbergh', '8402 Madison Pl Apt 1005', 'Philadelphia', 'PA', '19153', true),
  ('Hobart St', '2220 N Hobart St', 'Philadelphia', 'PA', '19131', true),
  ('Ivy Hill Rd', '1000 Ivy Hill Rd', 'Philadelphia', 'PA', '19150', true),
  ('Frankford Ave', '8216 Frankford Ave', 'Philadelphia', 'PA', '19136', true),
  ('Indian Park', '64 Indian Park Rd', 'Levittown', 'PA', '19057', true),
  ('Winder Dr', '806 Winder Dr', 'Bristol', 'PA', '19007', true),
  ('RFC Office', '1700 S 60th St', 'Philadelphia', 'PA', '19142', true)
) AS t(name, address, city, state, zip_code, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM group_homes gh WHERE LOWER(gh.name) = LOWER(t.name)
);
