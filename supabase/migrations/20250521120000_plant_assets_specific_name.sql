ALTER TABLE "plantAssets"
  ADD COLUMN IF NOT EXISTS specific_name text;

UPDATE "plantAssets"
SET specific_name = name
WHERE specific_name IS NULL;
