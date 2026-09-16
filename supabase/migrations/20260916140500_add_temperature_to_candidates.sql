ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS temperature TEXT CHECK (temperature IN ('hot', 'warm', 'cold')) DEFAULT NULL;
