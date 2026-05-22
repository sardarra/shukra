-- Depreciable plant assets (linked to equipment purchase journal entries).

CREATE TABLE IF NOT EXISTS "plantAssets" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  journal_entry_id text,
  name text NOT NULL,
  account text NOT NULL,
  cost numeric NOT NULL,
  salvage_value numeric NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 5,
  purchase_date date NOT NULL,
  last_depreciated_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, journal_entry_id)
);

ALTER TABLE "plantAssets" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_assets_select_own" ON "plantAssets";
CREATE POLICY "plant_assets_select_own"
  ON "plantAssets"
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "plant_assets_insert_own" ON "plantAssets";
CREATE POLICY "plant_assets_insert_own"
  ON "plantAssets"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "plant_assets_update_own" ON "plantAssets";
CREATE POLICY "plant_assets_update_own"
  ON "plantAssets"
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
